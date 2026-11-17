import { describe, expect, it } from 'vitest';
import {
  buildDensityField,
  DEMO_PRESETS,
  generateSyntheticHeatmapCoordinates,
  summarizeCoordinates,
} from '../components/analytics/Heatmap';

describe('Canvas Heatmap analytics engine', () => {
  it('generates deterministic synthetic coordinates bounded inside [0, 100] for all presets', () => {
    for (const preset of DEMO_PRESETS) {
      const a = generateSyntheticHeatmapCoordinates(preset.id, 120, 'unit-seed');
      const b = generateSyntheticHeatmapCoordinates(preset.id, 120, 'unit-seed');
      expect(a).toEqual(b);
      expect(a).toHaveLength(120);

      for (const pt of a) {
        expect(pt.x).toBeGreaterThanOrEqual(3);
        expect(pt.x).toBeLessThanOrEqual(97);
        expect(pt.y).toBeGreaterThanOrEqual(4);
        expect(pt.y).toBeLessThanOrEqual(96);
        expect(pt.weight).toBeGreaterThan(0);
      }
    }
  });

  it('evaluates Gaussian density field with peak located at concentrated coordinate cluster and supports flipDirection', () => {
    const cluster = [
      { x: 80, y: 25, weight: 1.5 },
      { x: 81, y: 26, weight: 1.5 },
      { x: 79, y: 24, weight: 1.5 },
      { x: 20, y: 80, weight: 0.4 },
    ];

    const field = buildDensityField(cluster, 100, 65, 7.5, false);
    expect(field.maxValue).toBeGreaterThan(0);
    expect(field.peakX).toBeGreaterThan(72);
    expect(field.peakX).toBeLessThan(88);
    expect(field.peakY).toBeGreaterThan(18);
    expect(field.peakY).toBeLessThan(33);

    const flipped = buildDensityField(cluster, 100, 65, 7.5, true);
    expect(flipped.peakX).toBeCloseTo(100 - field.peakX, 0);
    expect(flipped.peakY).toBeCloseTo(100 - field.peakY, 0);

    const empty = buildDensityField([], 100, 65);
    expect(empty.maxValue).toBe(0);
  });

  it('summarizes coordinate pitch thirds totaling 100% and computes weighted centroid', () => {
    const pts = [
      { x: 10, y: 20, weight: 1 },
      { x: 50, y: 50, weight: 2 },
      { x: 90, y: 80, weight: 1 },
    ];
    const summary = summarizeCoordinates(pts);
    expect(summary.count).toBe(3);
    expect(summary.meanX).toBe(50);
    expect(summary.meanY).toBe(50);
    expect(summary.defensivePct + summary.middlePct + summary.finalPct).toBe(100);
    expect(summary.middlePct).toBe(50);
  });
});
