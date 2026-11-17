"""
Database Repository & Orchestration Layer
-----------------------------------------
Initializes SQLite schema, runs model training & chronological backtesting,
caches predictions in `predictions`, and serves structured responses for all
OpenAPI endpoints.
"""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.model_engine import (
    compute_match_flow_scenarios,
    fit_team_strengths,
    predict_match_distribution,
    run_chronological_backtest,
)
from backend.providers import sync_live_scoreboard_tick, sync_provider_data
from backend.seed_data import SEASON_ID, seed_demo_database


SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def get_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    resolved = db_path or os.environ.get("DATABASE_PATH", "./data/epl_tactical.db")
    Path(resolved).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(resolved, timeout=10.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _migrate_fixtures_table_if_needed(conn: sqlite3.Connection) -> None:
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(fixtures)").fetchall()}
    if not cols:
        return
    needs_rebuild = "live_clock" not in cols or "live_detail" not in cols
    if not needs_rebuild:
        row = conn.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='fixtures'"
        ).fetchone()
        if row and "'LIVE'" not in (row["sql"] or ""):
            needs_rebuild = True
    if needs_rebuild:
        # Clean rebuild of fixtures + stats so updated CHECK constraint ('LIVE') takes effect cleanly
        conn.executescript(
            """
            PRAGMA foreign_keys = OFF;
            DROP TABLE IF EXISTS predictions;
            DROP TABLE IF EXISTS player_availability;
            DROP TABLE IF EXISTS match_team_stats;
            DROP TABLE IF EXISTS fixtures;
            PRAGMA foreign_keys = ON;
            """
        )
        with open(SCHEMA_PATH, "r", encoding="utf-8") as fh:
            conn.executescript(fh.read())


def ensure_initialized(conn: sqlite3.Connection) -> None:
    with open(SCHEMA_PATH, "r", encoding="utf-8") as fh:
        conn.executescript(fh.read())
    _migrate_fixtures_table_if_needed(conn)

    count = conn.execute("SELECT COUNT(*) FROM teams").fetchone()[0]
    fx_count = conn.execute("SELECT COUNT(*) FROM fixtures").fetchone()[0]
    placeholder_players = conn.execute("SELECT COUNT(*) FROM players WHERE name LIKE '%#%'").fetchone()[0]
    mode = os.environ.get("DATA_PROVIDER", "auto").strip().lower()
    latest_sync = conn.execute("SELECT is_demo, provider FROM provider_syncs ORDER BY completed_at DESC LIMIT 1").fetchone()
    should_upgrade_to_live = (
        mode != "demo"
        and (latest_sync is None or bool(latest_sync["is_demo"]) or placeholder_players > 0)
    )

    if count == 0 or fx_count == 0 or should_upgrade_to_live:
        sync_provider_data(conn)
        train_and_cache_predictions(conn)


