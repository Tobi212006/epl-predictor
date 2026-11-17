import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';
import { useAppPreferences } from '../lib/quality';
import { DataFreshnessStrip, EmptyState, LoadingSkeleton } from '../components/common/DataFreshnessStrip';
import { resolveMatchupUiAccents } from '../components/common/FootballMotifs';
import { ProbabilityBar } from '../components/common/ProbabilityBar';
import { StadiumBattleBanner } from '../components/common/StadiumBattleBanner';
import { useToast } from '../components/common/ToastProvider';
import { MatchStatsMomentumPanel } from '../components/match/MatchStatsMomentumPanel';
import { FormationPassingPanel } from '../components/pitch/FormationPassingPanel';
import { TacticalHeatmap } from '../components/pitch/TacticalHeatmap';
import { mapSquadToHeatmapNodes } from '../lib/heatmapData';

export const MatchCenterPage: React.FC = () => {
  const { fixtureId: paramId } = useParams();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const { selectedFixtureId, setSelectedFixtureId } = useAppPreferences();

  const [customMode, setCustomMode] = useState(false);
  const [customHome, setCustomHome] = useState('arsenal');
  const [customAway, setCustomAway] = useState('man-city');

  const statusQuery = useQuery({ queryKey: ['data-status'], queryFn: api.getDataStatus });
  const fixturesQuery = useQuery({
    queryKey: ['fixtures', 'match-center-picker'],
    queryFn: async () => {
      const scheduled = await api.getFixtures({ status: 'SCHEDULED', limit: 30 });
      if (scheduled.items.length > 0) return scheduled;
      return api.getFixtures({ limit: 30 });
    },
  });
  const standingsQuery = useQuery({ queryKey: ['standings'], queryFn: api.getStandings });

  const fixtureOptions = fixturesQuery.data?.items || [];
  const activeFixtureId = paramId || selectedFixtureId || fixtureOptions[0]?.id || '';

  const bundleQuery = useQuery({
    queryKey: ['match-prediction', activeFixtureId],
    queryFn: () => api.getMatchPrediction(activeFixtureId),
    enabled: !customMode && Boolean(activeFixtureId),
  });

  const customMutation = useMutation({
    mutationFn: () => api.predictPair(customHome, customAway),
    onSuccess: (res) => {
      pushToast({
        variant: 'success',
        title: `${res.home_team.team.short_name} vs ${res.away_team.team.short_name} Computed`,
        description: `Projected xG ${res.prediction.home_xg.toFixed(2)} – ${res.prediction.away_xg.toFixed(2)}.`,
      });
    },
    onError: (err: Error) => {
      pushToast({
        variant: 'error',
        title: 'Custom Matchup Failed',
        description: err.message,
      });
    },
  });

  const teams = standingsQuery.data?.standings || [];
  const activeBundle = customMode && customMutation.data ? customMutation.data : bundleQuery.data;
  const prediction = activeBundle?.prediction;
  const homeTeam = activeBundle?.home_team;
  const awayTeam = activeBundle?.away_team;

  const scoreChartData = (prediction?.top_scorelines || []).map((s) => ({
    scoreline: `${s.home}-${s.away}`,
    probabilityPct: Number((s.probability * 100).toFixed(1)),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F4F7F5]">Match Center</h1>
          <p className="mt-1 text-sm text-[#A5B2BD]">
            Stadium Home vs Away matchup card, probabilistic 1X2 distribution, expected goals, formation &amp; passing inspection.
          </p>
        </div>

        {/* Toggle between scheduled fixture and custom two-team selector */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#1B2732] border border-[#34424E]">
          <button
            type="button"
            onClick={() => setCustomMode(false)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors min-h-[36px] ${
              !customMode ? 'bg-[#63E6A5] text-[#0D131A] font-bold' : 'text-[#A5B2BD] hover:text-[#F4F7F5]'
            }`}
          >
            Scheduled Fixture
          </button>
          <button
            type="button"
            onClick={() => {
              setCustomMode(true);
              customMutation.mutate();
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors min-h-[36px] ${
              customMode ? 'bg-[#63E6A5] text-[#0D131A] font-bold' : 'text-[#A5B2BD] hover:text-[#F4F7F5]'
            }`}
          >
            Custom Matchup
          </button>
        </div>
      </div>

      <DataFreshnessStrip
        status={statusQuery.data}
        isLoading={statusQuery.isLoading}
        error={statusQuery.error as Error | null}
      />

      {/* Matchup Picker Bar */}
      {!customMode ? (
        <div className="rounded-xl floodlit-card p-4 flex flex-wrap items-center gap-4">
          <label htmlFor="fixture-picker" className="text-xs font-medium text-[#F4F7F5]">
            Select Upcoming Fixture
          </label>
          <select
            id="fixture-picker"
            value={activeFixtureId}
            onChange={(e) => {
              setSelectedFixtureId(e.target.value);
              navigate(`/match-center/${e.target.value}`);
            }}
            className="rounded-lg bg-[#141E28] border border-[#34424E] px-3 py-2 text-xs text-[#F4F7F5] min-h-[38px]"
          >
            {fixtureOptions.map((fx) => (
              <option key={fx.id} value={fx.id}>
                MW {fx.matchweek}: {fx.home_short} vs {fx.away_short}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="rounded-xl floodlit-card p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="custom-home" className="text-xs text-[#7DD3FC] font-semibold">Home</label>
            <select
              id="custom-home"
              value={customHome}
              onChange={(e) => setCustomHome(e.target.value)}
              className="rounded-lg bg-[#141E28] border border-[#34424E] px-3 py-2 text-xs text-[#F4F7F5] min-h-[38px]"
            >
              {teams.map((t) => (
                <option key={t.team_id} value={t.team_id} disabled={t.team_id === customAway}>
                  {t.short_name}
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs text-[#A5B2BD] font-mono">vs</span>
          <div className="flex items-center gap-2">
            <label htmlFor="custom-away" className="text-xs text-[#F87171] font-semibold">Away</label>
            <select
              id="custom-away"
              value={customAway}
              onChange={(e) => setCustomAway(e.target.value)}
              className="rounded-lg bg-[#141E28] border border-[#34424E] px-3 py-2 text-xs text-[#F4F7F5] min-h-[38px]"
            >
              {teams.map((t) => (
                <option key={t.team_id} value={t.team_id} disabled={t.team_id === customHome}>
                  {t.short_name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => customMutation.mutate()}
            disabled={customMutation.isPending || customHome === customAway}
            className="px-4 py-2 rounded-lg bg-[#63E6A5] text-[#0D131A] text-xs font-bold hover:opacity-90 min-h-[38px]"
          >
            {customMutation.isPending ? 'Computing in Python...' : 'Compute Prediction'}
          </button>
        </div>
      )}

      {(!customMode && (!activeFixtureId || fixturesQuery.isLoading || bundleQuery.isLoading)) || customMutation.isPending ? (
        <LoadingSkeleton rows={4} height="h-24" />
      ) : (!customMode && bundleQuery.isError) || (customMode && customMutation.isError) ? (
        <EmptyState
          title="Unable to Compute Match Prediction"
          description={((customMode ? customMutation.error : bundleQuery.error) as Error)?.message || 'Match prediction lookup failed.'}
          actionLabel={!customMode && paramId && fixtureOptions[0] ? 'Load Next Fixture' : 'Retry'}
          onAction={() => {
            if (!customMode && paramId && fixtureOptions[0]) {
              setSelectedFixtureId(fixtureOptions[0].id);
              navigate(`/match-center/${fixtureOptions[0].id}`);
            } else if (customMode) {
              customMutation.mutate();
            } else {
              bundleQuery.refetch();
            }
          }}
        />
      ) : prediction && homeTeam && awayTeam ? (
        <>
          {/* Home Stadium Home vs Away Battle Format */}
          <StadiumBattleBanner
            home={{
              id: homeTeam.team.id,
              name: homeTeam.team.name,
              shortName: homeTeam.team.short_name,
              tla: homeTeam.team.tla,
              primaryColor: homeTeam.team.primary_color,
              secondaryColor: homeTeam.team.secondary_color,
              managerName: homeTeam.current_appointment?.manager_name,
              formation: homeTeam.tactical_profile?.base_formation,
              xg: prediction.home_xg,
            }}
            away={{
              id: awayTeam.team.id,
              name: awayTeam.team.name,
              shortName: awayTeam.team.short_name,
              tla: awayTeam.team.tla,
              primaryColor: awayTeam.team.primary_color,
              secondaryColor: awayTeam.team.secondary_color,
              managerName: awayTeam.current_appointment?.manager_name,
              formation: awayTeam.tactical_profile?.base_formation,
              xg: prediction.away_xg,
            }}
            venue={!customMode && bundleQuery.data?.fixture ? bundleQuery.data.fixture.venue : homeTeam.team.venue}
            matchweek={!customMode && bundleQuery.data?.fixture ? bundleQuery.data.fixture.matchweek : undefined}
            status={!customMode && bundleQuery.data?.fixture ? bundleQuery.data.fixture.status : 'SCHEDULED'}
            liveClock={!customMode && bundleQuery.data?.fixture ? bundleQuery.data.fixture.live_clock : null}
            homeGoals={!customMode && bundleQuery.data?.fixture ? bundleQuery.data.fixture.home_goals : null}
            awayGoals={!customMode && bundleQuery.data?.fixture ? bundleQuery.data.fixture.away_goals : null}
            probHome={prediction.prob_home}
            probDraw={prediction.prob_draw}
            probAway={prediction.prob_away}
            fixtureId={!customMode ? activeFixtureId : undefined}
            mode="match"
          />

          {(() => {
            const { homeAccent: homeColor, awayAccent: awayColor } = resolveMatchupUiAccents(
              {
                teamId: homeTeam.team.id,
                primaryColor: homeTeam.team.primary_color,
                secondaryColor: homeTeam.team.secondary_color,
              },
              {
                teamId: awayTeam.team.id,
                primaryColor: awayTeam.team.primary_color,
                secondaryColor: awayTeam.team.secondary_color,
              },
            );
            const fixtureStatus =
              !customMode && bundleQuery.data?.fixture ? bundleQuery.data.fixture.status : 'SCHEDULED';

            return (
              <>
                <ProbabilityBar
                  homeName={homeTeam.team.short_name}
                  awayName={awayTeam.team.short_name}
                  homeColor={homeColor}
                  awayColor={awayColor}
                  prediction={prediction}
                  lastUpdated={statusQuery.data?.last_synced_at}
                />

                <MatchStatsMomentumPanel
                  homeShort={homeTeam.team.short_name}
                  awayShort={awayTeam.team.short_name}
                  homeColor={homeColor}
                  awayColor={awayColor}
                  fixtureStatus={fixtureStatus}
                  observedHome={!customMode ? bundleQuery.data?.observed_stats?.home : null}
                  observedAway={!customMode ? bundleQuery.data?.observed_stats?.away : null}
                  homeProfile={homeTeam.tactical_profile}
                  awayProfile={awayTeam.tactical_profile}
                  prediction={prediction}
                />

                {/* Interactive Formation & Passing Analysis */}
                <FormationPassingPanel
                  mode={customMode ? 'custom' : 'fixture'}
                  fixtureId={!customMode ? activeFixtureId : undefined}
                  homeTeamId={homeTeam.team.id}
                  awayTeamId={awayTeam.team.id}
                  homeName={homeTeam.team.short_name}
                  awayName={awayTeam.team.short_name}
                  homeTla={homeTeam.team.tla}
                  awayTla={awayTeam.team.tla}
                  homeColor={homeColor}
                  awayColor={awayColor}
                />

                {/* Player Activity Density Heatmap */}
                <TacticalHeatmap
                  homeTeam={{
                    teamId: homeTeam.team.id,
                    name: homeTeam.team.name,
                    shortName: homeTeam.team.short_name,
                    tla: homeTeam.team.tla,
                    accentColor: homeColor,
                    formation: homeTeam.tactical_profile?.base_formation,
                    players: mapSquadToHeatmapNodes(homeTeam.players || []),
                  }}
                  awayTeam={{
                    teamId: awayTeam.team.id,
                    name: awayTeam.team.name,
                    shortName: awayTeam.team.short_name,
                    tla: awayTeam.team.tla,
                    accentColor: awayColor,
                    formation: awayTeam.tactical_profile?.base_formation,
                    players: mapSquadToHeatmapNodes(awayTeam.players || []),
                  }}
                />
              </>
            );
          })()}

          {/* Scoreline Distribution & Poisson Score Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl floodlit-card p-5">
              <h3 className="font-display text-base font-semibold text-[#F4F7F5]">
                Top Scoreline Probabilities
              </h3>
              <p className="text-xs text-[#A5B2BD] mt-0.5">
                Derived from Python Poisson + Dixon–Coles joint goal distribution.
              </p>
              <div className="h-60 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scoreChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="scoreline" stroke="#A5B2BD" fontSize={12} />
                    <YAxis stroke="#A5B2BD" fontSize={12} unit="%" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#141E28', borderColor: '#34424E', fontSize: '12px', color: '#F4F7F5' }}
                    />
                    <Bar dataKey="probabilityPct" name="Probability (%)" fill="#63E6A5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 6x6 Scoreline Heatmap */}
            <div className="rounded-xl floodlit-card p-5">
              <h3 className="font-display text-base font-semibold text-[#F4F7F5]">
                Scoreline Probability Matrix (0–5 Goals)
              </h3>
              <p className="text-xs text-[#A5B2BD] mt-0.5">
                Rows: {homeTeam.team.short_name} goals · Columns: {awayTeam.team.short_name} goals
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-center text-xs font-mono tabular-nums border-collapse">
                  <thead>
                    <tr className="text-[#A5B2BD]">
                      <th className="p-1.5 text-left">H \ A</th>
                      {[0, 1, 2, 3, 4, 5].map((a) => (
                        <th key={a} className="p-1.5">{a}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {prediction.score_grid.slice(0, 6).map((row, hGoals) => (
                      <tr key={hGoals}>
                        <td className="p-1.5 text-left text-[#A5B2BD] font-semibold">{hGoals}</td>
                        {row.slice(0, 6).map((prob, aGoals) => {
                          const pct = prob * 100;
                          const alpha = Math.min(0.6, pct / 18);
                          return (
                            <td
                              key={aGoals}
                              className="p-2 border border-[#34424E] rounded-sm text-[#F4F7F5]"
                              style={{ backgroundColor: `rgba(99, 230, 165, ${alpha.toFixed(2)})` }}
                            >
                              {pct.toFixed(1)}%
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Last 5 Matches Form Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[
              { label: `${homeTeam.team.short_name} Recent Form (Last 5)`, matches: homeTeam.recent_matches },
              { label: `${awayTeam.team.short_name} Recent Form (Last 5)`, matches: awayTeam.recent_matches },
            ].map((panel) => (
              <div key={panel.label} className="rounded-xl floodlit-card p-5">
                <h3 className="font-display text-base font-semibold text-[#F4F7F5]">{panel.label}</h3>
                <div className="mt-3 flex flex-col divide-y divide-[#34424E] text-xs tabular-nums">
                  {panel.matches.map((m) => (
                    <div key={m.id} className="py-2 flex items-center justify-between gap-2">
                      <span className="text-[#A5B2BD]">MW {m.matchweek}</span>
                      <span className="text-[#F4F7F5] font-medium">
                        {m.home_short} {m.home_goals}–{m.away_goals} {m.away_short}
                      </span>
                      <span className="font-mono text-[#A5B2BD] text-right">
                        {m.home_xg !== null && m.away_xg !== null
                          ? `${m.home_xg.toFixed(1)}–${m.away_xg.toFixed(1)} xG`
                          : m.home_shots !== null && m.home_shots !== undefined && m.away_shots !== null && m.away_shots !== undefined
                          ? `${m.home_shots}–${m.away_shots} sh${
                              m.home_poss !== null && m.home_poss !== undefined ? ` · ${Math.round(m.home_poss)}% poss` : ''
                            }`
                          : 'Goals only'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Availability Notes */}
          {!customMode && bundleQuery.data?.availability && bundleQuery.data.availability.length > 0 && (
            <div className="rounded-xl floodlit-card p-5">
              <h3 className="font-display text-base font-semibold text-[#F4F7F5]">
                Recorded Player Availability Notes
              </h3>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {bundleQuery.data.availability.map((av) => (
                  <div key={av.id} className="rounded-lg bg-[#141E28] border border-[#34424E] p-3 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-[#F4F7F5]">
                        #{av.shirt_number} {av.player_name} ({av.position})
                      </div>
                      <div className="text-[#A5B2BD] mt-0.5">{av.reason}</div>
                    </div>
                    <span className={av.status === 'AVAILABLE' ? 'text-[#63E6A5]' : 'text-[#FBBF24]'}>
                      {av.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};
