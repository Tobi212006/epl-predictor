# DESIGN.md — EPL Tactical Intelligence Visual & Spatial Specification

**Product:** EPL Tactical Intelligence — *Read the game. Model the outcome.*
**Season:** 2026–27 English Premier League

---

## 1. Visual Identity & Color Constitution

The application unifies every page, chart, 3D stage, and card under the official **Premier League Floodlit Royal Purple** visual language:

| Token | Hex | Usage |
| :--- | :--- | :--- |
| `--color-canvas` | `#12061E` / `#0E081C` | Primary page canvas and 3D WebGL stage fog/apron |
| `--color-pl-purple` | `#37003C` | Header surfaces, active navigation highlights, battle banners, primary brand accents |
| `--color-surface` | `#1A1230` / `#1A0524` | Elevated cards, inspector overlays, table containers |
| `--color-elevated` | `#261644` | Hover states, active chapter selections, modal backdrops |
| `--color-lime-accent` | `#00FF85` | Electric Mint — primary CTAs, selection rings, focus outlines, rest-defense vectors |
| `--color-cyan-home` | `#04F5FF` | Home club indicators, progressive passing arcs, half-space zones |
| `--color-orange-away` | `#FF2882` | Away club indicators, pressing trap triggers, unavailable player warnings |
| `--color-pitch` | `#165442` / `#1A5E4B` | Mowed pitch turf stripes (both 3D WebGL canvas and 2D SVG Analyst Pitch) |
| `--color-pitch-line` | `#8CE0B8` / `#9AEAC4` | Pitch boundary & box line markings |
| `--color-ink` | `#F8FAFC` | Primary high-contrast body and display text |
| `--color-muted` | `#C9BBE0` | Lavender-slate secondary copy and telemetry labels |

### Accessibility & Contrast Rules
- **Always-on Premium Experience:** There is **no** `auto | cinematic | lite` toggle; 3D WebGL (`TacticalTheatre3D`) renders automatically whenever WebGL is available, falling back seamlessly to `PitchFallback2D` only if WebGL fails/context is lost or inside 2D pointer-drag node editing.
- **Native Cursor:** Standard crisp OS pointer (`cursor: pointer` / `grab`) with zero custom floating cursor overlays.
- **Focus & Numbers:** `:focus-visible` renders a `2px solid #00FF85` outline; all scores, probabilities, xG projections, and standings rows enforce `font-variant-numeric: tabular-nums`.

---

## 2. Typography Hierarchy

| Role | Font Family | Characteristics |
| :--- | :--- | :--- |
| **Display / Hero** | `Urbanist` / `Outfit` | Tight tracking (`-0.025em`), bold weight (`700–800`), frosted gradient-clipped hero headlines |
| **Editorial** | `Newsreader` / `Gilda Display` | High-contrast serif for fixture matchups, dossier titles, and section headlines |
| **Body & UI** | `DM Sans` | Clean sans-serif for tactical analysis paragraphs, form notes, and tooltips |
| **Telemetry / Code** | `JetBrains Mono` | Monospace for matchweek tags, shirt numbers, live clocks, xG, and scoreline matrices |

---

## 3. Core Football Components

1. **`ClubKitBadge` (`/src/components/common/FootballMotifs.tsx`)**:
   - Bespoke SVG jersey silhouettes for all 20 Premier League 2026–27 clubs supporting authentic kit patterns (`stripes`, `hoops`, `sash`, `halves`, `collar`, `vneck`, `solid`) plus automatic away-kit clash inversion via `areKitColorsClose()`.
2. **`StadiumBattleBanner` (`/src/components/common/StadiumBattleBanner.tsx`)**:
   - Full-width Home vs Away stadium matchup banner featuring floodlit radial club glow, authentic `ClubKitBadge` kits, manager & formation metadata, live/finished scorelines, and expected goals readout.
3. **`CinematicStadiumHero` (`/src/components/hero/CinematicStadiumHero.tsx`)**:
   - Three-slide full-bleed stadium showcase with soft right-to-left misty gradient wipes, concentric orbital slide rings, and an instant Home/Away matchup predictor bar bound to real Python Poisson + Dixon–Coles calibration metadata (`dataStatus`).
4. **`MatchdayShelf3D` (`/src/components/shelf/MatchdayShelf3D.tsx`)**:
   - 3D CSS `preserve-3d` turning-spine matchday shelf (`3×N` wrapped cuboids) with WAAPI clip-path expansion and SVG fractal turbulence ink-blot poster reveal into the full-screen Matchday Tactical Dossier.
5. **`TacticalTheatreStage` (`/src/components/pitch/TacticalTheatreStage.tsx`)**:
   - Synchronized 5-phase formation engine (`base`, `in_possession`, `out_of_possession`, `attack_transition`, `defensive_transition`) supporting 3D sculpted jersey tokens (`TacticalTheatre3D`) and direct-manipulation 2D node editing (`PitchFallback2D`).

---

## 4. Quantitative & Tactical Honesty Rules

- **Real Live EPL Data:** Connects to ESPN's public 2026–27 Premier League API (`eng.1/standings`, `scoreboard`, `teams/{id}/schedule`, and `summary?event={id}` boxscores) with optional `football-data.org` v4 integration.
- **No Fabricated xG:** When an external feed omits xG, `xg` remains `NULL` in SQLite, `xg_mode` reports `goals_based_fallback`, and recent form panels display real observed match telemetry (shots & possession) or `"Goals only"`.
- **What-If Gating:** Schematic formation tweaks return `tactical_only` with baseline probabilities unchanged; only validated squad availability or venue reversals recompute numeric probabilities.
