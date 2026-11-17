"""
Authorized & Real-Time Football Data Provider Adapters
------------------------------------------------------
1. EspnLiveEplAdapter (Zero-Key Real-Time 2026-27 Premier League Feed):
   - Fetches official 2026-27 Premier League clubs & standings from ESPN's public
     site API (`eng.1/standings`), current scoreboard/live clock (`eng.1/scoreboard`),
     and full 380-match fixture schedules (`eng.1/teams/{id}/schedule?season=2026`).
   - Supports live match clock & score updates via `sync_live_scoreboard_tick`.
   - Stores observed shots, shots on target, corners, and possession when present
     on scoreboard events; keeps `xg = NULL` whenever xG is absent so Python
     computes `goals_based_fallback` honestly without ever inventing xG.
2. FootballDataOrgAdapter:
   Connects to https://api.football-data.org/v4/competitions/PL/matches when
   FOOTBALL_DATA_API_KEY is configured.
3. DemoAdapter:
   Explicitly labeled 2026-27 synthetic Demo Mode fallback when offline or forced.
"""

from __future__ import annotations

import json
import os
import sqlite3
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from backend.seed_data import SEASON_ID, seed_demo_database
from backend.tactical_builder import build_team_snapshots


ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1"
ESPN_STANDINGS_URL = "https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings"
USER_AGENT = "EPL-Tactical-Intelligence/1.2 (+https://github.com/epl-tactical-intelligence)"

ESPN_ID_TO_TEAM_ID: Dict[str, str] = {
    "359": "arsenal",
    "364": "liverpool",
    "382": "man-city",
    "363": "chelsea",
    "362": "aston-villa",
    "361": "newcastle",
    "367": "tottenham",
    "331": "brighton",
    "393": "nottm-forest",
    "349": "bournemouth",
    "370": "fulham",
    "337": "brentford",
    "360": "man-united",
    "384": "crystal-palace",
    "368": "everton",
    "357": "leeds",
    "366": "sunderland",
    "306": "hull-city",
    "373": "ipswich",
    "388": "coventry",
}

TEAM_NAME_ALIASES: Dict[str, str] = {
    "Arsenal FC": "arsenal",
    "Arsenal": "arsenal",
    "Liverpool FC": "liverpool",
    "Liverpool": "liverpool",
    "Manchester City FC": "man-city",
    "Manchester City": "man-city",
    "Man City": "man-city",
    "Chelsea FC": "chelsea",
    "Chelsea": "chelsea",
    "Aston Villa FC": "aston-villa",
    "Aston Villa": "aston-villa",
    "Newcastle United FC": "newcastle",
    "Newcastle United": "newcastle",
    "Newcastle": "newcastle",
    "Tottenham Hotspur FC": "tottenham",
    "Tottenham Hotspur": "tottenham",
    "Tottenham": "tottenham",
    "Brighton & Hove Albion FC": "brighton",
    "Brighton & Hove Albion": "brighton",
    "Brighton": "brighton",
    "Nottingham Forest FC": "nottm-forest",
    "Nottingham Forest": "nottm-forest",
    "Nottm Forest": "nottm-forest",
    "AFC Bournemouth": "bournemouth",
    "Bournemouth": "bournemouth",
    "Fulham FC": "fulham",
    "Fulham": "fulham",
    "Brentford FC": "brentford",
    "Brentford": "brentford",
    "Manchester United FC": "man-united",
    "Manchester United": "man-united",
    "Man United": "man-united",
    "Crystal Palace FC": "crystal-palace",
    "Crystal Palace": "crystal-palace",
    "Everton FC": "everton",
    "Everton": "everton",
    "Leeds United FC": "leeds",
    "Leeds United": "leeds",
    "Leeds": "leeds",
    "Sunderland AFC": "sunderland",
    "Sunderland": "sunderland",
    "Hull City AFC": "hull-city",
    "Hull City": "hull-city",
    "Ipswich Town FC": "ipswich",
    "Ipswich Town": "ipswich",
    "Ipswich": "ipswich",
    "Coventry City FC": "coventry",
    "Coventry City": "coventry",
    "Coventry": "coventry",
}


