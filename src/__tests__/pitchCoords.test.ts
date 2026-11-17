import { describe, expect, it } from 'vitest';
import {
  CAMERA_PRESETS,
  canonicalToSvg2D,
  canonicalToWorld3D,
  svg2DToCanonical,
} from '../components/pitch/pitchCoords';

describe('canonical pitch coordinate transforms', () => {
  it('maps canonical center (50, 50) to 3D origin (0, 0)', () => {
    const [wx, wz] = canonicalToWorld3D(50, 50, false);
    expect(wx).toBeCloseTo(0, 5);
    expect(wz).toBeCloseTo(0, 5);
  });

  it('flips direction symmetrically around pitch center', () => {
    const [wx1, wz1] = canonicalToWorld3D(20, 30, false);
    const [wx2, wz2] = canonicalToWorld3D(20, 30, true);
    expect(wx1).toBeCloseTo(-wx2, 5);
    expect(wz1).toBeCloseTo(-wz2, 5);
  });

  it('round-trips canonical <-> 2D SVG coordinates accurately', () => {
    const svg = canonicalToSvg2D(34.5, 71.2, false);
    const back = svg2DToCanonical(svg.x, svg.y, false);
    expect(back.x).toBeCloseTo(34.5, 1);
    expect(back.y).toBeCloseTo(71.2, 1);
  });

  it('defines all four required 3D camera presets', () => {
    expect(Object.keys(CAMERA_PRESETS)).toEqual([
      'broadcast',
      'topdown',
      'goalside',
      'halfspace',
    ]);
  });
});
