import React, { useId, useMemo, useState } from 'react';
import {
  Activity,
  Eye,
  EyeOff,
  Flame,
  FlaskConical,
  Grid3X3,
  RotateCcw,
  SwitchCamera,
  Users,
} from 'lucide-react';
import {
  computeHeatmapDensityGrid,
  describePitchZone,
  generateDummyPlayerHeatmapPoints,
  heatmapIntensityToColor,
  summarizeHeatmapActivity,
} from '../../lib/heatmapData';
import type {
  HeatmapActionType,
  HeatmapGridCell,
  PlayerNode,
  TacticalPhase,
} from '../../types/tactical';
import { AnimatedNumber } from '../common/AnimatedNumber';
import { liftHexLuminance } from '../common/FootballMotifs';
import {
  SVG_MARGIN,
  SVG_PITCH_H,
  SVG_PITCH_W,
  SVG_VIEWBOX_H,
  SVG_VIEWBOX_W,
  canonicalToSvg2D,
} from './pitchCoords';

export interface HeatmapTeamConfig {
  teamId: string;
  name: string;
  shortName: string;
  tla: string;
  accentColor?: string;
  formation?: string;
  players: PlayerNode[];
}

interface TacticalHeatmapProps {
  homeTeam: HeatmapTeamConfig;
  awayTeam?: HeatmapTeamConfig;
  initialSide?: 'home' | 'away';
  phase?: TacticalPhase;
  onPhaseChange?: (phase: TacticalPhase) => void;
  showPhaseSelector?: boolean;
  title?: string;
  subtitle?: string;
}

const GRID_COLS = 28;
const GRID_ROWS = 18;

const PHASE_OPTIONS: Array<{ key: TacticalPhase; label: string }> = [
  { key: 'base', label: 'Base' },
  { key: 'in_possession', label: 'In Possession' },
  { key: 'out_of_possession', label: 'Out of Possession' },
  { key: 'attack_transition', label: 'Atk Transition' },
  { key: 'defensive_transition', label: 'Def Transition' },
];

const ACTION_FILTERS: Array<{ key: 'all' | HeatmapActionType; label: string }> = [
  { key: 'all', label: 'All Actions' },
  { key: 'touch', label: 'Touches' },
  { key: 'progressive', label: 'Progressive' },
  { key: 'defensive', label: 'Defensive' },
];

