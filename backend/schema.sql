-- Normalized relational schema for EPL Tactical Intelligence

CREATE TABLE IF NOT EXISTS seasons (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    is_current INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    tla TEXT NOT NULL,
    primary_color TEXT NOT NULL,
    secondary_color TEXT NOT NULL,
    venue TEXT NOT NULL,
    founded INTEGER,
    provider_id TEXT
);

CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    shirt_number INTEGER NOT NULL,
    position TEXT NOT NULL,
    role_code TEXT NOT NULL,
    is_key_starter INTEGER NOT NULL DEFAULT 1,
    xg_share REAL NOT NULL DEFAULT 0.08,
    xga_impact REAL NOT NULL DEFAULT 0.05
);

CREATE TABLE IF NOT EXISTS managers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    nationality TEXT NOT NULL,
    preferred_system TEXT NOT NULL,
    bio_note TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_references (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    publisher TEXT NOT NULL,
    url TEXT NOT NULL,
    published_at TEXT NOT NULL,
    retrieved_at TEXT NOT NULL,
    evidence_type TEXT NOT NULL CHECK (evidence_type IN ('Observed', 'Analyst interpretation', 'Illustrative')),
    notes TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS manager_appointments (
    id TEXT PRIMARY KEY,
    manager_id TEXT NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    valid_from TEXT NOT NULL,
    valid_to TEXT,
    is_current INTEGER NOT NULL DEFAULT 1,
    source_ref_id TEXT REFERENCES source_references(id),
    evidence_type TEXT NOT NULL CHECK (evidence_type IN ('Observed', 'Analyst interpretation', 'Illustrative'))
);

CREATE TABLE IF NOT EXISTS fixtures (
    id TEXT PRIMARY KEY,
    season_id TEXT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    matchweek INTEGER NOT NULL,
    kickoff_utc TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED')),
    venue TEXT NOT NULL,
    home_team_id TEXT NOT NULL REFERENCES teams(id),
    away_team_id TEXT NOT NULL REFERENCES teams(id),
    home_goals INTEGER,
    away_goals INTEGER,
    live_clock TEXT,
    live_detail TEXT,
    is_demo INTEGER NOT NULL DEFAULT 1,
    provider TEXT NOT NULL,
    retrieved_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS match_team_stats (
    id TEXT PRIMARY KEY,
    fixture_id TEXT NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
    team_id TEXT NOT NULL REFERENCES teams(id),
    is_home INTEGER NOT NULL,
    goals INTEGER NOT NULL,
    xg REAL,
    xga REAL,
    shots INTEGER,
    shots_on_target INTEGER,
    corners INTEGER,
    possession_pct REAL,
    ppda REAL,
    xg_source TEXT,
    stats_provenance TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS player_availability (
    id TEXT PRIMARY KEY,
    fixture_id TEXT NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    team_id TEXT NOT NULL REFERENCES teams(id),
    status TEXT NOT NULL CHECK (status IN ('AVAILABLE', 'DOUBTFUL', 'UNAVAILABLE')),
    reason TEXT NOT NULL,
    source_ref_id TEXT REFERENCES source_references(id),
    retrieved_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tactical_profiles (
    id TEXT PRIMARY KEY,
    manager_id TEXT NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    season_id TEXT NOT NULL REFERENCES seasons(id),
    valid_from TEXT NOT NULL,
    base_formation TEXT NOT NULL,
    in_possession_shape TEXT NOT NULL,
    out_of_possession_block TEXT NOT NULL,
    buildup_structure TEXT NOT NULL,
    pressing_triggers TEXT NOT NULL,
    rest_defense TEXT NOT NULL,
    width_profile TEXT NOT NULL,
    tempo_profile TEXT NOT NULL,
    transition_attack TEXT NOT NULL,
    transition_defense TEXT NOT NULL,
    sub_tendencies TEXT NOT NULL,
    pressing_intensity_idx REAL NOT NULL,
    width_idx REAL NOT NULL,
    tempo_idx REAL NOT NULL,
    buildup_directness_idx REAL NOT NULL,
    sample_size_matches INTEGER NOT NULL,
    confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
    evidence_type TEXT NOT NULL CHECK (evidence_type IN ('Observed', 'Analyst interpretation', 'Illustrative')),
    source_refs_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tactical_snapshots (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    manager_id TEXT NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
    valid_from TEXT NOT NULL,
    phase TEXT NOT NULL CHECK (phase IN ('base', 'in_possession', 'out_of_possession', 'attack_transition', 'defensive_transition')),
    formation_label TEXT NOT NULL,
    players_json TEXT NOT NULL,
    edges_json TEXT NOT NULL,
    zones_json TEXT NOT NULL,
    annotations_json TEXT NOT NULL,
    source_refs_json TEXT NOT NULL,
    confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
    evidence_type TEXT NOT NULL CHECK (evidence_type IN ('Observed', 'Analyst interpretation', 'Illustrative')),
    UNIQUE(team_id, manager_id, phase)
);

CREATE TABLE IF NOT EXISTS model_versions (
    id TEXT PRIMARY KEY,
    version_tag TEXT NOT NULL,
    algorithm TEXT NOT NULL,
    dixon_coles_rho REAL NOT NULL,
    home_advantage REAL NOT NULL,
    shrinkage_k REAL NOT NULL,
    xg_weight REAL NOT NULL,
    brier_score REAL NOT NULL,
    log_loss REAL NOT NULL,
    baseline_brier REAL NOT NULL,
    baseline_log_loss REAL NOT NULL,
    calibration_json TEXT NOT NULL,
    sample_matches INTEGER NOT NULL,
    trained_at TEXT NOT NULL,
    notes TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS predictions (
    id TEXT PRIMARY KEY,
    fixture_id TEXT NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
    model_version_id TEXT NOT NULL REFERENCES model_versions(id),
    home_xg REAL NOT NULL,
    away_xg REAL NOT NULL,
    prob_home REAL NOT NULL,
    prob_draw REAL NOT NULL,
    prob_away REAL NOT NULL,
    over_2_5_prob REAL NOT NULL,
    under_2_5_prob REAL NOT NULL,
    top_scorelines_json TEXT NOT NULL,
    score_grid_json TEXT NOT NULL,
    feature_contributions_json TEXT NOT NULL,
    uncertainty_json TEXT NOT NULL,
    confidence_label TEXT NOT NULL CHECK (confidence_label IN ('high', 'medium', 'low')),
    xg_mode TEXT NOT NULL CHECK (xg_mode IN ('xg_blended', 'goals_based_fallback')),
    computed_at TEXT NOT NULL,
    UNIQUE(fixture_id, model_version_id)
);

CREATE TABLE IF NOT EXISTS provider_syncs (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    season_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('fresh', 'stale', 'error', 'demo')),
    records_synced INTEGER NOT NULL,
    xg_available INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    is_demo INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_fixtures_season_mw ON fixtures(season_id, matchweek);
CREATE INDEX IF NOT EXISTS idx_stats_fixture ON match_team_stats(fixture_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_team ON tactical_snapshots(team_id, phase);
CREATE INDEX IF NOT EXISTS idx_predictions_fixture ON predictions(fixture_id);
