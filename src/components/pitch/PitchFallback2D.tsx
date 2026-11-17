import React, { useMemo, useRef, useState } from 'react';
import type {
  OverlayVisibility,
  PlayerNode,
  TacticalEdge,
  TacticalSnapshot,
} from '../../types/tactical';
import { areKitColorsClose, liftHexLuminance } from '../common/FootballMotifs';
import {
  SVG_MARGIN,
  SVG_PITCH_H,
  SVG_PITCH_W,
  SVG_VIEWBOX_H,
  SVG_VIEWBOX_W,
  canonicalToSvg2D,
  svg2DToCanonical,
} from './pitchCoords';

export interface PitchRendererProps {
  snapshot: TacticalSnapshot;
  awaySnapshot?: TacticalSnapshot | null;
  homeColor?: string;
  awayColor?: string;
  flipDirection?: boolean;
  overlays: OverlayVisibility;
  isPlaying: boolean;
  speed: number;
  selectedPlayerId: string | null;
  selectedEdgeIndex: number | null;
  onSelectPlayer: (player: PlayerNode | null, teamSide: 'home' | 'away') => void;
  onSelectEdge: (edge: TacticalEdge | null, index: number | null) => void;
  editorMode?: boolean;
  onMovePlayer?: (playerId: string, x: number, y: number) => void;
  mismatchZones?: Array<{
    id: string;
    title: string;
    zone: { x1: number; y1: number; x2: number; y2: number };
    evidence_tag: string;
  }>;
  svgRef?: React.RefObject<SVGSVGElement | null>;
  reducedMotion?: boolean;
}

