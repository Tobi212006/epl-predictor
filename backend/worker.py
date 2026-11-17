"""
Persistent Python RPC Worker for EPL Tactical Intelligence
----------------------------------------------------------
Reads newline-delimited JSON requests from stdin and writes JSON responses to stdout.
Ensures all statistical modeling, backtesting, and SQLite persistence run directly
in Python 3.10.
"""

from __future__ import annotations

import json
import sys
import traceback
from typing import Any, Dict

from backend.providers import sync_provider_data
from backend.repository import (
    compute_manager_clash,
    ensure_initialized,
    get_connection,
    get_data_status,
    get_manager_tactics,
    get_match_flow,
    get_match_passing_analysis,
    get_match_prediction_bundle,
    get_methodology,
    get_standings,
    get_team_comparison,
    get_team_detail,
    get_team_passing_analysis,
    list_fixtures,
    list_managers,
    predict_custom_pair,
    run_live_scoreboard_tick,
    save_tactical_snapshot,
    simulate_what_if,
    train_and_cache_predictions,
)


def handle_action(conn, action: str, params: Dict[str, Any]) -> Any:
    if action == "data_status":
        return get_data_status(conn)
    if action == "data_refresh":
        res = sync_provider_data(conn, force_provider=params.get("provider"))
        train_and_cache_predictions(conn)
        return {"sync": res, "status": get_data_status(conn)}
    if action == "live_tick":
        tick = run_live_scoreboard_tick(conn)
        return {"tick": tick, "status": get_data_status(conn)}
    if action == "standings":
        return {"standings": get_standings(conn), "status": get_data_status(conn)}
    if action == "fixtures":
        return list_fixtures(
            conn,
            status=params.get("status"),
            matchweek=int(params["matchweek"]) if params.get("matchweek") is not None else None,
            team_id=params.get("team_id"),
            page=int(params.get("page", 1)),
            limit=int(params.get("limit", 40)),
        )
    if action == "team_detail":
        res = get_team_detail(conn, params["team_id"])
        if not res:
            raise ValueError(f"Team not found: {params['team_id']}")
        return res
    if action == "team_compare":
        return get_team_comparison(conn, params["home_team_id"], params["away_team_id"])
    if action == "managers_list":
        return {"managers": list_managers(conn)}
    if action == "manager_tactics":
        res = get_manager_tactics(conn, params["manager_id"])
        if not res:
            raise ValueError(f"Manager not found: {params['manager_id']}")
        return res
    if action == "match_prediction":
        res = get_match_prediction_bundle(conn, params["fixture_id"])
        if not res:
            raise ValueError(f"Fixture not found: {params['fixture_id']}")
        return res
    if action == "predict_pair":
        return predict_custom_pair(conn, params["home_team_id"], params["away_team_id"])
    if action == "match_flow":
        res = get_match_flow(conn, params["fixture_id"])
        if not res:
            raise ValueError(f"Fixture not found: {params['fixture_id']}")
        return res
    if action == "match_passing":
        res = get_match_passing_analysis(
            conn,
            fixture_id=params["fixture_id"],
            team_side=params.get("team_side", "home"),
            formation=params.get("formation"),
            include_demo=bool(params.get("include_demo", False)),
        )
        if not res:
            raise ValueError(f"Fixture not found: {params['fixture_id']}")
        return res
    if action == "team_passing":
        res = get_team_passing_analysis(
            conn,
            team_id=params["team_id"],
            formation=params.get("formation"),
            include_demo=bool(params.get("include_demo", False)),
        )
        if not res:
            raise ValueError(f"Team not found: {params['team_id']}")
        return res
    if action == "manager_clash":
        return compute_manager_clash(conn, params["home_team_id"], params["away_team_id"])
    if action == "simulate_what_if":
        return simulate_what_if(conn, params)
    if action == "save_snapshot":
        return save_tactical_snapshot(conn, params)
    if action == "methodology":
        return get_methodology(conn)
    raise ValueError(f"Unknown action: {action}")


def main() -> None:
    conn = get_connection()
    ensure_initialized(conn)

    # Signal readiness
    sys.stdout.write(json.dumps({"ready": True}) + "\n")
    sys.stdout.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        req_id = None
        try:
            req = json.loads(line)
            req_id = req.get("id")
            action = req["action"]
            params = req.get("params") or {}
            data = handle_action(conn, action, params)
            sys.stdout.write(json.dumps({"id": req_id, "ok": True, "data": data}) + "\n")
        except Exception as exc:
            sys.stdout.write(
                json.dumps({
                    "id": req_id,
                    "ok": False,
                    "error": str(exc),
                    "trace": traceback.format_exc(),
                }) + "\n"
            )
        sys.stdout.flush()


if __name__ == "__main__":
    main()