def _fetch_finished_matches_for_model(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT f.id, f.matchweek, f.kickoff_utc, f.home_team_id, f.away_team_id,
               f.home_goals, f.away_goals,
               sh.xg AS home_xg, sa.xg AS away_xg
        FROM fixtures f
        LEFT JOIN match_team_stats sh ON sh.fixture_id = f.id AND sh.team_id = f.home_team_id
        LEFT JOIN match_team_stats sa ON sa.fixture_id = f.id AND sa.team_id = f.away_team_id
        WHERE f.status = 'FINISHED' AND f.home_goals IS NOT NULL AND f.away_goals IS NOT NULL
        ORDER BY f.matchweek ASC, f.kickoff_utc ASC
        """
    ).fetchall()
    return [dict(r) for r in rows]


def train_and_cache_predictions(conn: sqlite3.Connection) -> Dict[str, Any]:
    team_rows = conn.execute("SELECT id FROM teams").fetchall()
    team_ids = [r["id"] for r in team_rows]
    finished = _fetch_finished_matches_for_model(conn)

    backtest = run_chronological_backtest(finished, team_ids, warmup_matchweek=3, xg_weight=0.55)
    strengths, league_avg, home_adv_log, xg_available = fit_team_strengths(finished, team_ids, xg_weight=0.55)

    now = datetime.now(timezone.utc).isoformat()
    model_id = "poisson-dc-v1.2"
    rho = backtest["best_rho"]

    conn.execute("DELETE FROM predictions WHERE model_version_id = ?", (model_id,))
    conn.execute("DELETE FROM model_versions WHERE id = ?", (model_id,))
    conn.execute(
        """INSERT INTO model_versions (
            id, version_tag, algorithm, dixon_coles_rho, home_advantage, shrinkage_k,
            xg_weight, brier_score, log_loss, baseline_brier, baseline_log_loss,
            calibration_json, sample_matches, trained_at, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            model_id,
            "v1.2-poisson-dc",
            "Sample-Shrunk Poisson + Dixon-Coles Low-Score Correction",
            rho,
            round(home_adv_log, 4),
            6.0,
            0.55 if xg_available else 0.0,
            backtest["brier_score"],
            backtest["log_loss"],
            backtest["baseline_brier"],
            backtest["baseline_log_loss"],
            json.dumps(backtest["calibration_bins"]),
            backtest["sample_matches"],
            now,
            "Walk-forward chronological backtest (no future leakage). Uses goals-based fallback automatically when xG is absent.",
        ),
    )

    all_fixtures = conn.execute("SELECT id, home_team_id, away_team_id FROM fixtures").fetchall()
    for fx in all_fixtures:
        if fx["home_team_id"] not in strengths or fx["away_team_id"] not in strengths:
            continue
        hs = strengths[fx["home_team_id"]]
        aws = strengths[fx["away_team_id"]]
        pred = predict_match_distribution(
            hs, aws, league_avg, home_adv_log, rho=rho, xg_available=xg_available
        )
        conn.execute(
            """INSERT INTO predictions (
                id, fixture_id, model_version_id, home_xg, away_xg,
                prob_home, prob_draw, prob_away, over_2_5_prob, under_2_5_prob,
                top_scorelines_json, score_grid_json, feature_contributions_json,
                uncertainty_json, confidence_label, xg_mode, computed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                f"pred-{fx['id']}",
                fx["id"],
                model_id,
                pred["home_xg"],
                pred["away_xg"],
                pred["prob_home"],
                pred["prob_draw"],
                pred["prob_away"],
                pred["over_2_5_prob"],
                pred["under_2_5_prob"],
                json.dumps(pred["top_scorelines"]),
                json.dumps(pred["score_grid"]),
                json.dumps(pred["feature_contributions"]),
                json.dumps(pred["uncertainty"]),
                pred["confidence_label"],
                pred["xg_mode"],
                now,
            ),
        )
    conn.commit()
    return {"model_version_id": model_id, "backtest": backtest, "xg_available": xg_available}


def get_data_status(conn: sqlite3.Connection) -> Dict[str, Any]:
    sync = conn.execute(
        "SELECT * FROM provider_syncs ORDER BY completed_at DESC LIMIT 1"
    ).fetchone()
    season = conn.execute("SELECT * FROM seasons WHERE is_current = 1 LIMIT 1").fetchone()
    model = conn.execute("SELECT version_tag, trained_at, sample_matches FROM model_versions LIMIT 1").fetchone()
    fixtures_count = conn.execute("SELECT COUNT(*) FROM fixtures").fetchone()[0]
    finished_count = conn.execute("SELECT COUNT(*) FROM fixtures WHERE status = 'FINISHED'").fetchone()[0]
    live_count = conn.execute("SELECT COUNT(*) FROM fixtures WHERE status = 'LIVE'").fetchone()[0]

    sync_dict = dict(sync) if sync else {
        "provider": "Synthetic Demo Dataset (2026-27)",
        "status": "demo",
        "xg_available": 1,
        "is_demo": 1,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "error_message": None,
    }
    is_espn = "ESPN" in (sync_dict.get("provider") or "")
    hint = (
        "Running in explicitly labeled synthetic Demo Mode. Click Refresh to sync live 2026-27 ESPN Premier League fixtures."
        if sync_dict["is_demo"]
        else (
            "Connected to live ESPN 2026-27 EPL API (scores, standings & match stats). Official xG is absent, so Python runs honest goals-based Poisson + Dixon-Coles fallback."
            if is_espn
            else "Connected to live football-data.org v4 feed (goals-based Poisson fallback active)."
        )
    )
    return {
        "season": dict(season) if season else {"id": SEASON_ID, "label": "2026–27 Premier League"},
        "provider": sync_dict["provider"],
        "status": sync_dict["status"],
        "is_demo": bool(sync_dict["is_demo"]),
        "xg_available": bool(sync_dict["xg_available"]),
        "last_synced_at": sync_dict["completed_at"],
        "error_message": sync_dict.get("error_message"),
        "fixtures_total": fixtures_count,
        "fixtures_finished": finished_count,
        "fixtures_live": live_count,
        "model_version": dict(model) if model else None,
        "setup_hint": hint,
    }


def run_live_scoreboard_tick(conn: sqlite3.Connection) -> Dict[str, Any]:
    res = sync_live_scoreboard_tick(conn)
    if res.get("finished_changed"):
        train_and_cache_predictions(conn)
    return res


def get_standings(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    teams = {r["id"]: dict(r) for r in conn.execute("SELECT * FROM teams").fetchall()}
    table: Dict[str, Dict[str, Any]] = {}
    for tid, t in teams.items():
        table[tid] = {
            "team_id": tid,
            "name": t["name"],
            "short_name": t["short_name"],
            "tla": t["tla"],
            "primary_color": t["primary_color"],
            "secondary_color": t["secondary_color"],
            "played": 0,
            "won": 0,
            "drawn": 0,
            "lost": 0,
            "gf": 0,
            "ga": 0,
            "gd": 0,
            "points": 0,
            "xg_for": 0.0,
            "xg_against": 0.0,
            "xg_count": 0,
            "form": [],
        }

    finished = conn.execute(
        """
        SELECT f.*, sh.xg AS h_xg, sa.xg AS a_xg
        FROM fixtures f
        LEFT JOIN match_team_stats sh ON sh.fixture_id = f.id AND sh.team_id = f.home_team_id
        LEFT JOIN match_team_stats sa ON sa.fixture_id = f.id AND sa.team_id = f.away_team_id
        WHERE f.status = 'FINISHED' AND f.home_goals IS NOT NULL AND f.away_goals IS NOT NULL
        ORDER BY f.matchweek ASC, f.kickoff_utc ASC
        """
    ).fetchall()

    for m in finished:
        h = table.get(m["home_team_id"])
        a = table.get(m["away_team_id"])
        if not h or not a:
            continue
        hg, ag = int(m["home_goals"]), int(m["away_goals"])
        h["played"] += 1
        a["played"] += 1
        h["gf"] += hg
        h["ga"] += ag
        a["gf"] += ag
        a["ga"] += hg
        if hg > ag:
            h["won"] += 1
            h["points"] += 3
            h["form"].append("W")
            a["lost"] += 1
            a["form"].append("L")
        elif hg == ag:
            h["drawn"] += 1
            h["points"] += 1
            h["form"].append("D")
            a["drawn"] += 1
            a["points"] += 1
            a["form"].append("D")
        else:
            a["won"] += 1
            a["points"] += 3
            a["form"].append("W")
            h["lost"] += 1
            h["form"].append("L")

        if m["h_xg"] is not None and m["a_xg"] is not None:
            h["xg_for"] += float(m["h_xg"])
            h["xg_against"] += float(m["a_xg"])
            h["xg_count"] += 1
            a["xg_for"] += float(m["a_xg"])
            a["xg_against"] += float(m["h_xg"])
            a["xg_count"] += 1

    rows = []
    for row in table.values():
        row["gd"] = row["gf"] - row["ga"]
        row["form"] = row["form"][-5:]
        row["xg_for"] = round(row["xg_for"], 2) if row["xg_count"] > 0 else None
        row["xg_against"] = round(row["xg_against"], 2) if row["xg_count"] > 0 else None
        rows.append(row)

    rows.sort(key=lambda r: (r["points"], r["gd"], r["gf"]), reverse=True)
    for idx, r in enumerate(rows):
        r["position"] = idx + 1
    return rows


VALID_FIXTURE_STATUSES = {"ALL", "SCHEDULED", "LIVE", "FINISHED", "POSTPONED"}


def list_fixtures(
    conn: sqlite3.Connection,
    status: Optional[str] = None,
    matchweek: Optional[int] = None,
    team_id: Optional[str] = None,
    page: int = 1,
    limit: int = 30,
) -> Dict[str, Any]:
    if page < 1:
        raise ValueError("page must be >= 1")
    if limit < 1 or limit > 150:
        raise ValueError("limit must be between 1 and 150")
    if status is not None and status not in VALID_FIXTURE_STATUSES:
        raise ValueError(f"Invalid fixture status: {status}")
    if matchweek is not None and (matchweek < 1 or matchweek > 38):
        raise ValueError("matchweek must be between 1 and 38")

    clauses = []
    params: List[Any] = []
    if status and status != "ALL":
        clauses.append("f.status = ?")
        params.append(status)
    if matchweek is not None:
        clauses.append("f.matchweek = ?")
        params.append(matchweek)
    if team_id:
        clauses.append("(f.home_team_id = ? OR f.away_team_id = ?)")
        params.extend([team_id, team_id])

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    total = conn.execute(f"SELECT COUNT(*) FROM fixtures f {where_sql}", params).fetchone()[0]
    offset = max(0, (page - 1) * limit)

    rows = conn.execute(
        f"""
        SELECT f.*,
               ht.name AS home_name, ht.short_name AS home_short, ht.tla AS home_tla, ht.primary_color AS home_color, ht.secondary_color AS home_secondary,
               at.name AS away_name, at.short_name AS away_short, at.tla AS away_tla, at.primary_color AS away_color, at.secondary_color AS away_secondary,
               p.home_xg, p.away_xg, p.prob_home, p.prob_draw, p.prob_away, p.over_2_5_prob, p.top_scorelines_json, p.confidence_label, p.xg_mode
        FROM fixtures f
        JOIN teams ht ON ht.id = f.home_team_id
        JOIN teams at ON at.id = f.away_team_id
        LEFT JOIN predictions p ON p.fixture_id = f.id
        {where_sql}
        ORDER BY CASE WHEN f.status = 'LIVE' THEN 0 ELSE 1 END, f.matchweek ASC, f.kickoff_utc ASC
        LIMIT ? OFFSET ?
        """,
        params + [limit, offset],
    ).fetchall()

    items = []
    for r in rows:
        d = dict(r)
        raw_top = d.pop("top_scorelines_json", None)
        d["top_scorelines"] = json.loads(raw_top) if raw_top else []
        items.append(d)

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
    }


def get_team_detail(conn: sqlite3.Connection, team_id: str) -> Optional[Dict[str, Any]]:
    team = conn.execute("SELECT * FROM teams WHERE id = ?", (team_id,)).fetchone()
    if not team:
        return None
    players = [dict(r) for r in conn.execute("SELECT * FROM players WHERE team_id = ? ORDER BY shirt_number ASC", (team_id,)).fetchall()]
    appt = conn.execute(
        """
        SELECT ma.*, m.name AS manager_name, m.nationality, m.preferred_system
        FROM manager_appointments ma
        JOIN managers m ON m.id = ma.manager_id
        WHERE ma.team_id = ? AND ma.is_current = 1
        LIMIT 1
        """,
        (team_id,),
    ).fetchone()
    profile = conn.execute(
        "SELECT * FROM tactical_profiles WHERE team_id = ? ORDER BY valid_from DESC LIMIT 1",
        (team_id,),
    ).fetchone()
    recent_matches = conn.execute(
        """
        SELECT f.*, ht.short_name AS home_short, ht.tla AS home_tla, at.short_name AS away_short, at.tla AS away_tla,
               sh.xg AS home_xg, sa.xg AS away_xg,
               sh.shots AS home_shots, sa.shots AS away_shots,
               sh.shots_on_target AS home_sot, sa.shots_on_target AS away_sot,
               sh.possession_pct AS home_poss, sa.possession_pct AS away_poss
        FROM fixtures f
        JOIN teams ht ON ht.id = f.home_team_id
        JOIN teams at ON at.id = f.away_team_id
        LEFT JOIN match_team_stats sh ON sh.fixture_id = f.id AND sh.team_id = f.home_team_id
        LEFT JOIN match_team_stats sa ON sa.fixture_id = f.id AND sa.team_id = f.away_team_id
        WHERE (f.home_team_id = ? OR f.away_team_id = ?) AND f.status = 'FINISHED'
        ORDER BY f.matchweek DESC LIMIT 5
        """,
        (team_id, team_id),
    ).fetchall()

    return {
        "team": dict(team),
        "players": players,
        "current_appointment": dict(appt) if appt else None,
        "tactical_profile": _hydrate_profile(dict(profile)) if profile else None,
        "recent_matches": [dict(r) for r in recent_matches],
    }


def _hydrate_profile(p: Dict[str, Any]) -> Dict[str, Any]:
    p["source_refs"] = json.loads(p.pop("source_refs_json", "[]"))
    return p


def _hydrate_snapshot(s: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": s["id"],
        "team_id": s["team_id"],
        "manager_id": s["manager_id"],
        "valid_from": s["valid_from"],
        "phase": s["phase"],
        "formation_label": s["formation_label"],
        "players": json.loads(s["players_json"]),
        "edges": json.loads(s["edges_json"]),
        "zones": json.loads(s["zones_json"]),
        "annotations": json.loads(s["annotations_json"]),
        "source_refs": json.loads(s["source_refs_json"]),
        "confidence": s["confidence"],
        "evidence_type": s["evidence_type"],
    }


def list_managers(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT m.*, ma.team_id, ma.valid_from, ma.evidence_type AS appointment_evidence,
               t.name AS team_name, t.short_name AS team_short, t.tla AS team_tla, t.primary_color,
               tp.base_formation, tp.in_possession_shape, tp.out_of_possession_block,
               tp.sample_size_matches, tp.confidence, tp.pressing_intensity_idx, tp.width_idx, tp.tempo_idx, tp.buildup_directness_idx
        FROM managers m
        JOIN manager_appointments ma ON ma.manager_id = m.id AND ma.is_current = 1
        JOIN teams t ON t.id = ma.team_id
        JOIN tactical_profiles tp ON tp.manager_id = m.id AND tp.team_id = ma.team_id
        ORDER BY t.short_name ASC
        """
    ).fetchall()
    return [dict(r) for r in rows]