def _map_team_id(name: str, espn_id: Optional[str] = None) -> Optional[str]:
    if espn_id and str(espn_id) in ESPN_ID_TO_TEAM_ID:
        return ESPN_ID_TO_TEAM_ID[str(espn_id)]
    if name in TEAM_NAME_ALIASES:
        return TEAM_NAME_ALIASES[name]
    low = name.lower()
    for alias, tid in TEAM_NAME_ALIASES.items():
        if alias.lower() in low or low in alias.lower():
            return tid
    return None


def _http_get_json(url: str, headers: Optional[Dict[str, str]] = None, timeout: int = 10) -> Dict[str, Any]:
    hdrs = {"Accept": "application/json", "User-Agent": USER_AGENT}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, headers=hdrs)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _parse_espn_score(val: Any) -> Optional[int]:
    if val is None:
        return None
    if isinstance(val, dict):
        v = val.get("value") if val.get("value") is not None else val.get("displayValue")
        if v is None:
            return None
        try:
            return int(float(v))
        except (TypeError, ValueError):
            return None
    try:
        return int(float(val))
    except (TypeError, ValueError):
        return None


def _parse_espn_stats(comp_stats: List[Dict[str, Any]]) -> Dict[str, Optional[float]]:
    out: Dict[str, Optional[float]] = {
        "shots": None,
        "shots_on_target": None,
        "corners": None,
        "possession_pct": None,
    }
    for st in comp_stats or []:
        name = st.get("name")
        val = st.get("displayValue") if st.get("displayValue") is not None else st.get("value")
        try:
            if name == "totalShots":
                out["shots"] = int(float(val))
            elif name == "shotsOnTarget":
                out["shots_on_target"] = int(float(val))
            elif name == "wonCorners":
                out["corners"] = int(float(val))
            elif name == "possessionPct":
                out["possession_pct"] = round(float(val), 1)
        except (TypeError, ValueError):
            continue
    return out


def _parse_espn_summary_boxscore(
    payload: Dict[str, Any], home_team_id: str, away_team_id: str
) -> Tuple[Dict[str, Optional[float]], Dict[str, Optional[float]]]:
    empty = {"shots": None, "shots_on_target": None, "corners": None, "possession_pct": None}
    h_out = dict(empty)
    a_out = dict(empty)
    teams_box = (payload.get("boxscore") or {}).get("teams") or []
    for tb in teams_box:
        t_obj = tb.get("team") or {}
        tid = _map_team_id(t_obj.get("displayName", ""), str(t_obj.get("id", "")))
        parsed = _parse_espn_stats(tb.get("statistics") or [])
        if tid == home_team_id:
            h_out = parsed
        elif tid == away_team_id:
            a_out = parsed
    return h_out, a_out


def _fetch_espn_summary_boxscore(
    eid: str, home_team_id: str, away_team_id: str
) -> Tuple[str, Dict[str, Optional[float]], Dict[str, Optional[float]]]:
    try:
        payload = _http_get_json(f"{ESPN_BASE}/summary?event={eid}", timeout=6)
        h_s, a_s = _parse_espn_summary_boxscore(payload, home_team_id, away_team_id)
        return eid, h_s, a_s
    except Exception:
        empty = {"shots": None, "shots_on_target": None, "corners": None, "possession_pct": None}
        return eid, dict(empty), dict(empty)


def _extract_athlete_stat(athlete: Dict[str, Any], stat_name: str) -> float:
    cats = ((athlete.get("statistics") or {}).get("splits") or {}).get("categories") or []
    for cat in cats:
        for st in cat.get("stats") or []:
            if st.get("name") == stat_name:
                try:
                    return float(st.get("value") or 0.0)
                except (TypeError, ValueError):
                    return 0.0
    return 0.0


