import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Swords } from 'lucide-react';
import { api } from '../lib/api';
import { useAppPreferences } from '../lib/quality';
import { DataFreshnessStrip, EmptyState, LoadingSkeleton } from '../components/common/DataFreshnessStrip';
import { ClubKitBadge, CLUB_IDENTITY_META, getClubUiTheme, resolveVisibleUiAccent } from '../components/common/FootballMotifs';
import { PitchFallback2D } from '../components/pitch/PitchFallback2D';
import type { OverlayVisibility } from '../types/tactical';

const DEFAULT_OVERLAYS: OverlayVisibility = {
  passing: true,
  pressing: true,
  halfSpaces: true,
  compactness: true,
  restDefense: true,
};

export const ManagerDNAPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedTeamId, setSelectedTeamId } = useAppPreferences();
  const paramManager = searchParams.get('manager');

  const statusQuery = useQuery({ queryKey: ['data-status'], queryFn: api.getDataStatus });
  const managersQuery = useQuery({ queryKey: ['managers-list'], queryFn: api.getManagers });
  const managers = managersQuery.data?.managers || [];

  const [selectedManagerId, setSelectedManagerId] = useState(paramManager || 'mikel-arteta');

  // Sync with Focus Club in top navbar when no explicit ?manager= override or when focus club changes
  useEffect(() => {
    if (managers.length === 0) return;
    if (paramManager && managers.some((m) => m.id === paramManager)) {
      setSelectedManagerId(paramManager);
      return;
    }
    const matching = managers.find((m) => m.team_id === selectedTeamId);
    if (matching) {
      setSelectedManagerId(matching.id);
    }
  }, [managers, paramManager, selectedTeamId]);

  const detailQuery = useQuery({
    queryKey: ['manager-tactics', selectedManagerId],
    queryFn: () => api.getManagerTactics(selectedManagerId),
    enabled: Boolean(selectedManagerId),
  });

  const detail = detailQuery.data;

  const handleSelectManager = (mgrId: string) => {
    setSelectedManagerId(mgrId);
    setSearchParams({ manager: mgrId });
    const found = managers.find((m) => m.id === mgrId);
    if (found?.team_id) {
      setSelectedTeamId(found.team_id);
    }
  };

  const pitchAccent = detail
    ? resolveVisibleUiAccent(
        detail.appointment.team_id,
        detail.appointment.primary_color || '#7DD3FC',
        detail.appointment.secondary_color || '#F4F7F5',
      )
    : null;
  const clubTheme = detail
    ? getClubUiTheme(
        detail.appointment.team_id,
        detail.appointment.primary_color || '#7DD3FC',
        detail.appointment.secondary_color || '#F4F7F5',
      )
    : null;
  const clubMeta = detail ? CLUB_IDENTITY_META[detail.appointment.team_id] : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F4F7F5]">
            Manager DNA &amp; Tactical Profiles
          </h1>
          <p className="mt-1 text-sm text-[#A5B2BD]">
            Dated manager appointments, in/out-of-possession structures, sample sizes, and evidence provenance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="mgr-select" className="text-xs text-[#A5B2BD]">Manager</label>
          <select
            id="mgr-select"
            value={selectedManagerId}
            onChange={(e) => handleSelectManager(e.target.value)}
            className="rounded-lg bg-[#141E28] border border-[#34424E] px-3 py-2 text-xs text-[#F4F7F5] min-h-[38px]"
          >
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.team_short})
              </option>
            ))}
          </select>
        </div>
      </div>

      <DataFreshnessStrip
        status={statusQuery.data}
        isLoading={statusQuery.isLoading}
        error={statusQuery.error as Error | null}
      />

      {managersQuery.isError || detailQuery.isError ? (
        <EmptyState
          title="Unable to Load Manager Profile"
          description={((detailQuery.error || managersQuery.error) as Error)?.message || 'Manager tactical data request failed.'}
          actionLabel="Retry"
          onAction={() => {
            managersQuery.refetch();
            detailQuery.refetch();
          }}
        />
      ) : detailQuery.isLoading || !detail || !pitchAccent || !clubTheme ? (
        <LoadingSkeleton rows={4} height="h-28" />
      ) : (
        <>
          {/* Manager Identity Header with Authentic Club Kit */}
          <div
            className="rounded-2xl floodlit-card p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center"
            style={{
              borderColor: clubTheme.glowMedium,
              background: `radial-gradient(circle at 12% 18%, ${clubTheme.glowSoft}, transparent 52%), #1B2732`,
            }}
          >
            <div className="lg:col-span-7 flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="shrink-0 flex flex-col items-center">
                <ClubKitBadge
                  teamId={detail.appointment.team_id}
                  primaryColor={detail.appointment.primary_color || '#7DD3FC'}
                  secondaryColor={detail.appointment.secondary_color}
                  tla={detail.appointment.team_tla}
                  size="lg"
                />
                <span
                  className="mt-1 font-mono text-[10px] tracking-widest font-bold"
                  style={{ color: pitchAccent }}
                >
                  {detail.appointment.team_tla}
                </span>
              </div>

              <div className="min-w-0">
                <div className="text-xs text-[#A5B2BD] tabular-nums">
                  <span className="font-semibold" style={{ color: pitchAccent }}>
                    {detail.appointment.team_name}
                  </span>
                  {clubMeta ? ` (${clubMeta.nickname} · ${clubMeta.stadium})` : ''} · Appointed {detail.appointment.valid_from} · Nationality: {detail.manager.nationality}
                </div>
                <h2 className="mt-1 font-display text-2xl font-bold text-[#F4F7F5]">
                  {detail.manager.name}
                </h2>
                <p className="mt-2 text-sm text-[#A5B2BD]">{detail.manager.bio_note}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs tabular-nums text-[#A5B2BD]">
                  <span>Base: <strong className="font-mono text-[#F4F7F5]">{detail.profile.base_formation}</strong></span>
                  <span aria-hidden="true">·</span>
                  <span>Sample: <strong className="font-mono text-[#F4F7F5]">{detail.profile.sample_size_matches} matches</strong></span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Confidence:{' '}
                    <strong className={detail.profile.confidence === 'high' ? 'text-[#63E6A5]' : detail.profile.confidence === 'medium' ? 'text-[#FBBF24]' : 'text-[#F87171]'}>
                      {detail.profile.confidence}
                    </strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#A5B2BD]">{detail.profile.evidence_type}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to={`/tactical-lab`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141E28] border border-[#34424E] text-xs text-[#F4F7F5] hover:border-[#63E6A5] hover:text-[#63E6A5] font-medium"
                  >
                    Open in 3D Tactical Lab
                  </Link>
                  <Link
                    to={`/manager-clash?home=${detail.appointment.team_id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#63E6A5] text-[#0D131A] text-xs font-bold hover:opacity-90"
                  >
                    <Swords className="w-3.5 h-3.5" />
                    Test in Manager Clash
                  </Link>
                </div>
              </div>
            </div>

            {/* Stylistic Indicators */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              {[
                { label: 'Pressing Intensity', val: detail.profile.pressing_intensity_idx, color: '#F87171' },
                { label: 'Attacking Width', val: detail.profile.width_idx, color: '#7DD3FC' },
                { label: 'Circulation Tempo', val: detail.profile.tempo_idx, color: '#63E6A5' },
                { label: 'Buildup Directness', val: detail.profile.buildup_directness_idx, color: '#FBBF24' },
              ].map((bar) => (
                <div key={bar.label} className="text-xs">
                  <div className="flex justify-between mb-1 tabular-nums">
                    <span className="text-[#A5B2BD]">{bar.label}</span>
                    <span className="font-mono text-[#F4F7F5]">{Math.round(bar.val * 100)} / 100</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#0D131A] overflow-hidden border border-[#34424E]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.round(bar.val * 100)}%`, backgroundColor: bar.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Side-by-Side In-Possession vs Out-of-Possession Tactical Snapshots */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl floodlit-card p-4">
              <div className="flex items-center justify-between mb-3 text-xs">
                <span className="font-display text-base font-semibold text-[#F4F7F5]">
                  In Possession · {detail.snapshots.in_possession.formation_label}
                </span>
                <span className="text-[#7DD3FC] font-mono">{detail.snapshots.in_possession.evidence_type}</span>
              </div>
              <div className="h-64 sm:h-72">
                <PitchFallback2D
                  snapshot={detail.snapshots.in_possession}
                  homeColor={pitchAccent}
                  overlays={DEFAULT_OVERLAYS}
                  isPlaying={false}
                  speed={1}
                  selectedPlayerId={null}
                  selectedEdgeIndex={null}
                  onSelectPlayer={() => {}}
                  onSelectEdge={() => {}}
                  reducedMotion={true}
                />
              </div>
              <p className="mt-3 text-xs text-[#A5B2BD]">{detail.profile.buildup_structure}</p>
            </div>

            <div className="rounded-xl floodlit-card p-4">
              <div className="flex items-center justify-between mb-3 text-xs">
                <span className="font-display text-base font-semibold text-[#F4F7F5]">
                  Out of Possession · {detail.snapshots.out_of_possession.formation_label}
                </span>
                <span className="text-[#F87171] font-mono">{detail.snapshots.out_of_possession.evidence_type}</span>
              </div>
              <div className="h-64 sm:h-72">
                <PitchFallback2D
                  snapshot={detail.snapshots.out_of_possession}
                  homeColor={pitchAccent}
                  overlays={DEFAULT_OVERLAYS}
                  isPlaying={false}
                  speed={1}
                  selectedPlayerId={null}
                  selectedEdgeIndex={null}
                  onSelectPlayer={() => {}}
                  onSelectEdge={() => {}}
                  reducedMotion={true}
                />
              </div>
              <p className="mt-3 text-xs text-[#A5B2BD]">{detail.profile.pressing_triggers}</p>
            </div>
          </div>

          {/* Complete Phase & Tendency Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {[
              { title: 'Rest Defense', body: detail.profile.rest_defense },
              { title: 'Width Profile', body: detail.profile.width_profile },
              { title: 'Tempo Profile', body: detail.profile.tempo_profile },
              { title: 'Attacking Transition', body: detail.profile.transition_attack },
              { title: 'Defensive Transition', body: detail.profile.transition_defense },
              { title: 'Substitution Tendencies', body: detail.profile.sub_tendencies },
            ].map((item) => (
              <div key={item.title} className="rounded-xl floodlit-card p-4">
                <h3 className="font-display text-sm font-semibold text-[#63E6A5]">{item.title}</h3>
                <p className="mt-1.5 text-[#A5B2BD] leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
