# EPL Tactical Intelligence

**Read the game. Model the outcome.**

A 2026–27 English Premier League probabilistic match predictor and interactive tactical analysis studio. Built with React 19, TypeScript, Tailwind CSS v4, Three.js / React Three Fiber, Motion, Recharts, Express (`server.ts`), SQLite, and a Python 3.10 statistical prediction engine.

---

## Core Architecture

- **Quantitative Python Engine (`backend/model_engine.py`)**:
  - Iterative opponent-adjusted log-linear Poisson attack/defense strengths with Bayesian sample-size shrinkage (`k = 6.0`).
  - Optional xG/xGA blending (`xg_weight = 0.55`) **only** when verified xG data exists for both clubs; otherwise falls back automatically to **goals-based estimation** with lowered confidence (never fabricates xG).
  - Joint Poisson score grid (`0..8` goals + analytical tail handling) with chronologically validated **Dixon–Coles** low-score correlation adjustment (`rho = -0.075`).
  - Strictly causal walk-forward backtesting (no future matchweek leakage), computing **Brier Score**, **Multi-class Log Loss**, empirical baseline comparison, and **5-bin Reliability Calibration**.
- **Formation & Passing Analysis (`src/components/pitch/FormationPassingPanel.tsx` & `backend/tactical_builder.py`)**:
  - Supports Home / Away team switching and tactical formation templates (`4-3-3`, `4-2-3-1`, `3-5-2`, `4-4-2`, `3-4-2-1`, `3-2-5`, `4-1-4-1`, `5-3-2`).
  - Interactive player selection isolates a single player's passing connections and computes partner breakdown metrics (`Attempted`, `Completed`, `Completion %`, `Key Passes`, `Top Partners`), with pass-type filters (`All passes`, `Completed`, `Incomplete`, `Key passes`).
  - **Honest Live vs. Demo Separation**: Live public APIs do not expose event-level pass tracking. In live mode, `GET /api/v1/matches/:id/passing` defaults to `data_mode: "unavailable_in_live_feed"`, shows observed team boxscore totals where available, and lets the user explicitly opt into **Load Sample Demo Passing Data** (strictly badged `Demo Sample · Not Live Match Data`).
- **3D Tactical Theatre & 2D SVG Fallback (`src/components/pitch/`)**:
  - Three.js / React Three Fiber pitch with procedural turf texture, vector pitch lines, composite 3D player tokens, damped phase morphing (`Base`, `In Possession`, `Out of Possession`, `Attack Transition`, `Defensive Transition`), camera presets, Analyst Node Editor, and JSON/SVG/PNG diagram export, with automatic fallback to `PitchFallback2D`.
- **Normalized Persistence (`backend/schema.sql`)**:
  - 14 SQLite tables (`seasons`, `teams`, `players`, `managers`, `manager_appointments`, `fixtures`, `match_team_stats`, `player_availability`, `tactical_profiles`, `tactical_snapshots`, `source_references`, `model_versions`, `predictions`, `provider_syncs`).

---

## Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Copy environment configuration
cp .env.example .env

# 3. Start full-stack dev server (Express + Vite + Python RPC engine on port 3000)
npm run dev

# 4. Run test suites (Vitest + Python unittest)
npm test

# 5. Typecheck & production build
npm run lint
npm run build
npm start
```

### Environment Variables (`.env`)

- `DATA_PROVIDER`: `"auto"` (default, uses `espn-live` or `football-data` if key is set), `"espn-live"`, `"football-data"`, `"openfootball"`, or `"demo"`.
- `FOOTBALL_DATA_API_KEY`: Optional API token from [football-data.org](https://www.football-data.org/) for `DATA_PROVIDER="football-data"`.
- `DATABASE_PATH`: Path to SQLite database file (default `./data/epl_tactical.db`).
- `ADMIN_API_TOKEN`: Optional bearer token protecting tactical snapshot edits and manual data refresh endpoints.

---

## Data Providers & Free-Tier API Limitations

1. **ESPN Public EPL Feed (`eng.1`)**: Zero-key live scores, standings, 380 fixtures, match clock, and team boxscore totals (`shots`, `shots_on_target`, `corners`, `possession_pct`) for finished/live fixtures where reported. Does **not** provide xG or event-level player pass coordinates.
2. **football-data.org v4 Free Tier**:
   - **Rate limit**: 10 requests/minute (`HTTP 429` if exceeded).
   - **Coverage**: 12 free-tier competitions, current season only, delayed scores.
   - **Missing data**: Free tier does **not** include match stats, lineups, xG/xGA, or player-to-player pass tracking, and requires attribution to football-data.org.
   - When connected, the engine automatically sets `xg_available = false` and runs in transparent `goals_based_fallback` mode.

---

## Reference Repository Attribution & Methodology Notes

Inspired by concepts from [`SUYOGRAGHAV556/epl-league-predictor-`](https://github.com/SUYOGRAGHAV556/epl-league-predictor-):
- **Reused concepts**: Strictly causal chronological matchweek splitting, walk-forward calibration/Brier/log-loss evaluation, and clear separation between synthetic demo data and real feeds.
- **Adapted / Not reused**: Replaced local CSV/joblib scripts with a real-time SQLite + Python RPC engine; excluded unvalidated numeric tactical bonuses so formation choices update tactical diagrams without fabricating probability changes.

## Known Limitations

- Predictions are **probabilistic estimates** derived from historical team scoring/conceding rates and recency weighting, not guaranteed outcomes.
- Poisson + Dixon–Coles models `(0,0), (1,0), (0,1), (1,1)` correlation; mid-game red cards and weather are not modeled unless observed.
- Animated passing lanes, pressing triggers, 90-minute match-flow timelines, and demo passing matrices are **schematic illustrations / labeled demo samples**, not observed optical player tracking data.
