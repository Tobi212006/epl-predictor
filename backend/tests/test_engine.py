import json
import os
import tempfile
import unittest

from backend.model_engine import (
    fit_team_strengths,
    predict_match_distribution,
    run_chronological_backtest,
)
from backend.repository import (
    compute_manager_clash,
    ensure_initialized,
    get_connection,
    get_manager_tactics,
    simulate_what_if,
)


class EngineTestSuite(unittest.TestCase):
    def setUp(self):
        self._prev_provider = os.environ.get("DATA_PROVIDER")
        os.environ["DATA_PROVIDER"] = "demo"
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self.conn = get_connection(self.tmp.name)
        ensure_initialized(self.conn)

    def tearDown(self):
        self.conn.close()
        if os.path.exists(self.tmp.name):
            os.remove(self.tmp.name)
        if self._prev_provider is None:
            os.environ.pop("DATA_PROVIDER", None)
        else:
            os.environ["DATA_PROVIDER"] = self._prev_provider

    def test_probability_normalization_and_top_scorelines(self):
        rows = self.conn.execute("SELECT id FROM teams").fetchall()
        team_ids = [r["id"] for r in rows]
        finished = [
            dict(r)
            for r in self.conn.execute(
                """
                SELECT f.id, f.matchweek, f.kickoff_utc, f.home_team_id, f.away_team_id,
                       f.home_goals, f.away_goals, sh.xg AS home_xg, sa.xg AS away_xg
                FROM fixtures f
                LEFT JOIN match_team_stats sh ON sh.fixture_id = f.id AND sh.team_id = f.home_team_id
                LEFT JOIN match_team_stats sa ON sa.fixture_id = f.id AND sa.team_id = f.away_team_id
                WHERE f.status = 'FINISHED'
                """
            ).fetchall()
        ]
        strengths, league_avg, ha, xg_avail = fit_team_strengths(finished, team_ids)
        pred = predict_match_distribution(
            strengths["arsenal"], strengths["liverpool"], league_avg, ha, xg_available=xg_avail
        )
        total = pred["prob_home"] + pred["prob_draw"] + pred["prob_away"]
        self.assertAlmostEqual(total, 1.0, places=3)
        self.assertGreater(pred["home_xg"], 0.3)
        self.assertGreater(pred["away_xg"], 0.3)
        self.assertEqual(len(pred["top_two_scorelines"]), 2)
        self.assertAlmostEqual(pred["over_2_5_prob"] + pred["under_2_5_prob"], 1.0, places=3)

    def test_missing_xg_triggers_goals_fallback_without_fabrication(self):
        rows = self.conn.execute("SELECT id FROM teams").fetchall()
        team_ids = [r["id"] for r in rows]
        finished = [
            {
                "id": f"m{i}",
                "matchweek": (i // 10) + 1,
                "kickoff_utc": f"2026-08-{15 + (i // 10):02d}T15:00:00Z",
                "home_team_id": team_ids[i % 10],
                "away_team_id": team_ids[(i % 10) + 10],
                "home_goals": 2 if i % 3 == 0 else 1,
                "away_goals": 1 if i % 2 == 0 else 0,
                "home_xg": None,
                "away_xg": None,
            }
            for i in range(60)
        ]
        strengths, league_avg, ha, xg_avail = fit_team_strengths(finished, team_ids)
        self.assertFalse(xg_avail)
        pred = predict_match_distribution(
            strengths[team_ids[0]], strengths[team_ids[10]], league_avg, ha, xg_available=xg_avail
        )
        self.assertEqual(pred["xg_mode"], "goals_based_fallback")
        self.assertIn(pred["confidence_label"], ("low", "medium"))

    def test_chronological_backtest_has_zero_leakage(self):
        rows = self.conn.execute("SELECT id FROM teams").fetchall()
        team_ids = [r["id"] for r in rows]
        finished = [
            dict(r)
            for r in self.conn.execute(
                "SELECT id, matchweek, kickoff_utc, home_team_id, away_team_id, home_goals, away_goals FROM fixtures WHERE status = 'FINISHED'"
            ).fetchall()
        ]
        bt = run_chronological_backtest(finished, team_ids, warmup_matchweek=3)
        self.assertGreater(bt["sample_matches"], 40)
        self.assertGreater(bt["brier_score"], 0.1)
        self.assertLess(bt["brier_score"], 1.0)
        self.assertGreater(bt["log_loss"], 0.2)
        self.assertTrue(len(bt["calibration_bins"]) >= 2)

    def test_tactical_snapshot_preserves_stable_player_ids_across_phases(self):
        tactics = get_manager_tactics(self.conn, "mikel-arteta")
        self.assertIsNotNone(tactics)
        snaps = tactics["snapshots"]
        self.assertEqual(set(snaps.keys()), {"base", "in_possession", "out_of_possession", "attack_transition", "defensive_transition"})
        base_ids = [p["id"] for p in snaps["base"]["players"]]
        att_ids = [p["id"] for p in snaps["in_possession"]["players"]]
        def_ids = [p["id"] for p in snaps["out_of_possession"]["players"]]
        self.assertEqual(base_ids, att_ids)
        self.assertEqual(base_ids, def_ids)
        self.assertEqual(len(base_ids), 11)

    def test_new_manager_does_not_inherit_high_confidence(self):
        brentford_mgr = get_manager_tactics(self.conn, "keith-andrews")
        self.assertIsNotNone(brentford_mgr)
        self.assertEqual(brentford_mgr["profile"]["confidence"], "low")
        self.assertLessEqual(brentford_mgr["profile"]["sample_size_matches"], 3)

    def test_what_if_tactical_only_gating(self):
        tactical_only = simulate_what_if(
            self.conn,
            {
                "home_team_id": "arsenal",
                "away_team_id": "liverpool",
                "home_formation": "3-4-2-1",
                "unavailable_player_ids": [],
                "swap_venue": False,
            },
        )
        self.assertEqual(tactical_only["recalculation_status"], "tactical_only")
        self.assertEqual(tactical_only["baseline_prediction"]["prob_home"], tactical_only["revised_prediction"]["prob_home"])

        quant_changed = simulate_what_if(
            self.conn,
            {
                "home_team_id": "arsenal",
                "away_team_id": "liverpool",
                "home_formation": "4-3-3",
                "unavailable_player_ids": ["arsenal-p9", "arsenal-p10"],
                "swap_venue": False,
            },
        )
        self.assertEqual(quant_changed["recalculation_status"], "validated_model")
        self.assertLess(quant_changed["revised_prediction"]["home_xg"], quant_changed["baseline_prediction"]["home_xg"])

    def test_manager_clash_identifies_mismatches(self):
        clash = compute_manager_clash(self.conn, "arsenal", "man-united")
        self.assertGreaterEqual(len(clash["mismatches"]), 1)

    def test_match_flow_scenarios_structure(self):
        from backend.repository import get_match_flow
        flow = get_match_flow(self.conn, "epl-2627-mw13-01")
        self.assertIsNotNone(flow)
        self.assertEqual(len(flow["flow"]["chapters"]), 3)
        self.assertIn("Scenario analysis", flow["flow"]["disclaimer"])

    def test_espn_live_parsers_and_2627_club_mapping(self):
        from backend.providers import _map_team_id, _parse_espn_score, _parse_espn_stats

        self.assertEqual(_map_team_id("Arsenal", "359"), "arsenal")
        self.assertEqual(_map_team_id("Hull City", "306"), "hull-city")
        self.assertEqual(_map_team_id("Ipswich Town", "373"), "ipswich")
        self.assertEqual(_map_team_id("Coventry City", "388"), "coventry")

        self.assertEqual(_parse_espn_score({"value": 2.0, "displayValue": "2"}), 2)
        self.assertEqual(_parse_espn_score("3"), 3)
        self.assertIsNone(_parse_espn_score(None))

        parsed = _parse_espn_stats([
            {"name": "totalShots", "displayValue": "14"},
            {"name": "shotsOnTarget", "displayValue": "6"},
            {"name": "wonCorners", "displayValue": "7"},
            {"name": "possessionPct", "displayValue": "58.4"},
        ])
        self.assertEqual(parsed["shots"], 14)
        self.assertEqual(parsed["shots_on_target"], 6)
        self.assertEqual(parsed["corners"], 7)
        self.assertEqual(parsed["possession_pct"], 58.4)
        self.assertNotIn("xg", parsed)

    def test_espn_summary_boxscore_parser(self):
        from backend.providers import _parse_espn_summary_boxscore

        payload = {
            "boxscore": {
                "teams": [
                    {
                        "team": {"id": "359", "displayName": "Arsenal"},
                        "statistics": [
                            {"name": "totalShots", "displayValue": "18"},
                            {"name": "shotsOnTarget", "displayValue": "7"},
                            {"name": "wonCorners", "displayValue": "9"},
                            {"name": "possessionPct", "displayValue": "62.5"},
                        ],
                    },
                    {
                        "team": {"id": "382", "displayName": "Manchester City"},
                        "statistics": [
                            {"name": "totalShots", "displayValue": "11"},
                            {"name": "shotsOnTarget", "displayValue": "4"},
                            {"name": "wonCorners", "displayValue": "5"},
                            {"name": "possessionPct", "displayValue": "37.5"},
                        ],
                    },
                ]
            }
        }
        h_stats, a_stats = _parse_espn_summary_boxscore(payload, "arsenal", "man-city")
        self.assertEqual(h_stats["shots"], 18)
        self.assertEqual(h_stats["shots_on_target"], 7)
        self.assertEqual(h_stats["possession_pct"], 62.5)
        self.assertEqual(a_stats["shots"], 11)
        self.assertEqual(a_stats["corners"], 5)
        self.assertNotIn("xg", h_stats)

    def test_exact_four_decimal_probability_sums(self):
        rows = self.conn.execute("SELECT id FROM teams").fetchall()
        team_ids = [r["id"] for r in rows]
        finished = [
            dict(r)
            for r in self.conn.execute(
                "SELECT id, matchweek, kickoff_utc, home_team_id, away_team_id, home_goals, away_goals FROM fixtures WHERE status = 'FINISHED'"
            ).fetchall()
        ]
        strengths, league_avg, ha, xg_avail = fit_team_strengths(finished, team_ids)
        for h_id, a_id in [("arsenal", "liverpool"), ("man-city", "hull-city"), ("ipswich", "coventry")]:
            pred = predict_match_distribution(
                strengths[h_id], strengths[a_id], league_avg, ha, xg_available=xg_avail
            )
            self.assertEqual(round(pred["prob_home"] + pred["prob_draw"] + pred["prob_away"], 4), 1.0)
            self.assertEqual(round(pred["over_2_5_prob"] + pred["under_2_5_prob"], 4), 1.0)

    def test_chronological_backtest_ignores_unknown_teams(self):
        rows = self.conn.execute("SELECT id FROM teams").fetchall()
        team_ids = [r["id"] for r in rows]
        finished = [
            dict(r)
            for r in self.conn.execute(
                "SELECT id, matchweek, kickoff_utc, home_team_id, away_team_id, home_goals, away_goals FROM fixtures WHERE status = 'FINISHED'"
            ).fetchall()
        ]
        finished.append({
            "id": "bad-match",
            "matchweek": 9,
            "kickoff_utc": "2026-10-20T15:00:00Z",
            "home_team_id": "unknown-club-x",
            "away_team_id": "arsenal",
            "home_goals": 1,
            "away_goals": 2,
        })
        bt = run_chronological_backtest(finished, team_ids, warmup_matchweek=3)
        self.assertGreater(bt["sample_matches"], 40)

    def test_repository_input_validation_rejects_bad_inputs(self):
        from backend.repository import (
            list_fixtures,
            predict_custom_pair,
            save_tactical_snapshot,
        )

        with self.assertRaises(ValueError):
            list_fixtures(self.conn, page=0)
        with self.assertRaises(ValueError):
            list_fixtures(self.conn, limit=999)
        with self.assertRaises(ValueError):
            list_fixtures(self.conn, status="BOGUS")
        with self.assertRaises(ValueError):
            list_fixtures(self.conn, matchweek=99)

        with self.assertRaises(ValueError):
            predict_custom_pair(self.conn, "arsenal", "arsenal")
        with self.assertRaises(ValueError):
            predict_custom_pair(self.conn, "arsenal", "not-a-club")

        with self.assertRaises(ValueError):
            compute_manager_clash(self.conn, "chelsea", "chelsea")

        with self.assertRaises(ValueError):
            simulate_what_if(
                self.conn,
                {
                    "home_team_id": "arsenal",
                    "away_team_id": "liverpool",
                    "home_formation": "9-9-9",
                    "unavailable_player_ids": [],
                    "swap_venue": False,
                },
            )

        with self.assertRaises(ValueError):
            save_tactical_snapshot(
                self.conn,
                {
                    "team_id": "arsenal",
                    "manager_id": "mikel-arteta",
                    "phase": "invalid_phase",
                    "players": [],
                },
            )

        with self.assertRaises(ValueError):
            save_tactical_snapshot(
                self.conn,
                {
                    "team_id": "arsenal",
                    "manager_id": "mikel-arteta",
                    "phase": "base",
                    "players": [{"id": f"p{i}", "x": 150, "y": 50} for i in range(11)],
                },
            )

    def test_build_espn_xi_selects_and_sorts_real_roster(self):
        from backend.providers import _build_espn_xi_for_team

        def make_ath(idx: int, pos: str, apps: int, goals: int = 0, saves: int = 0):
            return {
                "id": str(1000 + idx),
                "displayName": f"Player {pos}{idx}",
                "lastName": f"Last{pos}{idx}",
                "jersey": str(idx + 1),
                "position": {"abbreviation": pos},
                "statistics": {
                    "splits": {
                        "categories": [
                            {
                                "stats": [
                                    {"name": "appearances", "value": apps},
                                    {"name": "totalGoals", "value": goals},
                                    {"name": "saves", "value": saves},
                                ]
                            }
                        ]
                    }
                },
            }

        athletes = [
            make_ath(1, "G", 10, saves=25),
            make_ath(2, "G", 1, saves=2),
            make_ath(3, "D", 10),
            make_ath(4, "D", 9),
            make_ath(5, "D", 8),
            make_ath(6, "D", 7),
            make_ath(7, "D", 2),
            make_ath(8, "M", 10, goals=3),
            make_ath(9, "M", 9, goals=1),
            make_ath(10, "M", 8),
            make_ath(11, "F", 10, goals=7),
            make_ath(12, "F", 9, goals=4),
            make_ath(13, "F", 8, goals=2),
            make_ath(14, "F", 1, goals=0),
        ]
        xi = _build_espn_xi_for_team("arsenal", athletes)
        self.assertIsNotNone(xi)
        assert xi is not None
        self.assertEqual(len(xi), 11)
        self.assertEqual(xi[0]["name"], "Player G1")
        self.assertEqual(xi[0]["position"], "GK")
        self.assertEqual(xi[9]["name"], "Player F11")
        self.assertIsNone(_build_espn_xi_for_team("arsenal", athletes[:5]))

    def test_352_formation_and_passing_live_vs_demo_separation(self):
        from backend.tactical_builder import FORMATION_TEMPLATES, build_formation_players
        from backend.repository import get_match_passing_analysis, get_team_passing_analysis

        self.assertIn("3-5-2", FORMATION_TEMPLATES)
        self.assertEqual(len(FORMATION_TEMPLATES["3-5-2"]), 11)

        # Simulate a live provider DB state where is_demo is 0
        self.conn.execute("UPDATE provider_syncs SET is_demo = 0, provider = 'espn-live'")
        self.conn.commit()

        live_res = get_match_passing_analysis(
            self.conn, "epl-2627-mw13-01", team_side="home", formation="3-5-2", include_demo=False
        )
        self.assertIsNotNone(live_res)
        assert live_res is not None
        self.assertEqual(live_res["data_mode"], "unavailable_in_live_feed")
        self.assertFalse(live_res["is_demo_data"])
        self.assertEqual(live_res["formation"], "3-5-2")
        self.assertEqual(len(live_res["players"]), 11)
        self.assertEqual(live_res["links"], [])
        self.assertIsNone(live_res["summary"])

        # Explicit demo=True opt-in produces labeled demo passing links with exact summary sums
        demo_res = get_match_passing_analysis(
            self.conn, "epl-2627-mw13-01", team_side="away", formation="3-5-2", include_demo=True
        )
        self.assertIsNotNone(demo_res)
        assert demo_res is not None
        self.assertEqual(demo_res["data_mode"], "demo_sample")
        self.assertTrue(demo_res["is_demo_data"])
        self.assertEqual(demo_res["formation"], "3-5-2")
        self.assertGreater(len(demo_res["links"]), 10)
        summary = demo_res["summary"]
        self.assertIsNotNone(summary)
        self.assertEqual(
            summary["total_passes"],
            sum(l["total_passes"] for l in demo_res["links"]),
        )
        self.assertEqual(
            summary["completed_passes"] + summary["incomplete_passes"],
            summary["total_passes"],
        )

        # Team passing endpoint honors requested formation
        team_res = get_team_passing_analysis(self.conn, "arsenal", formation="4-2-3-1", include_demo=True)
        self.assertIsNotNone(team_res)
        assert team_res is not None
        self.assertEqual(team_res["formation"], "4-2-3-1")
        nodes = build_formation_players(team_res["players"], "3-5-2")
        self.assertEqual(len(nodes), 11)

    def test_team_comparison_splits_and_observed_stats(self):
        from backend.repository import get_match_prediction_bundle, get_team_comparison

        cmp = get_team_comparison(self.conn, "arsenal", "man-city")
        self.assertEqual(cmp["left"]["team"]["id"], "arsenal")
        self.assertEqual(cmp["right"]["team"]["id"], "man-city")

        for side_key in ("left", "right"):
            splits = cmp[side_key]["splits"]
            overall = splits["overall"]
            home = splits["home"]
            away = splits["away"]
            self.assertEqual(overall["played"], home["played"] + away["played"])
            self.assertEqual(overall["points"], home["points"] + away["points"])
            self.assertEqual(overall["clean_sheets"], home["clean_sheets"] + away["clean_sheets"])
            self.assertEqual(overall["gf"] - overall["ga"], overall["gd"])
            if overall["played"] > 0:
                self.assertAlmostEqual(overall["ppg"], round(overall["points"] / overall["played"], 2), places=2)

        with self.assertRaises(ValueError):
            get_team_comparison(self.conn, "arsenal", "arsenal")
        with self.assertRaises(ValueError):
            get_team_comparison(self.conn, "arsenal", "unknown-fc")

        finished_row = self.conn.execute(
            "SELECT id FROM fixtures WHERE status = 'FINISHED' LIMIT 1"
        ).fetchone()
        self.assertIsNotNone(finished_row)
        bundle = get_match_prediction_bundle(self.conn, finished_row["id"])
        self.assertIsNotNone(bundle)
        assert bundle is not None
        self.assertIn("observed_stats", bundle)
        self.assertIn("home", bundle["observed_stats"])
        self.assertIn("away", bundle["observed_stats"])


if __name__ == "__main__":
    unittest.main()
