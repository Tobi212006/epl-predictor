import React from 'react';

export type KitPattern = 'solid' | 'raglan' | 'stripes' | 'hoops' | 'sash' | 'pinstripe';

export interface AuthenticKitSpec {
  primary: string;
  secondary: string;
  trim: string;
  pattern: KitPattern;
  awayPrimary: string;
  awaySecondary: string;
  awayPattern: KitPattern;
}

export const CLUB_KIT_SPECS: Record<string, AuthenticKitSpec> = {
  arsenal: {
    primary: '#EF0107',
    secondary: '#FFFFFF',
    trim: '#063672',
    pattern: 'raglan',
    awayPrimary: '#1A1C22',
    awaySecondary: '#63E6A5',
    awayPattern: 'pinstripe',
  },
  liverpool: {
    primary: '#C8102E',
    secondary: '#FFFFFF',
    trim: '#F6EB61',
    pattern: 'pinstripe',
    awayPrimary: '#15221E',
    awaySecondary: '#7DD3FC',
    awayPattern: 'raglan',
  },
  'man-city': {
    primary: '#6CABDD',
    secondary: '#1C2C5B',
    trim: '#FFFFFF',
    pattern: 'solid',
    awayPrimary: '#6C1D45',
    awaySecondary: '#F6EB61',
    awayPattern: 'sash',
  },
  chelsea: {
    primary: '#034694',
    secondary: '#FFFFFF',
    trim: '#DBA111',
    pattern: 'solid',
    awayPrimary: '#F7E7D5',
    awaySecondary: '#034694',
    awayPattern: 'sash',
  },
  'aston-villa': {
    primary: '#670E36',
    secondary: '#95BFE5',
    trim: '#FEE505',
    pattern: 'raglan',
    awayPrimary: '#F3F4F6',
    awaySecondary: '#670E36',
    awayPattern: 'raglan',
  },
  newcastle: {
    primary: '#161618',
    secondary: '#FFFFFF',
    trim: '#41B6E6',
    pattern: 'stripes',
    awayPrimary: '#E2F1EA',
    awaySecondary: '#165442',
    awayPattern: 'hoops',
  },
  tottenham: {
    primary: '#F8FAFC',
    secondary: '#132257',
    trim: '#132257',
    pattern: 'raglan',
    awayPrimary: '#132257',
    awaySecondary: '#73C2FB',
    awayPattern: 'pinstripe',
  },
  brighton: {
    primary: '#0057B8',
    secondary: '#FFFFFF',
    trim: '#FFCD00',
    pattern: 'stripes',
    awayPrimary: '#F59E0B',
    awaySecondary: '#111827',
    awayPattern: 'hoops',
  },
  'nottm-forest': {
    primary: '#DD0000',
    secondary: '#FFFFFF',
    trim: '#FFFFFF',
    pattern: 'solid',
    awayPrimary: '#0F172A',
    awaySecondary: '#38BDF8',
    awayPattern: 'sash',
  },
  bournemouth: {
    primary: '#DA291C',
    secondary: '#111111',
    trim: '#E6C27A',
    pattern: 'stripes',
    awayPrimary: '#F8FAFC',
    awaySecondary: '#DA291C',
    awayPattern: 'sash',
  },
  fulham: {
    primary: '#F8FAFC',
    secondary: '#111111',
    trim: '#CC0000',
    pattern: 'sash',
    awayPrimary: '#1B2732',
    awaySecondary: '#F87171',
    awayPattern: 'hoops',
  },
  brentford: {
    primary: '#E30613',
    secondary: '#FFFFFF',
    trim: '#111111',
    pattern: 'stripes',
    awayPrimary: '#1E293B',
    awaySecondary: '#FBBF24',
    awayPattern: 'raglan',
  },
  'man-united': {
    primary: '#DA291C',
    secondary: '#FBE122',
    trim: '#111111',
    pattern: 'solid',
    awayPrimary: '#1B2A4A',
    awaySecondary: '#E2E8F0',
    awayPattern: 'pinstripe',
  },
  'crystal-palace': {
    primary: '#1B458F',
    secondary: '#C4122E',
    trim: '#FFFFFF',
    pattern: 'stripes',
    awayPrimary: '#F8FAFC',
    awaySecondary: '#1B458F',
    awayPattern: 'sash',
  },
  everton: {
    primary: '#003399',
    secondary: '#FFFFFF',
    trim: '#FFFFFF',
    pattern: 'solid',
    awayPrimary: '#1F2937',
    awaySecondary: '#FBBF24',
    awayPattern: 'hoops',
  },
  leeds: {
    primary: '#F8FAFC',
    secondary: '#1D428A',
    trim: '#FFCD00',
    pattern: 'solid',
    awayPrimary: '#1D428A',
    awaySecondary: '#FFCD00',
    awayPattern: 'sash',
  },
  sunderland: {
    primary: '#EB172B',
    secondary: '#FFFFFF',
    trim: '#111111',
    pattern: 'stripes',
    awayPrimary: '#0F172A',
    awaySecondary: '#38BDF8',
    awayPattern: 'raglan',
  },
  'hull-city': {
    primary: '#F59E0B',
    secondary: '#111827',
    trim: '#FFFFFF',
    pattern: 'stripes',
    awayPrimary: '#1E293B',
    awaySecondary: '#F59E0B',
    awayPattern: 'sash',
  },
  ipswich: {
    primary: '#0044A9',
    secondary: '#FFFFFF',
    trim: '#DE2C37',
    pattern: 'pinstripe',
    awayPrimary: '#141E28',
    awaySecondary: '#FFFFFF',
    awayPattern: 'solid',
  },
  coventry: {
    primary: '#59BBE8',
    secondary: '#FFFFFF',
    trim: '#0E2448',
    pattern: 'stripes',
    awayPrimary: '#111827',
    awaySecondary: '#59BBE8',
    awayPattern: 'sash',
  },
};

