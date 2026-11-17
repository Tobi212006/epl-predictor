import { describe, expect, it } from 'vitest';
import {
  computeFilteredSummary,
  computePlayerPassingStats,
  filterPassingLinks,
  getFilteredPassWeight,
} from '../lib/passingMetrics';
import type { PassingLink, PlayerNode } from '../types/tactical';

const SAMPLE_PLAYERS: PlayerNode[] = [
  { id: 'p1', name: 'David Raya', short_name: 'Raya', shirt_number: 22, role: 'GK', x: 8, y: 50, status: 'AVAILABLE' },
  { id: 'p2', name: 'William Saliba', short_name: 'Saliba', shirt_number: 2, role: 'RCB', x: 25, y: 63, status: 'AVAILABLE' },
  { id: 'p3', name: 'Declan Rice', short_name: 'Rice', shirt_number: 41, role: 'DM', x: 46, y: 50, status: 'AVAILABLE' },
  { id: 'p4', name: 'Martin Odegaard', short_name: 'Odegaard', shirt_number: 8, role: 'RCM', x: 64, y: 65, status: 'AVAILABLE' },
  { id: 'p5', name: 'Bukayo Saka', short_name: 'Saka', shirt_number: 7, role: 'RW', x: 78, y: 83, status: 'AVAILABLE' },
];

const SAMPLE_LINKS: PassingLink[] = [
  {
    from_id: 'p1',
    to_id: 'p2',
    from_name: 'Raya',
    to_name: 'Saliba',
    total_passes: 18,
    completed_passes: 17,
    incomplete_passes: 1,
    key_passes: 0,
  },
  {
    from_id: 'p2',
    to_id: 'p3',
    from_name: 'Saliba',
    to_name: 'Rice',
    total_passes: 26,
    completed_passes: 23,
    incomplete_passes: 3,
    key_passes: 1,
  },
  {
    from_id: 'p3',
    to_id: 'p4',
    from_name: 'Rice',
    to_name: 'Odegaard',
    total_passes: 20,
    completed_passes: 16,
    incomplete_passes: 4,
    key_passes: 3,
  },
  {
    from_id: 'p4',
    to_id: 'p5',
    from_name: 'Odegaard',
    to_name: 'Saka',
    total_passes: 14,
    completed_passes: 10,
    incomplete_passes: 4,
    key_passes: 5,
  },
];

describe('passingMetrics helpers', () => {
  it('computes pass weights accurately per filter mode', () => {
    const link = SAMPLE_LINKS[2];
    expect(getFilteredPassWeight(link, 'all')).toBe(20);
    expect(getFilteredPassWeight(link, 'completed')).toBe(16);
    expect(getFilteredPassWeight(link, 'incomplete')).toBe(4);
    expect(getFilteredPassWeight(link, 'key')).toBe(3);
  });

  it('filters out zero-weight links and isolates selected player connections', () => {
    const keyLinks = filterPassingLinks(SAMPLE_LINKS, 'key', null);
    expect(keyLinks).toHaveLength(3);
    expect(keyLinks.every((l) => l.key_passes > 0)).toBe(true);

    const riceLinks = filterPassingLinks(SAMPLE_LINKS, 'all', 'p3');
    expect(riceLinks).toHaveLength(2);
    expect(riceLinks.every((l) => l.from_id === 'p3' || l.to_id === 'p3')).toBe(true);
  });

  it('computes consistent summary KPIs and most connected pair', () => {
    const summary = computeFilteredSummary(SAMPLE_LINKS, 'all', null);
    expect(summary.total_passes).toBe(78);
    expect(summary.completed_passes).toBe(66);
    expect(summary.incomplete_passes).toBe(12);
    expect(summary.key_passes).toBe(9);
    expect(summary.completion_pct).toBe(84.6);
    expect(summary.most_connected_pair).toEqual({
      from_name: 'Saliba',
      to_name: 'Rice',
      total_passes: 26,
      completed_passes: 23,
    });

    const keySummary = computeFilteredSummary(SAMPLE_LINKS, 'key', 'p4');
    expect(keySummary.most_connected_pair?.from_name).toBe('Odegaard');
    expect(keySummary.most_connected_pair?.to_name).toBe('Saka');
    expect(keySummary.most_connected_pair?.total_passes).toBe(5);
  });

  it('computes player passing totals and sorted top partners', () => {
    const stats = computePlayerPassingStats('p3', SAMPLE_LINKS, SAMPLE_PLAYERS);
    expect(stats.attempted).toBe(46);
    expect(stats.completed).toBe(39);
    expect(stats.incomplete).toBe(7);
    expect(stats.keyPasses).toBe(4);
    expect(stats.completionPct).toBe(84.8);
    expect(stats.topPartners[0].partnerId).toBe('p2');
    expect(stats.topPartners[0].partnerName).toBe('Saliba');
    expect(stats.topPartners[0].passes).toBe(26);
  });
});