def get_manager_tactics(conn: sqlite3.Connection, manager_id: str) -> Optional[Dict[str, Any]]:
    mgr = conn.execute("SELECT * FROM managers WHERE id = ?", (manager_id,)).fetchone()
    if not mgr:
        return None
    appt = conn.execute(
        """
        SELECT ma.*, t.name AS team_name, t.short_name AS team_short, t.tla AS team_tla, t.primary_color, t.secondary_color
        FROM manager_appointments ma
        JOIN teams t ON t.id = ma.team_id
        WHERE ma.manager_id = ? AND ma.is_current = 1
        LIMIT 1
        """,
        (manager_id,),
    ).fetchone()
    profile = conn.execute(
        "SELECT * FROM tactical_profiles WHERE manager_id = ? ORDER BY valid_from DESC LIMIT 1",
        (manager_id,),
    ).fetchone()
    snapshots = conn.execute(
        "SELECT * FROM tactical_snapshots WHERE manager_id = ?",
        (manager_id,),
    ).fetchall()
    sources = {
        r["id"]: dict(r)
        for r in conn.execute("SELECT * FROM source_references").fetchall()
    }
    hydrated_profile = _hydrate_profile(dict(profile)) if profile else None
    ref_ids = hydrated_profile["source_refs"] if hydrated_profile else []
    resolved_sources = [sources[rid] for rid in ref_ids if rid in sources]

    return {
        "manager": dict(mgr),
        "appointment": dict(appt) if appt else None,
        "profile": hydrated_profile,
        "snapshots": {s["phase"]: _hydrate_snapshot(dict(s)) for s in snapshots},
        "sources": resolved_sources,
    }