export interface ClubIdentityMeta {
  nickname: string;
  stadium: string;
  capacity: number;
  city: string;
}

export const CLUB_IDENTITY_META: Record<string, ClubIdentityMeta> = {
  arsenal: { nickname: 'The Gunners', stadium: 'Emirates Stadium', capacity: 60704, city: 'London' },
  'aston-villa': { nickname: 'The Villans', stadium: 'Villa Park', capacity: 42657, city: 'Birmingham' },
  bournemouth: { nickname: 'The Cherries', stadium: 'Vitality Stadium', capacity: 11307, city: 'Bournemouth' },
  brentford: { nickname: 'The Bees', stadium: 'Gtech Community Stadium', capacity: 17250, city: 'London' },
  brighton: { nickname: 'The Seagulls', stadium: 'Amex Stadium', capacity: 31800, city: 'Brighton' },
  chelsea: { nickname: 'The Blues', stadium: 'Stamford Bridge', capacity: 40341, city: 'London' },
  coventry: { nickname: 'The Sky Blues', stadium: 'Coventry Building Society Arena', capacity: 32609, city: 'Coventry' },
  'crystal-palace': { nickname: 'The Eagles', stadium: 'Selhurst Park', capacity: 25486, city: 'London' },
  everton: { nickname: 'The Toffees', stadium: 'Hill Dickinson Stadium', capacity: 52769, city: 'Liverpool' },
  fulham: { nickname: 'The Cottagers', stadium: 'Craven Cottage', capacity: 24500, city: 'London' },
  'hull-city': { nickname: 'The Tigers', stadium: 'MKM Stadium', capacity: 25400, city: 'Hull' },
  ipswich: { nickname: 'Tractor Boys', stadium: 'Portman Road', capacity: 29673, city: 'Ipswich' },
  leeds: { nickname: 'The Whites', stadium: 'Elland Road', capacity: 37642, city: 'Leeds' },
  liverpool: { nickname: 'The Reds', stadium: 'Anfield', capacity: 61276, city: 'Liverpool' },
  'man-city': { nickname: 'The Citizens', stadium: 'Etihad Stadium', capacity: 53400, city: 'Manchester' },
  'man-united': { nickname: 'The Red Devils', stadium: 'Old Trafford', capacity: 74310, city: 'Manchester' },
  newcastle: { nickname: 'The Magpies', stadium: "St. James' Park", capacity: 52305, city: 'Newcastle' },
  'nottm-forest': { nickname: 'Tricky Trees', stadium: 'City Ground', capacity: 30404, city: 'Nottingham' },
  sunderland: { nickname: 'The Black Cats', stadium: 'Stadium of Light', capacity: 49000, city: 'Sunderland' },
  tottenham: { nickname: 'Spurs', stadium: 'Tottenham Hotspur Stadium', capacity: 62850, city: 'London' },
};

