import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye,
  EyeOff,
  Flame,
  FlaskConical,
  SlidersHorizontal,
  SwitchCamera,
} from 'lucide-react';
import { describePitchZone } from '../../lib/heatmapData';

export interface HeatmapCoordinate {
  x: number;
  y: number;
  weight?: number;
  label?: string;
}

export type DemoDistributionPreset =
  | 'inside-forward'
  | 'box-to-box'
  | 'inverted-fullback'
  | 'high-press';

export interface HeatmapProps {
  /** Array of canonical pitch coordinates (x: 0..100 length, y: 0..100 width). */
  coordinates?: HeatmapCoordinate[];
  /** Optional controlled demo mode flag; defaults to true when coordinates are omitted/empty. */
  demoMode?: boolean;
  /** Default synthetic distribution preset when demo mode is active. */
  demoPreset?: DemoDistributionPreset;
  /** Number of synthetic points generated in demo mode. */
  demoPointCount?: number;
  /** Seed override for deterministic synthetic coordinate distributions. */
  demoSeed?: string;
  /** Heading displayed above the pitch canvas. */
  title?: string;
  /** Optional explanatory subtitle. */
  subtitle?: string;
  /** Initial Gaussian kernel radius in pitch percentage units (3..14). */
  radius?: number;
  /** Initial attack direction flip (attacking right-to-left when true). */
  flipDirection?: boolean;
  /** Show raw coordinate scatter markers over the density field. */
  showRawPoints?: boolean;
  /** Optional className applied to outer container. */
  className?: string;
  /** Callback fired when the user toggles demo mode. */
  onDemoModeChange?: (enabled: boolean) => void;
}

interface SyntheticCluster {
  cx: number;
  cy: number;
  sx: number;
  sy: number;
  share: number;
  label: string;
}

