import type { CameraPreset, PlayerNode, TacticalSnapshot } from '../../types/tactical';

// Canonical [0, 100] -> 3D World Space (105m x 68m scaled to 21 x 13.6 units)
export const PITCH_LENGTH_3D = 21.0;
export const PITCH_WIDTH_3D = 13.6;

export function canonicalToWorld3D(
  x: number,
  y: number,
  flipDirection = false,
): [number, number] {
  const cx = flipDirection ? 100 - x : x;
  const cy = flipDirection ? 100 - y : y;
  const worldX = ((cx - 50) / 100) * PITCH_LENGTH_3D;
  const worldZ = ((cy - 50) / 100) * PITCH_WIDTH_3D;
  return [worldX, worldZ];
}

// Canonical [0, 100] -> 2D SVG Space (1050 x 680 with 40px outer apron -> 1130 x 760)
export const SVG_MARGIN = 40;
export const SVG_PITCH_W = 1050;
export const SVG_PITCH_H = 680;
export const SVG_VIEWBOX_W = SVG_PITCH_W + SVG_MARGIN * 2;
export const SVG_VIEWBOX_H = SVG_PITCH_H + SVG_MARGIN * 2;

export function canonicalToSvg2D(
  x: number,
  y: number,
  flipDirection = false,
): { x: number; y: number } {
  const cx = flipDirection ? 100 - x : x;
  const cy = flipDirection ? 100 - y : y;
  return {
    x: SVG_MARGIN + (cx / 100) * SVG_PITCH_W,
    y: SVG_MARGIN + (cy / 100) * SVG_PITCH_H,
  };
}

export function svg2DToCanonical(
  svgX: number,
  svgY: number,
  flipDirection = false,
): { x: number; y: number } {
  const rawX = Math.max(2, Math.min(98, ((svgX - SVG_MARGIN) / SVG_PITCH_W) * 100));
  const rawY = Math.max(4, Math.min(96, ((svgY - SVG_MARGIN) / SVG_PITCH_H) * 100));
  return {
    x: Number((flipDirection ? 100 - rawX : rawX).toFixed(1)),
    y: Number((flipDirection ? 100 - rawY : rawY).toFixed(1)),
  };
}

export const CAMERA_PRESETS: Record<
  CameraPreset,
  { label: string; position: [number, number, number]; target: [number, number, number] }
> = {
  broadcast: {
    label: 'Broadcast Iso',
    position: [0, 13.5, 16.5],
    target: [0, 0, 0.5],
  },
  topdown: {
    label: 'Top-Down Analyst',
    position: [0, 22.5, 0.01],
    target: [0, 0, 0],
  },
  goalside: {
    label: 'Goal-Side Press',
    position: [15.5, 6.2, 7.8],
    target: [3.5, 0.3, 0],
  },
  halfspace: {
    label: 'Half-Space Close',
    position: [3.5, 6.5, 9.2],
    target: [4.2, 0.2, 2.2],
  },
};

export function downloadSnapshotJson(snapshot: TacticalSnapshot, filename?: string): void {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${snapshot.team_id}-${snapshot.phase}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSvgElement(svgEl: SVGSVGElement | null, format: 'svg' | 'png', filename: string): void {
  if (!svgEl) return;
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svgEl);

  if (format === 'svg') {
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const img = new Image();
  const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = SVG_VIEWBOX_W * 2;
    canvas.height = SVG_VIEWBOX_H * 2;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#070B13';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `${filename}.png`;
      a.click();
    }
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

export function computePolygonCentroid(players: PlayerNode[]): { x: number; y: number } {
  if (!players.length) return { x: 50, y: 50 };
  const sum = players.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / players.length, y: sum.y / players.length };
}
