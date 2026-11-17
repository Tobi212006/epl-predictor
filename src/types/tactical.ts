export type TacticalPhase =
  | 'base'
  | 'in_possession'
  | 'out_of_possession'
  | 'attack_transition'
  | 'defensive_transition';

export type CameraPreset = 'broadcast' | 'topdown' | 'goalside' | 'halfspace';

export type EvidenceType = 'Observed' | 'Analyst interpretation' | 'Illustrative';

export interface PlayerNode {
  id: string;
  name: string;
  short_name: string;
  shirt_number: number;
  role: string;
  x: number; // [0, 100]
  y: number; // [0, 100]
  status: 'AVAILABLE' | 'DOUBTFUL' | 'UNAVAILABLE';
}

export interface TacticalEdge {
  from: string;
  to: string;
  type: 'pass' | 'press' | 'cover' | 'overlap' | 'rest_defense';
  weight: number;
  label?: string;
}

export interface TacticalZone {
  id: string;
  label: string;
  type: 'half_space' | 'rest_defense' | 'compactness' | 'press_trap';
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  player_ids?: string[];
}

export interface TacticalSnapshot {
  id: string;
  team_id: string;
  manager_id: string;
  valid_from: string;
  phase: TacticalPhase;
  formation_label: string;
  players: PlayerNode[];
  edges: TacticalEdge[];
  zones: TacticalZone[];
  annotations: string[];
  source_refs: string[];
  confidence: 'high' | 'medium' | 'low';
  evidence_type: EvidenceType;
}

export interface OverlayVisibility {
  passing: boolean;
  pressing: boolean;
  halfSpaces: boolean;
  compactness: boolean;
  restDefense: boolean;
}

export interface DataStatus {
  season: { id: string; label: string; start_date?: string; end_date?: string };
  provider: string;
  status: 'fresh' | 'stale' | 'error' | 'demo';
  is_demo: boolean;
  xg_available: boolean;
  last_synced_at: string;
  error_message?: string | null;
  fixtures_total: number;
  fixtures_finished: number;
  fixtures_live?: number;
  model_version?: { version_tag: string; trained_at: string; sample_matches: number } | null;
  setup_hint: string;
}

export interface StandingRow {
  position: number;
  team_id: string;
  name: string;
  short_name: string;
  tla: string;
  primary_color: string;
  secondary_color: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  xg_for: number | null;
  xg_against: number | null;
  form: string[];
}

export interface FixtureItem {
  id: string;
  season_id: string;
  matchweek: number;
  kickoff_utc: string;
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED';
  venue: string;
  home_team_id: string;
  away_team_id: string;
  home_goals: number | null;
  away_goals: number | null;
  live_clock?: string | null;
  live_detail?: string | null;
  is_demo: number;
  provider: string;
  retrieved_at: string;
  home_name: string;
  home_short: string;
  home_tla: string;
  home_color: string;
  home_secondary?: string;
  away_name: string;
  away_short: string;
  away_tla: string;
  away_color: string;
  away_secondary?: string;
  home_xg: number | null;
  away_xg: number | null;
  prob_home: number | null;
  prob_draw: number | null;
  prob_away: number | null;
  over_2_5_prob?: number | null;
  top_scorelines?: Array<{ home: number; away: number; probability: number }>;
  confidence_label: 'high' | 'medium' | 'low' | null;
  xg_mode: 'xg_blended' | 'goals_based_fallback' | null;
  home_shots?: number | null;
  away_shots?: number | null;
  home_sot?: number | null;
  away_sot?: number | null;
  home_poss?: number | null;
  away_poss?: number | null;
}

export interface FeatureContribution {
  key: string;
  label: string;
  value: number;
  direction: 'home' | 'away' | 'neutral';
  detail: string;
}

export interface PredictionData {
  home_xg: number;
  away_xg: number;
  prob_home: number;
  prob_draw: number;
  prob_away: number;
  over_2_5_prob: number;
  under_2_5_prob: number;
  top_scorelines: Array<{ home: number; away: number; probability: number }>;
  score_grid: number[][];
  feature_contributions: FeatureContribution[];
  uncertainty: {
    home_xg_interval: [number, number];
    away_xg_interval: [number, number];
    prob_home_interval: [number, number];
    prob_away_interval: [number, number];
    min_sample_size: number;
  };
  confidence_label: 'high' | 'medium' | 'low';
  xg_mode: 'xg_blended' | 'goals_based_fallback';
  version_tag?: string;
  algorithm?: string;
}

