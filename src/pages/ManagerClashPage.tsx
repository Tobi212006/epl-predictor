import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeftRight } from 'lucide-react';
import { api } from '../lib/api';
import type { TacticalPhase } from '../types/tactical';
import { DataFreshnessStrip, EmptyState, LoadingSkeleton } from '../components/common/DataFreshnessStrip';
import { resolveMatchupUiAccents } from '../components/common/FootballMotifs';
import { StadiumBattleBanner } from '../components/common/StadiumBattleBanner';
import { TacticalTheatreStage } from '../components/pitch/TacticalTheatreStage';

export const ManagerClashPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramHome = searchParams.get('home');
  const paramAway = searchParams.get('away');

  const [homeId, setHomeId] = useState(paramHome || 'arsenal');
  const [awayId, setAwayId] = useState(() => {
    const initialHome = paramHome || 'arsenal';
    if (paramAway && paramAway !== initialHome) return paramAway;
    return initialHome === 'man-united' ? 'arsenal' : 'man-united';
  });
  const [phase, setPhase] = useState<TacticalPhase>('in_possession');
  const [viewMode, setViewMode] = useState<'shared' | 'split'>('shared');

  // Keep local state in sync when deep-linking via URL params
  useEffect(() => {
    if (paramHome && paramHome !== homeId) {
      setHomeId(paramHome);
      if (paramHome === awayId) {
        setAwayId(paramHome === 'arsenal' ? 'man-city' : 'arsenal');
      }
    }
    if (paramAway && paramAway !== awayId && paramAway !== (paramHome || homeId)) {
      setAwayId(paramAway);
    }
  }, [paramHome, paramAway]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusQuery = useQuery({ queryKey: ['data-status'], queryFn: api.getDataStatus });
  const standingsQuery = useQuery({ queryKey: ['standings'], queryFn: api.getStandings });
  const clashQuery = useQuery({
    queryKey: ['manager-clash', homeId, awayId],
    queryFn: () => api.getManagerClash(homeId, awayId),
    enabled: Boolean(homeId && awayId && homeId !== awayId),
  });

  const teams = standingsQuery.data?.standings || [];
  const clash = clashQuery.data;

  const updateSides = (nextHome: string, nextAway: string) => {
    setHomeId(nextHome);
    setAwayId(nextAway);
    setSearchParams({ home: nextHome, away: nextAway });
  };

  const swapSides = () => {
    updateSides(awayId, homeId);
  };

  const matchupAccents = clash
    ? resolveMatchupUiAccents(
        {
          teamId: clash.home.team.id,
          primaryColor: clash.home.team.primary_color,
          secondaryColor: clash.home.team.secondary_color,
        },
        {
          teamId: clash.away.team.id,
          primaryColor: clash.away.team.primary_color,
          secondaryColor: clash.away.team.secondary_color,
        },
      )
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F4F7F5]">
            Manager vs Manager Tactical Clash
          </h1>
          <p className="mt-1 text-sm text-[#A5B2BD]">
            Merge two tactical boards onto a shared 22-node Home Stadium pitch to inspect structural mismatches, pressing traps, and overloads.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#1B2732] border border-[#34424E]">
          <button
            type="button"
            onClick={() => setViewMode('shared')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors min-h-[36px] ${
              viewMode === 'shared' ? 'bg-[#63E6A5] text-[#0D131A] font-bold' : 'text-[#A5B2BD] hover:text-[#F4F7F5]'
            }`}
          >
            Shared Clash Pitch
          </button>
          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors min-h-[36px] ${
              viewMode === 'split' ? 'bg-[#63E6A5] text-[#0D131A] font-bold' : 'text-[#A5B2BD] hover:text-[#F4F7F5]'
            }`}
          >
            Split Comparison
          </button>
        </div>
      </div>

      <DataFreshnessStrip
        status={statusQuery.data}
        isLoading={statusQuery.isLoading}
        error={statusQuery.error as Error | null}
      />

      {/* Selectors + Reverse Sides */}
      <div className="rounded-xl floodlit-card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="clash-home" className="text-xs font-semibold text-[#7DD3FC]">Home Side (In Possession Focus)</label>
          <select
            id="clash-home"
            value={homeId}
            onChange={(e) => updateSides(e.target.value, awayId)}
            className="rounded-lg bg-[#141E28] border border-[#34424E] px-3 py-2 text-xs text-[#F4F7F5] min-h-[38px]"
          >
            {teams.map((t) => (
              <option key={t.team_id} value={t.team_id} disabled={t.team_id === awayId}>
                {t.short_name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={swapSides}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#141E28] hover:bg-[#233240] border border-[#34424E] text-xs font-medium text-[#F4F7F5] min-h-[38px] transition-colors"
        >
          <ArrowLeftRight className="w-3.5 h-3.5 text-[#63E6A5]" />
          Reverse Sides
        </button>

        <div className="flex items-center gap-2">
          <label htmlFor="clash-away" className="text-xs font-semibold text-[#F87171]">Away Side (Opposing Block)</label>
          <select
            id="clash-away"
            value={awayId}
            onChange={(e) => updateSides(homeId, e.target.value)}
            className="rounded-lg bg-[#141E28] border border-[#34424E] px-3 py-2 text-xs text-[#F4F7F5] min-h-[38px]"
          >
            {teams.map((t) => (
              <option key={t.team_id} value={t.team_id} disabled={t.team_id === homeId}>
                {t.short_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {clashQuery.isError ? (
        <EmptyState
          title="Unable to Load Manager Clash"
          description={(clashQuery.error as Error)?.message || 'Could not merge manager tactical profiles.'}
          actionLabel="Retry Clash"
          onAction={() => clashQuery.refetch()}
        />
      ) : clashQuery.isLoading || !clash || !matchupAccents ? (
        <LoadingSkeleton rows={4} height="h-28" />
      ) : (
        <>
          {/* Home Stadium Home vs Away Battle Format */}
          <StadiumBattleBanner
            home={{
              id: clash.home.team.id,
              name: clash.home.team.name,
              shortName: clash.home.team.short_name,
              tla: clash.home.team.tla,
              primaryColor: clash.home.team.primary_color,
              secondaryColor: clash.home.team.secondary_color,
              managerName: clash.home.appointment?.manager_name,
              formation: `${clash.home.profile.base_formation} → ${clash.home.profile.in_possession_shape}`,
            }}
            away={{
              id: clash.away.team.id,
              name: clash.away.team.name,
              shortName: clash.away.team.short_name,
              tla: clash.away.team.tla,
              primaryColor: clash.away.team.primary_color,
              secondaryColor: clash.away.team.secondary_color,
              managerName: clash.away.appointment?.manager_name,
              formation: `${clash.away.profile.base_formation} → ${clash.away.profile.out_of_possession_block}`,
            }}
            venue={clash.home.team.venue || `${clash.home.team.short_name} Home Ground`}
            mode="clash"
          />

          {viewMode === 'shared' ? (
            <TacticalTheatreStage
              snapshots={clash.home.snapshots}
              awaySnapshots={clash.away.snapshots}
              homeColor={matchupAccents.homeAccent}
              awayColor={matchupAccents.awayAccent}
              phase={phase}
              onPhaseChange={setPhase}
              mismatchZones={clash.mismatches}
              heightClass="h-[460px] sm:h-[560px]"
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TacticalTheatreStage
                snapshots={clash.home.snapshots}
                homeColor={matchupAccents.homeAccent}
                phase={phase}
                onPhaseChange={setPhase}
                heightClass="h-[380px]"
                compact={true}
              />
              <TacticalTheatreStage
                snapshots={clash.away.snapshots}
                homeColor={matchupAccents.awayAccent}
                phase={phase === 'in_possession' ? 'out_of_possession' : 'in_possession'}
                onPhaseChange={setPhase}
                heightClass="h-[380px]"
                compact={true}
              />
            </div>
          )}

          {/* Structural Mismatch Diagnostics */}
          <section>
            <h2 className="font-display text-lg font-semibold text-[#F4F7F5] mb-3">
              Identified Tactical Mismatches &amp; Conditional Interactions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clash.mismatches.map((mm) => (
                <div key={mm.id} className="rounded-xl floodlit-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-sm font-semibold text-[#63E6A5]">{mm.title}</h3>
                    <span className="text-[11px] font-mono text-[#7DD3FC]">{mm.evidence_tag}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-[#A5B2BD] leading-relaxed">{mm.summary}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
};