def _build_espn_xi_for_team(team_id: str, athletes: List[Dict[str, Any]]) -> Optional[List[Dict[str, Any]]]:
    """
    Selects an 11-player positional core (1 GK, 4 DEF, 3 MID, 3 FWD) from a live
    ESPN team roster sorted by appearances, goals/assists, and saves.
    Returns None if insufficient positional data is available so callers can keep defaults.
    """
    if not athletes:
        return None

    buckets: Dict[str, List[Tuple[float, Dict[str, Any]]]] = {"G": [], "D": [], "M": [], "F": []}
    for ath in athletes:
        pos_abbr = ((ath.get("position") or {}).get("abbreviation") or "").upper()
        if pos_abbr not in buckets:
            continue
        apps = _extract_athlete_stat(ath, "appearances")
        goals = _extract_athlete_stat(ath, "totalGoals")
        assists = _extract_athlete_stat(ath, "goalAssists")
        saves = _extract_athlete_stat(ath, "saves")
        score = apps * 10.0 + goals * 4.0 + assists * 2.5 + saves * 0.5
        buckets[pos_abbr].append((score, ath))

    for k in buckets:
        buckets[k].sort(key=lambda item: item[0], reverse=True)

    # Ensure we can pick 11 players cleanly; fill from remaining pool if any bucket is short
    desired = [("G", 1), ("D", 4), ("M", 3), ("F", 3)]
    chosen: List[Tuple[str, Dict[str, Any]]] = []
    used_ids = set()
    for pos_key, count in desired:
        for _, ath in buckets[pos_key][:count]:
            aid = str(ath.get("id") or ath.get("displayName"))
            used_ids.add(aid)
            chosen.append((pos_key, ath))

    if len(chosen) < 11:
        pool = []
        for pos_key in ("M", "D", "F", "G"):
            for sc, ath in buckets[pos_key]:
                aid = str(ath.get("id") or ath.get("displayName"))
                if aid not in used_ids:
                    pool.append((sc, pos_key, ath))
        pool.sort(key=lambda x: x[0], reverse=True)
        for _, pos_key, ath in pool:
            if len(chosen) >= 11:
                break
            chosen.append((pos_key, ath))

    if len(chosen) < 11:
        return None

    # Place highest-scoring forward in the central striker (ST, idx=9) slot rather than RW (idx=8)
    chosen[8], chosen[9] = chosen[9], chosen[8]

    role_slots = ["GK", "RB", "RCB", "LCB", "LB", "DM", "RCM", "LCM", "RW", "ST", "LW"]
    xg_priors = [0.0, 0.04, 0.03, 0.03, 0.04, 0.05, 0.10, 0.12, 0.16, 0.25, 0.15]
    xga_priors = [0.14, 0.07, 0.12, 0.12, 0.07, 0.11, 0.07, 0.06, 0.03, 0.02, 0.03]

    out: List[Dict[str, Any]] = []
    for idx, (pos_key, ath) in enumerate(chosen[:11]):
        full_name = str(ath.get("displayName") or ath.get("fullName") or f"Player {idx + 1}").strip()
        last_name = str(ath.get("lastName") or "").strip()
        short_name = last_name if last_name else full_name.split()[-1]
        try:
            shirt = int(ath.get("jersey")) if ath.get("jersey") else (idx + 1)
        except (TypeError, ValueError):
            shirt = idx + 1

        goals = _extract_athlete_stat(ath, "totalGoals")
        assists = _extract_athlete_stat(ath, "goalAssists")
        xg_share = xg_priors[idx]
        if idx > 0 and (goals > 0 or assists > 0):
            xg_share = min(0.34, round(xg_priors[idx] * 0.7 + min(0.18, goals * 0.028 + assists * 0.015), 3))

        out.append({
            "id": f"{team_id}-p{idx + 1}",
            "team_id": team_id,
            "name": full_name,
            "short_name": short_name,
            "shirt_number": shirt,
            "position": role_slots[idx],
            "role_code": role_slots[idx],
            "is_key_starter": 1,
            "xg_share": xg_share,
            "xga_impact": xga_priors[idx],
        })
    return out


def _fetch_espn_team_roster(espn_id: str) -> Tuple[str, List[Dict[str, Any]]]:
    for timeout_sec in (8, 12):
        try:
            payload = _http_get_json(f"{ESPN_BASE}/teams/{espn_id}/roster", timeout=timeout_sec)
            athletes = payload.get("athletes") or []
            if athletes:
                return espn_id, athletes
        except Exception:
            continue
    return espn_id, []


