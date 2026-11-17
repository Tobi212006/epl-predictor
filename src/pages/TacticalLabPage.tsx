import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAppPreferences } from '../lib/quality';
import type { TacticalPhase, TacticalSnapshot } from '../types/tactical';
import { DataFreshnessStrip, EmptyState, LoadingSkeleton } from '../components/common/DataFreshnessStrip';
import {
  ClubKitBadge,
  ClubTlaBadge,
  getClubConfig,
  resolveVisibleUiAccent,
} from '../components/common/FootballMotifs';
import { useToast } from '../components/common/ToastProvider';
import { TacticalTheatreStage } from '../components/pitch/TacticalTheatreStage';
import { TacticalHeatmap } from '../components/pitch/TacticalHeatmap';

const PITCH_MOWING_BANDS = Array.from({ length: 10 }, (_, idx) => idx);

const RealisticPitchBackgroundOverlay: React.FC = () => (
  <div
    className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
    aria-hidden="true"
  >
    {/* Deep turf wash using theme's --pitch variable */}
    <div
      className="absolute inset-0 opacity-35"
      style={{
        background:
          'radial-gradient(ellipse 85% 75% at 50% 50%, var(--color-pitch, var(--pitch)) 0%, rgba(13, 19, 26, 0.92) 92%)',
      }}
    />

    {/* Responsive 2D SVG pitch markings driven by --pitch & --pitch-line CSS variables */}
    <svg
      viewBox="0 0 1200 780"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full opacity-30 sm:opacity-35"
    >
      {/* Alternating turf mowing stripes */}
      <g>
        {PITCH_MOWING_BANDS.map((band) => (
          <rect
            key={band}
            x={40 + band * 112}
            y={40}
            width={112}
            height={700}
            fill="var(--color-pitch, var(--pitch))"
            fillOpacity={band % 2 === 0 ? 0.42 : 0.24}
          />
        ))}
      </g>

      {/* Touchlines, halfway line, center circle, penalty boxes & corner arcs */}
      <g
        fill="none"
        stroke="var(--color-pitch-line, var(--pitch-line))"
        strokeWidth="2.2"
        strokeOpacity="0.65"
      >
        <rect x="40" y="40" width="1120" height="700" rx="6" />
        <line x1="600" y1="40" x2="600" y2="740" />
        <circle cx="600" cy="390" r="95" />
        <circle cx="600" cy="390" r="4" fill="var(--color-pitch-line, var(--pitch-line))" />

        {/* Left Penalty & 6-yard boxes */}
        <rect x="40" y="185" width="175" height="410" />
        <rect x="40" y="295" width="60" height="190" />
        <path d="M 215 316 A 95 95 0 0 1 215 464" />
        <circle cx="154" cy="390" r="3.5" fill="var(--color-pitch-line, var(--pitch-line))" />

        {/* Right Penalty & 6-yard boxes */}
        <rect x="985" y="185" width="175" height="410" />
        <rect x="1100" y="295" width="60" height="190" />
        <path d="M 985 316 A 95 95 0 0 0 985 464" />
        <circle cx="1046" cy="390" r="3.5" fill="var(--color-pitch-line, var(--pitch-line))" />

        {/* Corner arcs */}
        <path d="M 40 60 A 20 20 0 0 0 60 40" />
        <path d="M 1140 40 A 20 20 0 0 0 1160 60" />
        <path d="M 40 720 A 20 20 0 0 1 60 740" />
        <path d="M 1140 740 A 20 20 0 0 1 1160 720" />
      </g>
    </svg>
  </div>
);