def get_match_prediction_bundle(conn: sqlite3.Connection, fixture_id: str) -> Optional[Dict[str, Any]]:
    fx = conn.execute(
        """
        SELECT f.*,
               ht.name AS home_name, ht.short_name AS home_short, ht.tla AS home_tla, ht.primary_color AS home_color, ht.secondary_color AS home_secondary,
               at.name AS away_name, at.short_name AS away_short, at.tla AS away_tla, at.primary_color AS away_color, at.secondary_color AS away_secondary
        FROM fixtures f
        JOIN teams ht ON ht.id = f.home_team_id
        JOIN teams at ON at.id = f.away_team_id
        WHERE f.id = ?
        """,
        (fixture_id,),
    ).fetchone()
    if not fx:
        return None
    pred_row = conn.execute(
        """
        SELECT p.*, mv.version_tag, mv.algorithm, mv.dixon_coles_rho, mv.brier_score, mv.log_loss
        FROM predictions p
        JOIN model_versions mv ON mv.id = p.model_version_id
        WHERE p.fixture_id = ?
        LIMIT 1
        """,
        (fixture_id,),
    ).fetchone()
    if not pred_row:
        train_and_cache_predictions(conn)
        pred_row = conn.execute(
            """
            SELECT p.*, mv.version_tag, mv.algorithm, mv.dixon_coles_rho, mv.brier_score, mv.log_loss
            FROM predictions p
            JOIN model_versions mv ON mv.id = p.model_version_id
            WHERE p.fixture_id = ?
            LIMIT 1
            """,
            (fixture_id,),
        ).fetchone()

    pred = dict(pred_row)
    pred["top_scorelines"] = json.loads(pred.pop("top_scorelines_json"))
    pred["score_grid"] = json.loads(pred.pop("score_grid_json"))
    pred["feature_contributions"] = json.loads(pred.pop("feature_contributions_json"))
    pred["uncertainty"] = json.loads(pred.pop("uncertainty_json"))

    home_detail = get_team_detail(conn, fx["home_team_id"])
    away_detail = get_team_detail(conn, fx["away_team_id"])
    avail = [
        dict(r)
        for r in conn.execute(
            """
            SELECT pa.*, pl.name AS player_name, pl.short_name AS player_short, pl.shirt_number, pl.position
            FROM player_availability pa
            JOIN players pl ON pl.id = pa.player_id
            WHERE pa.fixture_id = ?
            """,
            (fixture_id,),
        ).fetchall()
    ]

    obs_rows = conn.execute(
        """
        SELECT team_id, is_home, goals, xg, xga, shots, shots_on_target, corners, possession_pct, ppda, stats_provenance
        FROM match_team_stats
        WHERE fixture_id = ?
        """,
        (fixture_id,),
    ).fetchall()
    observed_stats: Dict[str, Any] = {"home": None, "away": None}
    for sr in obs_rows:
        d = dict(sr)
        if d["team_id"] == fx["home_team_id"] or d["is_home"] == 1:
            observed_stats["home"] = d
        elif d["team_id"] == fx["away_team_id"] or d["is_home"] == 0:
            observed_stats["away"] = d

    return {
        "fixture": dict(fx),
        "prediction": pred,
        "home_team": home_detail,
        "away_team": away_detail,
        "availability": avail,
        "observed_stats": observed_stats,
    }