export const DEMO_PRESETS: Array<{
  id: DemoDistributionPreset;
  label: string;
  description: string;
  clusters: SyntheticCluster[];
}> = [
  {
    id: 'inside-forward',
    label: 'Right Inside Forward',
    description: 'Touches along the right touchline cutting inward into the right half-space and box.',
    clusters: [
      { cx: 74, cy: 84, sx: 8.5, sy: 5.5, share: 0.42, label: 'Touchline reception' },
      { cx: 81, cy: 64, sx: 6.8, sy: 7.2, share: 0.36, label: 'Half-space pocket' },
      { cx: 89, cy: 52, sx: 4.5, sy: 6.5, share: 0.22, label: 'Back-post box arrival' },
    ],
  },
  {
    id: 'box-to-box',
    label: 'Box-to-Box Midfielder',
    description: 'Link play across the deep pivot, central progression lane, and late edge-of-box surges.',
    clusters: [
      { cx: 41, cy: 46, sx: 8.5, sy: 11.0, share: 0.34, label: 'Deep progression' },
      { cx: 58, cy: 36, sx: 9.0, sy: 8.5, share: 0.40, label: 'Left half-space carry' },
      { cx: 76, cy: 48, sx: 7.0, sy: 9.5, share: 0.26, label: 'Zone 14 arrival' },
    ],
  },
  {
    id: 'inverted-fullback',
    label: 'Inverted Fullback (LB)',
    description: 'Wide defensive starting position tucking into the central double pivot in possession.',
    clusters: [
      { cx: 27, cy: 16, sx: 8.0, sy: 5.0, share: 0.38, label: 'Wide buildup lane' },
      { cx: 45, cy: 36, sx: 7.5, sy: 6.8, share: 0.44, label: 'Inverted midfield pivot' },
      { cx: 61, cy: 26, sx: 7.0, sy: 6.5, share: 0.18, label: 'Counter-press trap' },
    ],
  },
  {
    id: 'high-press',
    label: 'High-Press Front Line',
    description: 'Aggressive final-third pressing actions forcing turnovers outside the opponent penalty box.',
    clusters: [
      { cx: 79, cy: 50, sx: 7.5, sy: 13.0, share: 0.45, label: 'Central pressing arc' },
      { cx: 73, cy: 22, sx: 8.0, sy: 6.5, share: 0.28, label: 'Left touchline lock' },
      { cx: 74, cy: 78, sx: 8.0, sy: 6.5, share: 0.27, label: 'Right touchline lock' },
    ],
  },
];

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createMulberry32(seed: string): () => number {
  let a = hashString(seed) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleGaussian(rand: () => number, sigma: number): number {
  const u1 = Math.max(1e-6, rand());
  const u2 = rand();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2) * sigma;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Generates deterministic synthetic pitch coordinates (x, y in [0, 100])
 * modeled as multi-modal Gaussian clusters for tactical Demo Mode.
 */
export function generateSyntheticHeatmapCoordinates(
  preset: DemoDistributionPreset = 'inside-forward',
  count = 140,
  seed = 'epl-mint-demo',
): HeatmapCoordinate[] {
  const spec = DEMO_PRESETS.find((p) => p.id === preset) ?? DEMO_PRESETS[0];
  const safeCount = Math.max(12, Math.min(800, Math.round(count)));
  const rand = createMulberry32(`${seed}:${spec.id}:${safeCount}`);
  const out: HeatmapCoordinate[] = [];

  for (let i = 0; i < safeCount; i += 1) {
    const r = rand();
    let acc = 0;
    let chosen = spec.clusters[spec.clusters.length - 1];
    for (const c of spec.clusters) {
      acc += c.share;
      if (r <= acc) {
        chosen = c;
        break;
      }
    }
    const x = Number(clamp(chosen.cx + sampleGaussian(rand, chosen.sx), 3, 97).toFixed(1));
    const y = Number(clamp(chosen.cy + sampleGaussian(rand, chosen.sy), 4, 96).toFixed(1));
    const weight = Number((0.75 + rand() * 0.55).toFixed(2));
    out.push({ x, y, weight, label: chosen.label });
  }

  return out;
}

export interface DensityFieldResult {
  width: number;
  height: number;
  values: Float32Array;
  maxValue: number;
  peakX: number;
  peakY: number;
}

/**
 * Evaluates a continuous Gaussian kernel density field across a pitch buffer.
 */
export function buildDensityField(
  points: HeatmapCoordinate[],
  bufWidth = 150,
  bufHeight = 98,
  radiusPct = 7.5,
  flipDirection = false,
): DensityFieldResult {
  const values = new Float32Array(bufWidth * bufHeight);
  if (points.length === 0) {
    return { width: bufWidth, height: bufHeight, values, maxValue: 0, peakX: 50, peakY: 50 };
  }

  const sigmaX = Math.max(2.5, radiusPct);
  const sigmaY = Math.max(2.5, radiusPct * 1.15);
  const inv2SigmaX2 = 1 / (2 * sigmaX * sigmaX);
  const inv2SigmaY2 = 1 / (2 * sigmaY * sigmaY);
  const reachX = Math.ceil((sigmaX * 3.1 * bufWidth) / 100);
  const reachY = Math.ceil((sigmaY * 3.1 * bufHeight) / 100);

  for (let i = 0; i < points.length; i += 1) {
    const pt = points[i];
    if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) continue;
    const rawX = clamp(pt.x, 0, 100);
    const rawY = clamp(pt.y, 0, 100);
    const px = flipDirection ? 100 - rawX : rawX;
    const py = flipDirection ? 100 - rawY : rawY;
    const w = pt.weight !== undefined && Number.isFinite(pt.weight) ? Math.max(0.1, pt.weight) : 1;

    const centerCol = Math.round((px / 100) * (bufWidth - 1));
    const centerRow = Math.round((py / 100) * (bufHeight - 1));
    const cStart = Math.max(0, centerCol - reachX);
    const cEnd = Math.min(bufWidth - 1, centerCol + reachX);
    const rStart = Math.max(0, centerRow - reachY);
    const rEnd = Math.min(bufHeight - 1, centerRow + reachY);

    for (let r = rStart; r <= rEnd; r += 1) {
      const cy = ((r + 0.5) / bufHeight) * 100;
      const dy = cy - py;
      const ey = dy * dy * inv2SigmaY2;
      const rowOffset = r * bufWidth;
      for (let c = cStart; c <= cEnd; c += 1) {
        const cx = ((c + 0.5) / bufWidth) * 100;
        const dx = cx - px;
        values[rowOffset + c] += w * Math.exp(-(dx * dx * inv2SigmaX2 + ey));
      }
    }
  }

  let maxValue = 0;
  let peakIdx = 0;
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] > maxValue) {
      maxValue = values[i];
      peakIdx = i;
    }
  }

  const peakRow = Math.floor(peakIdx / bufWidth);
  const peakCol = peakIdx % bufWidth;
  const peakX = Number((((peakCol + 0.5) / bufWidth) * 100).toFixed(1));
  const peakY = Number((((peakRow + 0.5) / bufHeight) * 100).toFixed(1));

  return { width: bufWidth, height: bufHeight, values, maxValue, peakX, peakY };
}

