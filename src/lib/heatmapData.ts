import type {
  HeatmapActionType,
  HeatmapGridCell,
  HeatmapSamplePoint,
  HeatmapSummary,
  PlayerNode,
  TacticalPhase,
} from '../types/tactical';

const ROLE_DEFAULT_COORDS: Record<string, { x: number; y: number }> = {
  GK: { x: 6, y: 50 },
  G: { x: 6, y: 50 },
  RB: { x: 24, y: 82 },
  RWB: { x: 35, y: 84 },
  RCB: { x: 21, y: 62 },
  CCB: { x: 20, y: 50 },
  LCB: { x: 21, y: 38 },
  LB: { x: 24, y: 18 },
  LWB: { x: 35, y: 16 },
  D: { x: 22, y: 50 },
  DM: { x: 38, y: 50 },
  CDM: { x: 38, y: 50 },
  RDM: { x: 38, y: 61 },
  LDM: { x: 38, y: 39 },
  RM: { x: 52, y: 83 },
  RCM: { x: 49, y: 67 },
  CM: { x: 49, y: 50 },
  LCM: { x: 49, y: 33 },
  LM: { x: 52, y: 17 },
  M: { x: 49, y: 50 },
  CAM: { x: 58, y: 50 },
  RW: { x: 69, y: 82 },
  ST: { x: 76, y: 50 },
  RST: { x: 76, y: 60 },
  LST: { x: 76, y: 40 },
  SS: { x: 67, y: 50 },
  F: { x: 73, y: 50 },
  LW: { x: 69, y: 18 },
};

export interface SquadRosterLike {
  id: string;
  name: string;
  short_name: string;
  shirt_number: number;
  position: string;
}