def predict_custom_pair(conn: sqlite3.Connection, home_team_id: str, away_team_id: str) -> Dict[str, Any]:
    if not home_team_id or not away_team_id or home_team_id == away_team_id:
        raise ValueError("Select two distinct valid EPL clubs.")
    home_detail = get_team_detail(conn, home_team_id)
    away_detail = get_team_detail(conn, away_team_id)
    if not home_detail or not away_detail:
        raise ValueError(f"Unknown club ID(s): {home_team_id}, {away_team_id}")

    finished = _fetch_finished_matches_for_model(conn)
    team_ids = [r["id"] for r in conn.execute("SELECT id FROM teams").fetchall()]
    strengths, league_avg, ha_log, xg_avail = fit_team_strengths(finished, team_ids, xg_weight=0.55)
    mv = conn.execute("SELECT * FROM model_versions LIMIT 1").fetchone()
    rho = mv["dixon_coles_rho"] if mv else -0.075

    pred = predict_match_distribution(
        strengths[home_team_id],
        strengths[away_team_id],
        league_avg,
        ha_log,
        rho=rho,
        xg_available=xg_avail,
    )
    return {
        "prediction": {
            **pred,
            "version_tag": mv["version_tag"] if mv else "v1.2-poisson-dc",
            "algorithm": mv["algorithm"] if mv else "Poisson + Dixon-Coles",
        },
        "home_team": home_detail,
        "away_team": away_detail,
    }


def get_match_flow(conn: sqlite3.Connection, fixture_id: str) -> Optional[Dict[str, Any]]:
    bundle = get_match_prediction_bundle(conn, fixture_id)
    if not bundle:
        return None
    flow = compute_match_flow_scenarios(
        home_team=bundle["home_team"]["team"],
        away_team=bundle["away_team"]["team"],
        home_profile=bundle["home_team"]["tactical_profile"],
        away_profile=bundle["away_team"]["tactical_profile"],
        prediction=bundle["prediction"],
    )
    return {
        "fixture": bundle["fixture"],
        "prediction": bundle["prediction"],
        "flow": flow,
    }


def compute_manager_clash(conn: sqlite3.Connection, home_team_id: str, away_team_id: str) -> Dict[str, Any]:
    if not home_team_id or not away_team_id or home_team_id == away_team_id:
        raise ValueError("Select two distinct teams for Manager Clash.")
    h_detail = get_team_detail(conn, home_team_id)
    a_detail = get_team_detail(conn, away_team_id)
    if not h_detail or not a_detail or not h_detail.get("tactical_profile") or not a_detail.get("tactical_profile"):
        raise ValueError(f"Manager tactical profile not found for {home_team_id} vs {away_team_id}.")
    h_prof = h_detail["tactical_profile"]
    a_prof = a_detail["tactical_profile"]

    h_snaps = {
        s["phase"]: _hydrate_snapshot(dict(s))
        for s in conn.execute("SELECT * FROM tactical_snapshots WHERE team_id = ?", (home_team_id,)).fetchall()
    }
    a_snaps = {
        s["phase"]: _hydrate_snapshot(dict(s))
        for s in conn.execute("SELECT * FROM tactical_snapshots WHERE team_id = ?", (away_team_id,)).fetchall()
    }

    # Derive structural mismatch diagnostics grounded in profile parameters
    mismatches = []
    if h_prof["pressing_intensity_idx"] >= 0.72 and a_prof["buildup_directness_idx"] <= 0.50:
        mismatches.append({
            "id": "mm-press-buildup",
            "title": "High Press vs Short Buildup Duel",
            "zone": {"x1": 62, "y1": 22, "x2": 92, "y2": 78},
            "evidence_tag": "Data-supported" if h_prof["confidence"] == "high" else "Tactical hypothesis",
            "summary": f"{h_detail['team']['short_name']}'s high pressing intensity ({h_prof['pressing_intensity_idx']:.2f}) directly tests {a_detail['team']['short_name']}'s short first-phase buildup ({a_prof['in_possession_shape']}).",
        })
    if h_prof["width_idx"] >= 0.78 and "5-3-2" in a_prof["out_of_possession_block"]:
        mismatches.append({
            "id": "mm-wide-overload",
            "title": "Wide Touchline Overload vs Narrow 5-3-2 Screen",
            "zone": {"x1": 58, "y1": 6, "x2": 88, "y2": 26},
            "evidence_tag": "Tactical hypothesis",
            "summary": f"{h_detail['team']['short_name']}'s touchline width ({h_prof['width_idx']:.2f}) forces {a_detail['team']['short_name']}'s wing-backs to jump out, opening half-space pockets.",
        })
    if a_prof["tempo_idx"] >= 0.72 and h_prof["pressing_intensity_idx"] >= 0.74:
        mismatches.append({
            "id": "mm-high-line-trans",
            "title": "High-Line Exposure on Vertical Counter",
            "zone": {"x1": 28, "y1": 20, "x2": 56, "y2": 80},
            "evidence_tag": "Tactical hypothesis",
            "summary": f"{a_detail['team']['short_name']}'s vertical transition tempo ({a_prof['tempo_idx']:.2f}) threatens space behind {h_detail['team']['short_name']}'s rest-defense line.",
        })
    if not mismatches:
        mismatches.append({
            "id": "mm-half-space",
            "title": "Central Half-Space Access Battle",
            "zone": {"x1": 54, "y1": 24, "x2": 78, "y2": 76},
            "evidence_tag": "Tactical hypothesis",
            "summary": f"{h_prof['in_possession_shape']} possession structure attempts to unlock {a_prof['out_of_possession_block']} central spacing.",
        })

    return {
        "home": {"team": h_detail["team"], "appointment": h_detail["current_appointment"], "profile": h_prof, "snapshots": h_snaps},
        "away": {"team": a_detail["team"], "appointment": a_detail["current_appointment"], "profile": a_prof, "snapshots": a_snaps},
        "mismatches": mismatches,
    }


