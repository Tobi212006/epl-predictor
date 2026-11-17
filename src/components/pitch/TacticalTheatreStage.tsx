import React, { Suspense, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Camera,
  Download,
  Edit3,
  Pause,
  Play,
  RotateCcw,
  Save,
  SlidersHorizontal,
  SwitchCamera,
} from 'lucide-react';
import type {
  CameraPreset,
  OverlayVisibility,
  PlayerNode,
  TacticalEdge,
  TacticalPhase,
  TacticalSnapshot,
} from '../../types/tactical';
import { useAppPreferences } from '../../lib/quality';
import { CAMERA_PRESETS, downloadSnapshotJson, exportSvgElement } from './pitchCoords';
import { PitchFallback2D } from './PitchFallback2D';
import { TacticalTheatre3D } from './TacticalTheatre3D';

export const PHASE_LABELS: Array<{ key: TacticalPhase; label: string }> = [
  { key: 'base', label: 'Base' },
  { key: 'in_possession', label: 'In Possession' },
  { key: 'out_of_possession', label: 'Out of Possession' },
  { key: 'attack_transition', label: 'Atk Transition' },
  { key: 'defensive_transition', label: 'Def Transition' },
];

interface TacticalTheatreStageProps {
  snapshots: Record<TacticalPhase, TacticalSnapshot>;
  awaySnapshots?: Record<TacticalPhase, TacticalSnapshot> | null;
  homeColor?: string;
  awayColor?: string;
  phase: TacticalPhase;
  onPhaseChange: (phase: TacticalPhase) => void;
  mismatchZones?: Array<{
    id: string;
    title: string;
    zone: { x1: number; y1: number; x2: number; y2: number };
    evidence_tag: string;
  }>;
  allowEditor?: boolean;
  onSaveSnapshot?: (snapshot: TacticalSnapshot) => Promise<void>;
  heightClass?: string;
  compact?: boolean;
}

