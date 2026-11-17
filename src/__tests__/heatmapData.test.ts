import { describe, expect, it } from 'vitest';
import {
  computeHeatmapDensityGrid,
  describePitchZone,
  generateDummyPlayerHeatmapPoints,
  heatmapIntensityToColor,
  mapSquadToHeatmapNodes,
  summarizeHeatmapActivity,
} from '../lib/heatmapData';
import type { PlayerNode } from '../types/tactical';

const SAMPLE_XI: PlayerNode[] = [
  { id: 'p1', name: 'David Raya', short_name: 'Raya', shirt_number: 22, role: 'GK', x: 6, y: 50, status: 'AVAILABLE' },
  { id: 'p2', name: 'Ben White', short_name: 'White', shirt_number: 4, role: 'RB', x: 24, y: 82, status: 'AVAILABLE' },
  { id: 'p3', name: 'William Saliba', short_name: 'Saliba', shirt_number: 2, role: 'RCB', x: 21, y: 62, status: 'AVAILABLE' },
  { id: 'p4', name: 'Gabriel', short_name: 'Gabriel', shirt_number: 6, role: 'LCB', x: 21, y: 38, status: 'AVAILABLE' },
  { id: 'p5', name: 'Timber', short_name: 'Timber', shirt_number: 12, role: 'LB', x: 24, y: 18, status: 'AVAILABLE' },
  { id: 'p6', name: 'Declan Rice', short_name: 'Rice', shirt_number: 41, role: 'DM', x: 38, y: 50, status: 'AVAILABLE' },
  { id: 'p7', name: 'Martin Odegaard', short_name: 'Odegaard', shirt_number: 8, role: 'RCM', x: 49, y: 67, status: 'AVAILABLE' },
  { id: 'p8', name: 'Mikel Merino', short_name: 'Merino', shirt_number: 23, role: 'LCM', x: 49, y: 33, status: 'AVAILABLE' },
  { id: 'p9', name: 'Bukayo Saka', short_name: 'Saka', shirt_number: 7, role: 'RW', x: 69, y: 82, status: 'AVAILABLE' },
  { id: 'p10', name: 'Kai Havertz', short_name: 'Havertz', shirt_number: 29, role: 'ST', x: 76, y: 50, status: 'AVAILABLE' },
  { id: 'p11', name: 'Leandro Trossard', short_name: 'Trossard', shirt_number: 19, role: 'LW', x: 69, y: 18, status: 'AVAILABLE' },
];

describe('heatmapData utilities', () => {
  it('generates deterministic dummy coordinates bounded cleanly inside pitch dimensions', () => {
    const first = generateDummyPlayerHeatmapPoints(SAMPLE_XI, {
      teamId: 'arsenal',
      phase: 'in_possession',
      pointsPerPlayer: 20,
    });
    const second = generateDummyPlayerHeatmapPoints(SAMPLE_XI, {
      teamId: 'arsenal',
      phase: 'in_possession',
      pointsPerPlayer: 20,
    });

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(150);

    for (const pt of first) {
      expect(pt.x).toBeGreaterThanOrEqual(2);
      expect(pt.x).toBeLessThanOrEqual(96);
      expect(pt.y).toBeGreaterThanOrEqual(4);
      expect(pt.y).toBeLessThanOrEqual(96);
      expect(pt.weight).toBeGreaterThanOrEqual(0.65);
      expect(pt.weight).toBeLessThanOrEqual(1.3);
      if (pt.playerId === 'p1') {
        expect(pt.x).toBeLessThanOrEqual(24);
        expect(pt.y).toBeGreaterThanOrEqual(22);
        expect(pt.y).toBeLessThanOrEqual(78);
      }
    }
  });

  it('normalizes KDE density grid values between 0 and 1 with peak cell at 1', () => {
    const pts = generateDummyPlayerHeatmapPoints([SAMPLE_XI[8]], {
      teamId: 'arsenal',
      phase: 'in_possession',
      pointsPerPlayer: 24,
    });
    const grid = computeHeatmapDensityGrid(pts, 28, 18);
    expect(grid).toHaveLength(28 * 18);

    const maxIntensity = Math.max(...grid.map((c) => c.intensity));
    const minIntensity = Math.min(...grid.map((c) => c.intensity));
    expect(maxIntensity).toBe(1);
    expect(minIntensity).toBeGreaterThanOrEqual(0);
  });

  it('summarizes pitch thirds and lateral channels summing to 100%', () => {
    const pts = generateDummyPlayerHeatmapPoints(SAMPLE_XI, {
      teamId: 'arsenal',
      phase: 'out_of_possession',
      pointsPerPlayer: 22,
    });
    const grid = computeHeatmapDensityGrid(pts, 28, 18);
    const summary = summarizeHeatmapActivity(pts, grid);

    expect(summary.sampleCount).toBe(pts.length);
    expect(summary.defensiveThirdPct + summary.middleThirdPct + summary.finalThirdPct).toBe(100);
    expect(summary.leftChannelPct + summary.centralChannelPct + summary.rightChannelPct).toBe(100);
    expect(summary.peakIntensityPct).toBe(100);
    expect(summary.peakZoneLabel).toContain('·');
  });

  it('maps roster entries to canonical pitch nodes and formats charcoal-to-mint colors', () => {
    const nodes = mapSquadToHeatmapNodes([
      { id: 'a1', name: 'Keeper', short_name: 'Keeper', shirt_number: 1, position: 'GK' },
      { id: 'a2', name: 'Striker', short_name: 'Striker', shirt_number: 9, position: 'ST' },
    ]);
    expect(nodes).toHaveLength(2);
    expect(nodes[0].x).toBe(6);
    expect(nodes[1].x).toBe(76);

    expect(describePitchZone(82, 85)).toBe('Final Third · Right Touchline');
    expect(heatmapIntensityToColor(0)).toBe('rgba(13, 19, 26, 0)');
    expect(heatmapIntensityToColor(0.5)).toContain('rgba(99, 230, 165,');
    expect(heatmapIntensityToColor(0.9)).toContain('rgba(226, 253, 240,');
  });
});
