"""
Optional Standalone FastAPI Entrypoint (for Docker Compose / Python deployments)
---------------------------------------------------------------------------------
Exposes the exact same OpenAPI v1 contract directly via FastAPI & Pydantic.
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel

from backend.providers import sync_provider_data
from backend.repository import (
    compute_manager_clash,
    ensure_initialized,
    get_connection,
    get_data_status,
    get_manager_tactics,
    get_match_flow,
    get_match_prediction_bundle,
    get_methodology,
    get_standings,
    get_team_detail,
    list_fixtures,
    list_managers,
    predict_custom_pair,
    save_tactical_snapshot,
    simulate_what_if,
    train_and_cache_predictions,
)

app = FastAPI(title="EPL Tactical Intelligence API", version="1.2.0")
_conn = get_connection()
ensure_initialized(_conn)


def verify_admin(authorization: Optional[str] = Header(default=None)) -> None:
    token = os.environ.get("ADMIN_API_TOKEN", "").strip()
    if token and authorization != f"Bearer {token}":
        raise HTTPException(status_code=401, detail="Invalid admin token")


class PairRequest(BaseModel):
    home_team_id: str
    away_team_id: str


class WhatIfRequest(BaseModel):
    home_team_id: str
    away_team_id: str
    home_formation: Optional[str] = None
    away_formation: Optional[str] = None
    unavailable_player_ids: List[str] = []
    swap_venue: bool = False


class SnapshotSaveRequest(BaseModel):
    team_id: str
    manager_id: str
    phase: str
    formation_label: str
    players: List[Dict[str, Any]]
    annotations: List[str] = []


@app.get("/api/v1/data/status")
def data_status():
    return get_data_status(_conn)


@app.post("/api/v1/data/refresh", dependencies=[Depends(verify_admin)])
def refresh_data(provider: Optional[str] = None):
    res = sync_provider_data(_conn, force_provider=provider)
    train_and_cache_predictions(_conn)
    return {"sync": res, "status": get_data_status(_conn)}


@app.get("/api/v1/standings")
def standings():
    return {"standings": get_standings(_conn), "status": get_data_status(_conn)}


@app.get("/api/v1/fixtures")
def fixtures(status: Optional[str] = None, matchweek: Optional[int] = None, team_id: Optional[str] = None, page: int = 1, limit: int = 50):
    return list_fixtures(_conn, status=status, matchweek=matchweek, team_id=team_id, page=page, limit=limit)


@app.get("/api/v1/teams/{team_id}")
def team_detail(team_id: str):
    res = get_team_detail(_conn, team_id)
    if not res:
        raise HTTPException(status_code=404, detail="Team not found")
    return res


@app.get("/api/v1/managers")
def managers():
    return {"managers": list_managers(_conn)}


@app.get("/api/v1/managers/clash")
def manager_clash(home: str = "arsenal", away: str = "liverpool"):
    return compute_manager_clash(_conn, home, away)


@app.get("/api/v1/managers/{manager_id}/tactics")
def manager_tactics(manager_id: str):
    res = get_manager_tactics(_conn, manager_id)
    if not res:
        raise HTTPException(status_code=404, detail="Manager not found")
    return res


@app.get("/api/v1/matches/{fixture_id}/prediction")
def match_prediction(fixture_id: str):
    res = get_match_prediction_bundle(_conn, fixture_id)
    if not res:
        raise HTTPException(status_code=404, detail="Fixture not found")
    return res


@app.post("/api/v1/matches/predict-pair")
def predict_pair(req: PairRequest):
    return predict_custom_pair(_conn, req.home_team_id, req.away_team_id)


@app.get("/api/v1/matches/{fixture_id}/flow")
def match_flow(fixture_id: str):
    res = get_match_flow(_conn, fixture_id)
    if not res:
        raise HTTPException(status_code=404, detail="Fixture not found")
    return res


@app.post("/api/v1/scenarios/simulate")
def scenarios_simulate(req: WhatIfRequest):
    return simulate_what_if(_conn, req.model_dump())


@app.post("/api/v1/tactics/snapshots", dependencies=[Depends(verify_admin)])
def save_snapshot(req: SnapshotSaveRequest):
    return save_tactical_snapshot(_conn, req.model_dump())


@app.get("/api/v1/methodology")
def methodology():
    return get_methodology(_conn)
