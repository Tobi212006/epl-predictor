# Touchline — EPL Predictor

Touchline is a responsive Premier League match centre and tactical-analysis website. It brings fixtures and standings together with an animated pitch, match timeline, stat comparisons, lineup view, and shot-map view. The interface is inspired by the useful match-centre patterns found in football apps, with original branding and layout.

## Start locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and add a free `FOOTBALL_DATA_TOKEN` from [football-data.org](https://www.football-data.org/client/register).
4. Run `npm run dev` and open `http://localhost:5173`.

The token remains on the Express server. The server caches responses for ten minutes. Without a token, the site runs in an explicitly labelled design-preview mode with sample figures.

## Data honesty

The free football-data.org plan provides Premier League fixtures, results, and tables, with delayed scores and a 10-requests-per-minute limit. It does not provide the event-level coverage needed for live momentum, shot maps, xG, possession, actual lineups, or player ratings. Those panels are visibly marked as preview-only or unavailable until a licensed provider with those fields is configured. The app does not scrape FotMob or SofaScore endpoints.

The table-form comparison is an exploratory signal, not a trained or calibrated match prediction. Sample match stats and timeline events are clearly labelled as illustrative.

## Motion and accessibility

The pitch uses React Three Fiber for animated player tokens and a moving ball, with a CSS pitch fallback. Motion includes a slow stadium-light wash, an orbital hero mark, fixture-card transitions, and chart-draw reveals. Reduced-motion preferences are respected; data remains readable without animation.

## API routes

- `GET /api/v1/status`
- `GET /api/v1/fixtures?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/v1/standings`
- `GET /api/v1/matches/:id`

## Build and run

- `npm run build` creates the production frontend in `dist/`.
- `npm start` serves the built app and API through Express.
