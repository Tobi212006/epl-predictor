export type KitPattern = 'solid' | 'raglan' | 'stripes' | 'hoops' | 'sash' | 'pinstripe';

export interface ClubConfig {
  id: string;
  displayName: string;
  shortName: string;
  tla: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: '#0D131A' | '#FFFFFF';
  secondaryTextColor: '#0D131A' | '#FFFFFF';
  trimColor: string;
  pattern: KitPattern;
  awayPrimary: string;
  awaySecondary: string;
  awayPattern: KitPattern;
  nickname: string;
  stadium: string;
  capacity: number;
  city: string;
  inCoreEpl20List: boolean;
}

export function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [30, 41, 59];
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return [30, 41, 59];
  return [r, g, b];
}

export function getRelativeLuminance(hex: string): number {
  const [r, g, b] = parseHexRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Returns WCAG-optimal dark or white foreground text for a given hex surface.
 * Compares contrast ratio against #FFFFFF vs #0D131A.
 */
export function getContrastTextColor(bgHex: string): '#0D131A' | '#FFFFFF' {
  const bgL = getRelativeLuminance(bgHex);
  const darkL = getRelativeLuminance('#0D131A');
  const whiteL = 1.0;
  const contrastWhite = (whiteL + 0.05) / (bgL + 0.05);
  const contrastDark = (bgL + 0.05) / (darkL + 0.05);
  return contrastDark > contrastWhite ? '#0D131A' : '#FFFFFF';
}

interface RawClubEntry {
  id: string;
  displayName: string;
  shortName: string;
  tla: string;
  primaryColor: string;
  secondaryColor: string;
  trimColor: string;
  pattern: KitPattern;
  awayPrimary: string;
  awaySecondary: string;
  awayPattern: KitPattern;
  nickname: string;
  stadium: string;
  capacity: number;
  city: string;
  inCoreEpl20List: boolean;
}

const RAW_CLUBS: RawClubEntry[] = [
  {
    id: 'arsenal',
    displayName: 'Arsenal',
    shortName: 'Arsenal',
    tla: 'ARS',
    primaryColor: '#EF0107',
    secondaryColor: '#FFFFFF',
    trimColor: '#063672',
    pattern: 'raglan',
    awayPrimary: '#1A1C22',
    awaySecondary: '#63E6A5',
    awayPattern: 'pinstripe',
    nickname: 'The Gunners',
    stadium: 'Emirates Stadium',
    capacity: 60704,
    city: 'London',
    inCoreEpl20List: true,
  },
  {
    id: 'aston-villa',
    displayName: 'Aston Villa',
    shortName: 'Aston Villa',
    tla: 'AVL',
    primaryColor: '#670E36',
    secondaryColor: '#95BFE5',
    trimColor: '#FEE505',
    pattern: 'raglan',
    awayPrimary: '#F3F4F6',
    awaySecondary: '#670E36',
    awayPattern: 'raglan',
    nickname: 'The Villans',
    stadium: 'Villa Park',
    capacity: 42657,
    city: 'Birmingham',
    inCoreEpl20List: true,
  },
  {
    id: 'bournemouth',
    displayName: 'AFC Bournemouth',
    shortName: 'Bournemouth',
    tla: 'BOU',
    primaryColor: '#DA291C',
    secondaryColor: '#111111',
    trimColor: '#E6C27A',
    pattern: 'stripes',
    awayPrimary: '#F8FAFC',
    awaySecondary: '#DA291C',
    awayPattern: 'sash',
    nickname: 'The Cherries',
    stadium: 'Vitality Stadium',
    capacity: 11307,
    city: 'Bournemouth',
    inCoreEpl20List: true,
  },
  {
    id: 'brentford',
    displayName: 'Brentford',
    shortName: 'Brentford',
    tla: 'BRE',
    primaryColor: '#E30613',
    secondaryColor: '#FFFFFF',
    trimColor: '#111111',
    pattern: 'stripes',
    awayPrimary: '#1E293B',
    awaySecondary: '#FBBF24',
    awayPattern: 'raglan',
    nickname: 'The Bees',
    stadium: 'Gtech Community Stadium',
    capacity: 17250,
    city: 'London',
    inCoreEpl20List: true,
  },
  {
    id: 'brighton',
    displayName: 'Brighton & Hove Albion',
    shortName: 'Brighton',
    tla: 'BHA',
    primaryColor: '#0057B8',
    secondaryColor: '#FFFFFF',
    trimColor: '#FFCD00',
    pattern: 'stripes',
    awayPrimary: '#F59E0B',
    awaySecondary: '#111827',
    awayPattern: 'hoops',
    nickname: 'The Seagulls',
    stadium: 'Amex Stadium',
    capacity: 31800,
    city: 'Brighton',
    inCoreEpl20List: true,
  },
  {
    id: 'burnley',
    displayName: 'Burnley',
    shortName: 'Burnley',
    tla: 'BUR',
    primaryColor: '#6C1D45',
    secondaryColor: '#99D6EA',
    trimColor: '#FFFFFF',
    pattern: 'raglan',
    awayPrimary: '#F8FAFC',
    awaySecondary: '#6C1D45',
    awayPattern: 'sash',
    nickname: 'The Clarets',
    stadium: 'Turf Moor',
    capacity: 21944,
    city: 'Burnley',
    inCoreEpl20List: true,
  },
  {
    id: 'chelsea',
    displayName: 'Chelsea',
    shortName: 'Chelsea',
    tla: 'CHE',
    primaryColor: '#034694',
    secondaryColor: '#FFFFFF',
    trimColor: '#DBA111',
    pattern: 'solid',
    awayPrimary: '#F7E7D5',
    awaySecondary: '#034694',
    awayPattern: 'sash',
    nickname: 'The Blues',
    stadium: 'Stamford Bridge',
    capacity: 40341,
    city: 'London',
    inCoreEpl20List: true,
  },
  {
    id: 'crystal-palace',
    displayName: 'Crystal Palace',
    shortName: 'Crystal Palace',
    tla: 'CRY',
    primaryColor: '#1B458F',
    secondaryColor: '#C4122E',
    trimColor: '#FFFFFF',
    pattern: 'stripes',
    awayPrimary: '#F8FAFC',
    awaySecondary: '#1B458F',
    awayPattern: 'sash',
    nickname: 'The Eagles',
    stadium: 'Selhurst Park',
    capacity: 25486,
    city: 'London',
    inCoreEpl20List: true,
  },
  {
    id: 'everton',
    displayName: 'Everton',
    shortName: 'Everton',
    tla: 'EVE',
    primaryColor: '#003399',
    secondaryColor: '#FFFFFF',
    trimColor: '#FFFFFF',
    pattern: 'solid',
    awayPrimary: '#1F2937',
    awaySecondary: '#FBBF24',
    awayPattern: 'hoops',
    nickname: 'The Toffees',
    stadium: 'Hill Dickinson Stadium',
    capacity: 52769,
    city: 'Liverpool',
    inCoreEpl20List: true,
  },
  {
    id: 'fulham',
    displayName: 'Fulham',
    shortName: 'Fulham',
    tla: 'FUL',
    primaryColor: '#F8FAFC',
    secondaryColor: '#111111',
    trimColor: '#CC0000',
    pattern: 'sash',
    awayPrimary: '#1B2732',
    awaySecondary: '#F87171',
    awayPattern: 'hoops',
    nickname: 'The Cottagers',
    stadium: 'Craven Cottage',
    capacity: 24500,
    city: 'London',
    inCoreEpl20List: true,
  },
  {
    id: 'leeds',
    displayName: 'Leeds United',
    shortName: 'Leeds',
    tla: 'LEE',
    primaryColor: '#F8FAFC',
    secondaryColor: '#1D428A',
    trimColor: '#FFCD00',
    pattern: 'solid',
    awayPrimary: '#1D428A',
    awaySecondary: '#FFCD00',
    awayPattern: 'sash',
    nickname: 'The Whites',
    stadium: 'Elland Road',
    capacity: 37642,
    city: 'Leeds',
    inCoreEpl20List: true,
  },
  {
    id: 'liverpool',
    displayName: 'Liverpool',
    shortName: 'Liverpool',
    tla: 'LIV',
    primaryColor: '#C8102E',
    secondaryColor: '#FFFFFF',
    trimColor: '#F6EB61',
    pattern: 'pinstripe',
    awayPrimary: '#15221E',
    awaySecondary: '#7DD3FC',
    awayPattern: 'raglan',
    nickname: 'The Reds',
    stadium: 'Anfield',
    capacity: 61276,
    city: 'Liverpool',
    inCoreEpl20List: true,
  },
  {
    id: 'man-city',
    displayName: 'Manchester City',
    shortName: 'Man City',
    tla: 'MCI',
    primaryColor: '#6CABDD',
    secondaryColor: '#1C2C5B',
    trimColor: '#FFFFFF',
    pattern: 'solid',
    awayPrimary: '#6C1D45',
    awaySecondary: '#F6EB61',
    awayPattern: 'sash',
    nickname: 'The Citizens',
    stadium: 'Etihad Stadium',
    capacity: 53400,
    city: 'Manchester',
    inCoreEpl20List: true,
  },
  {
    id: 'man-united',
    displayName: 'Manchester United',
    shortName: 'Man United',
    tla: 'MUN',
    primaryColor: '#DA291C',
    secondaryColor: '#FBE122',
    trimColor: '#111111',
    pattern: 'solid',
    awayPrimary: '#1B2A4A',
    awaySecondary: '#E2E8F0',
    awayPattern: 'pinstripe',
    nickname: 'The Red Devils',
    stadium: 'Old Trafford',
    capacity: 74310,
    city: 'Manchester',
    inCoreEpl20List: true,
  },
  {
    id: 'newcastle',
    displayName: 'Newcastle United',
    shortName: 'Newcastle',
    tla: 'NEW',
    primaryColor: '#161618',
    secondaryColor: '#FFFFFF',
    trimColor: '#41B6E6',
    pattern: 'stripes',
    awayPrimary: '#E2F1EA',
    awaySecondary: '#165442',
    awayPattern: 'hoops',
    nickname: 'The Magpies',
    stadium: "St. James' Park",
    capacity: 52305,
    city: 'Newcastle',
    inCoreEpl20List: true,
  },
  {
    id: 'nottm-forest',
    displayName: 'Nottingham Forest',
    shortName: 'Nottm Forest',
    tla: 'NFO',
    primaryColor: '#DD0000',
    secondaryColor: '#FFFFFF',
    trimColor: '#FFFFFF',
    pattern: 'solid',
    awayPrimary: '#0F172A',
    awaySecondary: '#38BDF8',
    awayPattern: 'sash',
    nickname: 'Tricky Trees',
    stadium: 'City Ground',
    capacity: 30404,
    city: 'Nottingham',
    inCoreEpl20List: true,
  },
  {
    id: 'sunderland',
    displayName: 'Sunderland',
    shortName: 'Sunderland',
    tla: 'SUN',
    primaryColor: '#EB172B',
    secondaryColor: '#FFFFFF',
    trimColor: '#111111',
    pattern: 'stripes',
    awayPrimary: '#0F172A',
    awaySecondary: '#38BDF8',
    awayPattern: 'raglan',
    nickname: 'The Black Cats',
    stadium: 'Stadium of Light',
    capacity: 49000,
    city: 'Sunderland',
    inCoreEpl20List: true,
  },
  {
    id: 'tottenham',
    displayName: 'Tottenham Hotspur',
    shortName: 'Tottenham',
    tla: 'TOT',
    primaryColor: '#F8FAFC',
    secondaryColor: '#132257',
    trimColor: '#132257',
    pattern: 'raglan',
    awayPrimary: '#132257',
    awaySecondary: '#73C2FB',
    awayPattern: 'pinstripe',
    nickname: 'Spurs',
    stadium: 'Tottenham Hotspur Stadium',
    capacity: 62850,
    city: 'London',
    inCoreEpl20List: true,
  },
  {
    id: 'west-ham',
    displayName: 'West Ham United',
    shortName: 'West Ham',
    tla: 'WHU',
    primaryColor: '#7A263A',
    secondaryColor: '#1BB1E7',
    trimColor: '#F3D459',
    pattern: 'raglan',
    awayPrimary: '#F8FAFC',
    awaySecondary: '#7A263A',
    awayPattern: 'hoops',
    nickname: 'The Hammers',
    stadium: 'London Stadium',
    capacity: 62500,
    city: 'London',
    inCoreEpl20List: true,
  },
  {
    id: 'wolves',
    displayName: 'Wolverhampton Wanderers',
    shortName: 'Wolves',
    tla: 'WOL',
    primaryColor: '#FDB913',
    secondaryColor: '#231F20',
    trimColor: '#231F20',
    pattern: 'solid',
    awayPrimary: '#1E242B',
    awaySecondary: '#FDB913',
    awayPattern: 'sash',
    nickname: 'Wolves',
    stadium: 'Molineux Stadium',
    capacity: 31750,
    city: 'Wolverhampton',
    inCoreEpl20List: true,
  },
  // Additional 2026–27 promoted/live-synced Premier League clubs in ESPN feed
  {
    id: 'coventry',
    displayName: 'Coventry City',
    shortName: 'Coventry',
    tla: 'COV',
    primaryColor: '#59BBE8',
    secondaryColor: '#FFFFFF',
    trimColor: '#0E2448',
    pattern: 'stripes',
    awayPrimary: '#111827',
    awaySecondary: '#59BBE8',
    awayPattern: 'sash',
    nickname: 'The Sky Blues',
    stadium: 'Coventry Building Society Arena',
    capacity: 32609,
    city: 'Coventry',
    inCoreEpl20List: false,
  },
  {
    id: 'hull-city',
    displayName: 'Hull City',
    shortName: 'Hull City',
    tla: 'HUL',
    primaryColor: '#F59E0B',
    secondaryColor: '#111827',
    trimColor: '#FFFFFF',
    pattern: 'stripes',
    awayPrimary: '#1E293B',
    awaySecondary: '#F59E0B',
    awayPattern: 'sash',
    nickname: 'The Tigers',
    stadium: 'MKM Stadium',
    capacity: 25400,
    city: 'Hull',
    inCoreEpl20List: false,
  },
  {
    id: 'ipswich',
    displayName: 'Ipswich Town',
    shortName: 'Ipswich',
    tla: 'IPS',
    primaryColor: '#0044A9',
    secondaryColor: '#FFFFFF',
    trimColor: '#DE2C37',
    pattern: 'pinstripe',
    awayPrimary: '#141E28',
    awaySecondary: '#FFFFFF',
    awayPattern: 'solid',
    nickname: 'Tractor Boys',
    stadium: 'Portman Road',
    capacity: 29673,
    city: 'Ipswich',
    inCoreEpl20List: false,
  },
];

export const CLUB_CONFIG_MAP: Record<string, ClubConfig> = Object.fromEntries(
  RAW_CLUBS.map((entry) => [
    entry.id,
    {
      ...entry,
      textColor: getContrastTextColor(entry.primaryColor),
      secondaryTextColor: getContrastTextColor(entry.secondaryColor),
    },
  ]),
);

const CLUB_ID_ALIASES: Record<string, string> = {
  'afc-bournemouth': 'bournemouth',
  'brighton-and-hove-albion': 'brighton',
  'leeds-united': 'leeds',
  'manchester-city': 'man-city',
  'manchester-united': 'man-united',
  'newcastle-united': 'newcastle',
  'nottingham-forest': 'nottm-forest',
  'tottenham-hotspur': 'tottenham',
  'west-ham-united': 'west-ham',
  wolverhampton: 'wolves',
  'wolverhampton-wanderers': 'wolves',
};

export const CORE_EPL_20_CLUBS: ClubConfig[] = RAW_CLUBS.filter((c) => c.inCoreEpl20List).map(
  (c) => CLUB_CONFIG_MAP[c.id],
);

export const ALL_REGISTERED_CLUBS: ClubConfig[] = RAW_CLUBS.map((c) => CLUB_CONFIG_MAP[c.id]);

export function getClubConfig(teamId?: string | null): ClubConfig | null {
  if (!teamId) return null;
  const normalized = teamId.trim().toLowerCase();
  const canonicalId = CLUB_ID_ALIASES[normalized] || normalized;
  return CLUB_CONFIG_MAP[canonicalId] || null;
}
