import type {
  DataStatus,
  FixtureItem,
  ManagerSummary,
  ObservedTeamMatchStats,
  PassingAnalysisData,
  PredictionData,
  StandingRow,
  TacticalPhase,
  TacticalProfile,
  TacticalSnapshot,
  TeamSplitMetrics,
} from '../types/tactical';

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody?.error) msg = errBody.error;
    } catch {
      // ignore non-json
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getDataStatus: () => apiFetch<DataStatus>('/api/v1/data/status'),
  refreshData: (provider?: string) =>
    apiFetch<{ sync: unknown; status: DataStatus }>('/api/v1/data/refresh', {
      method: 'POST',
      body: JSON.stringify({ provider }),
    }),
  liveTick: () =>
    apiFetch<{ tick: { updated: number; finished_changed: boolean; checked_at: string }; status: DataStatus }>(
      '/api/v1/data/live-tick',
      { method: 'POST' },
    ),
  getStandings: () => apiFetch<{ standings: StandingRow[]; status: DataStatus }>('/api/v1/standings'),
  getFixtures: (params?: { status?: string; matchweek?: number; team_id?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.matchweek !== undefined) q.set('matchweek', String(params.matchweek));
    if (params?.team_id) q.set('team_id', params.team_id);
    if (params?.limit) q.set('limit', String(params.limit));
    return apiFetch<{ items: FixtureItem[]; total: number; page: number; limit: number }>(
      `/api/v1/fixtures?${q.toString()}`,
    );
  },
  getTeamDetail: (teamId: string) =>
    apiFetch<{
      team: {
        id: string;
        name: string;
        short_name: string;
        tla: string;
        primary_color: string;
        secondary_color: string;
        venue: string;
      };
      players: Array<{
        id: string;
        name: string;
        short_name: string;
        shirt_number: number;
        position: string;
        xg_share: number;
        xga_impact: number;
      }>;
      current_appointment: {
        manager_id: string;
        manager_name: string;
        valid_from: string;
        evidence_type: string;
      } | null;
      tactical_profile: TacticalProfile | null;
      recent_matches: FixtureItem[];
    }>(`/api/v1/teams/${encodeURIComponent(teamId)}`),
  getTeamComparison: (home: string, away: string) =>
    apiFetch<{
      left: Awaited<ReturnType<typeof api.getTeamDetail>> & { splits: TeamSplitMetrics };
      right: Awaited<ReturnType<typeof api.getTeamDetail>> & { splits: TeamSplitMetrics };
    }>(`/api/v1/teams/compare?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}`),
  getManagers: () => apiFetch<{ managers: ManagerSummary[] }>('/api/v1/managers'),
  getManagerTactics: (managerId: string) =>
    apiFetch<{
      manager: { id: string; name: string; nationality: string; preferred_system: string; bio_note: string };
      appointment: { valid_from: string; team_id: string; team_name: string; team_short: string; team_tla: string; primary_color: string; secondary_color?: string; evidence_type: string };
      profile: TacticalProfile;
      snapshots: Record<TacticalPhase, TacticalSnapshot>;
      sources: Array<{ id: string; title: string; publisher: string; url: string; published_at: string; evidence_type: string; notes: string }>;
    }>(`/api/v1/managers/${encodeURIComponent(managerId)}/tactics`),
  getMatchPrediction: (fixtureId: string) =>
    apiFetch<{
      fixture: FixtureItem;
      prediction: PredictionData;
      home_team: Awaited<ReturnType<typeof api.getTeamDetail>>;
      away_team: Awaited<ReturnType<typeof api.getTeamDetail>>;
      availability: Array<{
        id: string;
        player_id: string;
        team_id: string;
        player_name: string;
        player_short: string;
        shirt_number: number;
        position: string;
        status: string;
        reason: string;
      }>;
      observed_stats?: {
        home: ObservedTeamMatchStats | null;
        away: ObservedTeamMatchStats | null;
      };
    }>(`/api/v1/matches/${encodeURIComponent(fixtureId)}/prediction`),
  predictPair: (home_team_id: string, away_team_id: string) =>
    apiFetch<{
      prediction: PredictionData;
      home_team: Awaited<ReturnType<typeof api.getTeamDetail>>;
      away_team: Awaited<ReturnType<typeof api.getTeamDetail>>;
    }>('/api/v1/matches/predict-pair', {
      method: 'POST',
      body: JSON.stringify({ home_team_id, away_team_id }),
    }),
  getMatchFlow: (fixtureId: string) =>
    apiFetch<{
      fixture: FixtureItem;
      prediction: PredictionData;
      flow: {
        disclaimer: string;
        computed_at: string;
        chapters: Array<{
          window: string;
          title: string;
          states: Record<
            'level' | 'home_leads' | 'away_leads',
            {
              summary: string;
              home_shape: string;
              away_shape: string;
              home_press_shift: number;
              away_press_shift: number;
              home_line_offset_x: number;
              away_line_offset_x: number;
              key_hypothesis: string;
              substitutions_note: string;
            }
          >;
        }>;
      };
    }>(`/api/v1/matches/${encodeURIComponent(fixtureId)}/flow`),
  getMatchPassing: (
    fixtureId: string,
    opts?: { team?: 'home' | 'away'; formation?: string; demo?: boolean },
  ) => {
    const q = new URLSearchParams();
    if (opts?.team) q.set('team', opts.team);
    if (opts?.formation) q.set('formation', opts.formation);
    if (opts?.demo) q.set('demo', 'true');
    return apiFetch<PassingAnalysisData>(
      `/api/v1/matches/${encodeURIComponent(fixtureId)}/passing?${q.toString()}`,
    );
  },
  getTeamPassing: (
    teamId: string,
    opts?: { formation?: string; demo?: boolean },
  ) => {
    const q = new URLSearchParams();
    if (opts?.formation) q.set('formation', opts.formation);
    if (opts?.demo) q.set('demo', 'true');
    return apiFetch<PassingAnalysisData>(
      `/api/v1/teams/${encodeURIComponent(teamId)}/passing?${q.toString()}`,
    );
  },
  getManagerClash: (home: string, away: string) =>
    apiFetch<{
      home: {
        team: { id: string; name: string; short_name: string; tla: string; primary_color: string; secondary_color?: string; venue?: string };
        appointment: { manager_id: string; manager_name: string; valid_from: string; evidence_type: string };
        profile: TacticalProfile;
        snapshots: Record<TacticalPhase, TacticalSnapshot>;
      };
      away: {
        team: { id: string; name: string; short_name: string; tla: string; primary_color: string; secondary_color?: string; venue?: string };
        appointment: { manager_id: string; manager_name: string; valid_from: string; evidence_type: string };
        profile: TacticalProfile;
        snapshots: Record<TacticalPhase, TacticalSnapshot>;
      };
      mismatches: Array<{
        id: string;
        title: string;
        zone: { x1: number; y1: number; x2: number; y2: number };
        evidence_tag: string;
        summary: string;
      }>;
    }>(`/api/v1/managers/clash?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}`),
  simulateWhatIf: (payload: {
    home_team_id: string;
    away_team_id: string;
    home_formation?: string;
    away_formation?: string;
    unavailable_player_ids: string[];
    swap_venue: boolean;
  }) =>
    apiFetch<{
      recalculation_status: 'validated_model' | 'tactical_only';
      recalculation_note: string;
      baseline_prediction: PredictionData;
      revised_prediction: PredictionData;
      home_players: TacticalSnapshot['players'];
      away_players: TacticalSnapshot['players'];
      effective_home_team: { id: string; short_name: string; tla: string; primary_color: string };
      effective_away_team: { id: string; short_name: string; tla: string; primary_color: string };
    }>('/api/v1/scenarios/simulate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  saveSnapshot: (payload: {
    team_id: string;
    manager_id: string;
    phase: TacticalPhase;
    formation_label: string;
    players: TacticalSnapshot['players'];
    annotations: string[];
  }) =>
    apiFetch<TacticalSnapshot>('/api/v1/tactics/snapshots', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getMethodology: () =>
    apiFetch<{
      models: Array<{
        id: string;
        version_tag: string;
        algorithm: string;
        dixon_coles_rho: number;
        home_advantage: number;
        shrinkage_k: number;
        xg_weight: number;
        brier_score: number;
        log_loss: number;
        baseline_brier: number;
        baseline_log_loss: number;
        calibration: Array<{ bin_label: string; predicted_avg: number; observed_freq: number; count: number }>;
        sample_matches: number;
        trained_at: string;
        notes: string;
      }>;
      sources: Array<{
        id: string;
        title: string;
        publisher: string;
        url: string;
        published_at: string;
        retrieved_at: string;
        evidence_type: string;
        notes: string;
      }>;
      recent_syncs: Array<{
        id: string;
        provider: string;
        status: string;
        records_synced: number;
        xg_available: number;
        error_message: string | null;
        completed_at: string;
        is_demo: number;
      }>;
      reference_inspiration: {
        repo: string;
        reusable_ideas: string[];
        not_reused_or_adapted: string[];
      };
      limitations: string[];
    }>('/api/v1/methodology'),
};
