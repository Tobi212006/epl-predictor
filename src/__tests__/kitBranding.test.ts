import { describe, expect, it } from 'vitest';
import {
  ALL_REGISTERED_CLUBS,
  CORE_EPL_20_CLUBS,
  getClubConfig,
  getContrastTextColor,
  parseHexRgb,
} from '../config/clubs';
import {
  CLUB_IDENTITY_META,
  CLUB_KIT_SPECS,
  areKitColorsClose,
  getClubUiTheme,
  getRelativeLuminance,
  resolveClubKitColors,
  resolveMatchupKitPair,
  resolveMatchupUiAccents,
  resolveVisibleUiAccent,
} from '../components/common/FootballMotifs';
import { computePolygonCentroid } from '../components/pitch/pitchCoords';

const EXPECTED_CORE_20_IDS = [
  'arsenal',
  'aston-villa',
  'bournemouth',
  'brentford',
  'brighton',
  'burnley',
  'chelsea',
  'crystal-palace',
  'everton',
  'fulham',
  'leeds',
  'liverpool',
  'man-city',
  'man-united',
  'newcastle',
  'nottm-forest',
  'sunderland',
  'tottenham',
  'west-ham',
  'wolves',
];

describe('centralized club configuration, kit branding & clash resolution', () => {
  it('registers all 20 named Premier League clubs plus live-synced 2026-27 clubs in one centralized config', () => {
    expect(CORE_EPL_20_CLUBS).toHaveLength(20);
    const coreIds = CORE_EPL_20_CLUBS.map((c) => c.id).sort();
    expect(coreIds).toEqual([...EXPECTED_CORE_20_IDS].sort());

    expect(ALL_REGISTERED_CLUBS.length).toBeGreaterThanOrEqual(20);
    expect(Object.keys(CLUB_KIT_SPECS)).toHaveLength(ALL_REGISTERED_CLUBS.length);
    expect(Object.keys(CLUB_IDENTITY_META)).toHaveLength(ALL_REGISTERED_CLUBS.length);
  });

  it('resolves aliases cleanly and never guesses colors from unknown club names', () => {
    expect(getClubConfig('wolverhampton-wanderers')?.id).toBe('wolves');
    expect(getClubConfig('West-Ham-United')?.id).toBe('west-ham');
    expect(getClubConfig('manchester-city')?.tla).toBe('MCI');
    expect(getClubConfig('brighton-and-hove-albion')?.id).toBe('brighton');
    expect(getClubConfig('non-existent-club-fc')).toBeNull();
    expect(getClubConfig(undefined)).toBeNull();
  });

  it('defines authentic non-clashing home and away kits and accessible WCAG contrast text for every registered club', () => {
    for (const club of ALL_REGISTERED_CLUBS) {
      expect(club.primaryColor, club.id).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(club.secondaryColor, club.id).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(club.awayPrimary, club.id).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(areKitColorsClose(club.primaryColor, club.awayPrimary), `${club.id} clash`).toBe(false);
      expect(club.textColor, club.id).toBe(getContrastTextColor(club.primaryColor));
      expect(club.stadium.length, club.id).toBeGreaterThan(3);
      expect(club.nickname.length, club.id).toBeGreaterThan(2);
      expect(club.capacity, club.id).toBeGreaterThan(10000);

      const theme = getClubUiTheme(club.id);
      expect(getRelativeLuminance(theme.accent)).toBeGreaterThanOrEqual(0.24);
      expect(theme.glowSoft).toContain('rgba(');
    }
  });

  it('keeps club UI accents hue-faithful instead of substituting yellow/white trim', () => {
    const [cr, cg, cb] = parseHexRgb(resolveVisibleUiAccent('chelsea', '#034694', '#FFFFFF'));
    expect(cb).toBeGreaterThan(cr);
    expect(cb).toBeGreaterThan(cg);

    const [ar, , ab] = parseHexRgb(resolveVisibleUiAccent('arsenal', '#EF0107', '#FFFFFF'));
    expect(ar).toBeGreaterThan(ab * 2);

    const [vr, vg] = parseHexRgb(resolveVisibleUiAccent('aston-villa', '#670E36', '#95BFE5'));
    expect(vr).toBeGreaterThan(vg);
  });

  it('resolves exact Home and Away book cover colors and switches Away to Away Kit only on clash', () => {
    const brightonVilla = resolveMatchupKitPair(
      { teamId: 'brighton', primaryColor: '#0057B8' },
      { teamId: 'aston-villa', primaryColor: '#670E36' },
    );
    expect(brightonVilla.isAwayKit).toBe(false);
    expect(brightonVilla.homeKit.primary).toBe('#0057B8');
    expect(brightonVilla.awayKit.primary).toBe('#670E36');

    const evertonPalace = resolveMatchupKitPair(
      { teamId: 'everton', primaryColor: '#003399' },
      { teamId: 'crystal-palace', primaryColor: '#1B458F' },
    );
    expect(evertonPalace.isAwayKit).toBe(true);
    expect(evertonPalace.homeKit.primary).toBe('#003399');
    expect(evertonPalace.awayKit.primary).toBe('#F8FAFC');
  });

  it('detects near-identical kit colors like Arsenal vs Liverpool home red', () => {
    const arsenalHome = resolveClubKitColors('arsenal', '#EF0107', '#FFFFFF', false);
    const liverpoolHome = resolveClubKitColors('liverpool', '#C8102E', '#FFFFFF', false);
    const liverpoolAway = resolveClubKitColors('liverpool', '#C8102E', '#FFFFFF', true);

    expect(areKitColorsClose(arsenalHome.primary, liverpoolHome.primary)).toBe(true);
    expect(areKitColorsClose(arsenalHome.primary, liverpoolAway.primary)).toBe(false);
  });

  it('lifts dark home/away kit primaries to visible high-contrast UI accents for all clubs', () => {
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

  it('falls back cleanly for unknown clubs using explicit caller-provided colors only', () => {
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
