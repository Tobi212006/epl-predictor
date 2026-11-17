import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, FlaskConical, Info, RotateCcw, Users } from 'lucide-react';
import { api } from '../../lib/api';
import {
  computeFilteredSummary,
  computePlayerPassingStats,
  filterPassingLinks,
  getFilteredPassWeight,
} from '../../lib/passingMetrics';
import type { PassFilterMode, PlayerNode } from '../../types/tactical';
import { AnimatedNumber } from '../common/AnimatedNumber';
import { EmptyState, LoadingSkeleton } from '../common/DataFreshnessStrip';
import { liftHexLuminance } from '../common/FootballMotifs';
import {
  SVG_MARGIN,
  SVG_PITCH_H,
  SVG_PITCH_W,
  SVG_VIEWBOX_H,
  SVG_VIEWBOX_W,
  canonicalToSvg2D,
} from './pitchCoords';

const FORMATION_OPTIONS = [
  { value: 'default', label: 'Club Default' },
  { value: '4-3-3', label: '4-3-3' },
  { value: '4-2-3-1', label: '4-2-3-1' },
  { value: '3-5-2', label: '3-5-2' },
  { value: '4-4-2', label: '4-4-2' },
  { value: '3-4-2-1', label: '3-4-2-1' },
];

const PASS_FILTER_TABS: Array<{ key: PassFilterMode; label: string }> = [
  { key: 'all', label: 'All passes' },
  { key: 'completed', label: 'Completed' },
  { key: 'incomplete', label: 'Incomplete' },
  { key: 'key', label: 'Key passes' },
];

interface FormationPassingPanelProps {
  mode: 'fixture' | 'custom';
  fixtureId?: string;
  homeTeamId: string;
  awayTeamId: string;
  homeName: string;
  awayName: string;
  homeTla: string;
  awayTla: string;
  homeColor?: string;
  awayColor?: string;
}