export interface TacticalProfile {
  id: string;
  manager_id: string;
  team_id: string;
  season_id: string;
  valid_from: string;
  base_formation: string;
  in_possession_shape: string;
  out_of_possession_block: string;
  buildup_structure: string;
  pressing_triggers: string;
  rest_defense: string;
  width_profile: string;
  tempo_profile: string;
  transition_attack: string;
  transition_defense: string;
  sub_tendencies: string;
  pressing_intensity_idx: number;
  width_idx: number;
  tempo_idx: number;
  buildup_directness_idx: number;
  sample_size_matches: number;
  confidence: 'high' | 'medium' | 'low';
  evidence_type: EvidenceType;
  source_refs: string[];
}

export interface ManagerSummary {
  id: string;
  name: string;
  nationality: string;
  preferred_system: string;
  bio_note: string;
  team_id: string;
  valid_from: string;
  appointment_evidence: EvidenceType;
  team_name: string;
  team_short: string;
  team_tla: string;
  primary_color: string;
  base_formation: string;
  in_possession_shape: string;
  out_of_possession_block: string;
  sample_size_matches: number;
  confidence: 'high' | 'medium' | 'low';
  pressing_intensity_idx: number;
  width_idx: number;
  tempo_idx: number;
  buildup_directness_idx: number;
}

export type PassFilterMode = 'all' | 'completed' | 'incomplete' | 'key';

export interface PassingLink {
  from_id: string;
  to_id: string;
  from_name: string;
  to_name: string;
  total_passes: number;
  completed_passes: number;
  incomplete_passes: number;
  key_passes: number;
}

export interface PassingSummary {
  total_passes: number;
  completed_passes: number;
  incomplete_passes: number;
  completion_pct: number;
  key_passes: number;
  most_connected_pair: {
    from_name: string;
    to_name: string;
    total_passes: number;
    completed_passes: number;
  } | null;
}

export interface PassingAnalysisData {
  fixture_id?: string;
  team_side?: 'home' | 'away';
  home_team_id?: string;
  away_team_id?: string;
  team: {
    id: string;
    name: string;
    short_name: string;
    tla: string;
    primary_color: string;
    secondary_color: string;
    venue: string;
  };
  formation: string;
  available_formations: string[];
  data_mode: 'demo_sample' | 'unavailable_in_live_feed';
  is_demo_data: boolean;
  disclaimer: string | null;
  api_limitation_note: string | null;
  observed_team_stats: {
    shots: number | null;
    shots_on_target: number | null;
    corners: number | null;
    possession_pct: number | null;
    stats_provenance?: string | null;
  } | null;
  players: PlayerNode[];
  links: PassingLink[];
  summary: PassingSummary | null;
}

export interface ObservedTeamMatchStats {
  team_id: string;
  is_home: number;
  goals: number | null;
  xg: number | null;
  xga: number | null;
  shots: number | null;
  shots_on_target: number | null;
  corners: number | null;
  possession_pct: number | null;
  ppda: number | null;
  stats_provenance?: string | null;
}

export interface TeamSplitBucket {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  clean_sheets: number;
  ppg: number;
}

export interface TeamSplitMetrics {
  overall: TeamSplitBucket;
  home: TeamSplitBucket;
  away: TeamSplitBucket;
  form: string[];
  goals_for_pg: number;
  goals_against_pg: number;
  xg_for_pg: number | null;
  xg_against_pg: number | null;
  avg_shots_pg: number | null;
  avg_possession_pct: number | null;
  observed_stats_matches: number;
}

export type HeatmapActionType = 'touch' | 'progressive' | 'defensive';

export interface HeatmapSamplePoint {
  id: string;
  playerId: string;
  x: number; // [0, 100] canonical pitch length
  y: number; // [0, 100] canonical pitch width
  weight: number; // [0.4, 1.5]
  actionType: HeatmapActionType;
}

export interface HeatmapGridCell {
  col: number;
  row: number;
  x: number; // center in [0, 100]
  y: number; // center in [0, 100]
  intensity: number; // normalized [0, 1]
}

export interface HeatmapSummary {
  sampleCount: number;
  defensiveThirdPct: number;
  middleThirdPct: number;
  finalThirdPct: number;
  leftChannelPct: number;
  centralChannelPct: number;
  rightChannelPct: number;
  avgX: number;
  avgY: number;
  peakZoneLabel: string;
  peakIntensityPct: number;
}


