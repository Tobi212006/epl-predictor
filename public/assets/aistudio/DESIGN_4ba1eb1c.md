# EPL Tactical Intelligence — Cinematic DESIGN.md

## 1. Creative direction
**Product:** EPL Tactical Intelligence  
**Tagline:** Read the game. Model the outcome.  
**Experience:** A premium football broadcast graphics package meets an interactive tactical analysis studio. Cinematic, fast, precise, immersive—not a betting website. The signature interaction is a full-pitch tactical transformation showing what a manager's team does **with the ball**, **without the ball**, and in **transitions**.

### Visual references (inspiration, not copied assets)
- Premium football television analysis graphics, tactical touchscreens, EA Sports FC-style team reveals, data-science dashboards.
- React Bits for curated headline, spotlight and reveal treatments; Motion/Framer Motion for UI transitions; GSAP ScrollTrigger for authored scroll scenes; Three.js + React Three Fiber for cinematic pitch rendering.
- Build original layouts and animation choreography. Do not copy copyrighted league broadcast packages, logos or club assets without permission.

## 2. Visual design system
| Token | Value | Use |
|---|---|---|
| Canvas | `#070B13` | Full-page background |
| Surface | `#111A29` | Panels |
| Elevated | `#1A293B` | Active cards |
| Text | `#F4F7FB` | Primary copy |
| Muted | `#A5B4C7` | Secondary text |
| Electric lime | `#B8F35B` | Active highlights |
| Electric cyan | `#66D4FF` | Home team / analytical layers |
| Ember orange | `#FFB36A` | Away team |
| Pitch | `#153D33` | Tactical surface |
| Pitch markings | `#79B59B` | Lines |
| Warning | `#F4C36A` | Stale / uncertain |
| Error | `#FF7788` | Failures |

Fonts: Space Grotesk for display/numerals, Inter for UI. Spacing on an 8px grid. Corners 12–20px. Use soft glows only around important active nodes, not every surface. Maintain accessible contrast and visible focus states.

## 3. Information architecture
1. **Overview** — current EPL season, fixtures, table, featured match, recent form, freshness.
2. **Match Center** — 1X2 probabilities, expected goals, likely scorelines, team comparison, explainability.
3. **Tactical Lab** — animated interactive pitch, formation states, passing networks, pressing traps, manager instructions.
4. **Manager DNA** — tactical identity, evidence, phase-specific formations, stylistic metrics and match examples.
5. **Manager vs Manager** — tactical confrontation, shared pitch, strengths and structural mismatches.
6. **Match Flow** — 0–30, 31–60, 61–90+ scenario playback, leading/level/trailing branches.
7. **What-if Lab** — lineup/formation adjustments, visual changes and valid quantitative recalculation.
8. **Methodology** — providers, timestamps, model version, calibration, limitations.

Desktop: slim left rail, sticky season/team picker top bar, broad central canvas. Mobile: compact header, bottom nav, full-width pitch with swipeable inspector below.

## 4. Signature animation: 3D Tactical Theatre
### Pitch presentation
- Render a low-poly or stylized photorealistic **3D pitch** with React Three Fiber; grass shader should be subtle, with faint alternating mowing stripes and clean white markings.
- Camera presets: **Broadcast Isometric**, **Top-down Analyst**, **Goal-side Press**, **Half-space Close-up**. Tween between camera positions; never snap abruptly.
- 11 player nodes per team: luminous rings / minimalist shirt-shaped tokens with numbers and short names. Colors + shapes differentiate sides; labels remain legible at all camera angles.
- Phase tabs: **Base**, **In Possession**, **Out of Possession**, **Attack Transition**, **Defensive Transition**. Optional set pieces only with evidence.
- On phase change, animate node positions using stable player IDs and interpolated coordinates (650–1100 ms); stagger minimally for cinematic effect while preserving tactical accuracy.
- Display formations as morphing labels: e.g. `4-3-3 → 3-2-5 → 4-4-2`. These are **illustrative examples only**, never attributed to a real manager without dated evidence.
- Passing paths: curved cyan lines with animated traveling particles; pressing arrows: orange pulse; defensive compactness: translucent connected polygons; overload zones: softly shaded half-spaces; rest-defense: dashed structure lines.
- Clicking a player pauses animation and opens a role inspector: starting zone, movement, tactical task, links, evidence level.
- Click an arrow to see its meaning; an arrow must not masquerade as observed tracking data.
- Controls: play/pause, 0.5×/1×/1.5× speed, reset, orbit/zoom limits, camera presets, layer toggles, switch attacking direction, compare states.

### Cinematic camera choreography
1. **Entrance (2–3 seconds max, skippable):** stadium-dark canvas; thin pitch lines draw into place; camera glides down to analyst angle; headline reveals.
2. **Team selection:** crest/name cards slide into opposite corners; pitch rotates into match orientation; team colors animate into player nodes.
3. **Possession switch:** camera pulls slightly upward; player nodes flow into attacking structure; passing lanes draw sequentially; annotations appear after movement settles.
4. **Out-of-possession switch:** camera shifts to defensive side; nodes contract into block; pressing triggers pulse; compactness shape fades in.
5. **Manager comparison:** two mini pitches slide together into one shared tactical board, with contrasting nodes and annotated mismatch zones.
6. **Prediction reveal:** animated 1X2 probability bar fills once, expected-goal values count up once, score distribution rises in order. No slot-machine or gambling aesthetics.
7. **Scroll storytelling:** pinned tactical explainer sections use GSAP ScrollTrigger to transition camera and overlays at explicit chapter boundaries; all content must remain accessible without scroll animation.