def simulate_what_if(conn: sqlite3.Connection, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Updates tactical diagram coordinates immediately and enforces strict quantitative
    discipline: probabilities are recomputed ONLY when validated inputs (player
    availability or venue reversal) change; purely schematic formation tweaks return
    'tactical_only' with baseline probabilities preserved.
    """
    home_id = payload.get("home_team_id")
    away_id = payload.get("away_team_id")
    if not home_id or not away_id or home_id == away_id:
        raise ValueError("Select two distinct valid EPL clubs for What-If simulation.")

    home_formation = payload.get("home_formation")
    away_formation = payload.get("away_formation")
    from backend.tactical_builder import FORMATION_TEMPLATES
    if home_formation and home_formation not in FORMATION_TEMPLATES:
        raise ValueError(f"Unsupported home formation template: {home_formation}")
    if away_formation and away_formation not in FORMATION_TEMPLATES:
        raise ValueError(f"Unsupported away formation template: {away_formation}")

    raw_unavail = payload.get("unavailable_player_ids", [])
    if not isinstance(raw_unavail, list):
        raise ValueError("unavailable_player_ids must be a list of player IDs.")
    unavailable_player_ids = set(str(pid) for pid in raw_unavail)
    swap_venue = bool(payload.get("swap_venue", False))

    eff_home = away_id if swap_venue else home_id
    eff_away = home_id if swap_venue else away_id

    finished = _fetch_finished_matches_for_model(conn)
    team_ids = [r["id"] for r in conn.execute("SELECT id FROM teams").fetchall()]
    strengths, league_avg, ha_log, xg_avail = fit_team_strengths(finished, team_ids, xg_weight=0.55)
    if home_id not in strengths or away_id not in strengths:
        raise ValueError(f"Unknown club ID(s): {home_id}, {away_id}")

    mv = conn.execute("SELECT dixon_coles_rho FROM model_versions LIMIT 1").fetchone()
    rho = mv["dixon_coles_rho"] if mv else -0.075

    baseline = predict_match_distribution(
        strengths[home_id], strengths[away_id], league_avg, ha_log, rho=rho, xg_available=xg_avail
    )

    # Check validated quantitative overrides (availability / venue swap)
    has_quant_change = swap_venue or len(unavailable_player_ids) > 0
    adj = {"home_att": 0.0, "home_def": 0.0, "away_att": 0.0, "away_def": 0.0}

    if unavailable_player_ids:
        placeholders = ",".join("?" for _ in unavailable_player_ids)
        missing_rows = conn.execute(
            f"SELECT team_id, xg_share, xga_impact FROM players WHERE id IN ({placeholders})",
            list(unavailable_player_ids),
        ).fetchall()
        for row in missing_rows:
            # Conservative shrinkage on missing starter share (replacement bench fills ~55% of output)
            att_drop = -0.45 * float(row["xg_share"])
            def_drop = 0.40 * float(row["xga_impact"])
            if row["team_id"] == eff_home:
                adj["home_att"] += att_drop
                adj["home_def"] += def_drop
            elif row["team_id"] == eff_away:
                adj["away_att"] += att_drop
                adj["away_def"] += def_drop

    if has_quant_change:
        revised = predict_match_distribution(
            strengths[eff_home], strengths[eff_away], league_avg, ha_log,
            rho=rho, xg_available=xg_avail, availability_adj=adj
        )
        rec_status = "validated_model"
        rec_note = "Probabilities recalculated using venue / squad availability impact shares."
    else:
        revised = baseline
        rec_status = "tactical_only"
        rec_note = "Tactical visualization only — insufficient data for revised probabilities"

    # Build updated tactical preview using requested formations
    h_detail = get_team_detail(conn, eff_home)
    a_detail = get_team_detail(conn, eff_away)
    if not h_detail or not a_detail:
        raise ValueError("Unable to load team details for What-If preview.")

    def _build_override_players(players: List[Dict[str, Any]], fmt: Optional[str]) -> List[Dict[str, Any]]:
        tpl = FORMATION_TEMPLATES.get(fmt or "", FORMATION_TEMPLATES["4-3-3"])
        out = []
        for idx, p in enumerate(players[:11]):
            slot = tpl[idx]
            out.append({
                "id": p["id"],
                "name": p["name"],
                "short_name": p["short_name"],
                "shirt_number": p["shirt_number"],
                "role": slot["role"],
                "x": slot["x"],
                "y": slot["y"],
                "status": "UNAVAILABLE" if p["id"] in unavailable_player_ids else "AVAILABLE",
            })
        return out

    return {
        "recalculation_status": rec_status,
        "recalculation_note": rec_note,
        "baseline_prediction": baseline,
        "revised_prediction": revised,
        "home_players": _build_override_players(h_detail["players"], home_formation),
        "away_players": _build_override_players(a_detail["players"], away_formation),
        "effective_home_team": h_detail["team"],
        "effective_away_team": a_detail["team"],
    }


VALID_TACTICAL_PHASES = {
    "base",
    "in_possession",
    "out_of_possession",
    "attack_transition",
    "defensive_transition",
}


def save_tactical_snapshot(conn: sqlite3.Connection, payload: Dict[str, Any]) -> Dict[str, Any]:
    team_id = str(payload.get("team_id") or "")
    manager_id = str(payload.get("manager_id") or "")
    phase = str(payload.get("phase") or "")
    players = payload.get("players")
    formation_label = str(payload.get("formation_label") or "Custom")[:48]
    annotations = payload.get("annotations", [])

    if phase not in VALID_TACTICAL_PHASES:
        raise ValueError(f"Invalid tactical phase: {phase}")
    if not isinstance(players, list) or len(players) != 11:
        raise ValueError("Tactical snapshot must contain exactly 11 player nodes.")
    if not isinstance(annotations, list):
        raise ValueError("annotations must be a list of strings.")

    sanitized_players = []
    for p in players:
        if not isinstance(p, dict) or "id" not in p or "x" not in p or "y" not in p:
            raise ValueError("Each player node must include id, x, and y coordinates.")
        try:
            px = float(p["x"])
            py = float(p["y"])
        except (TypeError, ValueError) as exc:
            raise ValueError("Player coordinates x and y must be numeric.") from exc
        if not (0.0 <= px <= 100.0 and 0.0 <= py <= 100.0):
            raise ValueError("Player coordinates x and y must fall within [0, 100].")
        sanitized_players.append({**p, "x": round(px, 1), "y": round(py, 1)})

    existing = conn.execute(
        "SELECT id FROM tactical_snapshots WHERE team_id = ? AND manager_id = ? AND phase = ?",
        (team_id, manager_id, phase),
    ).fetchone()
    if not existing:
        raise ValueError(f"Tactical snapshot not found for team={team_id}, manager={manager_id}, phase={phase}.")

    conn.execute(
        """
        UPDATE tactical_snapshots
        SET players_json = ?, formation_label = ?, annotations_json = ?, evidence_type = 'Analyst interpretation'
        WHERE team_id = ? AND manager_id = ? AND phase = ?
        """,
        (json.dumps(sanitized_players), formation_label, json.dumps([str(a) for a in annotations]), team_id, manager_id, phase),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM tactical_snapshots WHERE team_id = ? AND manager_id = ? AND phase = ?",
        (team_id, manager_id, phase),
    ).fetchone()
    if not row:
        raise ValueError("Saved tactical snapshot could not be reloaded.")
    return _hydrate_snapshot(dict(row))


def get_methodology(conn: sqlite3.Connection) -> Dict[str, Any]:
    models = [dict(r) for r in conn.execute("SELECT * FROM model_versions ORDER BY trained_at DESC").fetchall()]
    for m in models:
        m["calibration"] = json.loads(m.pop("calibration_json", "[]"))
    sources = [dict(r) for r in conn.execute("SELECT * FROM source_references").fetchall()]
    syncs = [dict(r) for r in conn.execute("SELECT * FROM provider_syncs ORDER BY completed_at DESC LIMIT 5").fetchall()]
    return {
        "models": models,
        "sources": sources,
        "recent_syncs": syncs,
        "reference_inspiration": {
            "repo": "https://github.com/SUYOGRAGHAV556/epl-league-predictor-",
            "reusable_ideas": [
                "Strictly causal chronological matchweek split with warm-up window to prevent data leakage",
                "Walk-forward Brier score, multi-class log loss, and reliability calibration bins",
                "Clear separation of synthetic Demo datasets vs real external feeds",
            ],
            "not_reused_or_adapted": [
                "Local CSV-only joblib pipeline replaced by real-time SQLite/Python RPC engine",
                "Arbitrary heuristic tactical bonuses removed; tactical formations never fabricate numeric probabilities",
            ],
        },
        "limitations": [
            "Poisson + Dixon-Coles models scorelines independently apart from 0-0 / 1-0 / 0-1 / 1-1 correlation; red cards and weather are not modeled unless observed.",
            "When xG/xGA is absent from a connected provider (such as ESPN public eng.1 or football-data.org free tier), the engine falls back to goals-based estimation and lowers confidence.",
            "Free-tier public APIs omit event-level player pass tracking; passing network graphs are only shown when explicitly running in labeled Demo Passing Mode.",
            "Animated 3D passing paths, pressing traps, and match-flow timelines are schematic analyst illustrations, not optical tracking data.",
        ],
    }


def _resolve_formation_choice(requested: Optional[str], fallback: str) -> str:
    from backend.tactical_builder import FORMATION_TEMPLATES
    if requested and requested in FORMATION_TEMPLATES:
        return requested
    for key in FORMATION_TEMPLATES:
        if key in (fallback or ""):
            return key
    return "4-3-3"


def get_team_passing_analysis(
    conn: sqlite3.Connection,
    team_id: str,
    formation: Optional[str] = None,
    include_demo: bool = False,
    fixture_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    from backend.tactical_builder import build_demo_passing_analysis, build_formation_players

    detail = get_team_detail(conn, team_id)
    if not detail:
        return None

    status = get_data_status(conn)
    prof = detail.get("tactical_profile") or {}
    default_fmt = prof.get("base_formation", "4-3-3")
    chosen_fmt = _resolve_formation_choice(formation, default_fmt)

    observed_stats: Optional[Dict[str, Any]] = None
    if fixture_id:
        st_row = conn.execute(
            """SELECT shots, shots_on_target, corners, possession_pct, stats_provenance
               FROM match_team_stats WHERE fixture_id = ? AND team_id = ? LIMIT 1""",
            (fixture_id, team_id),
        ).fetchone()
        if st_row:
            observed_stats = dict(st_row)

    use_demo = bool(status.get("is_demo")) or bool(include_demo)
    if use_demo:
        demo_payload = build_demo_passing_analysis(
            team_id=team_id,
            players=detail["players"],
            formation=chosen_fmt,
            tempo_idx=float(prof.get("tempo_idx") or 0.65),
            directness_idx=float(prof.get("buildup_directness_idx") or 0.52),
        )
        return {
            "team": detail["team"],
            "formation": chosen_fmt,
            "available_formations": ["4-3-3", "4-2-3-1", "3-5-2", "4-4-2", "3-4-2-1"],
            "data_mode": "demo_sample",
            "is_demo_data": True,
            "disclaimer": "Sample Demo Passing Dataset — Illustrative passing connections generated for tactical inspection. Not live match tracking events.",
            "api_limitation_note": None,
            "observed_team_stats": observed_stats,
            "players": demo_payload["players"],
            "links": demo_payload["links"],
            "summary": demo_payload["summary"],
        }

    players_only = build_formation_players(detail["players"], chosen_fmt)
    return {
        "team": detail["team"],
        "formation": chosen_fmt,
        "available_formations": ["4-3-3", "4-2-3-1", "3-5-2", "4-4-2", "3-4-2-1"],
        "data_mode": "unavailable_in_live_feed",
        "is_demo_data": False,
        "disclaimer": None,
        "api_limitation_note": f"Live feed ({status['provider']}) provides scores, standings, and match boxscore totals, but does not include event-level player pass tracking.",
        "observed_team_stats": observed_stats,
        "players": players_only,
        "links": [],
        "summary": None,
    }


def get_match_passing_analysis(
    conn: sqlite3.Connection,
    fixture_id: str,
    team_side: str = "home",
    formation: Optional[str] = None,
    include_demo: bool = False,
) -> Optional[Dict[str, Any]]:
    fx = conn.execute(
        "SELECT id, home_team_id, away_team_id, status, venue FROM fixtures WHERE id = ?",
        (fixture_id,),
    ).fetchone()
    if not fx:
        return None
    if team_side not in ("home", "away"):
        raise ValueError("team side must be 'home' or 'away'")
    target_team_id = fx["home_team_id"] if team_side == "home" else fx["away_team_id"]
    res = get_team_passing_analysis(
        conn,
        team_id=target_team_id,
        formation=formation,
        include_demo=include_demo,
        fixture_id=fixture_id,
    )
    if not res:
        return None
    return {
        "fixture_id": fixture_id,
        "team_side": team_side,
        "home_team_id": fx["home_team_id"],
        "away_team_id": fx["away_team_id"],
        **res,
    }


def _compute_team_split_metrics(conn: sqlite3.Connection, team_id: str) -> Dict[str, Any]:
    rows = conn.execute(
        """
        SELECT f.home_team_id, f.away_team_id, f.home_goals, f.away_goals,
               sh.xg AS home_xg, sa.xg AS away_xg,
               sh.shots AS home_shots, sa.shots AS away_shots,
               sh.possession_pct AS home_poss, sa.possession_pct AS away_poss
        FROM fixtures f
        LEFT JOIN match_team_stats sh ON sh.fixture_id = f.id AND sh.team_id = f.home_team_id
        LEFT JOIN match_team_stats sa ON sa.fixture_id = f.id AND sa.team_id = f.away_team_id
        WHERE f.status = 'FINISHED' AND f.home_goals IS NOT NULL AND f.away_goals IS NOT NULL
          AND (f.home_team_id = ? OR f.away_team_id = ?)
        ORDER BY f.matchweek ASC, f.kickoff_utc ASC
        """,
        (team_id, team_id),
    ).fetchall()

    def _blank() -> Dict[str, Any]:
        return {"played": 0, "won": 0, "drawn": 0, "lost": 0, "gf": 0, "ga": 0, "gd": 0, "points": 0, "clean_sheets": 0, "ppg": 0.0}

    overall = _blank()
    home = _blank()
    away = _blank()
    form: List[str] = []
    xg_for_sum = 0.0
    xg_against_sum = 0.0
    xg_matches = 0
    shots_sum = 0
    shots_matches = 0
    poss_sum = 0.0
    poss_matches = 0

    for r in rows:
        is_home = r["home_team_id"] == team_id
        gf = int(r["home_goals"] if is_home else r["away_goals"])
        ga = int(r["away_goals"] if is_home else r["home_goals"])
        split = home if is_home else away

        for bucket in (overall, split):
            bucket["played"] += 1
            bucket["gf"] += gf
            bucket["ga"] += ga
            if ga == 0:
                bucket["clean_sheets"] += 1
            if gf > ga:
                bucket["won"] += 1
                bucket["points"] += 3
            elif gf == ga:
                bucket["drawn"] += 1
                bucket["points"] += 1
            else:
                bucket["lost"] += 1

        form.append("W" if gf > ga else ("D" if gf == ga else "L"))

        t_xg = r["home_xg"] if is_home else r["away_xg"]
        o_xg = r["away_xg"] if is_home else r["home_xg"]
        if t_xg is not None and o_xg is not None:
            xg_for_sum += float(t_xg)
            xg_against_sum += float(o_xg)
            xg_matches += 1

        t_shots = r["home_shots"] if is_home else r["away_shots"]
        if t_shots is not None:
            shots_sum += int(t_shots)
            shots_matches += 1

        t_poss = r["home_poss"] if is_home else r["away_poss"]
        if t_poss is not None:
            poss_sum += float(t_poss)
            poss_matches += 1

    for bucket in (overall, home, away):
        bucket["gd"] = bucket["gf"] - bucket["ga"]
        bucket["ppg"] = round(bucket["points"] / bucket["played"], 2) if bucket["played"] > 0 else 0.0

    mp = overall["played"]
    return {
        "overall": overall,
        "home": home,
        "away": away,
        "form": form[-5:],
        "goals_for_pg": round(overall["gf"] / mp, 2) if mp > 0 else 0.0,
        "goals_against_pg": round(overall["ga"] / mp, 2) if mp > 0 else 0.0,
        "xg_for_pg": round(xg_for_sum / xg_matches, 2) if xg_matches > 0 else None,
        "xg_against_pg": round(xg_against_sum / xg_matches, 2) if xg_matches > 0 else None,
        "avg_shots_pg": round(shots_sum / shots_matches, 1) if shots_matches > 0 else None,
        "avg_possession_pct": round(poss_sum / poss_matches, 1) if poss_matches > 0 else None,
        "observed_stats_matches": max(shots_matches, poss_matches),
    }


def get_team_comparison(
    conn: sqlite3.Connection, home_team_id: str, away_team_id: str
) -> Dict[str, Any]:
    if not home_team_id or not away_team_id or home_team_id == away_team_id:
        raise ValueError("Select two distinct valid EPL clubs to compare.")
    left = get_team_detail(conn, home_team_id)
    right = get_team_detail(conn, away_team_id)
    if not left or not right:
        raise ValueError(f"Unknown club ID(s): {home_team_id}, {away_team_id}")

    return {
        "left": {
            **left,
            "splits": _compute_team_split_metrics(conn, home_team_id),
        },
        "right": {
            **right,
            "splits": _compute_team_split_metrics(conn, away_team_id),
        },
    }