export interface CoordinateMetrics {
  count: number;
  meanX: number;
  meanY: number;
  defensivePct: number;
  middlePct: number;
  finalPct: number;
}

export function summarizeCoordinates(points: HeatmapCoordinate[]): CoordinateMetrics {
  if (points.length === 0) {
    return { count: 0, meanX: 50, meanY: 50, defensivePct: 0, middlePct: 0, finalPct: 0 };
  }

  let wSum = 0;
  let xSum = 0;
  let ySum = 0;
  let defW = 0;
  let midW = 0;
  let finW = 0;

  for (const pt of points) {
    if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) continue;
    const x = clamp(pt.x, 0, 100);
    const y = clamp(pt.y, 0, 100);
    const w = pt.weight !== undefined && Number.isFinite(pt.weight) ? Math.max(0.1, pt.weight) : 1;
    wSum += w;
    xSum += x * w;
    ySum += y * w;
    if (x < 33.33) defW += w;
    else if (x < 66.67) midW += w;
    else finW += w;
  }

  if (wSum <= 0) {
    return { count: 0, meanX: 50, meanY: 50, defensivePct: 0, middlePct: 0, finalPct: 0 };
  }

  const defensivePct = Math.round((defW / wSum) * 100);
  const middlePct = Math.round((midW / wSum) * 100);
  const finalPct = 100 - defensivePct - middlePct;

  return {
    count: points.length,
    meanX: Number((xSum / wSum).toFixed(1)),
    meanY: Number((ySum / wSum).toFixed(1)),
    defensivePct,
    middlePct,
    finalPct,
  };
}

/**
 * Builds a 256-entry RGBA lookup table mapping normalized density [0, 1]
 * onto the Pitch Charcoal -> Emerald -> Mint (#63E6A5) -> Luminous Mint-White ramp.
 */
function createMintColorLut(): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 4);
  const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

  for (let i = 0; i < 256; i += 1) {
    const t = i / 255;
    const off = i * 4;
    if (t < 0.05) {
      lut[off] = 13;
      lut[off + 1] = 19;
      lut[off + 2] = 26;
      lut[off + 3] = 0;
    } else if (t < 0.38) {
      const k = (t - 0.05) / 0.33;
      lut[off] = lerp(24, 52, k);
      lut[off + 1] = lerp(138, 211, k);
      lut[off + 2] = lerp(102, 153, k);
      lut[off + 3] = lerp(42, 168, k);
    } else if (t < 0.72) {
      const k = (t - 0.38) / 0.34;
      lut[off] = lerp(52, 99, k);
      lut[off + 1] = lerp(211, 230, k);
      lut[off + 2] = lerp(153, 165, k);
      lut[off + 3] = lerp(168, 224, k);
    } else {
      const k = (t - 0.72) / 0.28;
      lut[off] = lerp(99, 226, k);
      lut[off + 1] = lerp(230, 253, k);
      lut[off + 2] = lerp(165, 240, k);
      lut[off + 3] = lerp(224, 246, k);
    }
  }
  return lut;
}