## 5. Motion language and limits
| Interaction | Animation | Duration target |
|---|---|---|
| Hover/focus | Border glow + 2px lift | 120–180ms |
| Card enter | Opacity + translateY(16px) | 350–500ms |
| Route change | Crossfade + restrained slide | 250–400ms |
| Tactical node morph | Position interpolation + arrow redraw | 650–1100ms |
| Camera preset | Damped position/quaternion tween | 800–1400ms |
| Prediction bar | Width transition, once per update | 650–900ms |
| Overlay line draw | Stroke reveal + subtle particles | 400–900ms |
| Hero reveal | Text mask + pitch line drawing | 1400–2500ms |

Use **Motion** for component lifecycle, **GSAP** for authored scroll sequences, **React Three Fiber** for 3D objects. Avoid competing animation systems on the same property. React Bits effects are optional accents, not a dependency for core navigation. No perpetual camera movement, aggressive flashes, motion blur that reduces legibility, or forced intro replay.

## 6. Page-specific design
### Overview
Large featured fixture hero; 3D miniature pitch with gently animated tactical preview; clean league table and form cards; current season and data timestamp always visible. First paint should show meaningful content, not wait for WebGL.

### Match Center
Team-versus-team header, kickoff and venue; 100% stacked home/draw/away probability bar, xG projection, top scorelines, season-vs-last-five comparison. Reveal **Why this prediction?** with model inputs, uncertainty and source references. Animated metrics never imply more precision than the model supports.

### Tactical Lab
Desktop: pitch 65%, inspector 35%. Mobile: pitch full width, inspector below. Tabs for tactical phases, overlay toggles, timeline, source badges (**Observed**, **Analyst interpretation**, **Illustrative**). Top-down SVG/Canvas fallback must remain fully functional.

### Manager DNA
Manager card with team, appointment dates, sample size, dated evidence; possession/defensive snapshots side by side; optional measured indicators for pressing intensity, width, tempo and buildup. No unsupported radar chart values. Animate one tactical change at a time on selection.

### Manager vs Manager
Split pitches → shared tactical board transition. Highlight wide overloads, press vs buildup, half-space access, high-line exposure and transition vulnerabilities. Each annotation labeled **Data-supported** or **Tactical hypothesis**. Allow side reversal and independent layer toggles.

### Match Flow
A scrubber with 0–30 / 31–60 / 61–90+ phases. Show likely tactical scenarios conditional on score state: level, home ahead, away ahead. Clearly label **Scenario analysis — not observed future events**. Changes in score state alter annotated hypothetical formations; do not invent future goals, cards or substitutions.

### What-if Lab
Formation picker, player availability, role adjustments and comparison toggle. Update visual diagram immediately; enable **Recalculate** only when a validated model can quantify the input. Otherwise say **Tactical visualization only — insufficient data to revise probabilities**.

## 7. 3D implementation details
- World pitch coordinate mapping from canonical 2D `x,y ∈ [0,100]` to world space; tactical snapshots remain renderer-independent.
- Use instanced geometry for repeated markers/particles, shared materials, capped DPR (e.g. 1–1.75), no expensive dynamic shadows by default.
- Use camera damping, constrained orbit controls and hit targets that work on touch.
- Prefer vector pitch markings, procedural shapes and CSS typography. Load any models/fonts lazily and honor licenses.
- Render charts and data in semantic HTML outside WebGL for accessibility and SEO.
- Avoid mounting multiple heavyweight 3D scenes simultaneously; suspend offscreen scenes and dispose textures/geometries.
- Test low-end Android devices and 360px screens; offer **Performance: Auto / Cinematic / Lite** toggle. Lite uses SVG/2D pitch with the same interactions.
- Honor `prefers-reduced-motion`: no camera travel, no particle flow, near-instant node transitions, static overlays, and no pinned scroll sequences.

## 8. Data integrity and confidence UI
Every card has states: `loading`, `fresh`, `stale`, `missing`, `error`, `demo`. Show season, timestamp, provider and metric definitions. Distinguish official scores, third-party xG, analyst-authored manager diagrams and model simulations. No fake live stats, fabricated player tracking, invented lineups or unverified manager appointments.

## 9. Components
`AppShell`, `CinematicHero`, `SeasonSelector`, `FixtureCard`, `LeagueTable`, `PredictionReveal`, `ProbabilityBar`, `ScorelineChart`, `FormSparkline`, `TacticalTheatre3D`, `PitchFallback2D`, `PlayerNode3D`, `TacticalEdge`, `PressingZone`, `FormationMorphController`, `CameraPresetSelector`, `PhaseToggle`, `PlaybackControls`, `ManagerDNA`, `EvidenceDrawer`, `ManagerClash`, `MatchFlowScrubber`, `ScenarioPanel`, `DataFreshnessBadge`, `MotionSettings`, `LoadingSkeleton`, `EmptyState`.

## 10. Acceptance criteria
- A user can switch a real or clearly illustrative team between in/out-of-possession shapes and watch all 11 nodes move consistently.
- Manager-vs-manager comparison visually highlights at least one documented/hypothetical tactical interaction.
- Camera presets, playback controls, speed, layer toggles and 2D fallback all work.
- Prediction data comes from backend calculations, never UI constants disguised as live predictions.
- On mobile Lite mode, tactical analysis remains complete and readable.
- Keyboard, touch and reduced-motion users can access the same insights.
- All animation is intentional and never obscures source attribution or uncertainty.