export const TacticalTheatreStage: React.FC<TacticalTheatreStageProps> = ({
  snapshots,
  awaySnapshots,
  homeColor = '#7DD3FC',
  awayColor = '#F87171',
  phase,
  onPhaseChange,
  mismatchZones = [],
  allowEditor = false,
  onSaveSnapshot,
  heightClass = 'h-[440px] md:h-[540px]',
  compact = false,
}) => {
  const { use3D, isSoftwareGl, prefersReducedMotion, reportWebglFailed } =
    useAppPreferences();

  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('broadcast');
  const [cameraTick, setCameraTick] = useState(0);
  const [flipDirection, setFlipDirection] = useState(false);
  const [isPlaying, setIsPlaying] = useState(!prefersReducedMotion);
  const [speed, setSpeed] = useState<number>(1);
  const [overlays, setOverlays] = useState<OverlayVisibility>({
    passing: true,
    pressing: true,
    halfSpaces: true,
    compactness: true,
    restDefense: true,
  });

  const [selectedPlayer, setSelectedPlayer] = useState<{ player: PlayerNode; side: 'home' | 'away' } | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<{ edge: TacticalEdge; index: number } | null>(null);
  const [editorMode, setEditorMode] = useState(false);
  const [editedPlayers, setEditedPlayers] = useState<PlayerNode[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const svgExportRef = useRef<SVGSVGElement | null>(null);

  const activeSnapshot = snapshots[phase] || snapshots.base;
  const effectiveSnapshot: TacticalSnapshot = editedPlayers
    ? { ...activeSnapshot, players: editedPlayers }
    : activeSnapshot;

  const awaySnapshot = awaySnapshots
    ? awaySnapshots[phase === 'in_possession' ? 'out_of_possession' : phase === 'out_of_possession' ? 'in_possession' : phase] ||
      awaySnapshots.base
    : null;

  const handlePhaseClick = (next: TacticalPhase) => {
    setEditedPlayers(null);
    setSelectedPlayer(null);
    setSelectedEdge(null);
    onPhaseChange(next);
  };

  const handleMovePlayer = (playerId: string, x: number, y: number) => {
    const base = editedPlayers || activeSnapshot.players;
    setEditedPlayers(base.map((p) => (p.id === playerId ? { ...p, x, y } : p)));
  };

  const handleSave = async () => {
    if (!onSaveSnapshot) return;
    setSaving(true);
    setSaveNotice(null);
    try {
      await onSaveSnapshot(effectiveSnapshot);
      setEditedPlayers(null);
      setEditorMode(false);
      setSaveNotice('Snapshot saved');
    } catch (e) {
      setSaveNotice((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // In Editor mode we use the direct-manipulation 2D SVG pitch so pointer drag works precisely
  const render3D = use3D && !editorMode;

  return (
    <div className="flex flex-col gap-3">
      {/* Phase tabs + Formation morph indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#1B2732] border border-[#34424E] rounded-lg" role="tablist" aria-label="Tactical phases">
          {PHASE_LABELS.map((tab) => {
            const active = phase === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handlePhaseClick(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 min-h-[36px] ${
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

        <div className="flex items-center gap-3 text-xs text-[#A5B2BD] tabular-nums">
          <span className="font-mono text-sm font-semibold text-[#F4F7F5]">
            {effectiveSnapshot.formation_label}
          </span>
          <span aria-hidden="true">·</span>
          <span>{effectiveSnapshot.evidence_type}</span>
          <span aria-hidden="true">·</span>
          <span>Confidence: {effectiveSnapshot.confidence}</span>
        </div>
      </div>

      {/* Main Pitch Stage */}
      <div className={`relative w-full ${heightClass} rounded-xl border border-[#34424E] bg-[#0D131A] overflow-hidden`}>
        {render3D ? (
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center text-sm text-[#A5B2BD]">
                Initializing 3D Tactical Theatre...
              </div>
            }
          >
            <TacticalTheatre3D
              snapshot={effectiveSnapshot}
              awaySnapshot={awaySnapshot}
              homeColor={homeColor}
              awayColor={awayColor}
              flipDirection={flipDirection}
              cameraPreset={cameraPreset}
              cameraRequestTick={cameraTick}
              overlays={overlays}
              isPlaying={isPlaying}
              speed={speed}
              selectedPlayerId={selectedPlayer?.player.id ?? null}
              selectedEdgeIndex={selectedEdge?.index ?? null}
              onSelectPlayer={(player, side) => {
                if (player) {
                  setIsPlaying(false);
                  setSelectedPlayer({ player, side });
                  setSelectedEdge(null);
                } else {
                  setSelectedPlayer(null);
                }
              }}
              onSelectEdge={(edge, index) => {
                if (edge && index !== null) {
                  setSelectedEdge({ edge, index });
                  setSelectedPlayer(null);
                } else {
                  setSelectedEdge(null);
                }
              }}
              mismatchZones={mismatchZones}
              isSoftwareGl={isSoftwareGl}
              onWebglContextLost={reportWebglFailed}
            />
          </Suspense>
        ) : (
          <PitchFallback2D
            snapshot={effectiveSnapshot}
            awaySnapshot={awaySnapshot}
            homeColor={homeColor}
            awayColor={awayColor}
            flipDirection={flipDirection}
            overlays={overlays}
            isPlaying={isPlaying}
            speed={speed}
            selectedPlayerId={selectedPlayer?.player.id ?? null}
            selectedEdgeIndex={selectedEdge?.index ?? null}
            onSelectPlayer={(player, side) => {
              if (player) {
                setIsPlaying(false);
                setSelectedPlayer({ player, side });
                setSelectedEdge(null);
              } else {
                setSelectedPlayer(null);
              }
            }}
            onSelectEdge={(edge, index) => {
              if (edge && index !== null) {
                setSelectedEdge({ edge, index });
                setSelectedPlayer(null);
              } else {
                setSelectedEdge(null);
              }
            }}
            editorMode={editorMode}
            onMovePlayer={handleMovePlayer}
            mismatchZones={mismatchZones}
            svgRef={svgExportRef}
            reducedMotion={prefersReducedMotion}
          />
        )}

        {/* Hidden SVG mirror only when in 3D mode and user triggers SVG/PNG export */}
        {render3D && (
          <div className="sr-only" aria-hidden="true">
            <PitchFallback2D
              snapshot={effectiveSnapshot}
              awaySnapshot={awaySnapshot}
              homeColor={homeColor}
              awayColor={awayColor}
              flipDirection={flipDirection}
              overlays={overlays}
              isPlaying={false}
              speed={1}
              selectedPlayerId={null}
              selectedEdgeIndex={null}
              onSelectPlayer={() => {}}
              onSelectEdge={() => {}}
              mismatchZones={mismatchZones}
              svgRef={svgExportRef}
              reducedMotion={true}
            />
          </div>
        )}

        {/* Top-left Mode / Attacking Direction Indicator */}
        <div className="absolute top-3 left-3 pointer-events-none px-2.5 py-1 rounded-md bg-[#141E28]/95 border border-[#34424E] text-[11px] text-[#A5B2BD] tabular-nums">
          <span>{render3D ? '3D WebGL' : '2D SVG Analyst'}</span>
          <span aria-hidden="true"> · </span>
          <span>{flipDirection ? '← Attacking Left' : 'Attacking Right →'}</span>
          {editorMode && <span className="text-[#63E6A5]"> · Drag nodes to adjust</span>}
        </div>

        {/* Selected Player Role Inspector Overlay */}
        <AnimatePresence>
          {selectedPlayer && (
            <motion.div
              key={`player-${selectedPlayer.player.id}`}
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-80 rounded-lg bg-[#1B2732] border border-[#63E6A5]/45 p-3.5 text-xs shadow-lg"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] text-[#7DD3FC]">
                    {selectedPlayer.side === 'home' ? 'Primary XI' : 'Opponent XI'} · #{selectedPlayer.player.shirt_number} · {selectedPlayer.player.role}
                  </div>
                  <div className="font-display text-base font-semibold text-[#F4F7F5]">
                    {selectedPlayer.player.name}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPlayer(null)}
                  className="px-2 py-1 rounded text-[#A5B2BD] hover:text-[#F4F7F5] hover:bg-white/10"
                  aria-label="Close player inspector"
                >
                  Close
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[#A5B2BD] tabular-nums">
                <div>Canonical Zone: ({selectedPlayer.player.x}, {selectedPlayer.player.y})</div>
                <div>Status: {selectedPlayer.player.status}</div>
              </div>
              <div className="mt-2 text-[#F4F7F5]/90">
                Evidence: {effectiveSnapshot.evidence_type} ({effectiveSnapshot.confidence} confidence). Coordinates represent schematic role positioning for {effectiveSnapshot.formation_label}.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selected Tactical Edge Meaning Inspector */}
        <AnimatePresence>
          {selectedEdge && (
            <motion.div
              key={`edge-${selectedEdge.index}`}
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-84 rounded-lg bg-[#1B2732] border border-[#7DD3FC]/45 p-3.5 text-xs shadow-lg"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-[#F4F7F5] capitalize">
                  {selectedEdge.edge.type.replace('_', ' ')} Vector
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEdge(null)}
                  className="px-2 py-1 rounded text-[#A5B2BD] hover:text-[#F4F7F5] hover:bg-white/10"
                >
                  Close
                </button>
              </div>
              <p className="mt-1.5 text-[#F4F7F5]/90">
                {selectedEdge.edge.label || 'Schematic tactical passing or pressing connection.'}
              </p>
              <p className="mt-1.5 text-[11px] text-[#FBBF24]">
                Illustrative tactical pattern — not observed optical player tracking data.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Unified Controls Toolbar */}
      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl floodlit-card px-3.5 py-2.5">
          {/* Playback Controls */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141E28] hover:bg-[#233240] border border-[#34424E] text-xs font-medium text-[#F4F7F5] min-h-[38px] whitespace-nowrap shrink-0"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>

            {[0.5, 1, 1.5].map((sp) => (
              <button
                key={sp}
                type="button"
                onClick={() => setSpeed(sp)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono tabular-nums min-h-[38px] whitespace-nowrap shrink-0 ${
                  speed === sp
                    ? 'bg-[#63E6A5]/20 text-[#63E6A5] border border-[#63E6A5]/45'
                    : 'text-[#A5B2BD] hover:text-[#F4F7F5] bg-[#141E28]'
                }`}
              >
                {sp}×
              </button>
            ))}

            <button
              type="button"
              onClick={() => {
                setFlipDirection((f) => !f);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#141E28] hover:bg-[#233240] text-xs text-[#A5B2BD] hover:text-[#F4F7F5] min-h-[38px] whitespace-nowrap shrink-0"
              title="Flip attacking direction"
            >
              <SwitchCamera className="w-3.5 h-3.5" />
              Flip Direction
            </button>

            <button
              type="button"
              onClick={() => {
                setEditedPlayers(null);
                setSelectedPlayer(null);
                setSelectedEdge(null);
                setCameraPreset('broadcast');
                setCameraTick((t) => t + 1);
                onPhaseChange('base');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#141E28] hover:bg-[#233240] text-xs text-[#A5B2BD] hover:text-[#F4F7F5] min-h-[38px] whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>

          {/* Camera Presets (when 3D active) */}
          {render3D && (
            <div className="flex flex-wrap items-center gap-1">
              <Camera className="w-3.5 h-3.5 text-[#A5B2BD] mr-1" />
              {(Object.keys(CAMERA_PRESETS) as CameraPreset[]).map((presetKey) => (
                <button
                  key={presetKey}
                  type="button"
                  onClick={() => {
                    setCameraPreset(presetKey);
                    setCameraTick((t) => t + 1);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap shrink-0 min-h-[38px] ${
                    cameraPreset === presetKey
                      ? 'bg-[#7DD3FC]/20 text-[#7DD3FC] border border-[#7DD3FC]/45'
                      : 'text-[#A5B2BD] hover:text-[#F4F7F5]'
                  }`}
                >
                  {CAMERA_PRESETS[presetKey].label}
                </button>
              ))}
            </div>
          )}

          {/* Layer Overlays & Quality/Editor/Export */}
          <div className="flex flex-wrap items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#A5B2BD] mr-0.5" />
            {(
              [
                ['passing', 'Passes'],
                ['pressing', 'Press'],
                ['halfSpaces', 'Half-Spaces'],
                ['compactness', 'Compactness'],
                ['restDefense', 'Rest Def'],
              ] as Array<[keyof OverlayVisibility, string]>
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setOverlays((prev) => ({ ...prev, [k]: !prev[k] }))}
                className={`px-2 py-1 rounded text-xs whitespace-nowrap shrink-0 min-h-[34px] ${
                  overlays[k]
                    ? 'bg-[#233240] text-[#F4F7F5] border border-[#34424E]'
                    : 'text-[#A5B2BD]/60 hover:text-[#A5B2BD]'
                }`}
              >
                {label}
              </button>
            ))}

            {allowEditor && (
              <>
                <button
                  type="button"
                  onClick={() => setEditorMode((e) => !e)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs whitespace-nowrap shrink-0 min-h-[34px] ${
                    editorMode
                      ? 'bg-[#63E6A5] text-[#0D131A] font-bold'
                      : 'bg-[#141E28] text-[#A5B2BD] hover:text-[#F4F7F5] border border-[#34424E]'
                  }`}
                >
                  <Edit3 className="w-3 h-3" />
                  {editorMode ? 'Editing 2D' : 'Edit Nodes'}
                </button>
                {editedPlayers && onSaveSnapshot && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSave}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-[#7DD3FC] text-[#0D131A] font-bold whitespace-nowrap shrink-0 min-h-[34px]"
                  >
                    <Save className="w-3 h-3" />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => downloadSnapshotJson(effectiveSnapshot)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-[#A5B2BD] hover:text-[#F4F7F5] border border-[#34424E] whitespace-nowrap shrink-0 min-h-[34px]"
              title="Export Snapshot JSON"
            >
              <Download className="w-3 h-3" />
              JSON
            </button>
            <button
              type="button"
              onClick={() =>
                exportSvgElement(svgExportRef.current, 'svg', `${effectiveSnapshot.team_id}-${phase}`)
              }
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-[#A5B2BD] hover:text-[#F4F7F5] border border-[#34424E] whitespace-nowrap shrink-0 min-h-[34px]"
              title="Export Diagram SVG"
            >
              SVG
            </button>
            <button
              type="button"
              onClick={() =>
                exportSvgElement(svgExportRef.current, 'png', `${effectiveSnapshot.team_id}-${phase}`)
              }
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-[#A5B2BD] hover:text-[#F4F7F5] border border-[#34424E] whitespace-nowrap shrink-0 min-h-[34px]"
              title="Export Diagram PNG"
            >
              PNG
            </button>
          </div>
        </div>
      )}

      {saveNotice && (
        <div className="text-xs text-[#63E6A5]">{saveNotice}</div>
      )}
    </div>
  );
};