export const FormationPassingPanel: React.FC<FormationPassingPanelProps> = ({
  mode,
  fixtureId,
  homeTeamId,
  awayTeamId,
  homeName,
  awayName,
  homeTla,
  awayTla,
  homeColor = '#7DD3FC',
  awayColor = '#F87171',
}) => {
  const [selectedSide, setSelectedSide] = useState<'home' | 'away'>('home');
  const [formation, setFormation] = useState<string>('default');
  const [filterMode, setFilterMode] = useState<PassFilterMode>('all');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showDemoSample, setShowDemoSample] = useState<boolean>(false);

  const activeTeamId = selectedSide === 'home' ? homeTeamId : awayTeamId;
  const activeTeamName = selectedSide === 'home' ? homeName : awayName;
  const activeAccent = liftHexLuminance(selectedSide === 'home' ? homeColor : awayColor, 0.25);

  const passingQuery = useQuery({
    queryKey: [
      'passing-analysis',
      mode,
      fixtureId || '',
      activeTeamId,
      selectedSide,
      formation,
      showDemoSample,
    ],
    queryFn: () => {
      const requestedFmt = formation === 'default' ? undefined : formation;
      if (mode === 'fixture' && fixtureId) {
        return api.getMatchPassing(fixtureId, {
          team: selectedSide,
          formation: requestedFmt,
          demo: showDemoSample,
        });
      }
      return api.getTeamPassing(activeTeamId, {
        formation: requestedFmt,
        demo: showDemoSample,
      });
    },
    enabled: mode === 'fixture' ? Boolean(fixtureId) : Boolean(activeTeamId),
  });

  const data = passingQuery.data;
  const players: PlayerNode[] = data?.players || [];
  const allLinks = data?.links || [];

  const playerLookup = useMemo(() => {
    const m = new Map<string, PlayerNode>();
    players.forEach((p) => m.set(p.id, p));
    return m;
  }, [players]);

  const visibleLinks = useMemo(
    () => filterPassingLinks(allLinks, filterMode, selectedPlayerId),
    [allLinks, filterMode, selectedPlayerId],
  );

  const filteredSummary = useMemo(
    () => computeFilteredSummary(allLinks, filterMode, selectedPlayerId),
    [allLinks, filterMode, selectedPlayerId],
  );

  const selectedPlayer = selectedPlayerId ? playerLookup.get(selectedPlayerId) || null : null;
  const selectedPlayerStats = useMemo(() => {
    if (!selectedPlayerId) return null;
    return computePlayerPassingStats(selectedPlayerId, allLinks, players);
  }, [selectedPlayerId, allLinks, players]);

  const connectedPlayerIds = useMemo(() => {
    if (!selectedPlayerId) return new Set<string>();
    const ids = new Set<string>([selectedPlayerId]);
    for (const l of visibleLinks) {
      ids.add(l.from_id);
      ids.add(l.to_id);
    }
    return ids;
  }, [selectedPlayerId, visibleLinks]);

  const stripes = useMemo(() => Array.from({ length: 10 }, (_, i) => i), []);

  const handleTeamSideChange = (side: 'home' | 'away') => {
    setSelectedSide(side);
    setSelectedPlayerId(null);
  };

  const handleFormationChange = (nextFmt: string) => {
    setFormation(nextFmt);
    setSelectedPlayerId(null);
  };

  const observed = data?.observed_team_stats;
  const hasObservedBoxscore = Boolean(
    observed &&
      (observed.shots !== null ||
        observed.shots_on_target !== null ||
        observed.corners !== null ||
        observed.possession_pct !== null),
  );

  const isDemoActive = data?.data_mode === 'demo_sample';

  return (
    <section className="rounded-xl floodlit-card p-4 sm:p-6 flex flex-col gap-5" aria-label="Formation and Passing Analysis">
      {/* Header + Home/Away & Formation Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#F4F7F5]">
              Formation &amp; Passing Analysis
            </h2>
            {data && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border ${
                  isDemoActive
                    ? 'bg-[#FBBF24]/12 border-[#FBBF24]/40 text-[#FBBF24]'
                    : 'bg-[#141E28] border-[#34424E] text-[#A5B2BD]'
                }`}
              >
                <FlaskConical className="w-3 h-3 shrink-0" />
                {isDemoActive
                  ? 'Demo Sample · Not Live Match Data'
                  : 'Live Feed · Formation Layout Only'}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[#A5B2BD]">
            Switch clubs and tactical shapes ({data?.formation || (formation === 'default' ? 'Default' : formation)}) and click any player to isolate their passing links.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Home / Away Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#141E28] border border-[#34424E]" role="group" aria-label="Select team side">
            <button
              type="button"
              onClick={() => handleTeamSideChange('home')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 min-h-[38px] transition-colors ${
                selectedSide === 'home'
                  ? 'bg-[#63E6A5] text-[#0D131A] font-bold'
                  : 'text-[#A5B2BD] hover:text-[#F4F7F5]'
              }`}
            >
              {homeTla} (Home)
            </button>
            <button
              type="button"
              onClick={() => handleTeamSideChange('away')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 min-h-[38px] transition-colors ${
                selectedSide === 'away'
                  ? 'bg-[#63E6A5] text-[#0D131A] font-bold'
                  : 'text-[#A5B2BD] hover:text-[#F4F7F5]'
              }`}
            >
              {awayTla} (Away)
            </button>
          </div>

          {/* Formation Selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="passing-formation-select" className="text-xs text-[#A5B2BD] whitespace-nowrap">
              Shape
            </label>
            <select
              id="passing-formation-select"
              value={formation}
              onChange={(e) => handleFormationChange(e.target.value)}
              className="rounded-lg bg-[#141E28] border border-[#34424E] px-3 py-2 text-xs font-mono text-[#F4F7F5] min-h-[40px]"
            >
              {FORMATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Observed Match Team Boxscore Strip (when available in DB) */}
      {hasObservedBoxscore && observed && (
        <div className="rounded-lg bg-[#141E28] border border-[#34424E] px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-xs tabular-nums">
          <div className="font-medium text-[#F4F7F5]">
            Observed Team Boxscore · <span className="text-[#63E6A5]">{activeTeamName}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[#A5B2BD]">
            {observed.possession_pct !== null && (
              <span>
                Possession: <strong className="font-mono text-[#F4F7F5]">{observed.possession_pct.toFixed(1)}%</strong>
              </span>
            )}
            {observed.shots !== null && (
              <span>
                Shots: <strong className="font-mono text-[#F4F7F5]">{observed.shots}</strong>
              </span>
            )}
            {observed.shots_on_target !== null && (
              <span>
                On Target: <strong className="font-mono text-[#F4F7F5]">{observed.shots_on_target}</strong>
              </span>
            )}
            {observed.corners !== null && (
              <span>
                Corners: <strong className="font-mono text-[#F4F7F5]">{observed.corners}</strong>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Loading / Error States */}
      {passingQuery.isLoading ? (
        <LoadingSkeleton rows={3} height="h-28" />
      ) : passingQuery.isError ? (
        <EmptyState
          title="Unable to Load Formation & Passing View"
          description={(passingQuery.error as Error)?.message || 'Passing analysis endpoint failed.'}
          actionLabel="Retry"
          onAction={() => passingQuery.refetch()}
        />
      ) : !data ? null : (
        <>
          {/* Honest Live-API Limitation Banner vs Explicit Demo Sample Disclaimer */}
          {data.data_mode === 'unavailable_in_live_feed' ? (
            <div className="rounded-lg bg-[#141E28] border border-[#34424E] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-2.5 text-xs text-[#A5B2BD] leading-relaxed">
                <AlertCircle className="w-4 h-4 text-[#7DD3FC] shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-[#F4F7F5]">
                    Player-to-player pass tracking is unavailable in the live feed
                  </div>
                  <p className="mt-0.5">
                    {data.api_limitation_note ||
                      'Public free-tier feeds provide match scores, standings, and team boxscore totals, but omit event-level pass coordinates. Formation spacing below shows the tactical XI without fabricated live pass counts.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDemoSample(true)}
                className="px-4 py-2.5 rounded-lg bg-[#63E6A5] text-[#0D131A] text-xs font-bold hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 min-h-[42px]"
              >
                Load Sample Demo Passing Data
              </button>
            </div>
          ) : (
            <div className="rounded-lg bg-[#FBBF24]/10 border border-[#FBBF24]/35 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#FBBF24]">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Sample Demo Passing Dataset:</strong>{' '}
                  {data.disclaimer ||
                    'Illustrative passing links generated deterministically from team tempo/directness profiles for tactical exploration — not observed live player tracking events.'}
                </span>
              </div>
              {showDemoSample && (
                <button
                  type="button"
                  onClick={() => {
                    setShowDemoSample(false);
                    setSelectedPlayerId(null);
                  }}
                  className="px-3 py-1.5 rounded-md bg-[#141E28] border border-[#34424E] text-[#F4F7F5] text-xs font-medium hover:border-[#63E6A5] whitespace-nowrap shrink-0 min-h-[36px]"
                >
                  Return to Live View
                </button>
              )}
            </div>
          )}

          {/* Filter Tabs + Explicit Legend (shown when links exist) */}
          {allLinks.length > 0 && (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#141E28] border border-[#34424E]" role="tablist" aria-label="Pass category filter">
                {PASS_FILTER_TABS.map((tab) => {
                  const active = filterMode === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFilterMode(tab.key)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 min-h-[36px] transition-colors ${
                        active
                          ? 'bg-[#63E6A5] text-[#0D131A] font-bold'
                          : 'text-[#A5B2BD] hover:text-[#F4F7F5]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#A5B2BD]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-5 h-0.5 bg-[#63E6A5] inline-block" />
                  Completed / Flow
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-5 h-0 border-t-2 border-dashed border-[#F87171] inline-block" />
                  Incomplete
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#FBBF24] inline-block" />
                  Key Passes
                </span>
                <span className="text-[#A5B2BD]">Width = volume</span>
              </div>
            </div>
          )}

          {/* Main Pitch + Player Pass Stats Inspector Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* Pitch Canvas */}
            <div className="xl:col-span-8 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#A5B2BD]">
                <span>
                  <strong className="text-[#F4F7F5]">{activeTeamName}</strong> · {data.formation} · Attacking Right →
                </span>
                {selectedPlayerId && (
                  <button
                    type="button"
                    onClick={() => setSelectedPlayerId(null)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#63E6A5] hover:underline whitespace-nowrap"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset player focus
                  </button>
                )}
              </div>

              <div className="w-full rounded-xl border border-[#34424E] bg-[#0D131A] overflow-hidden">
                <svg
                  viewBox={`0 0 ${SVG_VIEWBOX_W} ${SVG_VIEWBOX_H}`}
                  className="w-full h-auto block select-none"
                  role="img"
                  aria-label={`${activeTeamName} ${data.formation} formation and passing network`}
                  onClick={() => setSelectedPlayerId(null)}
                >
                  <defs>
                    <marker id="pass-arrow-mint" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#63E6A5" />
                    </marker>
                    <marker id="pass-arrow-coral" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#F87171" />
                    </marker>
                    <marker id="pass-arrow-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#FBBF24" />
                    </marker>
                  </defs>

                  <rect x="0" y="0" width={SVG_VIEWBOX_W} height={SVG_VIEWBOX_H} fill="#0D131A" />

                  {/* Mowing Stripes */}
                  <g>
                    {stripes.map((i) => (
                      <rect
                        key={i}
                        x={SVG_MARGIN + i * (SVG_PITCH_W / 10)}
                        y={SVG_MARGIN}
                        width={SVG_PITCH_W / 10}
                        height={SVG_PITCH_H}
                        fill={i % 2 === 0 ? '#185443' : '#144738'}
                      />
                    ))}
                  </g>

                  {/* Pitch Lines */}
                  <g stroke="#7EC4A6" strokeWidth="2.4" fill="none" strokeOpacity="0.82">
                    <rect x={SVG_MARGIN} y={SVG_MARGIN} width={SVG_PITCH_W} height={SVG_PITCH_H} />
                    <line x1={SVG_MARGIN + SVG_PITCH_W / 2} y1={SVG_MARGIN} x2={SVG_MARGIN + SVG_PITCH_W / 2} y2={SVG_MARGIN + SVG_PITCH_H} />
                    <circle cx={SVG_MARGIN + SVG_PITCH_W / 2} cy={SVG_MARGIN + SVG_PITCH_H / 2} r={91.5} />
                    <circle cx={SVG_MARGIN + SVG_PITCH_W / 2} cy={SVG_MARGIN + SVG_PITCH_H / 2} r={4} fill="#7EC4A6" />
                    <rect x={SVG_MARGIN} y={SVG_MARGIN + (SVG_PITCH_H - 403) / 2} width={165} height={403} />
                    <rect x={SVG_MARGIN} y={SVG_MARGIN + (SVG_PITCH_H - 183) / 2} width={55} height={183} />
                    <rect x={SVG_MARGIN + SVG_PITCH_W - 165} y={SVG_MARGIN + (SVG_PITCH_H - 403) / 2} width={165} height={403} />
                    <rect x={SVG_MARGIN + SVG_PITCH_W - 55} y={SVG_MARGIN + (SVG_PITCH_H - 183) / 2} width={55} height={183} />
                  </g>

                  {/* Passing Connections */}
                  <g>
                    {visibleLinks.map((link) => {
                      const fromP = playerLookup.get(link.from_id);
                      const toP = playerLookup.get(link.to_id);
                      if (!fromP || !toP) return null;

                      const a = canonicalToSvg2D(fromP.x, fromP.y, false);
                      const b = canonicalToSvg2D(toP.x, toP.y, false);
                      const mx = (a.x + b.x) / 2;
                      const my = (a.y + b.y) / 2 - 18;
                      const pathD = `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
                      const weight = getFilteredPassWeight(link, filterMode);
                      const strokeW = Math.min(9.5, 1.5 + weight * 0.25);

                      const isIncompleteMode = filterMode === 'incomplete';
                      const isKeyMode = filterMode === 'key';
                      const strokeColor = isIncompleteMode
                        ? '#F87171'
                        : isKeyMode
                        ? '#FBBF24'
                        : '#63E6A5';
                      const markerEnd = isIncompleteMode
                        ? 'url(#pass-arrow-coral)'
                        : isKeyMode
                        ? 'url(#pass-arrow-amber)'
                        : 'url(#pass-arrow-mint)';

                      return (
                        <g key={`${link.from_id}-${link.to_id}`}>
                          <path
                            d={pathD}
                            fill="none"
                            stroke={strokeColor}
                            strokeWidth={strokeW}
                            strokeOpacity={selectedPlayerId ? 0.92 : 0.68}
                            strokeDasharray={isIncompleteMode ? '9 6' : undefined}
                            strokeLinecap="round"
                            markerEnd={markerEnd}
                          />
                          {selectedPlayerId && (
                            <g transform={`translate(${mx}, ${my})`}>
                              <rect x="-14" y="-10" width="28" height="20" rx="5" fill="#0D131A" stroke={strokeColor} strokeWidth="1.2" />
                              <text
                                textAnchor="middle"
                                dy="4"
                                fill="#F4F7F5"
                                fontSize="11"
                                fontWeight="700"
                                fontFamily="JetBrains Mono, monospace"
                              >
                                {weight}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </g>

                  {/* 11 Player Nodes */}
                  <g>
                    {players.map((p) => {
                      const pt = canonicalToSvg2D(p.x, p.y, false);
                      const isSelected = selectedPlayerId === p.id;
                      const isDimmed = Boolean(selectedPlayerId && !connectedPlayerIds.has(p.id));
                      return (
                        <g
                          key={p.id}
                          transform={`translate(${pt.x}, ${pt.y})`}
                          className="cursor-pointer"
                          opacity={isDimmed ? 0.35 : 1}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setSelectedPlayerId((prev) => (prev === p.id ? null : p.id));
                          }}
                        >
                          {isSelected && (
                            <circle r="30" fill="none" stroke="#63E6A5" strokeWidth="2.5" />
                          )}
                          <circle
                            r={isSelected ? 23 : 20}
                            fill="#141E28"
                            stroke={isSelected ? '#63E6A5' : activeAccent}
                            strokeWidth={isSelected ? 3.5 : 2.5}
                          />
                          <text
                            textAnchor="middle"
                            dy="5"
                            fill="#F4F7F5"
                            fontSize="14"
                            fontWeight="700"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {p.shirt_number}
                          </text>
                          <text
                            y="34"
                            textAnchor="middle"
                            fill="#F4F7F5"
                            fontSize="12"
                            fontWeight="600"
                            paintOrder="stroke"
                            stroke="#0D131A"
                            strokeWidth="3.5"
                          >
                            {p.short_name}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </svg>
              </div>

              {/* Touch-Friendly Squad Quick Selector (Keyboard & Mobile Friendly) */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-[#A5B2BD] mr-1 inline-flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-[#63E6A5]" />
                  Squad XI:
                </span>
                {players.map((p) => {
                  const active = selectedPlayerId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPlayerId((prev) => (prev === p.id ? null : p.id))}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors min-h-[32px] whitespace-nowrap ${
                        active
                          ? 'bg-[#63E6A5] border-[#63E6A5] text-[#0D131A] font-bold'
                          : 'bg-[#141E28] border-[#34424E] text-[#A5B2BD] hover:text-[#F4F7F5] hover:border-[#63E6A5]/50'
                      }`}
                    >
                      <span className="font-mono mr-1">#{p.shirt_number}</span>
                      {p.short_name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Summary KPIs & Selected Player Pass Inspector */}
            <div className="xl:col-span-4 flex flex-col gap-4">
              {/* Summary Metrics */}
              {allLinks.length > 0 ? (
                <div className="rounded-xl bg-[#141E28] border border-[#34424E] p-4 flex flex-col gap-3">
                  <div className="text-xs font-semibold text-[#F4F7F5]">
                    {selectedPlayer ? `${selectedPlayer.short_name} · Filtered Link Summary` : `${activeTeamName} · Passing Summary`}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs tabular-nums">
                    <div className="rounded-lg bg-[#0D131A] border border-[#34424E] p-3">
                      <div className="text-[#A5B2BD]">Total Passes</div>
                      <div className="font-mono text-lg font-bold text-[#F4F7F5] mt-0.5">
                        <AnimatedNumber value={filteredSummary.total_passes} />
                      </div>
                    </div>
                    <div className="rounded-lg bg-[#0D131A] border border-[#34424E] p-3">
                      <div className="text-[#A5B2BD]">Completion %</div>
                      <div className="font-mono text-lg font-bold text-[#63E6A5] mt-0.5">
                        <AnimatedNumber value={filteredSummary.completion_pct} decimals={1} suffix="%" />
                      </div>
                    </div>
                    <div className="rounded-lg bg-[#0D131A] border border-[#34424E] p-3">
                      <div className="text-[#A5B2BD]">Key Passes</div>
                      <div className="font-mono text-lg font-bold text-[#FBBF24] mt-0.5">
                        <AnimatedNumber value={filteredSummary.key_passes} />
                      </div>
                    </div>
                    <div className="rounded-lg bg-[#0D131A] border border-[#34424E] p-3">
                      <div className="text-[#A5B2BD]">Top Link</div>
                      <div className="font-mono text-xs font-semibold text-[#7DD3FC] mt-1 truncate">
                        {filteredSummary.most_connected_pair
                          ? `${filteredSummary.most_connected_pair.from_name} → ${filteredSummary.most_connected_pair.to_name} (${filteredSummary.most_connected_pair.total_passes})`
                          : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-[#141E28] border border-[#34424E] p-4 text-xs text-[#A5B2BD]">
                  <div className="font-semibold text-[#F4F7F5] mb-1">Formation Shape Ready</div>
                  <p className="leading-relaxed">
                    Inspecting <strong className="text-[#F4F7F5]">{data.formation}</strong> positional layout for {activeTeamName}. Click any player node or load the demo passing sample above to explore passing networks.
                  </p>
                </div>
              )}

              {/* Selected Player Pass Stats */}
              <div className="rounded-xl bg-[#141E28] border border-[#34424E] p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-[#F4F7F5]">Player Pass Inspector</div>
                  {selectedPlayer && (
                    <span className="font-mono text-[11px] text-[#63E6A5]">
                      #{selectedPlayer.shirt_number} · {selectedPlayer.role}
                    </span>
                  )}
                </div>

                {!selectedPlayer ? (
                  <p className="text-xs text-[#A5B2BD] leading-relaxed">
                    Click any player circle on the pitch (or pick a player from the Squad XI row) to highlight only their passing connections and inspect partner totals.
                  </p>
                ) : selectedPlayerStats && allLinks.length > 0 ? (
                  <>
                    <div className="font-display text-base font-bold text-[#F4F7F5]">
                      {selectedPlayer.name}
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 text-xs tabular-nums">
                      <div className="rounded-lg bg-[#0D131A] border border-[#34424E] p-2.5">
                        <div className="text-[#A5B2BD]">Attempted</div>
                        <div className="font-mono text-base font-bold text-[#F4F7F5]">{selectedPlayerStats.attempted}</div>
                      </div>
                      <div className="rounded-lg bg-[#0D131A] border border-[#34424E] p-2.5">
                        <div className="text-[#A5B2BD]">Completed</div>
                        <div className="font-mono text-base font-bold text-[#63E6A5]">{selectedPlayerStats.completed}</div>
                      </div>
                      <div className="rounded-lg bg-[#0D131A] border border-[#34424E] p-2.5">
                        <div className="text-[#A5B2BD]">Completion %</div>
                        <div className="font-mono text-base font-bold text-[#7DD3FC]">{selectedPlayerStats.completionPct.toFixed(1)}%</div>
                      </div>
                      <div className="rounded-lg bg-[#0D131A] border border-[#34424E] p-2.5">
                        <div className="text-[#A5B2BD]">Key Passes</div>
                        <div className="font-mono text-base font-bold text-[#FBBF24]">{selectedPlayerStats.keyPasses}</div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#34424E]">
                      <div className="text-[11px] font-semibold text-[#A5B2BD] mb-2">Top Passing Partners</div>
                      <div className="flex flex-col gap-1.5 text-xs tabular-nums">
                        {selectedPlayerStats.topPartners.map((partner) => (
                          <div key={partner.partnerId} className="flex items-center justify-between gap-2 rounded-md bg-[#0D131A] px-2.5 py-1.5 border border-[#34424E]">
                            <span className="text-[#F4F7F5] font-medium truncate">{partner.partnerName}</span>
                            <span className="font-mono text-[11px] text-[#63E6A5]">
                              {partner.completed}/{partner.passes} ({partner.keyPasses} KP)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-[#A5B2BD] leading-relaxed">
                    <div className="font-display text-sm font-bold text-[#F4F7F5] mb-1">
                      {selectedPlayer.name} ({selectedPlayer.role})
                    </div>
                    <p>
                      Canonical zone ({selectedPlayer.x}, {selectedPlayer.y}) in {data.formation}. Load the demo passing sample to inspect player-to-player pass counts.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
};
