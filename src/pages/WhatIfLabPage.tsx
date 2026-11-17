import React, { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, RotateCcw } from 'lucide-react';
import { api } from '../lib/api';
import type { OverlayVisibility, TacticalSnapshot } from '../types/tactical';
import { DataFreshnessStrip, EmptyState, LoadingSkeleton } from '../components/common/DataFreshnessStrip';
import { resolveMatchupUiAccents } from '../components/common/FootballMotifs';
import { ProbabilityBar } from '../components/common/ProbabilityBar';
import { StadiumBattleBanner } from '../components/common/StadiumBattleBanner';
import { useToast } from '../components/common/ToastProvider';
import { PitchFallback2D } from '../components/pitch/PitchFallback2D';

const FORMATIONS = ['4-3-3', '4-2-3-1', '3-5-2', '3-4-2-1', '3-2-5', '4-4-2', '4-1-4-1', '5-3-2'];

const OVERLAYS: OverlayVisibility = {
  passing: true,
  pressing: true,
  halfSpaces: false,
  compactness: false,
  restDefense: false,
};

export const WhatIfLabPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { pushToast } = useToast();
  const paramHome = searchParams.get('home');
  const paramAway = searchParams.get('away');

  const [homeId, setHomeId] = useState(paramHome || 'arsenal');
  const [awayId, setAwayId] = useState(() => {
    const h = paramHome || 'arsenal';
    if (paramAway && paramAway !== h) return paramAway;
    return h === 'liverpool' ? 'arsenal' : 'liverpool';
  });
  const [homeFormation, setHomeFormation] = useState('4-3-3');
  const [awayFormation, setAwayFormation] = useState('4-2-3-1');
  const [unavailableIds, setUnavailableIds] = useState<string[]>([]);
  const [swapVenue, setSwapVenue] = useState(false);

  useEffect(() => {
    if (paramHome && paramHome !== homeId) {
      setHomeId(paramHome);
      setUnavailableIds([]);
      if (paramHome === awayId) {
        setAwayId(paramHome === 'liverpool' ? 'arsenal' : 'liverpool');
      }
    }
    if (paramAway && paramAway !== awayId && paramAway !== (paramHome || homeId)) {
      setAwayId(paramAway);
      setUnavailableIds([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramHome, paramAway]);

  const statusQuery = useQuery({ queryKey: ['data-status'], queryFn: api.getDataStatus });
  const standingsQuery = useQuery({ queryKey: ['standings'], queryFn: api.getStandings });
  const homeDetailQuery = useQuery({
    queryKey: ['team-detail', homeId],
    queryFn: () => api.getTeamDetail(homeId),
  });
  const awayDetailQuery = useQuery({
    queryKey: ['team-detail', awayId],
    queryFn: () => api.getTeamDetail(awayId),
  });

  const simMutation = useMutation({
    mutationFn: () =>
      api.simulateWhatIf({
        home_team_id: homeId,
        away_team_id: awayId,
        home_formation: homeFormation,
        away_formation: awayFormation,
        unavailable_player_ids: unavailableIds,
        swap_venue: swapVenue,
      }),
    onError: (err: Error) => {
      pushToast({
        variant: 'error',
        title: 'Simulation Failed',
        description: err.message,
      });
    },
  });

  useEffect(() => {
    if (homeId !== awayId) {
      simMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeId, awayId, homeFormation, awayFormation, unavailableIds, swapVenue]);

  const toggleUnavailable = (pid: string) => {
    setUnavailableIds((prev) =>
      prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid],
    );
  };

  const resetAll = () => {
    setHomeFormation('4-3-3');
    setAwayFormation('4-2-3-1');
    setUnavailableIds([]);
    setSwapVenue(false);
    pushToast({
      variant: 'info',
      title: 'Scenario Reset',
      description: 'Restored baseline formations, venue, and full squad availability.',
    });
  };

  const teams = standingsQuery.data?.standings || [];
  const sim = simMutation.data;

  const homeSnapshot: TacticalSnapshot | null = sim
    ? {
        id: 'whatif-home',
        team_id: sim.effective_home_team.id,
        manager_id: 'sim',
        valid_from: '2026-11-16',
        phase: 'base',
        formation_label: swapVenue ? awayFormation : homeFormation,
        players: sim.home_players,
        edges: [],
        zones: [],
        annotations: [],
        source_refs: [],
        confidence: 'medium',
        evidence_type: 'Illustrative',
      }
    : null;

  const awaySnapshot: TacticalSnapshot | null = sim
    ? {
        id: 'whatif-away',
        team_id: sim.effective_away_team.id,
        manager_id: 'sim',
        valid_from: '2026-11-16',
        phase: 'base',
        formation_label: swapVenue ? homeFormation : awayFormation,
        players: sim.away_players,
        edges: [],
        zones: [],
        annotations: [],
        source_refs: [],
        confidence: 'medium',
        evidence_type: 'Illustrative',
      }
    : null;

  const effectiveHomeDetail = swapVenue ? awayDetailQuery.data : homeDetailQuery.data;
  const effectiveAwayDetail = swapVenue ? homeDetailQuery.data : awayDetailQuery.data;

  const effHomePrimary = effectiveHomeDetail?.team.primary_color || sim?.effective_home_team.primary_color || '#7DD3FC';
  const effAwayPrimary = effectiveAwayDetail?.team.primary_color || sim?.effective_away_team.primary_color || '#F87171';
  const { homeAccent: resolvedHomeColor, awayAccent: resolvedAwayColor } = sim
    ? resolveMatchupUiAccents(
        {
          teamId: sim.effective_home_team.id,
          primaryColor: effHomePrimary,
          secondaryColor: effectiveHomeDetail?.team.secondary_color,
        },
        {
          teamId: sim.effective_away_team.id,
          primaryColor: effAwayPrimary,
          secondaryColor: effectiveAwayDetail?.team.secondary_color,
        },
      )
    : { homeAccent: '#7DD3FC', awayAccent: '#F87171' };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F4F7F5]">
            What-if Tactical &amp; Availability Lab
          </h1>
          <p className="mt-1 text-sm text-[#A5B2BD]">
            Test formation adjustments, venue swaps, and player absences with honest statistical recalculation boundaries.
          </p>
        </div>

        <button
          type="button"
          onClick={resetAll}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1B2732] hover:bg-[#233240] border border-[#34424E] text-xs font-medium text-[#F4F7F5] min-h-[38px] transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#63E6A5]" />
          Reset Baseline
        </button>
      </div>

      <DataFreshnessStrip
        status={statusQuery.data}
        isLoading={statusQuery.isLoading}
        error={statusQuery.error as Error | null}
      />

      {/* Configuration Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 rounded-xl floodlit-card p-4 items-end">
        <div className="lg:col-span-3">
          <label htmlFor="wi-home" className="block text-xs font-semibold text-[#7DD3FC] mb-1">Home Club</label>
          <select
            id="wi-home"
            value={homeId}
            onChange={(e) => {
              const nextHome = e.target.value;
              setHomeId(nextHome);
              setUnavailableIds([]);
              setSearchParams({ home: nextHome, away: awayId });
            }}
            className="w-full rounded-lg bg-[#141E28] border border-[#34424E] px-3 py-2 text-xs text-[#F4F7F5] min-h-[38px]"
          >
            {teams.map((t) => (
              <option key={t.team_id} value={t.team_id} disabled={t.team_id === awayId}>
                {t.short_name}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label htmlFor="wi-hfmt" className="block text-xs text-[#A5B2BD] mb-1">Home Formation</label>
          <select
            id="wi-hfmt"
            value={homeFormation}
            onChange={(e) => setHomeFormation(e.target.value)}
            className="w-full rounded-lg bg-[#141E28] border border-[#34424E] px-3 py-2 text-xs font-mono text-[#F4F7F5] min-h-[38px]"
          >
            {FORMATIONS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2 flex justify-center">
          <button
            type="button"
            onClick={() => setSwapVenue((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium min-h-[38px] border transition-colors ${
              swapVenue
                ? 'bg-[#63E6A5] text-[#0D131A] border-[#63E6A5] font-bold'
                : 'bg-[#141E28] text-[#A5B2BD] border-[#34424E] hover:text-[#F4F7F5]'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            {swapVenue ? 'Venue Swapped' : 'Swap Venue'}
          </button>
        </div>

        <div className="lg:col-span-3">
          <label htmlFor="wi-away" className="block text-xs font-semibold text-[#F87171] mb-1">Away Club</label>
          <select
            id="wi-away"
            value={awayId}
            onChange={(e) => {
              const nextAway = e.target.value;
              setAwayId(nextAway);
              setUnavailableIds([]);
              setSearchParams({ home: homeId, away: nextAway });
            }}
            className="w-full rounded-lg bg-[#141E28] border border-[#34424E] px-3 py-2 text-xs text-[#F4F7F5] min-h-[38px]"
          >
            {teams.map((t) => (
              <option key={t.team_id} value={t.team_id} disabled={t.team_id === homeId}>
                {t.short_name}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label htmlFor="wi-afmt" className="block text-xs text-[#A5B2BD] mb-1">Away Formation</label>
          <select
            id="wi-afmt"
            value={awayFormation}
            onChange={(e) => setAwayFormation(e.target.value)}
            className="w-full rounded-lg bg-[#141E28] border border-[#34424E] px-3 py-2 text-xs font-mono text-[#F4F7F5] min-h-[38px]"
          >
            {FORMATIONS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Quantitative Recalculation Status Banner */}
      {sim && (
        <div
          className={`rounded-xl px-4 py-3 text-xs border ${
            sim.recalculation_status === 'validated_model'
              ? 'bg-[#63E6A5]/10 border-[#63E6A5]/40 text-[#63E6A5]'
              : 'bg-[#FBBF24]/10 border-[#FBBF24]/40 text-[#FBBF24]'
          }`}
        >
          <strong>
            {sim.recalculation_status === 'validated_model'
              ? 'Validated Probability Recalculation:'
              : 'Honest Model Boundary:'}
          </strong>{' '}
          {sim.recalculation_note}
        </div>
      )}

      {simMutation.isError || homeDetailQuery.isError || awayDetailQuery.isError ? (
        <EmptyState
          title="Scenario Simulation Error"
          description={
            ((simMutation.error || homeDetailQuery.error || awayDetailQuery.error) as Error)?.message ||
            'Failed to execute Python scenario calculation.'
          }
          actionLabel="Retry Simulation"
          onAction={() => {
            homeDetailQuery.refetch();
            awayDetailQuery.refetch();
            simMutation.mutate();
          }}
        />
      ) : simMutation.isPending && !sim ? (
        <LoadingSkeleton rows={4} height="h-24" />
      ) : sim && homeSnapshot && awaySnapshot ? (
        <>
          {/* Stadium Home vs Away Battle Banner (reflects swapVenue dynamically) */}
          <StadiumBattleBanner
            home={{
              id: sim.effective_home_team.id,
              name: effectiveHomeDetail?.team.name || sim.effective_home_team.short_name,
              shortName: sim.effective_home_team.short_name,
              tla: sim.effective_home_team.tla,
              primaryColor: effHomePrimary,
              secondaryColor: effectiveHomeDetail?.team.secondary_color,
              managerName: effectiveHomeDetail?.current_appointment?.manager_name,
              formation: homeSnapshot.formation_label,
              xg: sim.revised_prediction.home_xg,
            }}
            away={{
              id: sim.effective_away_team.id,
              name: effectiveAwayDetail?.team.name || sim.effective_away_team.short_name,
              shortName: sim.effective_away_team.short_name,
              tla: sim.effective_away_team.tla,
              primaryColor: effAwayPrimary,
              secondaryColor: effectiveAwayDetail?.team.secondary_color,
              managerName: effectiveAwayDetail?.current_appointment?.manager_name,
              formation: awaySnapshot.formation_label,
              xg: sim.revised_prediction.away_xg,
            }}
            venue={effectiveHomeDetail?.team.venue || `${sim.effective_home_team.short_name} Stadium`}
            probHome={sim.revised_prediction.prob_home}
            probDraw={sim.revised_prediction.prob_draw}
            probAway={sim.revised_prediction.prob_away}
            mode="whatif"
          />

          {/* Live Dual Tactical Pitch */}
          <div className="rounded-xl floodlit-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#A5B2BD] mb-3">
              <span>
                <strong style={{ color: resolvedHomeColor }}>{sim.effective_home_team.short_name}</strong> ({homeSnapshot.formation_label}) vs{' '}
                <strong style={{ color: resolvedAwayColor }}>{sim.effective_away_team.short_name}</strong> ({awaySnapshot.formation_label})
              </span>
              <span>Ruled-out players dim with dashed red outlines</span>
            </div>
            <div className="h-[360px] sm:h-[440px]">
              <PitchFallback2D
                snapshot={homeSnapshot}
                awaySnapshot={awaySnapshot}
                homeColor={resolvedHomeColor}
                awayColor={resolvedAwayColor}
                overlays={OVERLAYS}
                isPlaying={false}
                speed={1}
                selectedPlayerId={null}
                selectedEdgeIndex={null}
                onSelectPlayer={() => {}}
                onSelectEdge={() => {}}
                reducedMotion={true}
              />
            </div>
          </div>

          {/* Baseline vs Revised Probabilities */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h2 className="font-display text-sm font-semibold text-[#A5B2BD] mb-2">
                Baseline Pre-Match Distribution
              </h2>
              <ProbabilityBar
                homeName={homeDetailQuery.data?.team.short_name || sim.effective_home_team.short_name}
                awayName={awayDetailQuery.data?.team.short_name || sim.effective_away_team.short_name}
                homeColor={resolvedHomeColor}
                awayColor={resolvedAwayColor}
                prediction={sim.baseline_prediction}
                showExplainability={false}
                lastUpdated={statusQuery.data?.last_synced_at}
              />
            </div>
            <div>
              <h2 className="font-display text-sm font-semibold text-[#63E6A5] mb-2">
                {sim.recalculation_status === 'validated_model'
                  ? 'Revised Scenario Distribution'
                  : 'Unchanged (Tactical Visualization Only)'}
              </h2>
              <ProbabilityBar
                homeName={sim.effective_home_team.short_name}
                awayName={sim.effective_away_team.short_name}
                homeColor={resolvedHomeColor}
                awayColor={resolvedAwayColor}
                prediction={sim.revised_prediction}
                showExplainability={false}
                lastUpdated={statusQuery.data?.last_synced_at}
              />
            </div>
          </div>

          {/* Player Availability Checklists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[
              {
                title: `${homeDetailQuery.data?.team.short_name || sim.effective_home_team.short_name} Squad Availability`,
                players: homeDetailQuery.data?.players || [],
                accent: 'text-[#7DD3FC]',
              },
              {
                title: `${awayDetailQuery.data?.team.short_name || sim.effective_away_team.short_name} Squad Availability`,
                players: awayDetailQuery.data?.players || [],
                accent: 'text-[#F87171]',
              },
            ].map((panel) => (
              <div key={panel.title} className="rounded-xl floodlit-card p-4">
                <h3 className={`font-display text-sm font-semibold ${panel.accent} mb-3`}>
                  {panel.title} (uncheck to simulate absence)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {panel.players.map((p) => {
                    const isOut = unavailableIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                          isOut
                            ? 'bg-[#F87171]/15 border-[#F87171]/50 text-[#F87171]'
                            : 'bg-[#141E28] border-[#34424E] text-[#F4F7F5] hover:border-[#63E6A5]/45'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={!isOut}
                            onChange={() => toggleUnavailable(p.id)}
                            className="accent-[#63E6A5]"
                          />
                          <span className="font-mono text-[#A5B2BD]">#{p.shirt_number}</span>
                          <span className="truncate">{p.short_name}</span>
                        </span>
                        <span className="font-mono text-[11px] text-[#A5B2BD]">{p.position}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
};