function parseHexRgb(hex: string): [number, number, number] {
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

export function liftHexLuminance(hex: string, minLuminance = 0.28): string {
  if (getRelativeLuminance(hex) >= minLuminance) return hex;
  const [r, g, b] = parseHexRgb(hex);
  for (let step = 1; step <= 16; step += 1) {
    const t = step / 16;
    const nr = Math.round(r + (244 - r) * t);
    const ng = Math.round(g + (247 - g) * t);
    const nb = Math.round(b + (245 - b) * t);
    const cand = `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`.toUpperCase();
    if (getRelativeLuminance(cand) >= minLuminance) {
      return cand;
    }
  }
  return '#E2E8F0';
}

export function areKitColorsClose(hexA: string, hexB: string): boolean {
  const [r1, g1, b1] = parseHexRgb(hexA);
  const [r2, g2, b2] = parseHexRgb(hexB);
  const dist = Math.hypot(r1 - r2, g1 - g2, b1 - b2);
  return dist < 95;
}

function getContrastText(hex: string): string {
  const [r, g, b] = parseHexRgb(hex);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.64 ? '#0D131A' : '#FFFFFF';
}

export function resolveClubKitColors(
  teamId: string | undefined,
  fallbackPrimary: string,
  fallbackSecondary = '#FFFFFF',
  isAway = false,
): { primary: string; secondary: string; trim: string; pattern: KitPattern } {
  const spec = teamId ? CLUB_KIT_SPECS[teamId] : undefined;
  if (!spec) {
    return {
      primary: fallbackPrimary,
      secondary: fallbackSecondary,
      trim: fallbackSecondary,
      pattern: isAway ? 'sash' : 'solid',
    };
  }
  if (isAway) {
    return {
      primary: spec.awayPrimary,
      secondary: spec.awaySecondary,
      trim: spec.primary,
      pattern: spec.awayPattern,
    };
  }
  return {
    primary: spec.primary,
    secondary: spec.secondary,
    trim: spec.trim,
    pattern: spec.pattern,
  };
}

/**
 * Resolves a high-contrast club accent hex safe for dark Charcoal/Slate UI
 * bars, pitch node strokes, and SVG/Recharts overlays (never invisible on #0D131A).
 */
export function resolveVisibleUiAccent(
  teamId: string | undefined,
  fallbackPrimary: string,
  fallbackSecondary = '#FFFFFF',
  isAway = false,
  minLuminance = 0.24,
): string {
  const kit = resolveClubKitColors(teamId, fallbackPrimary, fallbackSecondary, isAway);
  const candidates = [kit.primary, kit.trim, kit.secondary];
  for (const cand of candidates) {
    if (getRelativeLuminance(cand) >= minLuminance) {
      return cand;
    }
  }
  return liftHexLuminance(kit.primary, minLuminance);
}

/**
 * Resolves contrasting Home & Away UI accents for shared charts, dual pitches,
 * and comparison bars so both clubs are bright on dark surfaces and clearly distinct.
 */
export function resolveMatchupUiAccents(
  home: { teamId?: string; primaryColor: string; secondaryColor?: string },
  away: { teamId?: string; primaryColor: string; secondaryColor?: string },
): { homeAccent: string; awayAccent: string; isAwayKit: boolean } {
  const isAwayKit = areKitColorsClose(home.primaryColor, away.primaryColor);
  const awayKit = resolveClubKitColors(
    away.teamId,
    away.primaryColor,
    away.secondaryColor || '#FFFFFF',
    isAwayKit,
  );

  const homeAccent = resolveVisibleUiAccent(
    home.teamId,
    home.primaryColor,
    home.secondaryColor || '#FFFFFF',
    false,
  );

  const awayCandidates = [
    awayKit.primary,
    awayKit.secondary,
    awayKit.trim,
    '#F87171',
    '#7DD3FC',
  ];
  let awayAccent = '';
  for (const cand of awayCandidates) {
    if (getRelativeLuminance(cand) >= 0.24 && !areKitColorsClose(homeAccent, cand)) {
      awayAccent = cand;
      break;
    }
  }
  if (!awayAccent) {
    const lifted = liftHexLuminance(awayKit.primary, 0.26);
    awayAccent = areKitColorsClose(homeAccent, lifted)
      ? areKitColorsClose(homeAccent, '#F87171')
        ? '#7DD3FC'
        : '#F87171'
      : lifted;
  }

  return { homeAccent, awayAccent, isAwayKit };
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHexRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getClubUiTheme(
  teamId: string | undefined,
  fallbackPrimary = '#63E6A5',
  fallbackSecondary = '#FFFFFF',
): {
  accent: string;
  glowSoft: string;
  glowMedium: string;
  meta: ClubIdentityMeta | null;
} {
  const accent = resolveVisibleUiAccent(teamId, fallbackPrimary, fallbackSecondary, false, 0.24);
  return {
    accent,
    glowSoft: hexToRgba(accent, 0.14),
    glowMedium: hexToRgba(accent, 0.28),
    meta: teamId ? CLUB_IDENTITY_META[teamId] || null : null,
  };
}

interface ClubKitBadgeProps {
  teamId?: string;
  primaryColor: string;
  secondaryColor?: string;
  tla: string;
  shirtNumber?: number | string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: KitPattern;
  isAway?: boolean;
  className?: string;
}

const SIZE_MAP = {
  xs: { w: 28, h: 30 },
  sm: { w: 42, h: 46 },
  md: { w: 58, h: 64 },
  lg: { w: 86, h: 96 },
  xl: { w: 116, h: 128 },
};

export const ClubKitBadge: React.FC<ClubKitBadgeProps> = ({
  teamId,
  primaryColor,
  secondaryColor = '#F4F7F5',
  tla,
  shirtNumber,
  size = 'md',
  variant,
  isAway = false,
  className = '',
}) => {
  const dims = SIZE_MAP[size];
  const uid = React.useId().replace(/:/g, '');
  const resolved = resolveClubKitColors(teamId, primaryColor, secondaryColor, isAway);
  const kitPrimary = resolved.primary;
  const kitSecondary = resolved.secondary;
  const kitTrim = resolved.trim;
  const kitPattern = variant || resolved.pattern;
  const textCol = getContrastText(kitPrimary);

  return (
    <svg
      width={dims.w}
      height={dims.h}
      viewBox="0 0 110 122"
      className={`shrink-0 drop-shadow-[0_8px_18px_rgba(8,14,20,0.62)] ${className}`}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={`kit-clip-${uid}`}>
          <path d="M 35 12 C 44 17 66 17 75 12 L 103 28 L 93 54 L 80 49 L 80 112 L 30 112 L 30 49 L 17 54 L 7 28 Z" />
        </clipPath>
        <linearGradient id={`kit-fabric-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22" />
          <stop offset="46%" stopColor="#FFFFFF" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.32" />
        </linearGradient>
        <linearGradient id={`kit-fold-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.22" />
          <stop offset="18%" stopColor="#FFFFFF" stopOpacity="0.08" />
          <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.02" />
          <stop offset="82%" stopColor="#000000" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.24" />
        </linearGradient>
      </defs>

      <g clipPath={`url(#kit-clip-${uid})`}>
        <rect x="0" y="0" width="110" height="122" fill={kitPrimary} />

        {kitPattern === 'raglan' && (
          <g fill={kitSecondary}>
            <polygon points="0,12 37,12 31,56 0,56" />
            <polygon points="73,12 110,12 110,56 79,56" />
          </g>
        )}

        {kitPattern === 'stripes' && (
          <g fill={kitSecondary}>
            <rect x="33" y="10" width="8.5" height="106" />
            <rect x="50.75" y="10" width="8.5" height="106" />
            <rect x="68.5" y="10" width="8.5" height="106" />
          </g>
        )}

        {kitPattern === 'sash' && (
          <polygon points="22,12 42,12 88,112 68,112" fill={kitSecondary} fillOpacity="0.88" />
        )}

        {kitPattern === 'hoops' && (
          <g fill={kitSecondary} fillOpacity="0.85">
            <rect x="24" y="42" width="62" height="12" />
            <rect x="24" y="72" width="62" height="9" />
          </g>
        )}

        {kitPattern === 'pinstripe' && (
          <g stroke={kitSecondary} strokeWidth="1.4" strokeOpacity="0.55">
            <line x1="36" y1="12" x2="36" y2="112" />
            <line x1="45" y1="12" x2="45" y2="112" />
            <line x1="55" y1="12" x2="55" y2="112" />
            <line x1="65" y1="12" x2="65" y2="112" />
            <line x1="74" y1="12" x2="74" y2="112" />
          </g>
        )}

        <rect x="29" y="49" width="4" height="64" fill={kitTrim} fillOpacity="0.55" />
        <rect x="77" y="49" width="4" height="64" fill={kitTrim} fillOpacity="0.55" />

        <polygon points="7,28 17,54 22,52 12,26" fill={kitTrim} />
        <polygon points="103,28 93,54 88,52 98,26" fill={kitTrim} />

        <path d="M 35 12 Q 55 24 75 12 L 71 17 Q 55 29 39 17 Z" fill={kitTrim} />
        <path d="M 39 11 Q 55 21 71 11 L 67 11 Q 55 18 43 11 Z" fill="#0D131A" fillOpacity="0.6" />

        {/* Original minimalist woven chest shield + stitched shoulder trim */}
        <path
          d="M 65 32 L 74 32 L 74 40 C 74 44 69.5 47 69.5 47 C 69.5 47 65 44 65 40 Z"
          fill={kitSecondary}
          stroke={kitTrim}
          strokeWidth="1.2"
        />
        <circle cx="69.5" cy="38.5" r="2.2" fill={kitPrimary} />

        {/* Subtle shoulder seam detail */}
        <line x1="15" y1="32" x2="26" y2="39" stroke={kitTrim} strokeWidth="1.4" strokeOpacity="0.7" />

        <rect
          x="36"
          y="55"
          width="38"
          height="24"
          rx="5"
          fill={kitPattern === 'stripes' || kitPattern === 'hoops' || kitPattern === 'sash' ? kitPrimary : 'transparent'}
          fillOpacity={kitPattern === 'stripes' || kitPattern === 'hoops' || kitPattern === 'sash' ? '0.88' : '0'}
        />

        <rect x="0" y="0" width="110" height="122" fill={`url(#kit-fold-${uid})`} />
        <rect x="0" y="0" width="110" height="122" fill={`url(#kit-fabric-${uid})`} />
      </g>

      <path
        d="M 35 12 C 44 17 66 17 75 12 L 103 28 L 93 54 L 80 49 L 80 112 L 30 112 L 30 49 L 17 54 L 7 28 Z"
        fill="none"
        stroke="rgba(255,255,255,0.34)"
        strokeWidth="1.8"
      />
      <path d="M 35 12 L 30 49 M 75 12 L 80 49" stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="2 2" />

      <text
        x="55"
        y={shirtNumber ? '75' : '73'}
        textAnchor="middle"
        fill={textCol}
        fontSize={shirtNumber ? '27' : '16'}
        fontWeight="800"
        fontFamily="JetBrains Mono, monospace"
        letterSpacing="0.04em"
        style={{ paintOrder: 'stroke', stroke: textCol === '#FFFFFF' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.35)', strokeWidth: '2.5px' }}
      >
        {shirtNumber ?? tla}
      </text>
    </svg>
  );
};

export const SoccerBallEmblem: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    className={className}
    aria-hidden="true"
  >
    <defs>
      <radialGradient id="ball-grad-pitch" cx="35%" cy="30%" r="68%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="62%" stopColor="#DCE6EC" />
        <stop offset="100%" stopColor="#6E8294" />
      </radialGradient>
    </defs>
    <circle cx="32" cy="32" r="29" fill="url(#ball-grad-pitch)" stroke="#1B2732" strokeWidth="2.5" />
    <polygon points="32,20 42,27 38,39 26,39 22,27" fill="#1B2732" />
    <path
      d="M 32 20 L 32 4 M 42 27 L 57 20 M 38 39 L 49 55 M 26 39 L 15 55 M 22 27 L 7 20"
      stroke="#1B2732"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
    <polygon points="32,4 23,11 41,11" fill="#63E6A5" />
    <polygon points="57,20 55,32 60,29" fill="#7DD3FC" />
    <polygon points="7,20 9,32 4,29" fill="#34424E" />
  </svg>
);

export const PitchlineCrestMark: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    className={className}
    aria-hidden="true"
  >
    <rect x="3" y="3" width="42" height="42" rx="10" fill="#1B2732" stroke="#63E6A5" strokeWidth="2" />
    <rect x="9" y="11" width="30" height="26" rx="3" fill="none" stroke="#34424E" strokeWidth="1.6" />
    <line x1="24" y1="11" x2="24" y2="37" stroke="#34424E" strokeWidth="1.6" />
    <circle cx="24" cy="24" r="5.5" fill="none" stroke="#7DD3FC" strokeWidth="1.6" />
    <path d="M 14 29 L 22 21 L 34 18" fill="none" stroke="#63E6A5" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="14" cy="29" r="2.6" fill="#7DD3FC" />
    <circle cx="22" cy="21" r="2.6" fill="#63E6A5" />
    <circle cx="34" cy="18" r="2.8" fill="#F4F7F5" />
  </svg>
);

export const TacticalPitchBackdrop: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 420 280"
    className={className}
    fill="none"
    aria-hidden="true"
  >
    <rect x="12" y="12" width="396" height="256" rx="10" stroke="rgba(125,211,252,0.24)" strokeWidth="1.5" />
    <line x1="210" y1="12" x2="210" y2="268" stroke="rgba(125,211,252,0.22)" strokeWidth="1.5" />
    <circle cx="210" cy="140" r="42" stroke="rgba(99,230,165,0.3)" strokeWidth="1.5" />
    <circle cx="210" cy="140" r="3.5" fill="#63E6A5" />
    <rect x="12" y="72" width="66" height="136" stroke="rgba(125,211,252,0.22)" strokeWidth="1.5" />
    <rect x="342" y="72" width="66" height="136" stroke="rgba(125,211,252,0.22)" strokeWidth="1.5" />
    <path d="M 88 92 Q 165 44 252 110 T 346 135" stroke="#63E6A5" strokeWidth="1.8" strokeDasharray="5 4" strokeOpacity="0.65" />
    <circle cx="88" cy="92" r="5" fill="#7DD3FC" />
    <circle cx="212" cy="84" r="5" fill="#63E6A5" />
    <circle cx="346" cy="135" r="5" fill="#F87171" />
  </svg>
);

export const PremCrownLionMark: React.FC<{
  size?: number;
  accentColor?: string;
  className?: string;
}> = ({ size = 24, accentColor = '#63E6A5', className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    className={`shrink-0 ${className}`}
    aria-hidden="true"
  >
    <rect x="3" y="3" width="42" height="42" rx="11" fill="#141E28" stroke={accentColor} strokeWidth="2.2" />
    {/* Crown Peaks */}
    <path
      d="M15 16 L18 10 L24 14 L30 10 L33 16 Z"
      fill={accentColor}
    />
    {/* Stylized Geometric Lion Head Silhouette */}
    <path
      d="M15 18 H33 L36 25 L32 34 L24 38 L16 34 L12 25 Z"
      fill="#F4F7F5"
      fillOpacity="0.92"
    />
    <path
      d="M18 22 L21 24 L24 21 L27 24 L30 22 L29 29 L24 33 L19 29 Z"
      fill="#141E28"
    />
    <circle cx="21.5" cy="24.5" r="1.3" fill={accentColor} />
    <circle cx="26.5" cy="24.5" r="1.3" fill={accentColor} />
  </svg>
);

export const PremChevronBackdrop: React.FC<{
  leftColor?: string;
  rightColor?: string;
  className?: string;
}> = ({ leftColor = '#63E6A5', rightColor = '#7DD3FC', className = '' }) => (
  <svg
    viewBox="0 0 600 120"
    preserveAspectRatio="none"
    className={className}
    aria-hidden="true"
  >
    <g opacity="0.16">
      <polygon points="0,0 56,0 26,120 -30,120" fill={leftColor} />
      <polygon points="74,0 102,0 72,120 44,120" fill={leftColor} />
      <polygon points="498,0 526,0 556,120 528,120" fill={rightColor} />
      <polygon points="544,0 600,0 630,120 574,120" fill={rightColor} />
    </g>
  </svg>
);