export const TacticalHeatmap: React.FC<TacticalHeatmapProps> = ({
  homeTeam,
  awayTeam,
  initialSide = 'home',
  phase: controlledPhase,
  onPhaseChange,
  showPhaseSelector = true,
  title = 'Player Activity Density Heatmap',
  subtitle = 'Gaussian kernel density visualization generated from dummy tactical coordinate samples.',
}) => {
  const uid = useId().replace(/:/g, '');
  const [selectedSide, setSelectedSide] = useState<'home' | 'away'>(initialSide);
  const [internalPhase, setInternalPhase] = useState<TacticalPhase>('in_possession');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<'all' | HeatmapActionType>('all');
  const [renderMode, setRenderMode] = useState<'thermal' | 'grid'>('thermal');
  const [showSampleDots, setShowSampleDots] = useState<boolean>(true);
  const [showPlayerNodes, setShowPlayerNodes] = useState<boolean>(true);
  const [flipDirection, setFlipDirection] = useState<boolean>(false);
  const [hoveredCell, setHoveredCell] = useState<HeatmapGridCell | null>(null);

  const activePhase = controlledPhase ?? internalPhase;
  const setPhase = (next: TacticalPhase) => {
    if (onPhaseChange) onPhaseChange(next);
    else setInternalPhase(next);
  };

  const activeTeam = selectedSide === 'away' && awayTeam ? awayTeam : homeTeam;
  const players = activeTeam.players || [];
  const activeAccent = liftHexLuminance(
    activeTeam.accentColor || (selectedSide === 'away' ? '#F87171' : '#7DD3FC'),
    0.25,
  );

  const allTeamPoints = useMemo(
    () =>
      generateDummyPlayerHeatmapPoints(players, {
        teamId: activeTeam.teamId,
        phase: activePhase,
        pointsPerPlayer: 26,
      }),
    [players, activeTeam.teamId, activePhase],
  );

  const filteredPoints = useMemo(() => {
    return allTeamPoints.filter((pt) => {
      if (selectedPlayerId && pt.playerId !== selectedPlayerId) return false;
      if (actionFilter !== 'all' && pt.actionType !== actionFilter) return false;
      return true;
    });
  }, [allTeamPoints, selectedPlayerId, actionFilter]);

  const densityGrid = useMemo(
    () =>
      computeHeatmapDensityGrid(
        filteredPoints,
        GRID_COLS,
        GRID_ROWS,
        selectedPlayerId ? 6.6 : 7.6,
        selectedPlayerId ? 7.6 : 8.6,
      ),
    [filteredPoints, selectedPlayerId],
  );

  const summary = useMemo(
    () => summarizeHeatmapActivity(filteredPoints, densityGrid),
    [filteredPoints, densityGrid],
  );

  const selectedPlayer = useMemo(
    () => (selectedPlayerId ? players.find((p) => p.id === selectedPlayerId) || null : null),
    [players, selectedPlayerId],
  );

  const stripes = useMemo(() => Array.from({ length: 10 }, (_, i) => i), []);
  const cellW = SVG_PITCH_W / GRID_COLS;
  const cellH = SVG_PITCH_H / GRID_ROWS;

  const blurFilterId = `hm-blur-${uid}`;
  const pitchClipId = `hm-clip-${uid}`;
  const thermalGradId = `hm-grad-${uid}`;

  const handleSideSwitch = (side: 'home' | 'away') => {
    setSelectedSide(side);
    setSelectedPlayerId(null);
    setHoveredCell(null);
  };

  return (
    <section
      className="rounded-xl floodlit-card p-4 sm:p-6 flex flex-col gap-5"
      aria-label="Player Activity Density Heatmap"
    >
      {/* Header + Home/Away + Mode Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#F4F7F5]">
              {title}
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border bg-[#63E6A5]/10 border-[#63E6A5]/40 text-[#63E6A5]">
              <FlaskConical className="w-3 h-3 shrink-0" />
              Demo Sample · Dummy Coordinates
            </span>
          </div>
          <p className="mt-1 text-xs text-[#A5B2BD]">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {awayTeam && (
            <div
              className="flex items-center gap-1 p-1 rounded-lg bg-[#141E28] border border-[#34424E]"
              role="group"
              aria-label="Heatmap team side"
            >
              <button
                type="button"
                onClick={() => handleSideSwitch('home')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 min-h-[36px] transition-colors ${
                  selectedSide === 'home'
                    ? 'bg-[#63E6A5] text-[#0D131A] font-bold'
                    : 'text-[#A5B2BD] hover:text-[#F4F7F5]'
                }`}
              >
                {homeTeam.tla} (Home)
              </button>
              <button
                type="button"
                onClick={() => handleSideSwitch('away')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 min-h-[36px] transition-colors ${
                  selectedSide === 'away'
                    ? 'bg-[#63E6A5] text-[#0D131A] font-bold'
                    : 'text-[#A5B2BD] hover:text-[#F4F7F5]'
                }`}
              >
                {awayTeam.tla} (Away)
              </button>
            </div>
          )}

          {/* Smooth Thermal vs Tactical Grid Mode */}
          <div
            className="flex items-center gap-1 p-1 rounded-lg bg-[#141E28] border border-[#34424E]"
            role="group"
            aria-label="Heatmap visualization mode"
          >
            <button
              type="button"
              onClick={() => setRenderMode('thermal')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 min-h-[36px] transition-colors ${
                renderMode === 'thermal'
                  ? 'bg-[#63E6A5] text-[#0D131A] font-bold'
                  : 'text-[#A5B2BD] hover:text-[#F4F7F5]'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              Smooth Thermal
            </button>
            <button
              type="button"
              onClick={() => setRenderMode('grid')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 min-h-[36px] transition-colors ${
                renderMode === 'grid'
                  ? 'bg-[#63E6A5] text-[#0D131A] font-bold'
                  : 'text-[#A5B2BD] hover:text-[#F4F7F5]'
              }`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              Grid Zones
            </button>
          </div>
        </div>
      </div>

      {/* Phase & Action Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {showPhaseSelector && (
            <div
              className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#141E28] border border-[#34424E]"
              role="tablist"
              aria-label="Heatmap tactical phase"
            >
              {PHASE_OPTIONS.map((opt) => {
                const active = activePhase === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setPhase(opt.key)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 min-h-[34px] transition-colors ${
                      active
                        ? 'bg-[#63E6A5] text-[#0D131A] font-bold'
                        : 'text-[#A5B2BD] hover:text-[#F4F7F5]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}

          <div
            className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#141E28] border border-[#34424E]"
            role="group"
            aria-label="Action coordinate filter"
          >
            {ACTION_FILTERS.map((f) => {
              const active = actionFilter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setActionFilter(f.key)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 min-h-[34px] transition-colors ${
                    active
                      ? 'bg-[#233240] text-[#63E6A5] border border-[#63E6A5]/45 font-semibold'
                      : 'text-[#A5B2BD] hover:text-[#F4F7F5]'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Layer & Direction Toggles */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setShowSampleDots((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border min-h-[34px] whitespace-nowrap transition-colors ${
              showSampleDots
                ? 'bg-[#141E28] border-[#63E6A5]/50 text-[#63E6A5]'
                : 'bg-[#141E28] border-[#34424E] text-[#A5B2BD]'
            }`}
          >
            {showSampleDots ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            Coordinates
          </button>
          <button
            type="button"
            onClick={() => setShowPlayerNodes((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border min-h-[34px] whitespace-nowrap transition-colors ${
              showPlayerNodes
                ? 'bg-[#141E28] border-[#7DD3FC]/50 text-[#7DD3FC]'
                : 'bg-[#141E28] border-[#34424E] text-[#A5B2BD]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            XI Nodes
          </button>
          <button
            type="button"
            onClick={() => setFlipDirection((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#141E28] border border-[#34424E] text-[#A5B2BD] hover:text-[#F4F7F5] min-h-[34px] whitespace-nowrap transition-colors"
          >
            <SwitchCamera className="w-3.5 h-3.5" />
            Flip
          </button>
        </div>
      </div>

      {/* Main Pitch + Telemetry Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left: SVG Tactical Pitch with Charcoal-to-Mint Density Field */}
        <div className="xl:col-span-8 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#A5B2BD]">
            <span>
              <strong className="text-[#F4F7F5]">{activeTeam.shortName}</strong>
              {activeTeam.formation ? ` · ${activeTeam.formation}` : ''}
              {' · '}
              {selectedPlayer ? (
                <span className="text-[#63E6A5] font-semibold">
                  #{selectedPlayer.shirt_number} {selectedPlayer.name} ({selectedPlayer.role})
                </span>
              ) : (
                <span>Full XI Composite</span>
              )}
              {' · '}
              {flipDirection ? '← Attacking Left' : 'Attacking Right →'}
            </span>

            <div className="flex items-center gap-3">
              {hoveredCell && (
                <span className="font-mono text-[11px] text-[#63E6A5] tabular-nums">
                  {describePitchZone(hoveredCell.x, hoveredCell.y)} · {Math.round(hoveredCell.intensity * 100)}%
                </span>
              )}
              {selectedPlayerId && (
                <button
                  type="button"
                  onClick={() => setSelectedPlayerId(null)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#63E6A5] hover:underline whitespace-nowrap"
                >
                  <RotateCcw className="w-3 h-3" />
                  All XI
                </button>
              )}
            </div>
          </div>

          <div className="w-full rounded-xl border border-[#34424E] bg-[#0D131A] overflow-hidden">
            <svg
              viewBox={`0 0 ${SVG_VIEWBOX_W} ${SVG_VIEWBOX_H}`}
              className="w-full h-auto block select-none"
              role="img"
              aria-label={`${activeTeam.shortName} player activity heatmap on tactical pitch`}
              onClick={() => setSelectedPlayerId(null)}
              onMouseLeave={() => setHoveredCell(null)}
            >
              <defs>
                <clipPath id={pitchClipId}>
                  <rect
                    x={SVG_MARGIN}
                    y={SVG_MARGIN}
                    width={SVG_PITCH_W}
                    height={SVG_PITCH_H}
                    rx="4"
                  />
                </clipPath>
                <filter id={blurFilterId} x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="22" />
                </filter>
                <radialGradient id={thermalGradId} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#E2FDF0" stopOpacity="0.96" />
                  <stop offset="38%" stopColor="#63E6A5" stopOpacity="0.78" />
                  <stop offset="72%" stopColor="#20B286" stopOpacity="0.38" />
                  <stop offset="100%" stopColor="#0D131A" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Outer Charcoal Stadium Apron */}
              <rect x="0" y="0" width={SVG_VIEWBOX_W} height={SVG_VIEWBOX_H} fill="#0D131A" />

              {/* Alternating Charcoal-Emerald Pitch Turf Stripes */}
              <g>
                {stripes.map((i) => (
                  <rect
                    key={i}
                    x={SVG_MARGIN + i * (SVG_PITCH_W / 10)}
                    y={SVG_MARGIN}
                    width={SVG_PITCH_W / 10}
                    height={SVG_PITCH_H}
                    fill={i % 2 === 0 ? '#11382D' : '#0E2F26'}
                  />
                ))}
              </g>

              {/* Heatmap Density Layer clipped cleanly to Pitch Boundary */}
              <g clipPath={`url(#${pitchClipId})`}>
                {renderMode === 'thermal' ? (
                  <>
                    {/* Subtle Charcoal-to-Mint Density Grid Backdrop */}
                    <g opacity="0.82">
                      {densityGrid.map((cell) => {
                        if (cell.intensity < 0.08) return null;
                        const cx = flipDirection ? 100 - cell.x : cell.x;
                        const cy = flipDirection ? 100 - cell.y : cell.y;
                        const pos = canonicalToSvg2D(cx, cy, false);
                        return (
                          <rect
                            key={`th-${cell.col}-${cell.row}`}
                            x={pos.x - cellW * 0.55}
                            y={pos.y - cellH * 0.55}
                            width={cellW * 1.1}
                            height={cellH * 1.1}
                            fill={heatmapIntensityToColor(cell.intensity)}
                          />
                        );
                      })}
                    </g>

                    {/* Smooth Blurred Gaussian Thermal Splats */}
                    <g filter={`url(#${blurFilterId})`} opacity="0.88">
                      {densityGrid
                        .filter((cell) => cell.intensity >= 0.24)
                        .map((cell) => {
                          const cx = flipDirection ? 100 - cell.x : cell.x;
                          const cy = flipDirection ? 100 - cell.y : cell.y;
                          const pos = canonicalToSvg2D(cx, cy, false);
                          const radius = 26 + cell.intensity * 46;
                          return (
                            <circle
                              key={`splat-${cell.col}-${cell.row}`}
                              cx={pos.x}
                              cy={pos.y}
                              r={radius}
                              fill={`url(#${thermalGradId})`}
                              opacity={Math.min(0.85, cell.intensity * 0.85)}
                            />
                          );
                        })}
                    </g>
                  </>
                ) : (
                  /* Structured Tactical Grid Mode with Interactive Hover Readout */
                  <g>
                    {densityGrid.map((cell) => {
                      const cx = flipDirection ? 100 - cell.x : cell.x;
                      const cy = flipDirection ? 100 - cell.y : cell.y;
                      const pos = canonicalToSvg2D(cx, cy, false);
                      const isHovered =
                        hoveredCell?.col === cell.col && hoveredCell?.row === cell.row;
                      return (
                        <rect
                          key={`grid-${cell.col}-${cell.row}`}
                          x={pos.x - cellW / 2}
                          y={pos.y - cellH / 2}
                          width={cellW}
                          height={cellH}
                          fill={heatmapIntensityToColor(cell.intensity)}
                          stroke={isHovered ? '#F4F7F5' : 'rgba(13, 19, 26, 0.28)'}
                          strokeWidth={isHovered ? 2 : 0.7}
                          className="cursor-crosshair"
                          onMouseEnter={() => setHoveredCell(cell)}
                        />
                      );
                    })}
                  </g>
                )}
              </g>

              {/* Crisp Pitch Markings */}
              <g
                stroke="#7EC4A6"
                strokeWidth="2.4"
                fill="none"
                strokeOpacity="0.86"
                className="pointer-events-none"
              >
                <rect x={SVG_MARGIN} y={SVG_MARGIN} width={SVG_PITCH_W} height={SVG_PITCH_H} />
                <line
                  x1={SVG_MARGIN + SVG_PITCH_W / 2}
                  y1={SVG_MARGIN}
                  x2={SVG_MARGIN + SVG_PITCH_W / 2}
                  y2={SVG_MARGIN + SVG_PITCH_H}
                />
                <circle
                  cx={SVG_MARGIN + SVG_PITCH_W / 2}
                  cy={SVG_MARGIN + SVG_PITCH_H / 2}
                  r={91.5}
                />
                <circle
                  cx={SVG_MARGIN + SVG_PITCH_W / 2}
                  cy={SVG_MARGIN + SVG_PITCH_H / 2}
                  r={4}
                  fill="#7EC4A6"
                />
                <rect
                  x={SVG_MARGIN}
                  y={SVG_MARGIN + (SVG_PITCH_H - 403) / 2}
                  width={165}
                  height={403}
                />
                <rect
                  x={SVG_MARGIN}
                  y={SVG_MARGIN + (SVG_PITCH_H - 183) / 2}
                  width={55}
                  height={183}
                />
                <rect
                  x={SVG_MARGIN + SVG_PITCH_W - 165}
                  y={SVG_MARGIN + (SVG_PITCH_H - 403) / 2}
                  width={165}
                  height={403}
                />
                <rect
                  x={SVG_MARGIN + SVG_PITCH_W - 55}
                  y={SVG_MARGIN + (SVG_PITCH_H - 183) / 2}
                  width={55}
                  height={183}
                />
              </g>

              {/* Raw Sample Coordinate Dots */}
              {showSampleDots && (
                <g className="pointer-events-none">
                  {filteredPoints.map((pt) => {
                    const pos = canonicalToSvg2D(pt.x, pt.y, flipDirection);
                    const dotColor =
                      pt.actionType === 'progressive'
                        ? '#63E6A5'
                        : pt.actionType === 'defensive'
                        ? '#7DD3FC'
                        : '#F4F7F5';
                    return (
                      <circle
                        key={pt.id}
                        cx={pos.x}
                        cy={pos.y}
                        r={selectedPlayerId ? 4.2 : 2.8}
                        fill={dotColor}
                        fillOpacity={selectedPlayerId ? 0.85 : 0.62}
                        stroke="#0D131A"
                        strokeWidth="1"
                      />
                    );
                  })}
                </g>
              )}

              {/* Interactive Squad XI Nodes */}
              {showPlayerNodes && (
                <g>
                  {players.map((p) => {
                    const pt = canonicalToSvg2D(p.x, p.y, flipDirection);
                    const isSelected = selectedPlayerId === p.id;
                    const isDimmed = Boolean(selectedPlayerId && !isSelected);
                    return (
                      <g
                        key={p.id}
                        transform={`translate(${pt.x}, ${pt.y})`}
                        className="cursor-pointer"
                        opacity={isDimmed ? 0.36 : 1}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setSelectedPlayerId((prev) => (prev === p.id ? null : p.id));
                        }}
                      >
                        {isSelected && (
                          <circle
                            r="29"
                            fill="none"
                            stroke="#63E6A5"
                            strokeWidth="2.5"
                            strokeDasharray="5 3"
                          />
                        )}
                        <circle
                          r={isSelected ? 22 : 18}
                          fill="#141E28"
                          fillOpacity="0.92"
                          stroke={isSelected ? '#63E6A5' : activeAccent}
                          strokeWidth={isSelected ? 3.2 : 2.2}
                        />
                        <text
                          textAnchor="middle"
                          dy="5"
                          fill="#F4F7F5"
                          fontSize="13"
                          fontWeight="700"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {p.shirt_number}
                        </text>
                        <text
                          y="31"
                          textAnchor="middle"
                          fill="#F4F7F5"
                          fontSize="11"
                          fontWeight="600"
                          paintOrder="stroke"
                          stroke="#0D131A"
                          strokeWidth="3.2"
                        >
                          {p.short_name}
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}
            </svg>
          </div>

          {/* Color Ramp & Coordinate Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#A5B2BD]">
            <div className="flex items-center gap-2">
              <span>Density:</span>
              <span className="text-[#A5B2BD]">Low</span>
              <div
                className="w-28 h-2.5 rounded-full border border-[#34424E]"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(32,178,134,0.45) 0%, #20B286 35%, #63E6A5 72%, #E2FDF0 100%)',
                }}
              />
              <span className="text-[#63E6A5] font-medium">Peak</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#63E6A5] inline-block" />
                Progressive
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F4F7F5] inline-block" />
                Touch
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#7DD3FC] inline-block" />
                Defensive
              </span>
            </div>
          </div>

          {/* Squad XI Touch/Keyboard Quick Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedPlayerId(null)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors min-h-[32px] whitespace-nowrap ${
                selectedPlayerId === null
                  ? 'bg-[#63E6A5] border-[#63E6A5] text-[#0D131A] font-bold'
                  : 'bg-[#141E28] border-[#34424E] text-[#A5B2BD] hover:text-[#F4F7F5]'
              }`}
            >
              All XI
            </button>
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

        {/* Right Column: Spatial Density Breakdown & Zone Telemetry */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          <div className="rounded-xl bg-[#141E28] border border-[#34424E] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-[#F4F7F5]">
                {selectedPlayer ? `${selectedPlayer.short_name} · Spatial Profile` : `${activeTeam.shortName} · Activity Summary`}
              </div>
              <Activity className="w-4 h-4 text-[#63E6A5]" />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs tabular-nums">
              <div className="rounded-lg bg-[#0D131A] border border-[#34424E] p-3">
                <div className="text-[#A5B2BD]">Sample Events</div>
                <div className="font-mono text-lg font-bold text-[#F4F7F5] mt-0.5">
                  <AnimatedNumber value={summary.sampleCount} />
                </div>
              </div>
              <div className="rounded-lg bg-[#0D131A] border border-[#34424E] p-3">
                <div className="text-[#A5B2BD]">Mean Pitch X</div>
                <div className="font-mono text-lg font-bold text-[#63E6A5] mt-0.5">
                  <AnimatedNumber value={summary.avgX} decimals={1} suffix="%" />
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-[#0D131A] border border-[#34424E] p-3 text-xs">
              <div className="text-[#A5B2BD]">Peak Activity Hotspot</div>
              <div className="font-mono text-xs font-semibold text-[#63E6A5] mt-1">
                {summary.peakZoneLabel}
              </div>
            </div>
          </div>

          {/* Pitch Thirds Breakdown */}
          <div className="rounded-xl bg-[#141E28] border border-[#34424E] p-4 flex flex-col gap-3 text-xs tabular-nums">
            <div className="font-semibold text-[#F4F7F5]">Pitch Thirds Distribution</div>
            {[
              { label: 'Defensive Third', pct: summary.defensiveThirdPct, color: '#7DD3FC' },
              { label: 'Middle Third', pct: summary.middleThirdPct, color: '#63E6A5' },
              { label: 'Final Third', pct: summary.finalThirdPct, color: '#E2FDF0' },
            ].map((row) => (
              <div key={row.label} className="flex flex-col gap-1">
                <div className="flex justify-between text-[#A5B2BD]">
                  <span>{row.label}</span>
                  <span className="font-mono text-[#F4F7F5]">
                    <AnimatedNumber value={row.pct} suffix="%" />
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#0D131A] border border-[#34424E] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${row.pct}%`, backgroundColor: row.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Lateral Channel Breakdown */}
          <div className="rounded-xl bg-[#141E28] border border-[#34424E] p-4 flex flex-col gap-3 text-xs tabular-nums">
            <div className="font-semibold text-[#F4F7F5]">Lateral Channel Balance</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Left', pct: summary.leftChannelPct },
                { label: 'Central', pct: summary.centralChannelPct },
                { label: 'Right', pct: summary.rightChannelPct },
              ].map((ch) => (
                <div key={ch.label} className="rounded-lg bg-[#0D131A] border border-[#34424E] p-2.5">
                  <div className="text-[11px] text-[#A5B2BD]">{ch.label}</div>
                  <div className="font-mono text-sm font-bold text-[#63E6A5] mt-0.5">
                    <AnimatedNumber value={ch.pct} suffix="%" />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[#A5B2BD] leading-relaxed">
              Dummy coordinates are deterministically seeded by player role, team, and tactical phase so density contours update live without fabricating match tracking feeds.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
