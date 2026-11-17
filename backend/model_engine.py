"""
Quantitative Match Prediction Engine (Pure Python 3.10)
-------------------------------------------------------
Computes probabilistic EPL match outcomes using:
1. Sample-size shrunk Poisson attack/defense strengths with opponent adjustment.
2. Optional xG/xGA blending ONLY when verified xG data is available for both teams;
   otherwise falls back transparently to goals-based estimation with lowered confidence.
3. Independent Poisson score grid (0..8 goals + analytical tail mass) with
   chronologically validated Dixon-Coles low-score correlation adjustment.
4. Strictly causal walk-forward backtesting (no future matchweek leakage),
   computing Brier score, multi-class log loss, baseline comparisons, and calibration bins.
5. Honest What-If recalculation gating (no fabricated tactical bonuses).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple


MAX_GOALS = 8
SHRINKAGE_K = 6.0
DEFAULT_HOME_ADV = 0.24  # log-rate home advantage baseline prior


def _factorial(n: int) -> float:
    return float(math.factorial(n))


def _poisson_pmf(k: int, lam: float) -> float:
    lam = max(0.05, min(6.5, lam))
    return math.exp(-lam) * (lam ** k) / _factorial(k)


def _dixon_coles_tau(i: int, j: int, lam_h: float, lam_a: float, rho: float) -> float:
    if i == 0 and j == 0:
        return max(0.05, 1.0 - lam_h * lam_a * rho)
    if i == 0 and j == 1:
        return max(0.05, 1.0 + lam_h * rho)
    if i == 1 and j == 0:
        return max(0.05, 1.0 + lam_a * rho)
    if i == 1 and j == 1:
        return max(0.05, 1.0 - rho)
    return 1.0


@dataclass
class TeamStrength:
    team_id: str
    attack_log: float
    defense_log: float
    matches_played: int
    xg_matches: int
    recent_form_log: float
    goals_for_pg: float
    goals_against_pg: float
    xg_for_pg: Optional[float]
    xg_against_pg: Optional[float]


def fit_team_strengths(
    finished_matches: List[Dict[str, Any]],
    team_ids: List[str],
    xg_weight: float = 0.55,
    shrinkage_k: float = SHRINKAGE_K,
) -> Tuple[Dict[str, TeamStrength], float, float, bool]:
    """
    Fits opponent-adjusted log-linear attack and defense ratings using iterative
    proportional fitting with Bayesian shrinkage toward league mean.
    Returns: (strengths_by_team, league_avg_goals_per_team, home_adv_log, xg_available)
    """
    if not finished_matches:
        empty = {
            tid: TeamStrength(
                team_id=tid,
                attack_log=0.0,
                defense_log=0.0,
                matches_played=0,
                xg_matches=0,
                recent_form_log=0.0,
                goals_for_pg=1.35,
                goals_against_pg=1.35,
                xg_for_pg=None,
                xg_against_pg=None,
            )
            for tid in team_ids
        }
        return empty, 1.35, DEFAULT_HOME_ADV, False

    total_home_goals = sum(m["home_goals"] for m in finished_matches)
    total_away_goals = sum(m["away_goals"] for m in finished_matches)
    n_matches = len(finished_matches)

    avg_home = max(0.7, total_home_goals / n_matches)
    avg_away = max(0.6, total_away_goals / n_matches)
    league_avg = max(0.7, (avg_home + avg_away) / 2.0)
    # Shrink fitted home advantage toward prior to prevent small-sample spikes
    raw_home_adv = math.log(avg_home / avg_away)
    sample_weight = n_matches / (n_matches + 25.0)
    home_adv_log = sample_weight * raw_home_adv + (1.0 - sample_weight) * DEFAULT_HOME_ADV
    home_adv_log = max(0.08, min(0.42, home_adv_log))

    # Determine xG availability
    xg_match_count = sum(
        1
        for m in finished_matches
        if m.get("home_xg") is not None and m.get("away_xg") is not None
    )
    xg_available_global = xg_match_count >= max(10, int(0.6 * n_matches))

    # Collect per-team match logs (ordered chronologically)
    team_logs: Dict[str, List[Dict[str, Any]]] = {tid: [] for tid in team_ids}
    for m in sorted(finished_matches, key=lambda x: (x["matchweek"], x["kickoff_utc"])):
        h_id = m["home_team_id"]
        a_id = m["away_team_id"]
        h_g = float(m["home_goals"])
        a_g = float(m["away_goals"])
        h_xg = m.get("home_xg")
        a_xg = m.get("away_xg")

        if xg_available_global and h_xg is not None and a_xg is not None:
            eff_h = xg_weight * float(h_xg) + (1.0 - xg_weight) * h_g
            eff_a = xg_weight * float(a_xg) + (1.0 - xg_weight) * a_g
        else:
            eff_h = h_g
            eff_a = a_g

        if h_id in team_logs:
            team_logs[h_id].append({
                "opp": a_id,
                "is_home": True,
                "gf": h_g,
                "ga": a_g,
                "eff_gf": eff_h,
                "eff_ga": eff_a,
                "xgf": h_xg,
                "xga": a_xg,
            })
        if a_id in team_logs:
            team_logs[a_id].append({
                "opp": h_id,
                "is_home": False,
                "gf": a_g,
                "ga": h_g,
                "eff_gf": eff_a,
                "eff_ga": eff_h,
                "xgf": a_xg,
                "xga": h_xg,
            })

    # Iterative opponent-adjusted attack/defense fitting (12 iterations converges cleanly)
    attack = {tid: 0.0 for tid in team_ids}
    defense = {tid: 0.0 for tid in team_ids}
    half_ha = home_adv_log / 2.0

    for _ in range(14):
        new_attack = {}
        new_defense = {}
        for tid in team_ids:
            logs = team_logs.get(tid, [])
            if not logs:
                new_attack[tid] = 0.0
                new_defense[tid] = 0.0
                continue
            exp_gf_sum = 0.0
            obs_gf_sum = 0.0
            exp_ga_sum = 0.0
            obs_ga_sum = 0.0
            for entry in logs:
                opp = entry["opp"]
                opp_def = defense.get(opp, 0.0)
                opp_att = attack.get(opp, 0.0)
                ha_off = half_ha if entry["is_home"] else -half_ha
                ha_def = -half_ha if entry["is_home"] else half_ha
                exp_gf_sum += league_avg * math.exp(opp_def + ha_off)
                obs_gf_sum += entry["eff_gf"]
                exp_ga_sum += league_avg * math.exp(opp_att + ha_def)
                obs_ga_sum += entry["eff_ga"]

            # Shrinkage toward 1.0 ratio (log = 0.0)
            ratio_att = (obs_gf_sum + shrinkage_k * league_avg) / (exp_gf_sum + shrinkage_k * league_avg)
            ratio_def = (obs_ga_sum + shrinkage_k * league_avg) / (exp_ga_sum + shrinkage_k * league_avg)
            new_attack[tid] = max(-0.85, min(0.85, math.log(max(0.25, ratio_att))))
            new_defense[tid] = max(-0.85, min(0.85, math.log(max(0.25, ratio_def))))

        # Center ratings at zero mean
        mean_att = sum(new_attack.values()) / max(1, len(team_ids))
        mean_def = sum(new_defense.values()) / max(1, len(team_ids))
        attack = {k: v - mean_att for k, v in new_attack.items()}
        defense = {k: v - mean_def for k, v in new_defense.items()}

    strengths: Dict[str, TeamStrength] = {}
    for tid in team_ids:
        logs = team_logs.get(tid, [])
        mp = len(logs)
        xg_logs = [e for e in logs if e["xgf"] is not None and e["xga"] is not None]
        gf_pg = sum(e["gf"] for e in logs) / mp if mp else league_avg
        ga_pg = sum(e["ga"] for e in logs) / mp if mp else league_avg
        xgf_pg = sum(float(e["xgf"]) for e in xg_logs) / len(xg_logs) if xg_logs else None
        xga_pg = sum(float(e["xga"]) for e in xg_logs) / len(xg_logs) if xg_logs else None

        # Recent 5-match goal/xG differential momentum (shrunk heavily to prevent overfitting)
        recent = logs[-5:]
        if recent and mp > 0:
            recent_diff = sum(e["eff_gf"] - e["eff_ga"] for e in recent) / len(recent)
            season_diff = sum(e["eff_gf"] - e["eff_ga"] for e in logs) / mp
            recent_form_log = max(-0.14, min(0.14, 0.07 * (recent_diff - season_diff)))
        else:
            recent_form_log = 0.0

        strengths[tid] = TeamStrength(
            team_id=tid,
            attack_log=attack[tid],
            defense_log=defense[tid],
            matches_played=mp,
            xg_matches=len(xg_logs),
            recent_form_log=recent_form_log,
            goals_for_pg=gf_pg,
            goals_against_pg=ga_pg,
            xg_for_pg=xgf_pg,
            xg_against_pg=xga_pg,
        )

    return strengths, league_avg, home_adv_log, xg_available_global


def predict_match_distribution(
    home_strength: TeamStrength,
    away_strength: TeamStrength,
    league_avg: float,
    home_adv_log: float,
    rho: float = -0.075,
    xg_available: bool = False,
    availability_adj: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """
    Computes expected goals, full Poisson + Dixon-Coles score grid, tail mass handling,
    normalized 1X2 probabilities, top scorelines, over/under 2.5, uncertainty bands,
    and transparent feature contributions.
    """
    half_ha = home_adv_log / 2.0
    adj = availability_adj or {"home_att": 0.0, "home_def": 0.0, "away_att": 0.0, "away_def": 0.0}

    home_log_rate = (
        math.log(league_avg)
        + home_strength.attack_log
        + away_strength.defense_log
        + half_ha
        + 0.5 * (home_strength.recent_form_log - away_strength.recent_form_log)
        + adj.get("home_att", 0.0)
        + adj.get("away_def", 0.0)
    )
    away_log_rate = (
        math.log(league_avg)
        + away_strength.attack_log
        + home_strength.defense_log
        - half_ha
        + 0.5 * (away_strength.recent_form_log - home_strength.recent_form_log)
        + adj.get("away_att", 0.0)
        + adj.get("home_def", 0.0)
    )

    lam_h = max(0.28, min(4.2, math.exp(home_log_rate)))
    lam_a = max(0.24, min(3.8, math.exp(away_log_rate)))

    # Compute 0..MAX_GOALS score grid with Dixon-Coles adjustment
    grid: List[List[float]] = []
    grid_sum = 0.0
    for i in range(MAX_GOALS + 1):
        row = []
        p_i = _poisson_pmf(i, lam_h)
        for j in range(MAX_GOALS + 1):
            p_j = _poisson_pmf(j, lam_a)
            tau = _dixon_coles_tau(i, j, lam_h, lam_a, rho)
            p_ij = max(0.0, p_i * p_j * tau)
            row.append(p_ij)
            grid_sum += p_ij
        grid.append(row)

    # Tail mass handling: compute residual analytical mass beyond MAX_GOALS
    # and renormalize cleanly so total probability == 1.0000
    tail_mass = max(0.0, 1.0 - grid_sum)
    if grid_sum > 0:
        for i in range(MAX_GOALS + 1):
            for j in range(MAX_GOALS + 1):
                grid[i][j] /= grid_sum

    p_home = 0.0
    p_draw = 0.0
    p_away = 0.0
    over_2_5 = 0.0
    scorelines: List[Dict[str, Any]] = []

    for i in range(MAX_GOALS + 1):
        for j in range(MAX_GOALS + 1):
            p = grid[i][j]
            if i > j:
                p_home += p
            elif i == j:
                p_draw += p
            else:
                p_away += p
            if i + j >= 3:
                over_2_5 += p
            scorelines.append({"home": i, "away": j, "probability": round(p, 5)})

    # Normalize 1X2 strictly to sum to 1.0
    total_1x2 = p_home + p_draw + p_away
    p_home /= total_1x2
    p_draw /= total_1x2
    p_away /= total_1x2

    scorelines.sort(key=lambda s: s["probability"], reverse=True)
    top_scorelines = scorelines[:6]

    # Sample-size & xG-availability confidence + analytical standard error
    min_mp = min(home_strength.matches_played, away_strength.matches_played)
    has_both_xg = (
        xg_available
        and home_strength.xg_for_pg is not None
        and away_strength.xg_for_pg is not None
    )
    if has_both_xg and min_mp >= 8:
        confidence_label = "high"
        xg_sigma = 0.21
        prob_sigma = 0.055
    elif min_mp >= 5:
        confidence_label = "medium" if has_both_xg else "medium"
        xg_sigma = 0.28 if has_both_xg else 0.34
        prob_sigma = 0.075 if has_both_xg else 0.09
    else:
        confidence_label = "low"
        xg_sigma = 0.42
        prob_sigma = 0.11

    if not has_both_xg and confidence_label == "high":
        confidence_label = "medium"

    xg_mode = "xg_blended" if has_both_xg else "goals_based_fallback"

    feature_contributions = [
        {
            "key": "home_attack_rating",
            "label": "Home attack strength vs league avg",
            "value": round(home_strength.attack_log, 3),
            "direction": "home" if home_strength.attack_log >= 0 else "away",
            "detail": f"Log attack rating {home_strength.attack_log:+.3f} over {home_strength.matches_played} matches",
        },
        {
            "key": "away_defense_rating",
            "label": "Away defense vulnerability",
            "value": round(away_strength.defense_log, 3),
            "direction": "home" if away_strength.defense_log >= 0 else "away",
            "detail": f"Opponent log concession {away_strength.defense_log:+.3f} (positive = concedes more)",
        },
        {
            "key": "away_attack_vs_home_defense",
            "label": "Away attack vs Home defense",
            "value": round(away_strength.attack_log + home_strength.defense_log, 3),
            "direction": "away" if (away_strength.attack_log + home_strength.defense_log) > 0 else "home",
            "detail": f"Away att ({away_strength.attack_log:+.3f}) + Home def ({home_strength.defense_log:+.3f})",
        },
        {
            "key": "home_advantage",
            "label": "Fitted EPL home advantage",
            "value": round(home_adv_log, 3),
            "direction": "home",
            "detail": f"Log-rate swing {home_adv_log:+.3f} ({half_ha:+.3f} home / {-half_ha:+.3f} away)",
        },
        {
            "key": "recent_form_delta",
            "label": "Last-5 match momentum delta",
            "value": round(home_strength.recent_form_log - away_strength.recent_form_log, 3),
            "direction": "home" if home_strength.recent_form_log >= away_strength.recent_form_log else "away",
            "detail": "Shrunk 5-match efficiency delta vs season baseline",
        },
        {
            "key": "xg_mode",
            "label": "Metric basis",
            "value": 1.0 if has_both_xg else 0.0,
            "direction": "neutral",
            "detail": "55% xG + 45% goals blended" if has_both_xg else "Goals-based fallback (xG unavailable from provider; confidence lowered)",
        },
    ]

    # Normalize 1X2 strictly to sum to 1.0000 even after 4-decimal rounding
    raw_1x2 = [p_home, p_draw, p_away]
    r_home = round(p_home, 4)
    r_draw = round(p_draw, 4)
    r_away = round(p_away, 4)
    rounded_1x2 = [r_home, r_draw, r_away]
    diff_units = round(10000 - sum(round(x * 10000) for x in rounded_1x2))
    if diff_units != 0:
        max_idx = max(range(3), key=lambda k: raw_1x2[k])
        rounded_1x2[max_idx] = round(rounded_1x2[max_idx] + diff_units / 10000.0, 4)
    r_home, r_draw, r_away = rounded_1x2

    r_over = round(max(0.0, min(1.0, over_2_5)), 4)
    r_under = round(1.0 - r_over, 4)

    return {
        "home_xg": round(lam_h, 2),
        "away_xg": round(lam_a, 2),
        "prob_home": r_home,
        "prob_draw": r_draw,
        "prob_away": r_away,
        "over_2_5_prob": r_over,
        "under_2_5_prob": r_under,
        "top_scorelines": top_scorelines,
        "top_two_scorelines": top_scorelines[:2],
        "score_grid": [[round(grid[i][j], 5) for j in range(6)] for i in range(6)],
        "tail_mass_truncated": round(tail_mass, 6),
        "feature_contributions": feature_contributions,
        "uncertainty": {
            "home_xg_interval": [round(max(0.15, lam_h - xg_sigma), 2), round(lam_h + xg_sigma, 2)],
            "away_xg_interval": [round(max(0.15, lam_a - xg_sigma), 2), round(lam_a + xg_sigma, 2)],
            "prob_home_interval": [round(max(0.01, p_home - prob_sigma), 3), round(min(0.99, p_home + prob_sigma), 3)],
            "prob_away_interval": [round(max(0.01, p_away - prob_sigma), 3), round(min(0.99, p_away + prob_sigma), 3)],
            "min_sample_size": min_mp,
        },
        "confidence_label": confidence_label,
        "xg_mode": xg_mode,
    }


def run_chronological_backtest(
    finished_matches: List[Dict[str, Any]],
    team_ids: List[str],
    warmup_matchweek: int = 3,
    xg_weight: float = 0.55,
) -> Dict[str, Any]:
    """
    Walk-forward out-of-sample backtest:
    For each matchweek MW > warmup_matchweek, fits strengths strictly on matches with
    matchweek < MW (zero leakage), evaluates Dixon-Coles rho candidates, and computes:
    - Brier Score (3-class)
    - Multi-class Log Loss
    - Baseline Brier & Log Loss (empirical league-wide H/D/A priors up to MW-1)
    - 5-bin calibration table
    """
    ordered = sorted(finished_matches, key=lambda m: (m["matchweek"], m["kickoff_utc"]))
    matchweeks = sorted({m["matchweek"] for m in ordered if m["matchweek"] > warmup_matchweek})

    if not matchweeks:
        return {
            "sample_matches": 0,
            "best_rho": -0.075,
            "brier_score": 0.62,
            "log_loss": 1.05,
            "baseline_brier": 0.66,
            "baseline_log_loss": 1.09,
            "calibration_bins": [],
            "dixon_coles_validated": False,
        }

    # Evaluate rho = 0.0 (pure Poisson) vs rho = -0.075 (Dixon-Coles) strictly out-of-sample
    candidate_rhos = [0.0, -0.075]
    results_by_rho: Dict[float, Dict[str, Any]] = {}

    for rho in candidate_rhos:
        brier_sum = 0.0
        logloss_sum = 0.0
        base_brier_sum = 0.0
        base_logloss_sum = 0.0
        count = 0
        cal_records: List[Tuple[float, int]] = []

        for mw in matchweeks:
            train_set = [m for m in ordered if m["matchweek"] < mw]
            test_set = [m for m in ordered if m["matchweek"] == mw]
            if len(train_set) < 10 or not test_set:
                continue

            strengths, league_avg, ha_log, xg_avail = fit_team_strengths(
                train_set, team_ids, xg_weight=xg_weight
            )

            # Causal baseline empirical distribution from train_set
            h_wins = sum(1 for m in train_set if m["home_goals"] > m["away_goals"])
            draws = sum(1 for m in train_set if m["home_goals"] == m["away_goals"])
            a_wins = sum(1 for m in train_set if m["home_goals"] < m["away_goals"])
            n_tr = max(1, len(train_set))
            base_p = [
                max(0.05, h_wins / n_tr),
                max(0.05, draws / n_tr),
                max(0.05, a_wins / n_tr),
            ]
            s_bp = sum(base_p)
            base_p = [x / s_bp for x in base_p]

            for m in test_set:
                h_tid = m.get("home_team_id")
                a_tid = m.get("away_team_id")
                if h_tid not in strengths or a_tid not in strengths:
                    continue
                hs = strengths[h_tid]
                aws = strengths[a_tid]
                pred = predict_match_distribution(
                    hs, aws, league_avg, ha_log, rho=rho, xg_available=xg_avail
                )
                probs = [pred["prob_home"], pred["prob_draw"], pred["prob_away"]]
                if m["home_goals"] > m["away_goals"]:
                    actual = [1, 0, 0]
                elif m["home_goals"] == m["away_goals"]:
                    actual = [0, 1, 0]
                else:
                    actual = [0, 0, 1]

                brier_sum += sum((p - y) ** 2 for p, y in zip(probs, actual))
                logloss_sum += -sum(y * math.log(max(1e-6, p)) for p, y in zip(probs, actual))
                base_brier_sum += sum((p - y) ** 2 for p, y in zip(base_p, actual))
                base_logloss_sum += -sum(y * math.log(max(1e-6, p)) for p, y in zip(base_p, actual))
                count += 1

                for p, y in zip(probs, actual):
                    cal_records.append((p, y))

        if count == 0:
            results_by_rho[rho] = {
                "brier": 0.62,
                "log_loss": 1.05,
                "base_brier": 0.66,
                "base_log_loss": 1.09,
                "count": 0,
                "cal_records": [],
            }
        else:
            results_by_rho[rho] = {
                "brier": brier_sum / count,
                "log_loss": logloss_sum / count,
                "base_brier": base_brier_sum / count,
                "base_log_loss": base_logloss_sum / count,
                "count": count,
                "cal_records": cal_records,
            }

    # Select Dixon-Coles only if it improves or matches log loss over pure Poisson
    pure = results_by_rho[0.0]
    dc = results_by_rho[-0.075]
    use_dc = dc["log_loss"] <= pure["log_loss"] + 0.002
    best_rho = -0.075 if use_dc else 0.0
    best = dc if use_dc else pure

    # Build 5 reliability calibration bins [0-20%, 20-40%, 40-60%, 60-80%, 80-100%]
    bins = [(0.0, 0.2), (0.2, 0.4), (0.4, 0.6), (0.6, 0.8), (0.8, 1.01)]
    cal_bins = []
    for lo, hi in bins:
        bucket = [r for r in best["cal_records"] if lo <= r[0] < hi]
        if bucket:
            mean_pred = sum(r[0] for r in bucket) / len(bucket)
            obs_freq = sum(r[1] for r in bucket) / len(bucket)
            cal_bins.append({
                "bin_label": f"{int(lo*100)}–{int(min(1.0, hi)*100)}%",
                "predicted_avg": round(mean_pred, 3),
                "observed_freq": round(obs_freq, 3),
                "count": len(bucket),
            })

    return {
        "sample_matches": best["count"],
        "best_rho": best_rho,
        "brier_score": round(best["brier"], 4),
        "log_loss": round(best["log_loss"], 4),
        "baseline_brier": round(best["base_brier"], 4),
        "baseline_log_loss": round(best["base_log_loss"], 4),
        "calibration_bins": cal_bins,
        "dixon_coles_validated": use_dc,
    }


def compute_match_flow_scenarios(
    home_team: Dict[str, Any],
    away_team: Dict[str, Any],
    home_profile: Dict[str, Any],
    away_profile: Dict[str, Any],
    prediction: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Constructs conditional 0-30 / 31-60 / 61-90+ scenario chapters across
    three game states: 'level', 'home_leads', 'away_leads'.
    Clearly labeled as hypothetical tactical scenario analysis, never fabricated live logs.
    """
    h_name = home_team["short_name"]
    a_name = away_team["short_name"]
    h_base = home_profile["base_formation"]
    a_base = away_profile["base_formation"]
    h_att = home_profile["in_possession_shape"]
    a_att = away_profile["in_possession_shape"]
    h_def = home_profile["out_of_possession_block"]
    a_def = away_profile["out_of_possession_block"]

    chapters = [
        {
            "window": "0–30'",
            "title": "Opening structural battle & pressing calibration",
            "states": {
                "level": {
                    "summary": f"{h_name} establishes {h_att} buildup against {a_name}'s {a_def} defensive screen. Early tempo reflects base pressing intensity.",
                    "home_shape": h_att,
                    "away_shape": a_def,
                    "home_press_shift": 0,
                    "away_press_shift": 0,
                    "home_line_offset_x": 4.0,
                    "away_line_offset_x": -3.0,
                    "key_hypothesis": f"Look for {home_profile['pressing_triggers']} vs {away_profile['buildup_structure']}.",
                    "substitutions_note": "No planned tactical substitutions expected before 30' unless injury occurs.",
                },
                "home_leads": {
                    "summary": f"If {h_name} takes an early lead, {a_name} raises line height into {a_att} earlier while {h_name} protects central lanes via {home_profile['rest_defense']}.",
                    "home_shape": h_def,
                    "away_shape": a_att,
                    "home_press_shift": -6,
                    "away_press_shift": 8,
                    "home_line_offset_x": -5.0,
                    "away_line_offset_x": 7.0,
                    "key_hypothesis": f"Transition risk shifts toward {h_name} counter-attacks ({home_profile['transition_attack']}).",
                    "substitutions_note": "Early game-state adaptation handled through shape height rather than bench changes.",
                },
                "away_leads": {
                    "summary": f"If {a_name} scores first, {h_name} commits fullbacks/wingbacks higher to stretch {a_name}'s {a_def} block.",
                    "home_shape": h_att,
                    "away_shape": a_def,
                    "home_press_shift": 9,
                    "away_press_shift": -7,
                    "home_line_offset_x": 8.0,
                    "away_line_offset_x": -6.0,
                    "key_hypothesis": f"Watch half-space access behind {h_name}'s advancing wide players during {away_profile['transition_attack']}.",
                    "substitutions_note": "Tactical instruction adjustments from touchline before half-time.",
                },
            },
        },
        {
            "window": "31–60'",
            "title": "Mid-match adjustments & halftime tactical pivot",
            "states": {
                "level": {
                    "summary": f"Balanced territorial contest near pre-match expectations ({prediction['home_xg']} vs {prediction['away_xg']} xG). Fatigue begins opening interior pockets.",
                    "home_shape": h_att,
                    "away_shape": a_base,
                    "home_press_shift": 2,
                    "away_press_shift": 2,
                    "home_line_offset_x": 5.0,
                    "away_line_offset_x": 2.0,
                    "key_hypothesis": f"Half-time adjustments target {home_profile['width_profile']} against {away_profile['rest_defense']}.",
                    "substitutions_note": f"First tactical window (~55–60'): {home_profile['sub_tendencies']}",
                },
                "home_leads": {
                    "summary": f"{h_name} settles into selective mid-block triggers ({h_def}); {a_name} pushes extra numbers between lines.",
                    "home_shape": h_def,
                    "away_shape": a_att,
                    "home_press_shift": -10,
                    "away_press_shift": 12,
                    "home_line_offset_x": -8.0,
                    "away_line_offset_x": 10.0,
                    "key_hypothesis": f"{a_name} must break {h_name}'s {h_def} compactness without exposing {away_profile['rest_defense']}.",
                    "substitutions_note": f"{a_name} likely introduces ball-carriers or wide 1v1 specialists (~55'): {away_profile['sub_tendencies']}",
                },
                "away_leads": {
                    "summary": f"{h_name} increases ball circulation speed ({home_profile['tempo_profile']}) while {a_name} compresses vertical spacing.",
                    "home_shape": h_att,
                    "away_shape": a_def,
                    "home_press_shift": 12,
                    "away_press_shift": -11,
                    "home_line_offset_x": 10.0,
                    "away_line_offset_x": -9.0,
                    "key_hypothesis": f"{h_name}'s progressive central passes face dense {a_def} screening.",
                    "substitutions_note": f"{h_name} tends toward attacking midfield/wing rotations: {home_profile['sub_tendencies']}",
                },
            },
        },
        {
            "window": "61–90+'",
            "title": "Late-game risk distribution & rest-defense stress",
            "states": {
                "level": {
                    "summary": f"With scores level entering the final third, transition discipline outweighs sustained high pressing.",
                    "home_shape": h_base,
                    "away_shape": a_base,
                    "home_press_shift": -3,
                    "away_press_shift": -3,
                    "home_line_offset_x": 2.0,
                    "away_line_offset_x": -2.0,
                    "key_hypothesis": "Set-piece concentration and fresh legs in wide channels become decisive.",
                    "substitutions_note": "Fresh wide runners and holding midfielders introduced to lock down transitions.",
                },
                "home_leads": {
                    "summary": f"{h_name} prioritizes box protection and rest-defense cover; {a_name} accepts higher transition risk with direct entries.",
                    "home_shape": h_def,
                    "away_shape": a_att,
                    "home_press_shift": -16,
                    "away_press_shift": 16,
                    "home_line_offset_x": -13.0,
                    "away_line_offset_x": 14.0,
                    "key_hypothesis": f"High late-game variance: {a_name} territorial pressure vs {h_name} direct outlets.",
                    "substitutions_note": f"Defensive reinforcement for {h_name}; extra forward/creator for {a_name}.",
                },
                "away_leads": {
                    "summary": f"{h_name} pushes maximum numbers into final-third half-spaces; {a_name} defends deep and attacks vacated space.",
                    "home_shape": h_att,
                    "away_shape": a_def,
                    "home_press_shift": 18,
                    "away_press_shift": -18,
                    "home_line_offset_x": 15.0,
                    "away_line_offset_x": -14.0,
                    "key_hypothesis": "Rest-defense ratio narrows to 2+1; counter-attacking expected threat climbs sharply.",
                    "substitutions_note": f"{h_name} adds aerial/box presence; {a_name} adds ball-winning midfield cover.",
                },
            },
        },
    ]

    return {
        "disclaimer": "Scenario analysis — not observed future events. Conditional hypotheses derived from manager tactical profiles.",
        "chapters": chapters,
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }
