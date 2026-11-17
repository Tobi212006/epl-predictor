import { describe, expect, it } from 'vitest';
import {
  CLUB_IDENTITY_META,
  CLUB_KIT_SPECS,
  areKitColorsClose,
  getClubUiTheme,
  getRelativeLuminance,
  resolveClubKitColors,
  resolveMatchupUiAccents,
  resolveVisibleUiAccent,
} from '../components/common/FootballMotifs';
import { computePolygonCentroid } from '../components/pitch/pitchCoords';

describe('club kit branding & clash resolution', () => {
  it('defines authentic home and away kits for all 20 EPL clubs', () => {
    expect(Object.keys(CLUB_KIT_SPECS)).toHaveLength(20);
    for (const [clubId, spec] of Object.entries(CLUB_KIT_SPECS)) {
      expect(spec.primary, clubId).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(spec.awayPrimary, clubId).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(areKitColorsClose(spec.primary, spec.awayPrimary), `${clubId} clash`).toBe(false);
    }
  });

  it('defines authentic stadium, capacity, and nickname metadata for all 20 EPL clubs', () => {
    expect(Object.keys(CLUB_IDENTITY_META)).toHaveLength(20);
    for (const clubId of Object.keys(CLUB_KIT_SPECS)) {
      const meta = CLUB_IDENTITY_META[clubId];
      expect(meta, `${clubId} meta missing`).toBeDefined();
      expect(meta.stadium.length).toBeGreaterThan(3);
      expect(meta.nickname.length).toBeGreaterThan(2);
      expect(meta.capacity).toBeGreaterThan(10000);
      const theme = getClubUiTheme(clubId);
      expect(getRelativeLuminance(theme.accent)).toBeGreaterThanOrEqual(0.24);
      expect(theme.glowSoft).toContain('rgba(');
    }
  });

  it('detects near-identical kit colors like Arsenal vs Liverpool home red', () => {
    const arsenalHome = resolveClubKitColors('arsenal', '#EF0107', '#FFFFFF', false);
    const liverpoolHome = resolveClubKitColors('liverpool', '#C8102E', '#FFFFFF', false);
    const liverpoolAway = resolveClubKitColors('liverpool', '#C8102E', '#FFFFFF', true);

    expect(areKitColorsClose(arsenalHome.primary, liverpoolHome.primary)).toBe(true);
    expect(areKitColorsClose(arsenalHome.primary, liverpoolAway.primary)).toBe(false);
  });

  it('lifts dark home/away kit primaries to visible high-contrast UI accents for all 20 clubs', () => {
    for (const [clubId, spec] of Object.entries(CLUB_KIT_SPECS)) {
      const homeUi = resolveVisibleUiAccent(clubId, spec.primary, spec.secondary, false);
      const awayUi = resolveVisibleUiAccent(clubId, spec.primary, spec.secondary, true);
      expect(getRelativeLuminance(homeUi), `${clubId} home UI luma`).toBeGreaterThanOrEqual(0.24);
      expect(getRelativeLuminance(awayUi), `${clubId} away UI luma`).toBeGreaterThanOrEqual(0.24);
    }
  });

  it('guarantees distinct high-contrast home and away matchup accents even for colliding kits', () => {
    const { homeAccent, awayAccent } = resolveMatchupUiAccents(
      { teamId: 'newcastle', primaryColor: '#161618', secondaryColor: '#FFFFFF' },
      { teamId: 'chelsea', primaryColor: '#034694', secondaryColor: '#FFFFFF' },
    );
    expect(getRelativeLuminance(homeAccent)).toBeGreaterThanOrEqual(0.24);
    expect(getRelativeLuminance(awayAccent)).toBeGreaterThanOrEqual(0.24);
    expect(areKitColorsClose(homeAccent, awayAccent)).toBe(false);

    const sameWhite = resolveMatchupUiAccents(
      { teamId: 'tottenham', primaryColor: '#F8FAFC', secondaryColor: '#132257' },
      { teamId: 'leeds', primaryColor: '#F8FAFC', secondaryColor: '#1D428A' },
    );
    expect(areKitColorsClose(sameWhite.homeAccent, sameWhite.awayAccent)).toBe(false);
  });

  it('falls back cleanly for unknown clubs', () => {
    const unknown = resolveClubKitColors('unknown-fc', '#123456', '#ABCDEF', true);
    expect(unknown.primary).toBe('#123456');
    expect(unknown.secondary).toBe('#ABCDEF');
    expect(unknown.pattern).toBe('sash');
  });

  it('computes polygon centroid cleanly even on empty input', () => {
    expect(computePolygonCentroid([])).toEqual({ x: 50, y: 50 });
    const c = computePolygonCentroid([
      { id: '1', name: 'A', short_name: 'A', shirt_number: 1, role: 'GK', x: 10, y: 20, status: 'AVAILABLE' },
      { id: '2', name: 'B', short_name: 'B', shirt_number: 9, role: 'ST', x: 70, y: 80, status: 'AVAILABLE' },
    ]);
    expect(c).toEqual({ x: 40, y: 50 });
  });
});
