import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAppPreferences } from '../lib/quality';
import type { TacticalPhase, TacticalSnapshot } from '../types/tactical';
import { DataFreshnessStrip, EmptyState, LoadingSkeleton } from '../components/common/DataFreshnessStrip';
import { ClubKitBadge, resolveVisibleUiAccent } from '../components/common/FootballMotifs';
import { useToast } from '../components/common/ToastProvider';
import { TacticalTheatreStage } from '../components/pitch/TacticalTheatreStage';
import { TacticalHeatmap } from '../components/pitch/TacticalHeatmap';

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
  const safeClubAccent = teamQuery.data?.team
    ? resolveVisibleUiAccent(
        teamQuery.data.team.id,
        teamQuery.data.team.primary_color,
        teamQuery.data.team.secondary_color,
      )
    : '#7DD3FC';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F4F7F5]">
            3D Tactical Lab
          </h1>
          <p className="mt-1 text-sm text-[#A5B2BD]">
            Interactive 11-node formation morphing across possession, pressing, and transition phases.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="tlab-club" className="text-xs text-[#A5B2BD]">Club</label>
          <select
            id="tlab-club"
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="rounded-lg bg-[#141E28] border border-[#34424E] px-3 py-2 text-xs text-[#F4F7F5] min-h-[38px]"
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Desktop 65% (8/12 cols) Interactive Pitch Theatre */}
          <div className="lg:col-span-8">
            <TacticalTheatreStage
              snapshots={tactics.snapshots}
              homeColor={safeClubAccent}
              phase={phase}
              onPhaseChange={setPhase}
              allowEditor={true}
              onSaveSnapshot={async (snap) => {
                await saveMutation.mutateAsync(snap);
              }}
              heightClass="h-[440px] sm:h-[540px]"
            />
          </div>

          {/* Desktop 35% (4/12 cols) Tactical Inspector & Evidence Drawer */}
          <aside className="lg:col-span-4 flex flex-col gap-4">
            <div className="rounded-xl floodlit-card p-5">
              <div className="flex items-start gap-3">
                {teamQuery.data?.team && (
                  <ClubKitBadge
                    teamId={teamQuery.data.team.id}
                    primaryColor={teamQuery.data.team.primary_color}
                    secondaryColor={teamQuery.data.team.secondary_color}
                    tla={teamQuery.data.team.tla}
                    size="sm"
                  />
                )}
                <div>
                  <div className="text-xs text-[#A5B2BD]">
                    {tactics.appointment.team_name} · Appointed {tactics.appointment.valid_from}
                  </div>
                  <h2 className="mt-1 font-display text-xl font-bold text-[#F4F7F5]">
                    {tactics.manager.name}
                  </h2>
                </div>
              </div>
              <div className="mt-3 font-mono text-xs text-[#63E6A5] tabular-nums">
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
            <div className="rounded-xl floodlit-card p-5 text-xs">
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
      )}

      {teamQuery.data?.team && activeSnap && (
        <TacticalHeatmap
          homeTeam={{
            teamId: teamQuery.data.team.id,
            name: teamQuery.data.team.name,
            shortName: teamQuery.data.team.short_name,
            tla: teamQuery.data.team.tla,
            accentColor: safeClubAccent,
            formation: activeSnap.formation_label || tactics?.profile.base_formation,
            players: activeSnap.players,
          }}
          phase={phase}
          onPhaseChange={setPhase}
          title={`${teamQuery.data.team.short_name} Spatial Activity Heatmap`}
          subtitle="Synchronized with the active tactical phase and live 11-node formation coordinates above."
        />
      )}
    </div>
  );
};