export function mapSquadToHeatmapNodes(players: SquadRosterLike[]): PlayerNode[] {
  return players.slice(0, 11).map((p, idx) => {
    const key = (p.position || '').toUpperCase().trim();
    const pos = ROLE_DEFAULT_COORDS[key] || {
      x: 18 + (idx % 4) * 18,
      y: 20 + ((idx * 17) % 60),
    };
    return {
      id: p.id,
      name: p.name,
      short_name: p.short_name,
      shirt_number: p.shirt_number,
      role: p.position || 'CM',
      x: pos.x,
      y: pos.y,
      status: 'AVAILABLE',
    };
  });
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createPrng(seedStr: string): () => number {
  let a = hashSeed(seedStr) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianOffset(rand: () => number, sigma: number): number {
  const u1 = Math.max(1e-6, rand());
  const u2 = rand();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * sigma;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

interface RoleClusterSpec {
  dx: number;
  dy: number;
  sx: number;
  sy: number;
  share: number;
  actionBias: HeatmapActionType;
}

function getRoleClusters(role: string, phase: TacticalPhase): RoleClusterSpec[] {
  const r = role.toUpperCase();
  const phaseX =
    phase === 'in_possession'
      ? 5.5
      : phase === 'out_of_possession'
      ? -6.5
      : phase === 'attack_transition'
      ? 9.0
      : phase === 'defensive_transition'
      ? -8.0
      : 0;

  if (r.includes('GK')) {
    return [
      { dx: -1 + phaseX * 0.2, dy: 0, sx: 3.5, sy: 6.5, share: 0.72, actionBias: 'touch' },
      { dx: 8 + phaseX * 0.35, dy: 0, sx: 4.5, sy: 10.0, share: 0.28, actionBias: 'progressive' },
    ];
  }
  if (r.includes('INV-RB') || r.includes('INV-LB')) {
    const dirY = r.includes('RB') ? -10 : 10;
    return [
      { dx: phaseX, dy: 0, sx: 6.5, sy: 6.0, share: 0.45, actionBias: 'defensive' },
      { dx: 12 + phaseX, dy: dirY, sx: 7.0, sy: 6.5, share: 0.55, actionBias: 'progressive' },
    ];
  }
  if (r.includes('RB') || r.includes('LB') || r.includes('WB')) {
    return [
      { dx: phaseX * 0.7, dy: 0, sx: 7.5, sy: 5.5, share: 0.42, actionBias: 'defensive' },
      { dx: 15 + phaseX, dy: 0, sx: 9.0, sy: 5.2, share: 0.58, actionBias: 'progressive' },
    ];
  }
  if (r.includes('CB')) {
    return [
      { dx: phaseX * 0.75, dy: 0, sx: 7.0, sy: 7.5, share: 0.65, actionBias: 'defensive' },
      { dx: 11 + phaseX * 0.85, dy: 0, sx: 7.5, sy: 8.5, share: 0.35, actionBias: 'touch' },
    ];
  }
  if (r.includes('DM') || r.includes('CDM')) {
    return [
      { dx: phaseX * 0.8, dy: 0, sx: 8.5, sy: 10.5, share: 0.55, actionBias: 'touch' },
      { dx: 10 + phaseX, dy: 0, sx: 8.0, sy: 9.5, share: 0.45, actionBias: 'progressive' },
    ];
  }
  if (r.includes('RW') || r.includes('LW') || r.includes('RM') || r.includes('LM')) {
    const inwardY = r.includes('RW') || r.includes('RM') ? -11 : 11;
    return [
      { dx: phaseX, dy: 0, sx: 8.5, sy: 5.5, share: 0.52, actionBias: 'progressive' },
      { dx: 8 + phaseX, dy: inwardY, sx: 7.5, sy: 6.8, share: 0.48, actionBias: 'touch' },
    ];
  }
  if (r.includes('ST') || r.includes('SS')) {
    return [
      { dx: 6 + phaseX * 0.75, dy: 0, sx: 6.5, sy: 8.0, share: 0.6, actionBias: 'progressive' },
      { dx: -10 + phaseX * 0.8, dy: 0, sx: 8.0, sy: 11.5, share: 0.4, actionBias: 'touch' },
    ];
  }
  // Central / attacking midfielders
  return [
    { dx: phaseX * 0.9, dy: 0, sx: 8.5, sy: 9.0, share: 0.54, actionBias: 'touch' },
    { dx: 11 + phaseX, dy: 0, sx: 7.5, sy: 9.0, share: 0.46, actionBias: 'progressive' },
  ];
}

export function generateDummyPlayerHeatmapPoints(
  players: PlayerNode[],
  options: {
    teamId: string;
    phase?: TacticalPhase;
    pointsPerPlayer?: number;
  },
): HeatmapSamplePoint[] {
  const phase = options.phase || 'in_possession';
  const pointsPerPlayer = options.pointsPerPlayer ?? 26;
  const points: HeatmapSamplePoint[] = [];

  for (const player of players) {
    const isGk = player.role.toUpperCase().includes('GK');
    const count = isGk ? Math.max(12, Math.round(pointsPerPlayer * 0.65)) : pointsPerPlayer;
    const rand = createPrng(`${options.teamId}:${player.id}:${player.role}:${phase}`);
    const clusters = getRoleClusters(player.role, phase);

    for (let i = 0; i < count; i += 1) {
      const pick = rand();
      let acc = 0;
      let chosen = clusters[clusters.length - 1];
      for (const c of clusters) {
        acc += c.share;
        if (pick <= acc) {
          chosen = c;
          break;
        }
      }

      const rawX = player.x + chosen.dx + gaussianOffset(rand, chosen.sx);
      const rawY = player.y + chosen.dy + gaussianOffset(rand, chosen.sy);
      const x = Number(clamp(rawX, isGk ? 2 : 5, isGk ? 24 : 96).toFixed(1));
      const y = Number(clamp(rawY, isGk ? 22 : 4, isGk ? 78 : 96).toFixed(1));

      const actionRoll = rand();
      const actionType: HeatmapActionType =
        actionRoll < 0.56 ? chosen.actionBias : actionRoll < 0.82 ? 'touch' : 'defensive';
      const weight = Number((0.65 + rand() * 0.65).toFixed(2));

      points.push({
        id: `${player.id}-pt-${i}`,
        playerId: player.id,
        x,
        y,
        weight,
        actionType,
      });
    }
  }

  return points;
}

export function computeHeatmapDensityGrid(
  points: HeatmapSamplePoint[],
  cols = 28,
  rows = 18,
  sigmaX = 7.2,
  sigmaY = 8.4,
): HeatmapGridCell[] {
  const cells: HeatmapGridCell[] = [];
  if (cols <= 0 || rows <= 0) return cells;

  const twoSigmaX2 = 2 * sigmaX * sigmaX;
  const twoSigmaY2 = 2 * sigmaY * sigmaY;
  const rawValues: number[] = [];
  let maxVal = 0;

  for (let r = 0; r < rows; r += 1) {
    const cy = ((r + 0.5) / rows) * 100;
    for (let c = 0; c < cols; c += 1) {
      const cx = ((c + 0.5) / cols) * 100;
      let sum = 0;
      for (let i = 0; i < points.length; i += 1) {
        const pt = points[i];
        const dx = cx - pt.x;
        const dy = cy - pt.y;
        // Skip distant points beyond ~3.2 sigma for fast evaluation
        if (Math.abs(dx) > sigmaX * 3.2 || Math.abs(dy) > sigmaY * 3.2) continue;
        sum += pt.weight * Math.exp(-(dx * dx) / twoSigmaX2 - (dy * dy) / twoSigmaY2);
      }
      rawValues.push(sum);
      if (sum > maxVal) maxVal = sum;
    }
  }

  for (let r = 0; r < rows; r += 1) {
    const cy = Number((((r + 0.5) / rows) * 100).toFixed(1));
    for (let c = 0; c < cols; c += 1) {
      const cx = Number((((c + 0.5) / cols) * 100).toFixed(1));
      const idx = r * cols + c;
      const intensity = maxVal > 0 ? Number((rawValues[idx] / maxVal).toFixed(3)) : 0;
      cells.push({
        col: c,
        row: r,
        x: cx,
        y: cy,
        intensity,
      });
    }
  }

  return cells;
}

function normalizeThreePcts(a: number, b: number, c: number): [number, number, number] {
  const total = a + b + c;
  if (total <= 0) return [34, 33, 33];
  const rA = Math.round((a / total) * 100);
  const rB = Math.round((b / total) * 100);
  const rC = 100 - rA - rB;
  return [rA, rB, rC];
}

export function describePitchZone(x: number, y: number): string {
  const depth =
    x < 33.3 ? 'Defensive Third' : x < 66.6 ? 'Middle Third' : 'Final Third';
  const lane =
    y < 24
      ? 'Left Touchline'
      : y < 40
      ? 'Left Half-Space'
      : y <= 60
      ? 'Central Corridor'
      : y <= 76
      ? 'Right Half-Space'
      : 'Right Touchline';
  return `${depth} · ${lane}`;
}

export function summarizeHeatmapActivity(
  points: HeatmapSamplePoint[],
  grid: HeatmapGridCell[],
): HeatmapSummary {
  if (points.length === 0) {
    return {
      sampleCount: 0,
      defensiveThirdPct: 0,
      middleThirdPct: 0,
      finalThirdPct: 0,
      leftChannelPct: 0,
      centralChannelPct: 0,
      rightChannelPct: 0,
      avgX: 50,
      avgY: 50,
      peakZoneLabel: 'No activity coordinates',
      peakIntensityPct: 0,
    };
  }

  let defW = 0;
  let midW = 0;
  let finW = 0;
  let leftW = 0;
  let cenW = 0;
  let rightW = 0;
  let wSum = 0;
  let xSum = 0;
  let ySum = 0;

  for (const pt of points) {
    const w = pt.weight;
    wSum += w;
    xSum += pt.x * w;
    ySum += pt.y * w;

    if (pt.x < 33.33) defW += w;
    else if (pt.x < 66.67) midW += w;
    else finW += w;

    if (pt.y < 33.33) leftW += w;
    else if (pt.y <= 66.67) cenW += w;
    else rightW += w;
  }

  const [defensiveThirdPct, middleThirdPct, finalThirdPct] = normalizeThreePcts(defW, midW, finW);
  const [leftChannelPct, centralChannelPct, rightChannelPct] = normalizeThreePcts(leftW, cenW, rightW);

  let peakCell: HeatmapGridCell | null = null;
  for (const cell of grid) {
    if (!peakCell || cell.intensity > peakCell.intensity) {
      peakCell = cell;
    }
  }

  const avgX = Number((xSum / wSum).toFixed(1));
  const avgY = Number((ySum / wSum).toFixed(1));
  const peakZoneLabel = peakCell
    ? describePitchZone(peakCell.x, peakCell.y)
    : describePitchZone(avgX, avgY);

  return {
    sampleCount: points.length,
    defensiveThirdPct,
    middleThirdPct,
    finalThirdPct,
    leftChannelPct,
    centralChannelPct,
    rightChannelPct,
    avgX,
    avgY,
    peakZoneLabel,
    peakIntensityPct: peakCell ? Math.round(peakCell.intensity * 100) : 0,
  };
}

/**
 * Maps normalized density [0, 1] onto a Charcoal-to-Mint RGBA palette
 * that blends cleanly over dark charcoal-emerald pitch turf.
 */
export function heatmapIntensityToColor(intensity: number): string {
  const t = clamp(intensity, 0, 1);
  if (t < 0.08) return 'rgba(13, 19, 26, 0)';
  if (t < 0.35) {
    const alpha = 0.24 + ((t - 0.08) / 0.27) * 0.28;
    return `rgba(32, 178, 134, ${alpha.toFixed(3)})`;
  }
  if (t < 0.68) {
    const alpha = 0.52 + ((t - 0.35) / 0.33) * 0.26;
    return `rgba(99, 230, 165, ${alpha.toFixed(3)})`;
  }
  const alpha = 0.78 + ((t - 0.68) / 0.32) * 0.18;
  return `rgba(226, 253, 240, ${alpha.toFixed(3)})`;
}