const MINT_LUT = createMintColorLut();

export const Heatmap: React.FC<HeatmapProps> = ({
  coordinates,
  demoMode: controlledDemoMode,
  demoPreset: initialPreset = 'inside-forward',
  demoPointCount = 140,
  demoSeed = 'epl-mint-demo',
  title = 'Canvas Tactical Activity Heatmap',
  subtitle = 'Gaussian kernel density rendered onto an HTML5 tactical pitch canvas in Pitchline Mint.',
  radius: initialRadius = 7.5,
  flipDirection: initialFlip = false,
  showRawPoints: initialShowRaw = true,
  className = '',
  onDemoModeChange,
}) => {
  const hasProvidedCoords = Boolean(coordinates && coordinates.length > 0);
  const [internalDemoMode, setInternalDemoMode] = useState<boolean>(() => !hasProvidedCoords);
  const isDemoMode = controlledDemoMode ?? internalDemoMode;

  const [preset, setPreset] = useState<DemoDistributionPreset>(initialPreset);
  const [radius, setRadius] = useState<number>(initialRadius);
  const [flipDirection, setFlipDirection] = useState<boolean>(initialFlip);
  const [showRawPoints, setShowRawPoints] = useState<boolean>(initialShowRaw);
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    y: number;
    zoneLabel: string;
    densityPct: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({
    width: 840,
    height: 544,
  });

  const activePoints = useMemo(() => {
    if (isDemoMode) {
      return generateSyntheticHeatmapCoordinates(preset, demoPointCount, demoSeed);
    }
    return coordinates ?? [];
  }, [isDemoMode, preset, demoPointCount, demoSeed, coordinates]);

  const densityField = useMemo(
    () => buildDensityField(activePoints, 150, 98, radius, flipDirection),
    [activePoints, radius, flipDirection],
  );

  const metrics = useMemo(() => summarizeCoordinates(activePoints), [activePoints]);

  const peakZoneLabel = useMemo(() => {
    if (activePoints.length === 0) return 'No coordinate samples';
    const canonicalPeakX = flipDirection ? 100 - densityField.peakX : densityField.peakX;
    const canonicalPeakY = flipDirection ? 100 - densityField.peakY : densityField.peakY;
    return describePitchZone(canonicalPeakX, canonicalPeakY);
  }, [activePoints.length, densityField.peakX, densityField.peakY, flipDirection]);

  // Observe container size for sharp HiDPI canvas sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 120) {
        const w = Math.round(rect.width);
        const h = Math.round((w * 68) / 105);
        setCanvasSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Render tactical pitch, Gaussian mint density surface, markings, and coordinate pins on <canvas>
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const cssW = canvasSize.width;
    const cssH = canvasSize.height;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1. Charcoal stadium apron
    ctx.fillStyle = '#0D131A';
    ctx.fillRect(0, 0, cssW, cssH);

    const padX = Math.max(14, Math.round(cssW * 0.032));
    const padY = Math.max(14, Math.round(cssH * 0.048));
    const pitchW = cssW - padX * 2;
    const pitchH = cssH - padY * 2;

    // 2. Alternating mowed turf stripes inside pitch bounds
    ctx.save();
    ctx.beginPath();
    ctx.rect(padX, padY, pitchW, pitchH);
    ctx.clip();

    const stripeCount = 10;
    const stripeW = pitchW / stripeCount;
    for (let i = 0; i < stripeCount; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? '#11382D' : '#0E2F26';
      ctx.fillRect(padX + i * stripeW, padY, stripeW + 0.5, pitchH);
    }

    // 3. Mint Gaussian density bitmap rendered via offscreen ImageData buffer
    if (densityField.maxValue > 0) {
      if (!offscreenRef.current) {
        offscreenRef.current = document.createElement('canvas');
      }
      const off = offscreenRef.current;
      off.width = densityField.width;
      off.height = densityField.height;
      const offCtx = off.getContext('2d');
      if (offCtx) {
        const img = offCtx.createImageData(densityField.width, densityField.height);
        const data = img.data;
        const vals = densityField.values;
        const invMax = 1 / densityField.maxValue;

        for (let i = 0; i < vals.length; i += 1) {
          const norm = Math.pow(clamp(vals[i] * invMax, 0, 1), 0.88);
          const lutIdx = Math.min(255, Math.round(norm * 255)) * 4;
          const p = i * 4;
          data[p] = MINT_LUT[lutIdx];
          data[p + 1] = MINT_LUT[lutIdx + 1];
          data[p + 2] = MINT_LUT[lutIdx + 2];
          data[p + 3] = MINT_LUT[lutIdx + 3];
        }
        offCtx.putImageData(img, 0, 0);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(off, padX, padY, pitchW, pitchH);
      }
    }

    // 4. Crisp pitch markings drawn over the density layer
    ctx.strokeStyle = 'rgba(134, 201, 172, 0.86)';
    ctx.fillStyle = 'rgba(134, 201, 172, 0.9)';
    ctx.lineWidth = Math.max(1.2, cssW * 0.002);

    ctx.strokeRect(padX, padY, pitchW, pitchH);

    // Halfway line & center circle
    const midX = padX + pitchW / 2;
    const midY = padY + pitchH / 2;
    const centerR = (9.15 / 105) * pitchW;

    ctx.beginPath();
    ctx.moveTo(midX, padY);
    ctx.lineTo(midX, padY + pitchH);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(midX, midY, centerR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(midX, midY, Math.max(2.2, cssW * 0.0032), 0, Math.PI * 2);
    ctx.fill();

    // Penalty & six-yard boxes
    const penW = (16.5 / 105) * pitchW;
    const penH = (40.32 / 68) * pitchH;
    const penY = padY + (pitchH - penH) / 2;

    const sixW = (5.5 / 105) * pitchW;
    const sixH = (18.32 / 68) * pitchH;
    const sixY = padY + (pitchH - sixH) / 2;

    const penSpotDist = (11 / 105) * pitchW;

    // Left penalty area + D arc
    ctx.strokeRect(padX, penY, penW, penH);
    ctx.strokeRect(padX, sixY, sixW, sixH);
    ctx.beginPath();
    ctx.arc(padX + penSpotDist, midY, Math.max(2, cssW * 0.0026), 0, Math.PI * 2);
    ctx.fill();
    const arcAngle = Math.acos((penW - penSpotDist) / centerR);
    ctx.beginPath();
    ctx.arc(padX + penSpotDist, midY, centerR, -arcAngle, arcAngle);
    ctx.stroke();

    // Right penalty area + D arc
    ctx.strokeRect(padX + pitchW - penW, penY, penW, penH);
    ctx.strokeRect(padX + pitchW - sixW, sixY, sixW, sixH);
    ctx.beginPath();
    ctx.arc(padX + pitchW - penSpotDist, midY, Math.max(2, cssW * 0.0026), 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(padX + pitchW - penSpotDist, midY, centerR, Math.PI - arcAngle, Math.PI + arcAngle);
    ctx.stroke();

    // Corner arcs
    const cornerR = (1.4 / 105) * pitchW;
    ctx.beginPath();
    ctx.arc(padX, padY, cornerR, 0, Math.PI / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(padX + pitchW, padY, cornerR, Math.PI / 2, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(padX + pitchW, padY + pitchH, cornerR, Math.PI, (Math.PI * 3) / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(padX, padY + pitchH, cornerR, (Math.PI * 3) / 2, Math.PI * 2);
    ctx.stroke();

    // 5. Optional raw sample coordinate markers
    if (showRawPoints && activePoints.length > 0) {
      const dotR = activePoints.length > 180 ? 2.1 : 2.7;
      for (let i = 0; i < activePoints.length; i += 1) {
        const pt = activePoints[i];
        if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) continue;
        const nx = flipDirection ? 100 - clamp(pt.x, 0, 100) : clamp(pt.x, 0, 100);
        const ny = flipDirection ? 100 - clamp(pt.y, 0, 100) : clamp(pt.y, 0, 100);
        const cx = padX + (nx / 100) * pitchW;
        const cy = padY + (ny / 100) * pitchH;

        ctx.beginPath();
        ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(244, 247, 245, 0.72)';
        ctx.fill();
        ctx.lineWidth = 0.9;
        ctx.strokeStyle = 'rgba(13, 19, 26, 0.85)';
        ctx.stroke();
      }
    }

    // 6. Subtle interactive hover crosshair
    if (hoverInfo) {
      const hx = padX + ((flipDirection ? 100 - hoverInfo.x : hoverInfo.x) / 100) * pitchW;
      const hy = padY + ((flipDirection ? 100 - hoverInfo.y : hoverInfo.y) / 100) * pitchH;
      ctx.save();
      ctx.strokeStyle = 'rgba(99, 230, 165, 0.65)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, padY);
      ctx.lineTo(hx, padY + pitchH);
      ctx.moveTo(padX, hy);
      ctx.lineTo(padX + pitchW, hy);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }, [canvasSize, densityField, activePoints, showRawPoints, flipDirection, hoverInfo]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const padX = Math.max(14, Math.round(rect.width * 0.032));
      const padY = Math.max(14, Math.round(rect.height * 0.048));
      const pitchW = rect.width - padX * 2;
      const pitchH = rect.height - padY * 2;
      const lx = e.clientX - rect.left - padX;
      const ly = e.clientY - rect.top - padY;

      if (lx < 0 || lx > pitchW || ly < 0 || ly > pitchH) {
        setHoverInfo(null);
        return;
      }

      const normX = clamp((lx / pitchW) * 100, 0, 100);
      const normY = clamp((ly / pitchH) * 100, 0, 100);
      const col = Math.min(densityField.width - 1, Math.floor((normX / 100) * densityField.width));
      const row = Math.min(densityField.height - 1, Math.floor((normY / 100) * densityField.height));
      const rawVal = densityField.values[row * densityField.width + col] || 0;
      const densityPct =
        densityField.maxValue > 0 ? Math.round((rawVal / densityField.maxValue) * 100) : 0;

      const canonicalX = Number((flipDirection ? 100 - normX : normX).toFixed(1));
      const canonicalY = Number((flipDirection ? 100 - normY : normY).toFixed(1));

      setHoverInfo({
        x: canonicalX,
        y: canonicalY,
        zoneLabel: describePitchZone(canonicalX, canonicalY),
        densityPct,
      });
    },
    [densityField, flipDirection],
  );

  const toggleDemoMode = (next: boolean) => {
    if (controlledDemoMode === undefined) {
      setInternalDemoMode(next);
    }
    onDemoModeChange?.(next);
  };

  const activePresetMeta = DEMO_PRESETS.find((p) => p.id === preset) ?? DEMO_PRESETS[0];

  return (
    <section
      className={`rounded-xl floodlit-card p-5 sm:p-6 flex flex-col gap-5 ${className}`}
      aria-label={title}
    >
      {/* Header + Demo Mode Switch */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#A5B2BD] mb-1">
            <span className="inline-flex items-center gap-1.5 text-[#63E6A5] font-medium">
              <Flame className="w-3.5 h-3.5 shrink-0" />
              {isDemoMode ? 'Synthetic Demo Distribution' : 'Coordinate Input Mode'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{metrics.count} points</span>
            <span aria-hidden="true">·</span>
            <span>HTML5 Canvas Density</span>
          </div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#F4F7F5] headline-balance">
            {title}
          </h2>
          <p className="mt-1 text-xs text-[#A5B2BD] max-w-2xl">{subtitle}</p>
        </div>

        {/* Mode & Visual Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            className="flex items-center gap-1 p-1 rounded-lg bg-[#141E28] border border-[#34424E]"
            role="group"
            aria-label="Coordinate source mode"
          >
            <button
              type="button"
              onClick={() => toggleDemoMode(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 min-h-[36px] transition-colors ${
                isDemoMode
                  ? 'bg-[#63E6A5] text-[#0D131A] font-bold'
                  : 'text-[#A5B2BD] hover:text-[#F4F7F5]'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              Demo Mode
            </button>
            <button
              type="button"
              disabled={!hasProvidedCoords}
              onClick={() => toggleDemoMode(false)}
              title={
                hasProvidedCoords
                  ? 'Render coordinates passed via props'
                  : 'Pass a coordinates array prop to inspect custom coordinates'
              }
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 min-h-[36px] transition-colors ${
                !isDemoMode
                  ? 'bg-[#63E6A5] text-[#0D131A] font-bold'
                  : hasProvidedCoords
                  ? 'text-[#A5B2BD] hover:text-[#F4F7F5]'
                  : 'text-[#A5B2BD]/40 cursor-not-allowed'
              }`}
            >
              Input Coords
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowRawPoints((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 min-h-[38px] transition-colors ${
              showRawPoints
                ? 'bg-[#141E28] border-[#63E6A5]/50 text-[#63E6A5]'
                : 'bg-[#141E28] border-[#34424E] text-[#A5B2BD] hover:text-[#F4F7F5]'
            }`}
          >
            {showRawPoints ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            Points
          </button>

          <button
            type="button"
            onClick={() => setFlipDirection((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141E28] border border-[#34424E] text-xs font-medium text-[#A5B2BD] hover:text-[#F4F7F5] whitespace-nowrap shrink-0 min-h-[38px] transition-colors"
          >
            <SwitchCamera className="w-3.5 h-3.5" />
            Flip
          </button>
        </div>
      </div>

      {/* Synthetic Distribution Preset Bar + Kernel Radius Control */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-[#34424E]">
        {isDemoMode ? (
          <div
            className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#141E28] border border-[#34424E]"
            role="tablist"
            aria-label="Synthetic coordinate preset"
          >
            {DEMO_PRESETS.map((p) => {
              const active = preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPreset(p.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 min-h-[34px] transition-colors ${
                    active
                      ? 'bg-[#233240] text-[#63E6A5] border border-[#63E6A5]/45 font-semibold'
                      : 'text-[#A5B2BD] hover:text-[#F4F7F5]'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-[#A5B2BD]">
            Rendering {metrics.count} coordinate samples supplied directly via component props.
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-[#A5B2BD] shrink-0">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#63E6A5] shrink-0" />
          <label htmlFor="canvas-hm-radius" className="whitespace-nowrap">
            Kernel Radius
          </label>
          <input
            id="canvas-hm-radius"
            type="range"
            min={3.5}
            max={13}
            step={0.5}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-24 accent-[#63E6A5] cursor-pointer"
          />
          <span className="font-mono tabular-nums text-[#F4F7F5] w-9 text-right">
            {radius.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Main Canvas Pitch + Spatial Telemetry Strip */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div className="xl:col-span-9 flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#A5B2BD]">
            <span>
              {isDemoMode ? activePresetMeta.description : 'Custom coordinate spatial density'}
              {' · '}
              <span className="text-[#F4F7F5]">
                {flipDirection ? '← Attacking Left' : 'Attacking Right →'}
              </span>
            </span>
            <span className="font-mono text-[11px] tabular-nums text-[#63E6A5]">
              {hoverInfo
                ? `${hoverInfo.zoneLabel} (${hoverInfo.x}, ${hoverInfo.y}) · ${hoverInfo.densityPct}%`
                : 'Hover pitch to inspect density'}
            </span>
          </div>

          <div
            ref={containerRef}
            className="w-full rounded-xl border border-[#34424E] bg-[#0D131A] overflow-hidden"
          >
            {activePoints.length > 0 ? (
              <canvas
                ref={canvasRef}
                onPointerMove={handlePointerMove}
                onPointerLeave={() => setHoverInfo(null)}
                className="block w-full aspect-[105/68] cursor-crosshair select-none"
                role="img"
                aria-label={`${title} showing ${metrics.count} coordinate points`}
              />
            ) : (
              <div className="aspect-[105/68] flex flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-sm text-[#A5B2BD]">
                  No x/y coordinates supplied yet. Enable Demo Mode to preview synthetic distributions.
                </p>
                <button
                  type="button"
                  onClick={() => toggleDemoMode(true)}
                  className="px-4 py-2 rounded-lg bg-[#63E6A5] text-[#0D131A] text-xs font-bold min-h-[38px]"
                >
                  Load Synthetic Demo
                </button>
              </div>
            )}
          </div>

          {/* Mint Density Scale Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#A5B2BD]">
            <div className="flex items-center gap-2">
              <span>Mint Density:</span>
              <span>Low</span>
              <div
                className="w-28 h-2 rounded-full border border-[#34424E]"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(24,138,102,0.5) 0%, #34D399 38%, #63E6A5 72%, #E2FDF0 100%)',
                }}
              />
              <span className="text-[#63E6A5] font-medium">Peak</span>
            </div>
            <span className="font-mono tabular-nums">
              Buffer: 150×98 Gaussian KDE · Coordinate Space 0–100
            </span>
          </div>
        </div>

        {/* Right Telemetry Summary */}
        <div className="xl:col-span-3 flex flex-col gap-3 text-xs tabular-nums">
          <div className="rounded-xl bg-[#141E28] border border-[#34424E] p-4 flex flex-col gap-3">
            <div className="font-semibold text-[#F4F7F5]">Spatial Summary</div>
            <div className="grid grid-cols-2 xl:grid-cols-1 gap-2.5">
              <div>
                <div className="text-[#A5B2BD]">Active Samples</div>
                <div className="font-mono text-lg font-bold text-[#F4F7F5]">{metrics.count}</div>
              </div>
              <div>
                <div className="text-[#A5B2BD]">Mean Position (X, Y)</div>
                <div className="font-mono text-base font-bold text-[#63E6A5]">
                  {metrics.meanX}, {metrics.meanY}
                </div>
              </div>
              <div>
                <div className="text-[#A5B2BD]">Peak Hotspot</div>
                <div className="font-mono text-xs font-semibold text-[#F4F7F5] mt-0.5">
                  {peakZoneLabel}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-[#141E28] border border-[#34424E] p-4 flex flex-col gap-2.5">
            <div className="font-semibold text-[#F4F7F5]">Pitch Thirds Share</div>
            {[
              { label: 'Defensive Third', pct: metrics.defensivePct, color: '#7DD3FC' },
              { label: 'Middle Third', pct: metrics.middlePct, color: '#63E6A5' },
              { label: 'Final Third', pct: metrics.finalPct, color: '#E2FDF0' },
            ].map((row) => (
              <div key={row.label} className="flex flex-col gap-1">
                <div className="flex justify-between text-[#A5B2BD]">
                  <span>{row.label}</span>
                  <span className="font-mono text-[#F4F7F5]">{row.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#0D131A] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{ width: `${row.pct}%`, backgroundColor: row.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Heatmap;