export const PitchFallback2D: React.FC<PitchRendererProps> = ({
  snapshot,
  awaySnapshot,
  homeColor = '#7DD3FC',
  awayColor = '#F87171',
  flipDirection = false,
  overlays,
  isPlaying,
  selectedPlayerId,
  selectedEdgeIndex,
  onSelectPlayer,
  onSelectEdge,
  editorMode = false,
  onMovePlayer,
  mismatchZones = [],
  svgRef,
  reducedMotion = false,
}) => {
  const internalRef = useRef<SVGSVGElement | null>(null);
  const activeRef = svgRef || internalRef;
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const visibleHomeColor = liftHexLuminance(homeColor, 0.25);
  const rawAwayVisible = liftHexLuminance(awayColor, 0.25);
  const visibleAwayColor = areKitColorsClose(visibleHomeColor, rawAwayVisible)
    ? areKitColorsClose(visibleHomeColor, '#F87171')
      ? '#7DD3FC'
      : '#F87171'
    : rawAwayVisible;

  const playerMap = useMemo(() => {
    const m = new Map<string, PlayerNode>();
    snapshot.players.forEach((p) => m.set(p.id, p));
    return m;
  }, [snapshot.players]);

  const awayPlayerMap = useMemo(() => {
    const m = new Map<string, PlayerNode>();
    awaySnapshot?.players.forEach((p) => m.set(p.id, p));
    return m;
  }, [awaySnapshot]);

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!editorMode || !draggingId || !onMovePlayer || !activeRef.current) return;
    const rect = activeRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * SVG_VIEWBOX_W;
    const svgY = ((e.clientY - rect.top) / rect.height) * SVG_VIEWBOX_H;
    const { x, y } = svg2DToCanonical(svgX, svgY, flipDirection);
    onMovePlayer(draggingId, x, y);
  };

  const handlePointerUp = () => {
    if (draggingId) setDraggingId(null);
  };

  // Mowing stripe bands (10 vertical alternating turf bands)
  const stripes = useMemo(() => Array.from({ length: 10 }, (_, i) => i), []);

  const transitionCss = reducedMotion ? 'none' : 'transform 750ms cubic-bezier(0.16, 1, 0.3, 1)';

  return (
    <svg
      ref={activeRef}
      viewBox={`0 0 ${SVG_VIEWBOX_W} ${SVG_VIEWBOX_H}`}
      className="w-full h-full select-none touch-none rounded-xl bg-[#0D131A]"
      role="img"
      aria-label={`Tactical pitch diagram: ${snapshot.formation_label} (${snapshot.phase.replace('_', ' ')})`}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <defs>
        <marker id="arrow-cyan" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#7DD3FC" />
        </marker>
        <marker id="arrow-orange" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#F87171" />
        </marker>
        <marker id="arrow-lime" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#63E6A5" />
        </marker>
      </defs>

      {/* Outer stadium apron */}
      <rect x="0" y="0" width={SVG_VIEWBOX_W} height={SVG_VIEWBOX_H} fill="#0D131A" rx="16" />

      {/* Alternating turf stripes */}
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

      {/* Crisp Pitch Markings (#79B59B) */}
      <g stroke="#79B59B" strokeWidth="2.5" fill="none" strokeOpacity="0.85">
        <rect x={SVG_MARGIN} y={SVG_MARGIN} width={SVG_PITCH_W} height={SVG_PITCH_H} />
        <line x1={SVG_MARGIN + SVG_PITCH_W / 2} y1={SVG_MARGIN} x2={SVG_MARGIN + SVG_PITCH_W / 2} y2={SVG_MARGIN + SVG_PITCH_H} />
        <circle cx={SVG_MARGIN + SVG_PITCH_W / 2} cy={SVG_MARGIN + SVG_PITCH_H / 2} r={91.5} />
        <circle cx={SVG_MARGIN + SVG_PITCH_W / 2} cy={SVG_MARGIN + SVG_PITCH_H / 2} r={4} fill="#79B59B" />

        {/* Left Penalty Area */}
        <rect x={SVG_MARGIN} y={SVG_MARGIN + (SVG_PITCH_H - 403) / 2} width={165} height={403} />
        <rect x={SVG_MARGIN} y={SVG_MARGIN + (SVG_PITCH_H - 183) / 2} width={55} height={183} />
        <path d={`M ${SVG_MARGIN + 165} ${SVG_MARGIN + SVG_PITCH_H / 2 - 73} A 91.5 91.5 0 0 1 ${SVG_MARGIN + 165} ${SVG_MARGIN + SVG_PITCH_H / 2 + 73}`} />
        <circle cx={SVG_MARGIN + 110} cy={SVG_MARGIN + SVG_PITCH_H / 2} r={3.5} fill="#79B59B" />

        {/* Right Penalty Area */}
        <rect x={SVG_MARGIN + SVG_PITCH_W - 165} y={SVG_MARGIN + (SVG_PITCH_H - 403) / 2} width={165} height={403} />
        <rect x={SVG_MARGIN + SVG_PITCH_W - 55} y={SVG_MARGIN + (SVG_PITCH_H - 183) / 2} width={55} height={183} />
        <path d={`M ${SVG_MARGIN + SVG_PITCH_W - 165} ${SVG_MARGIN + SVG_PITCH_H / 2 - 73} A 91.5 91.5 0 0 0 ${SVG_MARGIN + SVG_PITCH_W - 165} ${SVG_MARGIN + SVG_PITCH_H / 2 + 73}`} />
        <circle cx={SVG_MARGIN + SVG_PITCH_W - 110} cy={SVG_MARGIN + SVG_PITCH_H / 2} r={3.5} fill="#79B59B" />

        {/* Goal Mouths */}
        <rect x={SVG_MARGIN - 18} y={SVG_MARGIN + (SVG_PITCH_H - 73) / 2} width={18} height={73} strokeOpacity="0.6" />
        <rect x={SVG_MARGIN + SVG_PITCH_W} y={SVG_MARGIN + (SVG_PITCH_H - 73) / 2} width={18} height={73} strokeOpacity="0.6" />
      </g>

      {/* Shaded Tactical Zones (Half-spaces, Press traps, Rest defense) */}
      <g>
        {snapshot.zones.map((z) => {
          if (z.type === 'half_space' && !overlays.halfSpaces) return null;
          if (z.type === 'rest_defense' && !overlays.restDefense) return null;
          if (z.type === 'press_trap' && !overlays.pressing) return null;

          if (z.type === 'compactness' && overlays.compactness && z.player_ids?.length) {
            const pts = z.player_ids
              .map((pid) => playerMap.get(pid))
              .filter(Boolean)
              .map((p) => {
                const pt = canonicalToSvg2D(p!.x, p!.y, flipDirection);
                return `${pt.x},${pt.y}`;
              })
              .join(' ');
            if (!pts) return null;
            return (
              <polygon
                key={z.id}
                points={pts}
                fill={visibleHomeColor}
                fillOpacity="0.12"
                stroke={visibleHomeColor}
                strokeWidth="1.5"
                strokeDasharray="6 4"
              />
            );
          }

          if (z.x1 !== undefined && z.y1 !== undefined && z.x2 !== undefined && z.y2 !== undefined) {
            const p1 = canonicalToSvg2D(z.x1, z.y1, flipDirection);
            const p2 = canonicalToSvg2D(z.x2, z.y2, flipDirection);
            const rx = Math.min(p1.x, p2.x);
            const ry = Math.min(p1.y, p2.y);
            const rw = Math.abs(p2.x - p1.x);
            const rh = Math.abs(p2.y - p1.y);
            const fill = z.type === 'press_trap' ? '#F87171' : z.type === 'rest_defense' ? '#63E6A5' : '#7DD3FC';
            return (
              <g key={z.id}>
                <rect
                  x={rx}
                  y={ry}
                  width={rw}
                  height={rh}
                  rx="12"
                  fill={fill}
                  fillOpacity="0.12"
                  stroke={fill}
                  strokeOpacity="0.45"
                  strokeWidth="1.5"
                  strokeDasharray={z.type === 'rest_defense' ? '8 5' : undefined}
                />
                <text
                  x={rx + 10}
                  y={ry + 20}
                  fill={fill}
                  fillOpacity="0.85"
                  fontSize="12"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {z.label}
                </text>
              </g>
            );
          }
          return null;
        })}
      </g>

      {/* Manager vs Manager Mismatch Zones */}
      {mismatchZones.map((mm) => {
        const p1 = canonicalToSvg2D(mm.zone.x1, mm.zone.y1, flipDirection);
        const p2 = canonicalToSvg2D(mm.zone.x2, mm.zone.y2, flipDirection);
        const rx = Math.min(p1.x, p2.x);
        const ry = Math.min(p1.y, p2.y);
        return (
          <g key={mm.id}>
            <rect
              x={rx}
              y={ry}
              width={Math.abs(p2.x - p1.x)}
              height={Math.abs(p2.y - p1.y)}
              rx="14"
              fill="#63E6A5"
              fillOpacity="0.13"
              stroke="#63E6A5"
              strokeWidth="2"
              strokeDasharray="6 4"
            />
            <text x={rx + 10} y={ry + 22} fill="#63E6A5" fontSize="13" fontWeight="600">
              {mm.title}
            </text>
          </g>
        );
      })}

      {/* Tactical Edges (Passing Lanes, Press Triggers, Rest Defense) */}
      <g>
        {snapshot.edges.map((edge, idx) => {
          if ((edge.type === 'pass' || edge.type === 'overlap') && !overlays.passing) return null;
          if ((edge.type === 'press' || edge.type === 'cover') && !overlays.pressing) return null;
          if (edge.type === 'rest_defense' && !overlays.restDefense) return null;

          const pFrom = playerMap.get(edge.from);
          const pTo = playerMap.get(edge.to);
          if (!pFrom || !pTo) return null;

          const a = canonicalToSvg2D(pFrom.x, pFrom.y, flipDirection);
          const b = canonicalToSvg2D(pTo.x, pTo.y, flipDirection);
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2 - (edge.type === 'pass' ? 22 : 12);
          const d = `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
          const isSelected = selectedEdgeIndex === idx;
          const stroke =
            edge.type === 'press'
              ? '#F87171'
              : edge.type === 'rest_defense'
              ? '#63E6A5'
              : '#7DD3FC';
          const marker =
            edge.type === 'press'
              ? 'url(#arrow-orange)'
              : edge.type === 'rest_defense'
              ? 'url(#arrow-lime)'
              : 'url(#arrow-cyan)';

          return (
            <g
              key={`${edge.from}-${edge.to}-${idx}`}
              className="cursor-pointer"
              onClick={(ev) => {
                ev.stopPropagation();
                onSelectEdge(edge, idx);
              }}
            >
              <path d={d} stroke="transparent" strokeWidth="16" fill="none" />
              <path
                d={d}
                stroke={stroke}
                strokeWidth={isSelected ? 4 : 2.4}
                strokeOpacity={isSelected ? 1 : 0.78}
                strokeDasharray={edge.type === 'rest_defense' || edge.type === 'cover' ? '7 5' : undefined}
                fill="none"
                markerEnd={edge.type !== 'rest_defense' ? marker : undefined}
              />
              {isPlaying && !reducedMotion && edge.type === 'pass' && (
                <circle r="4.5" fill="#63E6A5">
                  <animateMotion dur="2.1s" repeatCount="indefinite" path={d} />
                </circle>
              )}
            </g>
          );
        })}
      </g>

      {/* Away Team Nodes (when Manager Clash or Match Flow dual-pitch is active) */}
      {awaySnapshot && (
        <g>
          {awaySnapshot.players.map((p) => {
            // Away team attacks right-to-left (mirror canonical x & y) unless flipped
            const pt = canonicalToSvg2D(p.x, p.y, !flipDirection);
            const isSel = selectedPlayerId === p.id;
            const isOut = p.status === 'UNAVAILABLE';
            return (
              <g
                key={p.id}
                style={{
                  transform: `translate(${pt.x}px, ${pt.y}px)`,
                  transition: transitionCss,
                }}
                className="cursor-pointer"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelectPlayer(p, 'away');
                }}
              >
                <circle
                  r={isSel ? 22 : 18}
                  fill="#1B2732"
                  stroke={isOut ? '#F87171' : visibleAwayColor}
                  strokeWidth={isSel ? 3.5 : 2.5}
                  strokeDasharray={isOut ? '4 3' : undefined}
                  opacity={isOut ? 0.5 : 1}
                />
                {/* Diamond marker distinguishes away team beyond color alone */}
                <rect x="-5" y="-23" width="10" height="10" transform="rotate(45 0 -18)" fill={visibleAwayColor} />
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
                  y="32"
                  textAnchor="middle"
                  fill="#F4F7F5"
                  fontSize="11"
                  fontWeight="500"
                  paintOrder="stroke"
                  stroke="#0D131A"
                  strokeWidth="3"
                >
                  {p.short_name}
                </text>
              </g>
            );
          })}
          {awaySnapshot.edges.map((edge, idx) => {
            if (edge.type === 'press' && !overlays.pressing) return null;
            if (edge.type !== 'press' && !overlays.passing) return null;
            const pFrom = awayPlayerMap.get(edge.from);
            const pTo = awayPlayerMap.get(edge.to);
            if (!pFrom || !pTo) return null;
            const a = canonicalToSvg2D(pFrom.x, pFrom.y, !flipDirection);
            const b = canonicalToSvg2D(pTo.x, pTo.y, !flipDirection);
            return (
              <line
                key={`away-e-${idx}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={visibleAwayColor}
                strokeOpacity="0.52"
                strokeWidth="1.6"
                strokeDasharray="4 4"
              />
            );
          })}
        </g>
      )}

      {/* Home / Primary Team Nodes */}
      <g>
        {snapshot.players.map((p) => {
          const pt = canonicalToSvg2D(p.x, p.y, flipDirection);
          const isSel = selectedPlayerId === p.id;
          const isOut = p.status === 'UNAVAILABLE';
          return (
            <g
              key={p.id}
              style={{
                transform: `translate(${pt.x}px, ${pt.y}px)`,
                transition: draggingId === p.id ? 'none' : transitionCss,
              }}
              className={editorMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
              onPointerDown={(ev) => {
                if (editorMode) {
                  ev.stopPropagation();
                  setDraggingId(p.id);
                }
              }}
              onClick={(ev) => {
                ev.stopPropagation();
                onSelectPlayer(p, 'home');
              }}
            >
              {isSel && (
                <circle r="27" fill="none" stroke="#63E6A5" strokeWidth="2" strokeOpacity="0.9" />
              )}
              <circle
                r={isSel ? 21 : 18}
                fill="#1B2732"
                stroke={isOut ? '#F87171' : visibleHomeColor}
                strokeWidth={isSel ? 3.5 : 2.5}
                strokeDasharray={isOut ? '4 3' : undefined}
                opacity={isOut ? 0.48 : 1}
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
                y="32"
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
    </svg>
  );
};
