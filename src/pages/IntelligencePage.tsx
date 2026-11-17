import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, BarChart2, Flame, Shield, User } from 'lucide-react';
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { api } from '../lib/api';
import { useAppPreferences } from '../lib/quality';
import { AnimatedNumber } from '../components/common/AnimatedNumber';
import { DataFreshnessStrip, EmptyState, LoadingSkeleton } from '../components/common/DataFreshnessStrip';
import {
  CLUB_IDENTITY_META,
  ClubKitBadge,
  areKitColorsClose,
  resolveMatchupUiAccents,
} from '../components/common/FootballMotifs';
import { TacticalHeatmap } from '../components/pitch/TacticalHeatmap';
import { Heatmap } from '../components/analytics/Heatmap';
import { generateDummyPlayerHeatmapPoints, mapSquadToHeatmapNodes } from '../lib/heatmapData';
import type { TeamSplitBucket } from '../types/tactical';

function formatSplitRecord(b: TeamSplitBucket): string {
  return `${b.won}W-${b.drawn}D-${b.lost}L`;
}

export const IntelligencePage: React.FC = () => {
  const { selectedTeamId } = useAppPreferences();
  const [leftTeamId, setLeftTeamId] = useState<string>(selectedTeamId || 'arsenal');
  const [rightTeamId, setRightTeamId] = useState<string>(() =>
    (selectedTeamId || 'arsenal') === 'man-city' ? 'liverpool' : 'man-city',
  );
  const [activeTab, setActiveTab] = useState<'teams' | 'players' | 'canvas'>('teams');
  const [playerLeftIdx, setPlayerLeftIdx] = useState(0);
  const [playerRightIdx, setPlayerRightIdx] = useState(0);

  const statusQuery = useQuery({ queryKey: ['data-status'], queryFn: api.getDataStatus });
  const standingsQuery = useQuery({ queryKey: ['standings'], queryFn: api.getStandings });
  const compareQuery = useQuery({
    queryKey: ['team-compare', leftTeamId, rightTeamId],
    queryFn: () => api.getTeamComparison(leftTeamId, rightTeamId),
    enabled: Boolean(leftTeamId && rightTeamId && leftTeamId !== rightTeamId),
  });

  const teams = standingsQuery.data?.standings || [];
  const cmp = compareQuery.data;

  const swapClubs = () => {
    setLeftTeamId(rightTeamId);
    setRightTeamId(leftTeamId);
    setPlayerLeftIdx(0);
    setPlayerRightIdx(0);
  };

  const radarData = useMemo(() => {
    if (!cmp?.left.tactical_profile || !cmp?.right.tactical_profile) return [];
    const lp = cmp.left.tactical_profile;
    const rp = cmp.right.tactical_profile;
    return [
      {
        axis: 'Pressing',
        left: Math.round(lp.pressing_intensity_idx * 100),
        right: Math.round(rp.pressing_intensity_idx * 100),
      },
      {
        axis: 'Width',
        left: Math.round(lp.width_idx * 100),
        right: Math.round(rp.width_idx * 100),
      },
      {
        axis: 'Tempo',
        left: Math.round(lp.tempo_idx * 100),
        right: Math.round(rp.tempo_idx * 100),
      },
      {
        axis: 'Directness',
        left: Math.round(lp.buildup_directness_idx * 100),
        right: Math.round(rp.buildup_directness_idx * 100),
      },
      {
        axis: 'PPG Index',
        left: Math.min(100, Math.round((cmp.left.splits.overall.ppg / 3) * 100)),
        right: Math.min(100, Math.round((cmp.right.splits.overall.ppg / 3) * 100)),
      },
    ];
  }, [cmp]);

  const rightKitClash = cmp
    ? areKitColorsClose(cmp.left.team.primary_color, cmp.right.team.primary_color)
    : false;
  const matchupAccents = cmp
    ? resolveMatchupUiAccents(
        {
          teamId: cmp.left.team.id,
          primaryColor: cmp.left.team.primary_color,
          secondaryColor: cmp.left.team.secondary_color,
        },
        {
          teamId: cmp.right.team.id,
          primaryColor: cmp.right.team.primary_color,
          secondaryColor: cmp.right.team.secondary_color,
        },
      )
    : null;

  const leftPlayers = cmp?.left.players || [];
  const rightPlayers = cmp?.right.players || [];
  const selectedLeftPlayer = leftPlayers[playerLeftIdx] || leftPlayers[0];
  const selectedRightPlayer = rightPlayers[playerRightIdx] || rightPlayers[0];

  const leftHeatmapTeam = useMemo(
    () =>
      cmp
        ? {
            teamId: cmp.left.team.id,
            name: cmp.left.team.name,
            shortName: cmp.left.team.short_name,
            tla: cmp.left.team.tla,
            accentColor: matchupAccents?.homeAccent || '#7DD3FC',
            formation: cmp.left.tactical_profile?.base_formation || '4-3-3',
            players: mapSquadToHeatmapNodes(cmp.left.players),
          }
        : null,
    [cmp, matchupAccents],
  );

  const rightHeatmapTeam = useMemo(
    () =>
      cmp
        ? {
            teamId: cmp.right.team.id,
            name: cmp.right.team.name,
            shortName: cmp.right.team.short_name,
            tla: cmp.right.team.tla,
            accentColor: matchupAccents?.awayAccent || '#F87171',
            formation: cmp.right.tactical_profile?.base_formation || '4-2-3-1',
            players: mapSquadToHeatmapNodes(cmp.right.players),
          }
        : null,
    [cmp, matchupAccents],
  );

  const canvasSampleCoordinates = useMemo(() => {
    if (!leftHeatmapTeam || !selectedLeftPlayer) return [];
    const node =
      leftHeatmapTeam.players.find((n) => n.id === selectedLeftPlayer.id) ||
      leftHeatmapTeam.players[0];
    if (!node) return [];
    return generateDummyPlayerHeatmapPoints([node], {
      teamId: leftHeatmapTeam.teamId,
      phase: 'in_possession',
      pointsPerPlayer: 48,
    }).map((pt) => ({
      x: pt.x,
      y: pt.y,
      weight: pt.weight,
      label: selectedLeftPlayer.short_name,
    }));
  }, [leftHeatmapTeam, selectedLeftPlayer]);

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header & Module Switcher */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F4F7F5]">
            Team &amp; Player Intelligence
          </h1>
          <p className="mt-1 text-sm text-[#A5B2BD]">
            Side-by-side club attack/defence metrics, Home vs Away splits, player contribution profiles, and pitch activity heatmaps.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#1B2732] border border-[#34424E]" role="tablist" aria-label="Intelligence mode">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'teams'}
            onClick={() => setActiveTab('teams')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap min-h-[36px] transition-colors ${
              activeTab === 'teams' ? 'bg-[#63E6A5] text-[#0D131A] font-bold' : 'text-[#A5B2BD] hover:text-[#F4F7F5]'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Club Comparison
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'players'}
            onClick={() => setActiveTab('players')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap min-h-[36px] transition-colors ${
              activeTab === 'players' ? 'bg-[#63E6A5] text-[#0D131A] font-bold' : 'text-[#A5B2BD] hover:text-[#F4F7F5]'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            Player &amp; Heatmap
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'canvas'}
            onClick={() => setActiveTab('canvas')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap min-h-[36px] transition-colors ${
              activeTab === 'canvas' ? 'bg-[#63E6A5] text-[#0D131A] font-bold' : 'text-[#A5B2BD] hover:text-[#F4F7F5]'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            Canvas Heatmap
          </button>
        </div>
      </div>

      <DataFreshnessStrip
        status={statusQuery.data}
        isLoading={statusQuery.isLoading}
        error={statusQuery.error as Error | null}
      />

      {/* Club Picker Toolbar */}
      <div className="rounded-xl floodlit-card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="intel-left-club" className="text-xs font-semibold text-[#7DD3FC]">
            Club A
          </label>
          <select
            id="intel-left-club"
            value={leftTeamId}
            onChange={(e) => {
              setLeftTeamId(e.target.value);
              setPlayerLeftIdx(0);
            }}
            className="rounded-lg bg-[#141E28] border border-[#34424E] px-3 py-2 text-xs text-[#F4F7F5] min-h-[38px]"
          >
            {teams.map((t) => (
              <option key={t.team_id} value={t.team_id} disabled={t.team_id === rightTeamId}>
                {t.short_name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={swapClubs}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#141E28] hover:bg-[#233240] border border-[#34424E] text-xs font-medium text-[#F4F7F5] min-h-[38px] transition-colors"
        >
          <ArrowLeftRight className="w-3.5 h-3.5 text-[#63E6A5]" />
          Swap Clubs
        </button>

        <div className="flex items-center gap-2">
          <label htmlFor="intel-right-club" className="text-xs font-semibold text-[#F87171]">
            Club B
          </label>
          <select
            id="intel-right-club"
            value={rightTeamId}
            onChange={(e) => {
              setRightTeamId(e.target.value);
              setPlayerRightIdx(0);
            }}
            className="rounded-lg bg-[#141E28] border border-[#34424E] px-3 py-2 text-xs text-[#F4F7F5] min-h-[38px]"
          >
            {teams.map((t) => (
              <option key={t.team_id} value={t.team_id} disabled={t.team_id === leftTeamId}>
                {t.short_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {compareQuery.isLoading ? (
        <LoadingSkeleton rows={4} height="h-28" />
      ) : compareQuery.isError || !cmp || !matchupAccents ? (
        <EmptyState
          title="Unable to Load Club Comparison"
          description={(compareQuery.error as Error)?.message || 'Comparison endpoint failed.'}
          actionLabel="Retry"
          onAction={() => compareQuery.refetch()}
        />
      ) : activeTab === 'teams' ? (
        <>
          {/* Club Identities + Home/Away Splits */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[
              { side: cmp.left, accentHex: matchupAccents.homeAccent, isAwayKit: false },
              { side: cmp.right, accentHex: matchupAccents.awayAccent, isAwayKit: rightKitClash },
            ].map(({ side, accentHex, isAwayKit }) => {
              const clubMeta = CLUB_IDENTITY_META[side.team.id];
              return (
              <div
                key={side.team.id}
                className="rounded-xl floodlit-card p-5 flex flex-col gap-4 border"
                style={{
                  borderColor: `${accentHex}55`,
                  backgroundImage: `radial-gradient(circle at 12% 18%, ${accentHex}18, transparent 52%)`,
                }}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <ClubKitBadge
                      teamId={side.team.id}
                      primaryColor={side.team.primary_color}
                      secondaryColor={side.team.secondary_color}
                      tla={side.team.tla}
                      size="md"
                      isAway={isAwayKit}
                    />
                    <div>
                      <h2 className="font-display text-xl font-bold text-[#F4F7F5]">{side.team.name}</h2>
                      <div className="text-xs text-[#A5B2BD]">
                        {side.current_appointment?.manager_name || 'Manager'} · {side.tactical_profile?.base_formation || '4-3-3'}
                        {clubMeta ? ` · ${clubMeta.stadium}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-right tabular-nums">
                    <div className="font-mono text-2xl font-bold" style={{ color: accentHex }}>
                      <AnimatedNumber value={side.splits.overall.points} /> <span className="text-xs font-normal text-[#A5B2BD]">pts</span>
                    </div>
                    <div className="font-mono text-xs text-[#A5B2BD]">
                      <AnimatedNumber value={side.splits.overall.ppg} decimals={2} /> PPG
                    </div>
                  </div>
                </div>

                {/* Home vs Away Performance Splits */}
                <div className="grid grid-cols-3 gap-2.5 text-xs tabular-nums">
                  {[
                    { label: 'Overall', b: side.splits.overall },
                    { label: 'Home Split', b: side.splits.home },
                    { label: 'Away Split', b: side.splits.away },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg bg-[#141E28] border border-[#34424E] p-3">
                      <div className="text-[11px] text-[#A5B2BD]">{item.label}</div>
                      <div className="font-mono font-bold text-[#F4F7F5] mt-1">{formatSplitRecord(item.b)}</div>
                      <div className="font-mono text-[11px] text-[#63E6A5] mt-0.5">
                        {item.b.gf}:{item.b.ga} · {item.b.ppg.toFixed(2)} PPG
                      </div>
                      <div className="text-[10px] text-[#A5B2BD] mt-0.5">{item.b.clean_sheets} CS</div>
                    </div>
                  ))}
                </div>

                {/* Form + Observed Boxscore Averages */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#34424E] text-xs tabular-nums">
                  <div className="flex items-center gap-1 font-mono">
                    <span className="text-[#A5B2BD] mr-1">Form:</span>
                    {side.splits.form.map((res, idx) => (
                      <span
                        key={idx}
                        className={`w-5 h-5 rounded flex items-center justify-center text-[11px] font-bold ${
                          res === 'W'
                            ? 'bg-[#63E6A5]/20 text-[#63E6A5]'
                            : res === 'D'
                            ? 'bg-white/10 text-[#A5B2BD]'
                            : 'bg-[#F87171]/20 text-[#F87171]'
                        }`}
                      >
                        {res}
                      </span>
                    ))}
                  </div>
                  <div className="font-mono text-[#A5B2BD]">
                    {side.splits.avg_possession_pct !== null
                      ? `${side.splits.avg_possession_pct}% poss · ${side.splits.avg_shots_pg} sh/g`
                      : `${side.splits.goals_for_pg.toFixed(2)} GF/g · ${side.splits.goals_against_pg.toFixed(2)} GA/g`}
                  </div>
                </div>
              </div>
              );
            })}
          </div>

          {/* Tactical Radar & Metric Head-to-Head */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 rounded-xl floodlit-card p-5">
              <h3 className="font-display text-base font-semibold text-[#F4F7F5]">
                Tactical Style &amp; Output Radar
              </h3>
              <p className="text-xs text-[#A5B2BD] mt-0.5">
                Analyst-curated tactical indices paired with observed season PPG efficiency.
              </p>
              <div className="h-72 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#34424E" />
                    <PolarAngleAxis dataKey="axis" stroke="#A5B2BD" fontSize={12} />
                    <PolarRadiusAxis domain={[0, 100]} stroke="#34424E" fontSize={10} />
                    <Radar
                      name={cmp.left.team.short_name}
                      dataKey="left"
                      stroke={matchupAccents.homeAccent}
                      fill={matchupAccents.homeAccent}
                      fillOpacity={0.28}
                    />
                    <Radar
                      name={cmp.right.team.short_name}
                      dataKey="right"
                      stroke={matchupAccents.awayAccent}
                      fill={matchupAccents.awayAccent}
                      fillOpacity={0.26}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#141E28', borderColor: '#34424E', fontSize: '12px', color: '#F4F7F5' }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-6 rounded-xl floodlit-card p-5 flex flex-col gap-4">
              <h3 className="font-display text-base font-semibold text-[#F4F7F5]">
                Attack, Defence &amp; Observed Metrics Comparison
              </h3>
              <div className="flex flex-col gap-3.5 text-xs tabular-nums">
                {[
                  {
                    label: 'Goals Scored / Match',
                    l: cmp.left.splits.goals_for_pg,
                    r: cmp.right.splits.goals_for_pg,
                    dec: 2,
                  },
                  {
                    label: 'Goals Conceded / Match',
                    l: cmp.left.splits.goals_against_pg,
                    r: cmp.right.splits.goals_against_pg,
                    dec: 2,
                  },
                  {
                    label: 'Overall Clean Sheets',
                    l: cmp.left.splits.overall.clean_sheets,
                    r: cmp.right.splits.overall.clean_sheets,
                    dec: 0,
                  },
                  {
                    label: 'Observed Shots / Match',
                    l: cmp.left.splits.avg_shots_pg,
                    r: cmp.right.splits.avg_shots_pg,
                    dec: 1,
                  },
                  {
                    label: 'Observed Possession %',
                    l: cmp.left.splits.avg_possession_pct,
                    r: cmp.right.splits.avg_possession_pct,
                    dec: 1,
                    suffix: '%',
                  },
                  {
                    label: 'Observed xG / Match',
                    l: cmp.left.splits.xg_for_pg,
                    r: cmp.right.splits.xg_for_pg,
                    dec: 2,
                  },
                ].map((row) => {
                  const hasBoth = row.l !== null && row.r !== null;
                  const sum = hasBoth ? (row.l as number) + (row.r as number) : 0;
                  const lPct = sum > 0 ? ((row.l as number) / sum) * 100 : 50;
                  return (
                    <div key={row.label} className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center font-mono">
                        <span className="font-bold" style={{ color: matchupAccents.homeAccent }}>
                          {row.l !== null ? `${(row.l as number).toFixed(row.dec)}${row.suffix || ''}` : 'N/A'}
                        </span>
                        <span className="font-sans text-[#A5B2BD]">{row.label}</span>
                        <span className="font-bold" style={{ color: matchupAccents.awayAccent }}>
                          {row.r !== null ? `${(row.r as number).toFixed(row.dec)}${row.suffix || ''}` : 'N/A'}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[#141E28] border border-[#34424E] overflow-hidden flex">
                        <div className="h-full" style={{ width: `${hasBoth ? lPct : 50}%`, backgroundColor: matchupAccents.homeAccent }} />
                        <div className="h-full" style={{ width: `${hasBoth ? 100 - lPct : 50}%`, backgroundColor: matchupAccents.awayAccent }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-[#A5B2BD] mt-auto">
                xG / Match displays N/A when the active live feed omits expected goals rather than fabricating values.
              </p>
            </div>
          </div>
        </>
      ) : activeTab === 'players' ? (
        /* Player Intelligence & Heatmap Tab */
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Side-by-Side Player Role Impact Comparison */}
            <div className="lg:col-span-5 rounded-xl floodlit-card p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-semibold text-[#F4F7F5] flex items-center gap-2">
                  <User className="w-4 h-4 text-[#63E6A5]" />
                  Player Profile Comparison
                </h2>
                <span className="text-[11px] font-mono text-[#A5B2BD]">Squad XI Model Shares</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label htmlFor="pl-cmp-left" className="block text-[#7DD3FC] font-semibold mb-1">
                    {cmp.left.team.short_name} Player
                  </label>
                  <select
                    id="pl-cmp-left"
                    value={playerLeftIdx}
                    onChange={(e) => setPlayerLeftIdx(Number(e.target.value))}
                    className="w-full rounded-lg bg-[#141E28] border border-[#34424E] px-2.5 py-2 text-xs text-[#F4F7F5]"
                  >
                    {leftPlayers.map((p, idx) => (
                      <option key={p.id} value={idx}>
                        #{p.shirt_number} {p.short_name} ({p.position})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="pl-cmp-right" className="block text-[#F87171] font-semibold mb-1">
                    {cmp.right.team.short_name} Player
                  </label>
                  <select
                    id="pl-cmp-right"
                    value={playerRightIdx}
                    onChange={(e) => setPlayerRightIdx(Number(e.target.value))}
                    className="w-full rounded-lg bg-[#141E28] border border-[#34424E] px-2.5 py-2 text-xs text-[#F4F7F5]"
                  >
                    {rightPlayers.map((p, idx) => (
                      <option key={p.id} value={idx}>
                        #{p.shirt_number} {p.short_name} ({p.position})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedLeftPlayer && selectedRightPlayer && (
                <div className="flex flex-col gap-3 text-xs tabular-nums">
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      className="rounded-lg bg-[#141E28] border p-3"
                      style={{ borderColor: `${matchupAccents.homeAccent}66` }}
                    >
                      <div className="font-mono font-bold" style={{ color: matchupAccents.homeAccent }}>
                        #{selectedLeftPlayer.shirt_number} · {selectedLeftPlayer.position}
                      </div>
                      <div className="font-display text-sm font-bold text-[#F4F7F5] mt-0.5 truncate">
                        {selectedLeftPlayer.name}
                      </div>
                    </div>
                    <div
                      className="rounded-lg bg-[#141E28] border p-3"
                      style={{ borderColor: `${matchupAccents.awayAccent}66` }}
                    >
                      <div className="font-mono font-bold" style={{ color: matchupAccents.awayAccent }}>
                        #{selectedRightPlayer.shirt_number} · {selectedRightPlayer.position}
                      </div>
                      <div className="font-display text-sm font-bold text-[#F4F7F5] mt-0.5 truncate">
                        {selectedRightPlayer.name}
                      </div>
                    </div>
                  </div>

                  {[
                    {
                      label: 'Attacking xG Share Prior',
                      l: Math.round(selectedLeftPlayer.xg_share * 100),
                      r: Math.round(selectedRightPlayer.xg_share * 100),
                      suffix: '%',
                    },
                    {
                      label: 'Defensive Impact Share',
                      l: Math.round(selectedLeftPlayer.xga_impact * 100),
                      r: Math.round(selectedRightPlayer.xga_impact * 100),
                      suffix: '%',
                    },
                  ].map((m) => {
                    const tot = m.l + m.r;
                    const lPct = tot > 0 ? (m.l / tot) * 100 : 50;
                    return (
                      <div key={m.label} className="flex flex-col gap-1">
                        <div className="flex justify-between font-mono">
                          <span className="font-bold" style={{ color: matchupAccents.homeAccent }}>
                            {m.l}{m.suffix}
                          </span>
                          <span className="font-sans text-[#A5B2BD]">{m.label}</span>
                          <span className="font-bold" style={{ color: matchupAccents.awayAccent }}>
                            {m.r}{m.suffix}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-[#141E28] border border-[#34424E] overflow-hidden flex">
                          <div className="h-full" style={{ width: `${lPct}%`, backgroundColor: matchupAccents.homeAccent }} />
                          <div className="h-full" style={{ width: `${100 - lPct}%`, backgroundColor: matchupAccents.awayAccent }} />
                        </div>
                      </div>
                    );
                  })}

                  <p className="text-[11px] text-[#A5B2BD] leading-relaxed">
                    Player share metrics reflect model availability priors synced from 2026–27 ESPN rosters; event-level per-90 heatmaps below use dummy tactical coordinates.
                  </p>
                </div>
              )}
            </div>

            {/* Squad XI Quick Roster Table */}
            <div className="lg:col-span-7 rounded-xl floodlit-card p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-semibold text-[#F4F7F5] flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#63E6A5]" />
                  {cmp.left.team.short_name} Core Squad XI
                </h2>
                <span className="text-xs text-[#A5B2BD]">Real 2026–27 ESPN Roster</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs tabular-nums border-collapse">
                  <thead>
                    <tr className="border-b border-[#34424E] text-[#A5B2BD]">
                      <th className="py-2 px-2">#</th>
                      <th className="py-2 px-2">Player</th>
                      <th className="py-2 px-2">Role</th>
                      <th className="py-2 px-2 text-right">Att Share</th>
                      <th className="py-2 px-2 text-right">Def Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leftPlayers.slice(0, 11).map((p, idx) => (
                      <tr
                        key={p.id}
                        onClick={() => setPlayerLeftIdx(idx)}
                        className={`border-b border-[#34424E]/50 cursor-pointer transition-colors ${
                          idx === playerLeftIdx ? 'bg-[#141E28]' : 'hover:bg-[#141E28]/60'
                        }`}
                      >
                        <td className="py-2 px-2 font-mono text-[#63E6A5]">#{p.shirt_number}</td>
                        <td className="py-2 px-2 font-medium text-[#F4F7F5]">{p.name}</td>
                        <td className="py-2 px-2 font-mono text-[#7DD3FC]">{p.position}</td>
                        <td className="py-2 px-2 text-right font-mono text-[#F4F7F5]">
                          {(p.xg_share * 100).toFixed(1)}%
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-[#A5B2BD]">
                          {(p.xga_impact * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Interactive Tactical Heatmap */}
          {leftHeatmapTeam && rightHeatmapTeam && (
            <TacticalHeatmap
              homeTeam={leftHeatmapTeam}
              awayTeam={rightHeatmapTeam}
              title="Player Activity Density Heatmap"
              subtitle="Click any player node or Squad XI chip to isolate individual spatial density across the tactical pitch."
            />
          )}
        </>
      ) : (
        <Heatmap
          coordinates={canvasSampleCoordinates}
          title={
            selectedLeftPlayer
              ? `${cmp.left.team.short_name} · ${selectedLeftPlayer.name} Canvas Heatmap`
              : 'Canvas Tactical Activity Heatmap'
          }
          subtitle="HTML5 canvas Gaussian density visualization rendered on a Charcoal & Mint tactical pitch with interactive Demo Mode."
        />
      )}
    </div>
  );
};