def _sync_espn_epl(conn: sqlite3.Connection, started_at: str) -> Dict[str, Any]:
    # 1. Seed base club catalog, rosters, managers, tactical snapshots cleanly first
    existing_teams = conn.execute("SELECT COUNT(*) FROM teams").fetchone()[0]
    if existing_teams == 0 or not conn.execute("SELECT 1 FROM teams WHERE id = 'hull-city'").fetchone():
        seed_demo_database(conn)

    # 2. Fetch live standings + current scoreboard
    standings_payload = _http_get_json(ESPN_STANDINGS_URL, timeout=10)
    entries = standings_payload.get("children", [{}])[0].get("standings", {}).get("entries", [])
    espn_team_ids: List[str] = []
    for entry in entries:
        etid = str(entry.get("team", {}).get("id", ""))
        if etid and etid in ESPN_ID_TO_TEAM_ID:
            espn_team_ids.append(etid)
    if len(espn_team_ids) < 18:
        espn_team_ids = list(ESPN_ID_TO_TEAM_ID.keys())

    scoreboard_payload = _http_get_json(f"{ESPN_BASE}/scoreboard", timeout=10)
    scoreboard_events = {str(ev["id"]): ev for ev in scoreboard_payload.get("events", []) if ev.get("id")}

    # 3. Fetch past & upcoming schedules for all 20 EPL clubs in parallel
    urls: List[str] = []
    for etid in espn_team_ids:
        urls.append(f"{ESPN_BASE}/teams/{etid}/schedule?season=2026")
        urls.append(f"{ESPN_BASE}/teams/{etid}/schedule?season=2026&fixture=true")

    raw_events: Dict[str, Dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=12) as pool:
        for payload in pool.map(lambda u: _http_get_json(u, timeout=10), urls):
            for ev in payload.get("events", []):
                eid = str(ev.get("id", ""))
                if eid:
                    raw_events[eid] = ev

    # Merge scoreboard events (contain live clocks & richer team statistics)
    for eid, ev in scoreboard_events.items():
        raw_events[eid] = ev

    parsed_rows: List[Dict[str, Any]] = []
    for eid, ev in raw_events.items():
        comps = ev.get("competitions") or []
        if not comps:
            continue
        comp = comps[0]
        competitors = comp.get("competitors") or []
        home_comp = next((c for c in competitors if c.get("homeAway") == "home"), None)
        away_comp = next((c for c in competitors if c.get("homeAway") == "away"), None)
        if not home_comp or not away_comp:
            continue

        h_id = _map_team_id(home_comp["team"].get("displayName", ""), str(home_comp["team"].get("id", "")))
        a_id = _map_team_id(away_comp["team"].get("displayName", ""), str(away_comp["team"].get("id", "")))
        if not h_id or not a_id or h_id == a_id:
            continue

        status_obj = comp.get("status") or ev.get("status") or {}
        st_type = status_obj.get("type") or {}
        st_state = st_type.get("state", "pre")
        st_name = st_type.get("name", "")

        if st_state == "post" or st_type.get("completed"):
            status = "FINISHED"
        elif st_state == "in":
            status = "LIVE"
        elif "POSTPONED" in st_name or "CANCELED" in st_name:
            status = "POSTPONED"
        else:
            status = "SCHEDULED"

        hg = _parse_espn_score(home_comp.get("score")) if status in ("FINISHED", "LIVE") else None
        ag = _parse_espn_score(away_comp.get("score")) if status in ("FINISHED", "LIVE") else None
        live_clock = status_obj.get("displayClock") if status == "LIVE" else None
        live_detail = st_type.get("shortDetail") or st_type.get("detail")

        kickoff = ev.get("date") or comp.get("date") or datetime.now(timezone.utc).isoformat()
        venue = (comp.get("venue") or {}).get("fullName") or "Premier League Stadium"

        parsed_rows.append({
            "fid": f"espn-{eid}",
            "eid": eid,
            "kickoff": kickoff,
            "status": status,
            "venue": venue,
            "h_id": h_id,
            "a_id": a_id,
            "hg": hg,
            "ag": ag,
            "live_clock": live_clock,
            "live_detail": live_detail,
            "h_stats": _parse_espn_stats(home_comp.get("statistics", [])),
            "a_stats": _parse_espn_stats(away_comp.get("statistics", [])),
        })

    if not parsed_rows:
        raise ValueError("ESPN public EPL feed returned 0 valid 2026-27 Premier League fixtures.")

    # Assign coherent matchweeks 1..38 chronologically by team appearance count
    parsed_rows.sort(key=lambda r: r["kickoff"])
    team_played_idx: Dict[str, int] = {}
    for row in parsed_rows:
        hmw = team_played_idx.get(row["h_id"], 0) + 1
        amw = team_played_idx.get(row["a_id"], 0) + 1
        mw = min(38, max(hmw, amw))
        team_played_idx[row["h_id"]] = hmw
        team_played_idx[row["a_id"]] = amw
        row["matchweek"] = mw

    # Enrich up to the 40 most recent finished matches with real ESPN boxscore stats (shots, SOT, corners, possession)
    finished_needing_stats = [
        r for r in reversed(parsed_rows)
        if r["status"] == "FINISHED" and r["h_stats"]["shots"] is None
    ][:40]
    if finished_needing_stats:
        row_by_eid = {r["eid"]: r for r in finished_needing_stats}
        with ThreadPoolExecutor(max_workers=12) as pool:
            results = pool.map(
                lambda r: _fetch_espn_summary_boxscore(r["eid"], r["h_id"], r["a_id"]),
                finished_needing_stats,
            )
            for eid, h_s, a_s in results:
                target = row_by_eid.get(eid)
                if target:
                    if h_s.get("shots") is not None:
                        target["h_stats"] = h_s
                    if a_s.get("shots") is not None:
                        target["a_stats"] = a_s

    # 4. Fetch real 2026-27 ESPN rosters for all 20 clubs to replace generic squad placeholders
    rosters_by_team: Dict[str, List[Dict[str, Any]]] = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        for etid, athletes in pool.map(_fetch_espn_team_roster, espn_team_ids):
            tid = ESPN_ID_TO_TEAM_ID.get(etid)
            if tid and athletes:
                xi = _build_espn_xi_for_team(tid, athletes)
                if xi:
                    rosters_by_team[tid] = xi

    now = datetime.now(timezone.utc).isoformat()
    conn.execute("DELETE FROM match_team_stats")
    conn.execute("DELETE FROM player_availability")
    conn.execute("DELETE FROM fixtures")

    for tid, xi in rosters_by_team.items():
        conn.execute("DELETE FROM players WHERE team_id = ?", (tid,))
        for p in xi:
            conn.execute(
                "INSERT INTO players (id, team_id, name, short_name, shirt_number, position, role_code, is_key_starter, xg_share, xga_impact) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (p["id"], p["team_id"], p["name"], p["short_name"], p["shirt_number"], p["position"], p["role_code"], p["is_key_starter"], p["xg_share"], p["xga_impact"]),
            )
        prof_row = conn.execute(
            "SELECT * FROM tactical_profiles WHERE team_id = ? ORDER BY valid_from DESC LIMIT 1",
            (tid,),
        ).fetchone()
        if prof_row:
            prof = dict(prof_row)
            src_refs = json.loads(prof.get("source_refs_json") or "[]")
            snapshots = build_team_snapshots(
                team_id=tid,
                manager_id=prof["manager_id"],
                valid_from=prof["valid_from"],
                players=xi,
                profile=prof,
                source_refs=src_refs,
            )
            for snap in snapshots:
                conn.execute(
                    """UPDATE tactical_snapshots
                    SET players_json = ?, edges_json = ?, zones_json = ?
                    WHERE team_id = ? AND manager_id = ? AND phase = ? AND evidence_type != 'Analyst interpretation'""",
                    (
                        json.dumps(snap["players"]),
                        json.dumps(snap["edges"]),
                        json.dumps(snap["zones"]),
                        tid,
                        prof["manager_id"],
                        snap["phase"],
                    ),
                )

    # Add real source reference
    conn.execute(
        """INSERT OR REPLACE INTO source_references
        (id, title, publisher, url, published_at, retrieved_at, evidence_type, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            "src-espn-live-2627",
            "2026–27 English Premier League Live Fixtures, Scores & Matchday Telemetry",
            "ESPN Public Soccer Scoreboard & Standings API (eng.1)",
            "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard",
            now[:10],
            now,
            "Observed",
            "Real-time 2026-27 fixtures, results, and scoreboard match statistics. Expected goals (xG) is absent from this feed and stored as NULL.",
        ),
    )

    synced = 0
    for row in parsed_rows:
        conn.execute(
            """INSERT INTO fixtures
            (id, season_id, matchweek, kickoff_utc, status, venue, home_team_id, away_team_id,
             home_goals, away_goals, live_clock, live_detail, is_demo, provider, retrieved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                row["fid"], SEASON_ID, row["matchweek"], row["kickoff"], row["status"],
                row["venue"], row["h_id"], row["a_id"], row["hg"], row["ag"],
                row["live_clock"], row["live_detail"], 0, "ESPN Live EPL API (eng.1)", now,
            ),
        )
        if row["status"] == "FINISHED" and row["hg"] is not None and row["ag"] is not None:
            hs = row["h_stats"]
            aws = row["a_stats"]
            conn.execute(
                """INSERT INTO match_team_stats
                (id, fixture_id, team_id, is_home, goals, xg, xga, shots, shots_on_target, corners, possession_pct, ppda, xg_source, stats_provenance)
                VALUES (?, ?, ?, 1, ?, NULL, NULL, ?, ?, ?, ?, NULL, NULL, ?)""",
                (
                    f"st-{row['fid']}-h", row["fid"], row["h_id"], row["hg"],
                    hs["shots"], hs["shots_on_target"], hs["corners"], hs["possession_pct"],
                    "ESPN Live EPL API (xG unavailable -> goals fallback)",
                ),
            )
            conn.execute(
                """INSERT INTO match_team_stats
                (id, fixture_id, team_id, is_home, goals, xg, xga, shots, shots_on_target, corners, possession_pct, ppda, xg_source, stats_provenance)
                VALUES (?, ?, ?, 0, ?, NULL, NULL, ?, ?, ?, ?, NULL, NULL, ?)""",
                (
                    f"st-{row['fid']}-a", row["fid"], row["a_id"], row["ag"],
                    aws["shots"], aws["shots_on_target"], aws["corners"], aws["possession_pct"],
                    "ESPN Live EPL API (xG unavailable -> goals fallback)",
                ),
            )
        synced += 1

    conn.execute(
        """INSERT INTO provider_syncs
        (id, provider, season_id, status, records_synced, xg_available, error_message, started_at, completed_at, is_demo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (f"sync-espn-{int(datetime.now().timestamp())}", "ESPN Live EPL API (eng.1)", SEASON_ID, "fresh", synced, 0, None, started_at, now, 0),
    )
    conn.commit()
    return {
        "status": "fresh",
        "provider": "ESPN Live EPL API (eng.1)",
        "xg_available": False,
        "records_synced": synced,
        "is_demo": False,
        "completed_at": now,
    }


def sync_live_scoreboard_tick(conn: sqlite3.Connection) -> Dict[str, Any]:
    """
    Lightweight <500ms live scoreboard tick that updates scores, live minute clock,
    and finished status for active matchweek fixtures without re-syncing 380 schedules.
    """
    payload = _http_get_json(f"{ESPN_BASE}/scoreboard", timeout=6)
    now = datetime.now(timezone.utc).isoformat()
    updated = 0
    finished_changed = False

    for ev in payload.get("events", []):
        eid = str(ev.get("id", ""))
        if not eid:
            continue
        fid = f"espn-{eid}"
        existing = conn.execute("SELECT status FROM fixtures WHERE id = ?", (fid,)).fetchone()
        if not existing:
            continue
        comp = (ev.get("competitions") or [{}])[0]
        competitors = comp.get("competitors") or []
        home_comp = next((c for c in competitors if c.get("homeAway") == "home"), None)
        away_comp = next((c for c in competitors if c.get("homeAway") == "away"), None)
        if not home_comp or not away_comp:
            continue

        status_obj = comp.get("status") or ev.get("status") or {}
        st_type = status_obj.get("type") or {}
        st_state = st_type.get("state", "pre")
        if st_state == "post" or st_type.get("completed"):
            new_status = "FINISHED"
        elif st_state == "in":
            new_status = "LIVE"
        else:
            new_status = "SCHEDULED"

        hg = _parse_espn_score(home_comp.get("score")) if new_status in ("FINISHED", "LIVE") else None
        ag = _parse_espn_score(away_comp.get("score")) if new_status in ("FINISHED", "LIVE") else None
        live_clock = status_obj.get("displayClock") if new_status == "LIVE" else None
        live_detail = st_type.get("shortDetail") or st_type.get("detail")

        if existing["status"] != "FINISHED" and new_status == "FINISHED":
            finished_changed = True

        conn.execute(
            """UPDATE fixtures
            SET status = ?, home_goals = ?, away_goals = ?, live_clock = ?, live_detail = ?, retrieved_at = ?
            WHERE id = ?""",
            (new_status, hg, ag, live_clock, live_detail, now, fid),
        )
        updated += 1

    conn.commit()
    return {"updated": updated, "finished_changed": finished_changed, "checked_at": now}


def sync_provider_data(conn: sqlite3.Connection, force_provider: Optional[str] = None) -> Dict[str, Any]:
    """
    Synchronizes fixture & result data according to DATA_PROVIDER and credentials.
    In `auto` mode:
      - Uses football-data.org v4 if FOOTBALL_DATA_API_KEY is configured.
      - Otherwise connects directly to ESPN Live EPL API (2026-27 public feed).
      - Falls back transparently to labeled Demo Mode only if network fails or 'demo' forced.
    """
    started_at = datetime.now(timezone.utc).isoformat()
    api_key = os.environ.get("FOOTBALL_DATA_API_KEY", "").strip()
    mode = (force_provider or os.environ.get("DATA_PROVIDER", "auto")).strip().lower()

    if mode == "auto":
        mode = "football-data" if api_key else "espn"

    if mode == "espn":
        try:
            return _sync_espn_epl(conn, started_at)
        except Exception as exc:
            now = datetime.now(timezone.utc).isoformat()
            existing = conn.execute("SELECT COUNT(*) FROM fixtures").fetchone()[0]
            if existing == 0:
                seed_demo_database(conn)
            conn.execute(
                """INSERT INTO provider_syncs
                (id, provider, season_id, status, records_synced, xg_available, error_message, started_at, completed_at, is_demo)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    f"sync-espn-err-{int(datetime.now().timestamp())}",
                    "ESPN Live EPL API (eng.1)",
                    SEASON_ID,
                    "error" if existing > 0 else "demo",
                    0,
                    1 if existing == 0 else 0,
                    f"ESPN live sync unavailable ({exc}); using fallback dataset.",
                    started_at,
                    now,
                    1 if existing == 0 else 0,
                ),
            )
            conn.commit()
            return {"status": "demo" if existing == 0 else "error", "provider": "ESPN Live EPL API (eng.1)", "error": str(exc), "is_demo": existing == 0}

    if mode == "football-data":
        if not api_key:
            seed_demo_database(conn)
            now = datetime.now(timezone.utc).isoformat()
            conn.execute(
                """INSERT INTO provider_syncs
                (id, provider, season_id, status, records_synced, xg_available, error_message, started_at, completed_at, is_demo)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    f"sync-{int(datetime.now().timestamp())}",
                    "Synthetic Demo Dataset (2026-27)",
                    SEASON_ID,
                    "demo",
                    150,
                    1,
                    "FOOTBALL_DATA_API_KEY is not configured; using labeled Demo Mode.",
                    started_at,
                    now,
                    1,
                ),
            )
            conn.commit()
            return {"status": "demo", "provider": "Synthetic Demo Dataset (2026-27)", "xg_available": True, "is_demo": True}

        try:
            payload = _http_get_json(
                "https://api.football-data.org/v4/competitions/PL/matches?season=2026",
                headers={"X-Auth-Token": api_key},
                timeout=12,
            )
            matches = payload.get("matches", [])
            if not matches:
                raise ValueError("football-data.org returned 0 matches for PL season 2026.")

            existing_teams = conn.execute("SELECT COUNT(*) FROM teams").fetchone()[0]
            if existing_teams == 0:
                seed_demo_database(conn)

            now = datetime.now(timezone.utc).isoformat()
            conn.execute("DELETE FROM match_team_stats")
            conn.execute("DELETE FROM fixtures")

            synced = 0
            for m in matches:
                h_id = _map_team_id(m["homeTeam"]["name"])
                a_id = _map_team_id(m["awayTeam"]["name"])
                if not h_id or not a_id:
                    continue
                fid = f"fd-{m['id']}"
                st = "FINISHED" if m["status"] == "FINISHED" else ("LIVE" if m["status"] in ("IN_PLAY", "PAUSED") else ("POSTPONED" if m["status"] == "POSTPONED" else "SCHEDULED"))
                ft = m.get("score", {}).get("fullTime", {})
                hg = ft.get("home") if st in ("FINISHED", "LIVE") else None
                ag = ft.get("away") if st in ("FINISHED", "LIVE") else None
                mw = int(m.get("matchday") or 1)
                venue = m.get("venue") or "Premier League Stadium"

                conn.execute(
                    """INSERT INTO fixtures
                    (id, season_id, matchweek, kickoff_utc, status, venue, home_team_id, away_team_id, home_goals, away_goals, is_demo, provider, retrieved_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (fid, SEASON_ID, mw, m["utcDate"], st, venue, h_id, a_id, hg, ag, 0, "football-data.org v4", now),
                )
                if st == "FINISHED" and hg is not None and ag is not None:
                    conn.execute(
                        """INSERT INTO match_team_stats
                        (id, fixture_id, team_id, is_home, goals, xg, xga, shots, shots_on_target, corners, possession_pct, ppda, xg_source, stats_provenance)
                        VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?)""",
                        (f"st-{fid}-h", fid, h_id, 1, hg, "football-data.org v4 (Goals only; xG unavailable)"),
                    )
                    conn.execute(
                        """INSERT INTO match_team_stats
                        (id, fixture_id, team_id, is_home, goals, xg, xga, shots, shots_on_target, corners, possession_pct, ppda, xg_source, stats_provenance)
                        VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?)""",
                        (f"st-{fid}-a", fid, a_id, 0, ag, "football-data.org v4 (Goals only; xG unavailable)"),
                    )
                synced += 1

            conn.execute(
                """INSERT INTO provider_syncs
                (id, provider, season_id, status, records_synced, xg_available, error_message, started_at, completed_at, is_demo)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (f"sync-{int(datetime.now().timestamp())}", "football-data.org v4", SEASON_ID, "fresh", synced, 0, None, started_at, now, 0),
            )
            conn.commit()
            return {"status": "fresh", "provider": "football-data.org v4", "xg_available": False, "records_synced": synced, "is_demo": False}

        except Exception as exc:
            now = datetime.now(timezone.utc).isoformat()
            existing = conn.execute("SELECT COUNT(*) FROM fixtures").fetchone()[0]
            if existing == 0:
                seed_demo_database(conn)
            conn.execute(
                """INSERT INTO provider_syncs
                (id, provider, season_id, status, records_synced, xg_available, error_message, started_at, completed_at, is_demo)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (f"sync-err-{int(datetime.now().timestamp())}", "football-data.org v4", SEASON_ID, "error", 0, 0, str(exc), started_at, now, 1 if existing == 0 else 0),
            )
            conn.commit()
            return {"status": "error", "provider": "football-data.org v4", "error": str(exc), "is_demo": existing == 0}

    # Explicit Demo Mode
    seed_demo_database(conn)
    now = datetime.now(timezone.utc).isoformat()
    return {"status": "demo", "provider": "Synthetic Demo Dataset (2026-27)", "xg_available": True, "is_demo": True, "completed_at": now}
