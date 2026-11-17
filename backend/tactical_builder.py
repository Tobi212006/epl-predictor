"""
Canonical Tactical Snapshot Generator & Coordinate Engine
---------------------------------------------------------
Generates renderer-independent TacticalSnapshot objects with canonical pitch
coordinates x, y in [0, 100]:
  - x = 0: team's own goal line; x = 100: opponent's goal line
  - y = 0: top touchline (left wing when attacking +x); y = 100: bottom touchline (right wing)
Preserves stable player IDs across all 5 tactical phases:
  base | in_possession | out_of_possession | attack_transition | defensive_transition
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


# Base formation templates in canonical [0, 100] attacking-right coordinates
FORMATION_TEMPLATES: Dict[str, List[Dict[str, Any]]] = {
    "4-3-3": [
        {"slot": 0, "role": "GK", "x": 6.0, "y": 50.0},
        {"slot": 1, "role": "RB", "x": 24.0, "y": 82.0},
        {"slot": 2, "role": "RCB", "x": 21.0, "y": 62.0},
        {"slot": 3, "role": "LCB", "x": 21.0, "y": 38.0},
        {"slot": 4, "role": "LB", "x": 24.0, "y": 18.0},
        {"slot": 5, "role": "DM", "x": 38.0, "y": 50.0},
        {"slot": 6, "role": "RCM", "x": 49.0, "y": 67.0},
        {"slot": 7, "role": "LCM", "x": 49.0, "y": 33.0},
        {"slot": 8, "role": "RW", "x": 69.0, "y": 82.0},
        {"slot": 9, "role": "ST", "x": 76.0, "y": 50.0},
        {"slot": 10, "role": "LW", "x": 69.0, "y": 18.0},
    ],
    "4-2-3-1": [
        {"slot": 0, "role": "GK", "x": 6.0, "y": 50.0},
        {"slot": 1, "role": "RB", "x": 24.0, "y": 82.0},
        {"slot": 2, "role": "RCB", "x": 21.0, "y": 62.0},
        {"slot": 3, "role": "LCB", "x": 21.0, "y": 38.0},
        {"slot": 4, "role": "LB", "x": 24.0, "y": 18.0},
        {"slot": 5, "role": "RDM", "x": 39.0, "y": 61.0},
        {"slot": 6, "role": "LDM", "x": 39.0, "y": 39.0},
        {"slot": 7, "role": "CAM", "x": 57.0, "y": 50.0},
        {"slot": 8, "role": "RW", "x": 67.0, "y": 81.0},
        {"slot": 9, "role": "ST", "x": 77.0, "y": 50.0},
        {"slot": 10, "role": "LW", "x": 67.0, "y": 19.0},
    ],
    "3-4-2-1": [
        {"slot": 0, "role": "GK", "x": 6.0, "y": 50.0},
        {"slot": 1, "role": "RWB", "x": 42.0, "y": 86.0},
        {"slot": 2, "role": "RCB", "x": 22.0, "y": 72.0},
        {"slot": 3, "role": "CCB", "x": 19.0, "y": 50.0},
        {"slot": 4, "role": "LCB", "x": 22.0, "y": 28.0},
        {"slot": 5, "role": "LWB", "x": 42.0, "y": 14.0},
        {"slot": 6, "role": "RCM", "x": 44.0, "y": 60.0},
        {"slot": 7, "role": "LCM", "x": 44.0, "y": 40.0},
        {"slot": 8, "role": "RAM", "x": 63.0, "y": 66.0},
        {"slot": 9, "role": "ST", "x": 76.0, "y": 50.0},
        {"slot": 10, "role": "LAM", "x": 63.0, "y": 34.0},
    ],
    "3-2-5": [
        {"slot": 0, "role": "GK", "x": 12.0, "y": 50.0},
        {"slot": 1, "role": "INV-RB", "x": 44.0, "y": 62.0},
        {"slot": 2, "role": "RCB", "x": 32.0, "y": 72.0},
        {"slot": 3, "role": "LCB", "x": 30.0, "y": 50.0},
        {"slot": 4, "role": "LB-CB", "x": 32.0, "y": 28.0},
        {"slot": 5, "role": "DM", "x": 46.0, "y": 40.0},
        {"slot": 6, "role": "R-HS", "x": 68.0, "y": 68.0},
        {"slot": 7, "role": "L-HS", "x": 68.0, "y": 32.0},
        {"slot": 8, "role": "RW", "x": 74.0, "y": 89.0},
        {"slot": 9, "role": "ST", "x": 82.0, "y": 50.0},
        {"slot": 10, "role": "LW", "x": 74.0, "y": 11.0},
    ],
    "4-4-2": [
        {"slot": 0, "role": "GK", "x": 5.0, "y": 50.0},
        {"slot": 1, "role": "RB", "x": 21.0, "y": 80.0},
        {"slot": 2, "role": "RCB", "x": 19.0, "y": 60.0},
        {"slot": 3, "role": "LCB", "x": 19.0, "y": 40.0},
        {"slot": 4, "role": "LB", "x": 21.0, "y": 20.0},
        {"slot": 5, "role": "RM", "x": 37.0, "y": 78.0},
        {"slot": 6, "role": "RCM", "x": 36.0, "y": 58.0},
        {"slot": 7, "role": "LCM", "x": 36.0, "y": 42.0},
        {"slot": 8, "role": "LM", "x": 37.0, "y": 22.0},
        {"slot": 9, "role": "ST", "x": 54.0, "y": 58.0},
        {"slot": 10, "role": "SS", "x": 54.0, "y": 42.0},
    ],
    "4-1-4-1": [
        {"slot": 0, "role": "GK", "x": 5.5, "y": 50.0},
        {"slot": 1, "role": "RB", "x": 22.0, "y": 80.0},
        {"slot": 2, "role": "RCB", "x": 20.0, "y": 60.0},
        {"slot": 3, "role": "LCB", "x": 20.0, "y": 40.0},
        {"slot": 4, "role": "LB", "x": 22.0, "y": 20.0},
        {"slot": 5, "role": "DM", "x": 31.0, "y": 50.0},
        {"slot": 6, "role": "RM", "x": 43.0, "y": 80.0},
        {"slot": 7, "role": "RCM", "x": 42.0, "y": 60.0},
        {"slot": 8, "role": "LCM", "x": 42.0, "y": 40.0},
        {"slot": 9, "role": "LM", "x": 43.0, "y": 20.0},
        {"slot": 10, "role": "ST", "x": 58.0, "y": 50.0},
    ],
    "5-3-2": [
        {"slot": 0, "role": "GK", "x": 5.0, "y": 50.0},
        {"slot": 1, "role": "RWB", "x": 24.0, "y": 85.0},
        {"slot": 2, "role": "RCB", "x": 19.0, "y": 68.0},
        {"slot": 3, "role": "CCB", "x": 18.0, "y": 50.0},
        {"slot": 4, "role": "LCB", "x": 19.0, "y": 32.0},
        {"slot": 5, "role": "LWB", "x": 24.0, "y": 15.0},
        {"slot": 6, "role": "RCM", "x": 36.0, "y": 64.0},
        {"slot": 7, "role": "CDM", "x": 34.0, "y": 50.0},
        {"slot": 8, "role": "LCM", "x": 36.0, "y": 36.0},
        {"slot": 9, "role": "ST", "x": 53.0, "y": 57.0},
        {"slot": 10, "role": "ST", "x": 53.0, "y": 43.0},
    ],
    "3-5-2": [
        {"slot": 0, "role": "GK", "x": 6.0, "y": 50.0},
        {"slot": 1, "role": "RWB", "x": 43.0, "y": 86.0},
        {"slot": 2, "role": "RCB", "x": 21.0, "y": 71.0},
        {"slot": 3, "role": "CCB", "x": 19.0, "y": 50.0},
        {"slot": 4, "role": "LCB", "x": 21.0, "y": 29.0},
        {"slot": 5, "role": "LWB", "x": 43.0, "y": 14.0},
        {"slot": 6, "role": "CDM", "x": 37.0, "y": 50.0},
        {"slot": 7, "role": "RCM", "x": 50.0, "y": 66.0},
        {"slot": 8, "role": "LCM", "x": 50.0, "y": 34.0},
        {"slot": 9, "role": "RST", "x": 74.0, "y": 60.0},
        {"slot": 10, "role": "LST", "x": 74.0, "y": 40.0},
    ],
}


def _resolve_template(shape_label: str, fallback: str = "4-3-3") -> List[Dict[str, Any]]:
    for key in FORMATION_TEMPLATES:
        if key in shape_label:
            return FORMATION_TEMPLATES[key]
    return FORMATION_TEMPLATES[fallback]


def build_team_snapshots(
    team_id: str,
    manager_id: str,
    valid_from: str,
    players: List[Dict[str, Any]],
    profile: Dict[str, Any],
    source_refs: List[str],
) -> List[Dict[str, Any]]:
    """
    Produces 5 canonical TacticalSnapshots for a team+manager pair preserving exact
    player IDs across all phases.
    """
    ordered_players = players[:11]
    base_tpl = _resolve_template(profile["base_formation"], "4-3-3")
    att_tpl = _resolve_template(profile["in_possession_shape"], "3-2-5")
    def_tpl = _resolve_template(profile["out_of_possession_block"], "4-4-2")

    press_offset = (profile["pressing_intensity_idx"] - 0.5) * 14.0
    width_scale = 0.88 + profile["width_idx"] * 0.24

    def _map_players(
        tpl: List[Dict[str, Any]],
        x_shift: float = 0.0,
        y_spread: float = 1.0,
        phase_role_hint: str = "",
    ) -> List[Dict[str, Any]]:
        out = []
        for idx, p in enumerate(ordered_players):
            slot = tpl[idx] if idx < len(tpl) else base_tpl[idx]
            cx = max(4.0, min(95.0, slot["x"] + (0.0 if idx == 0 else x_shift)))
            cy_rel = (slot["y"] - 50.0) * y_spread
            cy = max(6.0, min(94.0, 50.0 + cy_rel))
            out.append({
                "id": p["id"],
                "name": p["name"],
                "short_name": p["short_name"],
                "shirt_number": p["shirt_number"],
                "role": slot["role"] if not phase_role_hint else f"{slot['role']}",
                "x": round(cx, 1),
                "y": round(cy, 1),
                "status": "AVAILABLE",
            })
        return out

    # 1. Base
    base_players = _map_players(base_tpl, x_shift=0.0, y_spread=1.0)
    base_edges = [
        {"from": base_players[0]["id"], "to": base_players[2]["id"], "type": "pass", "weight": 0.7, "label": "Primary first-phase progression"},
        {"from": base_players[0]["id"], "to": base_players[3]["id"], "type": "pass", "weight": 0.7, "label": "Left-channel buildup outlet"},
        {"from": base_players[2]["id"], "to": base_players[5]["id"], "type": "pass", "weight": 0.85, "label": "Pivot progression lane"},
        {"from": base_players[5]["id"], "to": base_players[6]["id"], "type": "pass", "weight": 0.8, "label": "Interior rotation link"},
        {"from": base_players[6]["id"], "to": base_players[8]["id"], "type": "pass", "weight": 0.75, "label": "Wide progression outlet"},
    ]

    # 2. In Possession
    att_players = _map_players(att_tpl, x_shift=3.5, y_spread=width_scale)
    att_edges = [
        {"from": att_players[2]["id"], "to": att_players[5]["id"], "type": "pass", "weight": 0.9, "label": "Line-breaking central pass into pivot"},
        {"from": att_players[5]["id"], "to": att_players[6]["id"], "type": "pass", "weight": 0.88, "label": "Half-space pocket reception"},
        {"from": att_players[6]["id"], "to": att_players[8]["id"], "type": "overlap", "weight": 0.82, "label": "Wide isolation / touchline pin"},
        {"from": att_players[7]["id"], "to": att_players[9]["id"], "type": "pass", "weight": 0.86, "label": "Interior wall pass into box runner"},
        {"from": att_players[2]["id"], "to": att_players[3]["id"], "type": "rest_defense", "weight": 0.75, "label": "Rest-defense center-back screen"},
        {"from": att_players[1]["id"], "to": att_players[5]["id"], "type": "rest_defense", "weight": 0.72, "label": "Inverted counter-press security"},
    ]
    att_zones = [
        {"id": "z_rhs", "label": "Right Half-Space Overload", "type": "half_space", "x1": 56, "y1": 58, "x2": 84, "y2": 76},
        {"id": "z_lhs", "label": "Left Half-Space Pocket", "type": "half_space", "x1": 56, "y1": 24, "x2": 84, "y2": 42},
        {"id": "z_rest", "label": "Rest-Defense Perimeter", "type": "rest_defense", "x1": 26, "y1": 24, "x2": 48, "y2": 76},
    ]

    # 3. Out of Possession
    def_players = _map_players(def_tpl, x_shift=press_offset * 0.55, y_spread=0.88)
    def_edges = [
        {"from": def_players[9]["id"], "to": def_players[10]["id"], "type": "press", "weight": 0.9, "label": "First-line curved press trapping ball wide"},
        {"from": def_players[8]["id"], "to": def_players[1]["id"], "type": "cover", "weight": 0.78, "label": "Touchline trap & fullback jump"},
        {"from": def_players[6]["id"], "to": def_players[7]["id"], "type": "cover", "weight": 0.85, "label": "Central midfield lane lock"},
        {"from": def_players[2]["id"], "to": def_players[3]["id"], "type": "cover", "weight": 0.88, "label": "Back-line horizontal compactness"},
    ]
    def_zones = [
        {
            "id": "z_compact",
            "label": "Defensive Compactness Block",
            "type": "compactness",
            "player_ids": [def_players[1]["id"], def_players[2]["id"], def_players[3]["id"], def_players[4]["id"], def_players[8]["id"], def_players[7]["id"], def_players[6]["id"], def_players[5]["id"]],
        },
        {
            "id": "z_trap",
            "label": "Touchline Pressing Trigger Zone",
            "type": "press_trap",
            "x1": 38 + press_offset * 0.4,
            "y1": 70,
            "x2": 62 + press_offset * 0.4,
            "y2": 94,
        },
    ]

    # 4. Attacking Transition
    atk_tr_players = _map_players(att_tpl, x_shift=7.0, y_spread=0.96)
    atk_tr_edges = [
        {"from": atk_tr_players[5]["id"], "to": atk_tr_players[9]["id"], "type": "pass", "weight": 0.92, "label": "Vertical first-pass release behind high line"},
        {"from": atk_tr_players[6]["id"], "to": atk_tr_players[8]["id"], "type": "overlap", "weight": 0.85, "label": "Weak-side sprint into open channel"},
        {"from": atk_tr_players[7]["id"], "to": atk_tr_players[10]["id"], "type": "pass", "weight": 0.84, "label": "Diagonal switch into forward stride"},
    ]

    # 5. Defensive Transition
    def_tr_players = _map_players(def_tpl, x_shift=-4.0 + press_offset * 0.35, y_spread=0.84)
    def_tr_edges = [
        {"from": def_tr_players[7]["id"], "to": def_tr_players[6]["id"], "type": "press", "weight": 0.9, "label": "5-second counter-press squeeze on ball carrier"},
        {"from": def_tr_players[2]["id"], "to": def_tr_players[3]["id"], "type": "rest_defense", "weight": 0.86, "label": "Center-back delay & recovery sprint"},
        {"from": def_tr_players[1]["id"], "to": def_tr_players[4]["id"], "type": "cover", "weight": 0.8, "label": "Tucking in to protect central zone 14"},
    ]

    common_evidence = "Illustrative"
    conf = profile["confidence"]

    return [
        {
            "team_id": team_id,
            "manager_id": manager_id,
            "valid_from": valid_from,
            "phase": "base",
            "formation_label": profile["base_formation"],
            "players": base_players,
            "edges": base_edges,
            "zones": [],
            "annotations": [
                f"Base alignment: {profile['base_formation']} starting orientation",
                profile["buildup_structure"],
            ],
            "source_refs": source_refs,
            "confidence": conf,
            "evidence_type": common_evidence,
        },
        {
            "team_id": team_id,
            "manager_id": manager_id,
            "valid_from": valid_from,
            "phase": "in_possession",
            "formation_label": profile["in_possession_shape"],
            "players": att_players,
            "edges": att_edges,
            "zones": att_zones,
            "annotations": [
                f"In-possession structure: {profile['in_possession_shape']}",
                profile["width_profile"],
                profile["rest_defense"],
            ],
            "source_refs": source_refs,
            "confidence": conf,
            "evidence_type": common_evidence,
        },
        {
            "team_id": team_id,
            "manager_id": manager_id,
            "valid_from": valid_from,
            "phase": "out_of_possession",
            "formation_label": profile["out_of_possession_block"],
            "players": def_players,
            "edges": def_edges,
            "zones": def_zones,
            "annotations": [
                f"Out-of-possession block: {profile['out_of_possession_block']}",
                profile["pressing_triggers"],
            ],
            "source_refs": source_refs,
            "confidence": conf,
            "evidence_type": common_evidence,
        },
        {
            "team_id": team_id,
            "manager_id": manager_id,
            "valid_from": valid_from,
            "phase": "attack_transition",
            "formation_label": f"{profile['in_possession_shape']} Break",
            "players": atk_tr_players,
            "edges": atk_tr_edges,
            "zones": [
                {"id": "z_tr_atk", "label": "Vertical Transition Corridor", "type": "half_space", "x1": 52, "y1": 28, "x2": 88, "y2": 72}
            ],
            "annotations": [
                profile["transition_attack"],
                profile["tempo_profile"],
            ],
            "source_refs": source_refs,
            "confidence": conf,
            "evidence_type": common_evidence,
        },
        {
            "team_id": team_id,
            "manager_id": manager_id,
            "valid_from": valid_from,
            "phase": "defensive_transition",
            "formation_label": f"{profile['out_of_possession_block']} Recovery",
            "players": def_tr_players,
            "edges": def_tr_edges,
            "zones": [
                {
                    "id": "z_tr_def",
                    "label": "Rest-Defense Recovery Compactness",
                    "type": "compactness",
                    "player_ids": [def_tr_players[1]["id"], def_tr_players[2]["id"], def_tr_players[3]["id"], def_tr_players[4]["id"], def_tr_players[5]["id"], def_tr_players[6]["id"]],
                }
            ],
            "annotations": [
                profile["transition_defense"],
                profile["rest_defense"],
            ],
            "source_refs": source_refs,
            "confidence": conf,
            "evidence_type": common_evidence,
        },
    ]


def build_formation_players(
    players: List[Dict[str, Any]],
    formation: str = "4-3-3",
) -> List[Dict[str, Any]]:
    tpl = _resolve_template(formation, "4-3-3")
    out: List[Dict[str, Any]] = []
    for idx, p in enumerate(players[:11]):
        slot = tpl[idx] if idx < len(tpl) else FORMATION_TEMPLATES["4-3-3"][idx]
        out.append({
            "id": p["id"],
            "name": p["name"],
            "short_name": p["short_name"],
            "shirt_number": p["shirt_number"],
            "role": slot["role"],
            "x": round(float(slot["x"]), 1),
            "y": round(float(slot["y"]), 1),
            "status": "AVAILABLE",
        })
    return out


def build_demo_passing_analysis(
    team_id: str,
    players: List[Dict[str, Any]],
    formation: str = "4-3-3",
    tempo_idx: float = 0.65,
    directness_idx: float = 0.52,
) -> Dict[str, Any]:
    """
    Generates an illustrative, strictly labeled sample passing network for demonstration
    when live APIs omit event-level pass matrices. Deterministic per (team_id, formation).
    """
    nodes = build_formation_players(players, formation)
    if len(nodes) < 11:
        return {"formation": formation, "players": nodes, "links": [], "summary": None}

    seed = sum(ord(ch) for ch in f"{team_id}:{formation}")
    tempo_scale = 0.88 + tempo_idx * 0.32
    completion_bias = 0.85 - directness_idx * 0.08

    # Connect nearby structural teammates (slot index pairs) with realistic match pass counts
    pair_specs = [
        (0, 2, 16, 0),
        (0, 3, 15, 0),
        (2, 3, 28, 0),
        (2, 1, 20, 1),
        (3, 4, 19, 1),
        (2, 5, 22, 1),
        (3, 5, 18, 1),
        (1, 6, 17, 2),
        (1, 8, 15, 3),
        (4, 7, 18, 2),
        (4, 10, 14, 3),
        (5, 6, 26, 2),
        (5, 7, 24, 2),
        (6, 7, 21, 2),
        (6, 8, 19, 4),
        (6, 9, 12, 3),
        (7, 10, 18, 4),
        (7, 9, 13, 3),
        (8, 9, 11, 3),
        (10, 9, 11, 3),
        (8, 10, 8, 2),
    ]

    links: List[Dict[str, Any]] = []
    total_passes = 0
    total_completed = 0
    total_incomplete = 0
    total_key = 0
    top_pair: Optional[Dict[str, Any]] = None

    for idx, (i_from, i_to, base_vol, key_base) in enumerate(pair_specs):
        p_from = nodes[i_from]
        p_to = nodes[i_to]
        jitter = ((seed + idx * 7) % 7) - 3
        attempted = max(4, int(round((base_vol + jitter) * tempo_scale)))
        # Forward/final-third links naturally have slightly lower completion rate than CB circulation
        forward_penalty = 0.09 if i_to >= 8 else (0.04 if i_to >= 5 else 0.0)
        comp_rate = max(0.58, min(0.95, completion_bias - forward_penalty + ((seed + idx) % 5 - 2) * 0.015))
        completed = max(1, min(attempted, int(round(attempted * comp_rate))))
        incomplete = attempted - completed
        key_passes = min(completed, max(0, key_base + ((seed + idx) % 2 if key_base > 0 else 0)))

        link = {
            "from_id": p_from["id"],
            "to_id": p_to["id"],
            "from_name": p_from["short_name"],
            "to_name": p_to["short_name"],
            "total_passes": attempted,
            "completed_passes": completed,
            "incomplete_passes": incomplete,
            "key_passes": key_passes,
        }
        links.append(link)
        total_passes += attempted
        total_completed += completed
        total_incomplete += incomplete
        total_key += key_passes

        if top_pair is None or attempted > top_pair["total_passes"]:
            top_pair = {
                "from_name": p_from["short_name"],
                "to_name": p_to["short_name"],
                "total_passes": attempted,
                "completed_passes": completed,
            }

    return {
        "formation": formation,
        "players": nodes,
        "links": links,
        "summary": {
            "total_passes": total_passes,
            "completed_passes": total_completed,
            "incomplete_passes": total_incomplete,
            "completion_pct": round((total_completed / total_passes) * 100.0, 1) if total_passes else 0.0,
            "key_passes": total_key,
            "most_connected_pair": top_pair,
        },
    }