export const TacticalLabPage: React.FC = () => {
  const qc = useQueryClient();
  const { pushToast } = useToast();
  const { selectedTeamId, setSelectedTeamId } = useAppPreferences();
  const [phase, setPhase] = useState<TacticalPhase>('in_possession');

  const statusQuery = useQuery({ queryKey: ['data-status'], queryFn: api.getDataStatus });
  const standingsQuery = useQuery({ queryKey: ['standings'], queryFn: api.getStandings });
  const teamQuery = useQuery({
    queryKey: ['team-detail', selectedTeamId],
    queryFn: () => api.getTeamDetail(selectedTeamId),
  });

  const managerId = teamQuery.data?.current_appointment?.manager_id;
  const tacticsQuery = useQuery({
    queryKey: ['manager-tactics', managerId],
    queryFn: () => api.getManagerTactics(managerId!),
    enabled: Boolean(managerId),
  });

  const saveMutation = useMutation({
    mutationFn: (snap: TacticalSnapshot) =>
      api.saveSnapshot({
        team_id: snap.team_id,
        manager_id: snap.manager_id,
        phase: snap.phase,
        formation_label: snap.formation_label,
        players: snap.players,
        annotations: snap.annotations,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manager-tactics', managerId] });
      pushToast({
        variant: 'success',
        title: 'Tactical Snapshot Saved',
        description: 'Custom formation coordinates persisted to SQLite.',
      });
    },
    onError: (err: Error) => {
      pushToast({
        variant: 'error',
        title: 'Unable to Save Snapshot',
        description: err.message,
      });
    },
  });

  const teams = standingsQuery.data?.standings || [];
  const tactics = tacticsQuery.data;
  const activeSnap = tactics?.snapshots?.[phase];
  const team = teamQuery.data?.team;
  const clubCfg = getClubConfig(team?.id || selectedTeamId);
  const safeClubAccent = team
    ? resolveVisibleUiAccent(team.id, team.primary_color, team.secondary_color)
    : '#7DD3FC';

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {/* Page Header & Club Selector */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.14em] text-[#C084FC]">
            Premier League Tactical Workbench
          </div>
          <h1 className="mt-0.5 font-display text-2xl sm:text-3xl font-bold text-[#F4F7F5] headline-balance">
            3D Tactical Lab
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#A5B2BD] max-w-2xl">
            Interactive 11-node formation morphing across possession, pressing, and transition phases over a scaled tactical pitch.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto w-full sm:w-auto">
          {clubCfg && (
            <ClubTlaBadge
              teamId={clubCfg.id}
              tla={clubCfg.tla}
              primaryColor={clubCfg.primaryColor}
              secondaryColor={clubCfg.secondaryColor}
              size="md"
            />
          )}
          <label htmlFor="tlab-club" className="text-xs text-[#A5B2BD] whitespace-nowrap">
            Club
          </label>
          <select
            id="tlab-club"
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="flex-1 sm:flex-initial rounded-lg bg-[#141E28] border border-[#34424E] px-3 py-2 text-xs text-[#F4F7F5] min-h-[40px]"
          >
            {teams.map((t) => (
              <option key={t.team_id} value={t.team_id}>
                {t.short_name}
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

      {teamQuery.isLoading || tacticsQuery.isLoading ? (
        <LoadingSkeleton rows={4} height="h-32" />
      ) : teamQuery.isError || tacticsQuery.isError || !tactics ? (
        <EmptyState
          title="Unable to Load Tactical Profile"
          description={((teamQuery.error || tacticsQuery.error) as Error)?.message || 'Manager tactical profile unavailable.'}
          actionLabel="Retry"
          onAction={() => {
            teamQuery.refetch();
            tacticsQuery.refetch();
          }}
        />
      ) : (
        <div
          className="relative rounded-2xl border p-3 sm:p-5 overflow-hidden bg-[#0D131A]"
          style={{ borderColor: 'color-mix(in srgb, var(--color-pitch-line, var(--pitch-line)) 42%, transparent)' }}
        >
          {/* Realistic 2D Pitch Background Overlay using CSS --pitch & --pitch-line */}
          <RealisticPitchBackgroundOverlay />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
            {/* Desktop 8/12 cols, Mobile full width: Interactive Pitch Theatre */}
            <div className="lg:col-span-8 min-w-0">
              <TacticalTheatreStage
                snapshots={tactics.snapshots}
                homeColor={safeClubAccent}
                phase={phase}
                onPhaseChange={setPhase}
                allowEditor={true}
                onSaveSnapshot={async (snap) => {
                  await saveMutation.mutateAsync(snap);
                }}
                heightClass="h-[340px] sm:h-[460px] lg:h-[540px]"
              />
            </div>

            {/* Desktop 4/12 cols, Mobile stacked cleanly below: Tactical Inspector */}
            <aside className="lg:col-span-4 flex flex-col gap-4 min-w-0">
              <div
                className="rounded-xl floodlit-card p-4 sm:p-5 border"
                style={{
                  borderColor: `${safeClubAccent}55`,
                  backgroundImage: `radial-gradient(circle at 12% 16%, ${safeClubAccent}18, transparent 54%)`,
                }}
              >
                <div className="flex items-start gap-3">
                  {team && (
                    <ClubKitBadge
                      teamId={team.id}
                      primaryColor={team.primary_color}
                      secondaryColor={team.secondary_color}
                      tla={team.tla}
                      size="sm"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs text-[#A5B2BD] truncate">
                      <span className="font-semibold" style={{ color: safeClubAccent }}>
                        {tactics.appointment.team_name}
                      </span>{' '}
                      · Appointed {tactics.appointment.valid_from}
                    </div>
                    <h2 className="mt-1 font-display text-lg sm:text-xl font-bold text-[#F4F7F5] truncate">
                      {tactics.manager.name}
                    </h2>
                  </div>
                </div>
                <div className="mt-3 font-mono text-xs text-[#63E6A5] tabular-nums break-words">
                  {tactics.profile.base_formation} → {tactics.profile.in_possession_shape} (Att) / {tactics.profile.out_of_possession_block} (Def)
                </div>

                {tactics.profile.confidence === 'low' && (
                  <div className="mt-3 rounded-lg bg-[#FBBF24]/10 border border-[#FBBF24]/35 p-3 text-xs text-[#FBBF24]">
                    Recent appointment ({tactics.profile.sample_size_matches} matches). Predecessor tactics are excluded; low current-tenure confidence.
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-[#34424E]">
                  <h3 className="text-xs font-semibold text-[#F4F7F5]">Phase Annotations</h3>
                  <ul className="mt-2 flex flex-col gap-2 text-xs text-[#A5B2BD]">
                    {(activeSnap?.annotations || []).map((note, idx) => (
                      <li key={idx} className="leading-relaxed">
                        • {note}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 pt-4 border-t border-[#34424E] flex flex-col gap-2 text-xs">
                  <div>
                    <span className="text-[#A5B2BD]">Buildup:</span>{' '}
                    <span className="text-[#F4F7F5]">{tactics.profile.buildup_structure}</span>
                  </div>
                  <div>
                    <span className="text-[#A5B2BD]">Pressing Triggers:</span>{' '}
                    <span className="text-[#F4F7F5]">{tactics.profile.pressing_triggers}</span>
                  </div>
                  <div>
                    <span className="text-[#A5B2BD]">Rest Defense:</span>{' '}
                    <span className="text-[#F4F7F5]">{tactics.profile.rest_defense}</span>
                  </div>
                </div>
              </div>

              {/* Evidence & Provenance Drawer */}
              <div className="rounded-xl floodlit-card p-4 sm:p-5 text-xs">
                <h3 className="font-display text-sm font-semibold text-[#F4F7F5]">
                  Evidence &amp; Provenance
                </h3>
                <div className="mt-2 text-[#A5B2BD] tabular-nums">
                  Sample size: {tactics.profile.sample_size_matches} matches · Snapshot type: {activeSnap?.evidence_type} · Profile: {tactics.profile.evidence_type}
                </div>
                <div className="mt-3 flex flex-col gap-2.5">
                  {tactics.sources.map((src) => (
                    <div key={src.id} className="rounded-lg bg-[#141E28] border border-[#34424E] p-3">
                      <div className="font-medium text-[#F4F7F5]">{src.title}</div>
                      <div className="text-[#A5B2BD] mt-0.5">
                        {src.publisher} · {src.published_at} · {src.evidence_type}
                      </div>
                      <p className="text-[#A5B2BD]/90 mt-1">{src.notes}</p>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}

      {team && activeSnap && (
        <TacticalHeatmap
          homeTeam={{
            teamId: team.id,
            name: team.name,
            shortName: team.short_name,
            tla: team.tla,
            accentColor: safeClubAccent,
            formation: activeSnap.formation_label || tactics?.profile.base_formation,
            players: activeSnap.players,
          }}
          phase={phase}
          onPhaseChange={setPhase}
          title={`${team.short_name} Spatial Activity Heatmap`}
          subtitle="Synchronized with the active tactical phase and live 11-node formation coordinates above."
        />
      )}
    </div>
  );
};
