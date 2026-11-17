import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarDays, Compass, Send, ShieldHalf, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import stadiumSunsetImg from '../../assets/images/epl_stadium_sunset_1794865362280.jpg';
import tunnelFloodlightsImg from '../../assets/images/epl_tunnel_floodlights_1794865362748.jpg';
import pitchNightImg from '../../assets/images/epl_tactical_pitch_night_1794865363159.jpg';
import { useAppPreferences } from '../../lib/quality';
import type { DataStatus, FixtureItem, PredictionData, StandingRow } from '../../types/tactical';
import {
  CLUB_IDENTITY_META,
  ClubKitBadge,
  PremChevronBackdrop,
  SoccerBallEmblem,
  hexToRgba,
  resolveMatchupUiAccents,
} from '../common/FootballMotifs';
import { ParallaxLayer } from '../common/ParallaxLayer';

interface HeroSlide {
  id: string;
  image: string;
  titleLines: string[];
  titleSizeClass: string;
  titlePosStyle: React.CSSProperties;
  bgPosition: string;
  captionTitle: string;
  captionDesc: string;
  thumbLabel: string;
}

const SLIDES: HeroSlide[] = [
  {
    id: 'matchweek',
    image: stadiumSunsetImg,
    titleLines: ['WELCOME TO', 'MATCHWEEK'],
    titleSizeClass: 'text-[clamp(2.4rem,7.8vw,6.8rem)]',
    titlePosStyle: { left: '3.2vw', top: 'clamp(72px, 11vh, 112px)' },
    bgPosition: 'center 58%',
    captionTitle: 'Live Matchday',
    captionDesc:
      'Real-time 2026–27 Premier League fixtures, live clocks, and calibrated Python goal expectations.',
    thumbLabel: 'Stadium',
  },
  {
    id: 'tactics',
    image: tunnelFloodlightsImg,
    titleLines: ['READ THE GAME'],
    titleSizeClass: 'text-[clamp(2.4rem,7.6vw,6.6rem)]',
    titlePosStyle: { left: '3.2vw', top: 'clamp(76px, 12vh, 118px)' },
    bgPosition: 'center 54%',
    captionTitle: 'Manager DNA',
    captionDesc:
      'Trace how every head coach shifts from 4-3-3 buildup into 3-2-5 half-space attacks and pressing traps.',
    thumbLabel: 'Tunnel',
  },
  {
    id: 'outcome',
    image: pitchNightImg,
    titleLines: ['MODEL THE', 'OUTCOME'],
    titleSizeClass: 'text-[clamp(2.6rem,8.4vw,7.4rem)]',
    titlePosStyle: { left: '5.5vw', top: 'clamp(74px, 11.5vh, 116px)' },
    bgPosition: 'center 46%',
    captionTitle: 'Poisson Engine',
    captionDesc:
      'Dixon–Coles low-score adjustments and walk-forward calibration — zero invented probabilities.',
    thumbLabel: 'Pitch',
  },
];

interface CinematicStadiumHeroProps {
  standings: StandingRow[];
  featuredFixture?: FixtureItem;
  dataStatus?: DataStatus;
  onPredictPair: (homeId: string, awayId: string) => void;
  quickPairPrediction?: {
    homeShort: string;
    awayShort: string;
    prediction: PredictionData;
  } | null;
  isPredictingPair?: boolean;
  onScrollToShelf: () => void;
  onToggleDashboard: () => void;
  dashboardOpen: boolean;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export const CinematicStadiumHero: React.FC<CinematicStadiumHeroProps> = ({
  standings,
  featuredFixture,
  dataStatus,
  onPredictPair,
  quickPairPrediction,
  isPredictingPair = false,
  onScrollToShelf,
  onToggleDashboard,
  dashboardOpen,
}) => {
  const navigate = useNavigate();
  const { prefersReducedMotion, selectedTeamId } = useAppPreferences();
  const [activeIdx, setActiveIdx] = useState(0);
  const [prevIdx, setPrevIdx] = useState<number | null>(null);
  const [wipeProgress, setWipeProgress] = useState(1);
  const [introReady, setIntroReady] = useState(false);
  const [captionRevealed, setCaptionRevealed] = useState(false);
  const [viewportW, setViewportW] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1280,
  );

  // Quick Matchup Floating Bar Popovers
  const [activeField, setActiveField] = useState<'home' | 'away' | 'mode' | 'lens'>('home');
  const [openPopover, setOpenPopover] = useState<'mode' | 'lens' | null>(null);
  const [homeId, setHomeId] = useState(featuredFixture?.home_team_id || 'arsenal');
  const [awayId, setAwayId] = useState(featuredFixture?.away_team_id || 'man-city');
  const [analysisLens, setAnalysisLens] = useState<'Full 90 Poisson' | 'Match Flow 0–90' | 'What-If Lab'>('Full 90 Poisson');

  const engineLabel = dataStatus?.xg_available
    ? 'xG Blended (Poisson)'
    : 'Goals Fallback (Poisson)';

  const searchBarRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const prevSlideWrapRef = useRef<HTMLDivElement>(null);
  const activeSlideWrapRef = useRef<HTMLDivElement>(null);
  const activeBgImgRef = useRef<HTMLDivElement>(null);
  const mistWrapRef = useRef<HTMLDivElement>(null);
  const railWrapRef = useRef<HTMLDivElement>(null);
  const wipeRafRef = useRef<number>(0);
  const scrollRafRef = useRef<number>(0);
  const pointerRafRef = useRef<number>(0);
  const activeIdxRef = useRef(0);
  activeIdxRef.current = activeIdx;

  useEffect(() => {
    if (featuredFixture) {
      setHomeId(featuredFixture.home_team_id);
      setAwayId(featuredFixture.away_team_id);
    }
  }, [featuredFixture?.home_team_id, featuredFixture?.away_team_id]);

  // Intro word & ring stagger
  useEffect(() => {
    const t1 = setTimeout(() => setIntroReady(true), prefersReducedMotion ? 10 : 120);
    const t2 = setTimeout(() => setCaptionRevealed(true), prefersReducedMotion ? 10 : 520);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [prefersReducedMotion]);

  // Track viewport width & scroll choreography via coalesced rAF DOM updates (zero React re-renders)
  useEffect(() => {
    const onResize = () => setViewportW(window.innerWidth);
    const applyScrollTransforms = () => {
      scrollRafRef.current = 0;
      const sy = window.scrollY || 0;
      const parallaxBgLag = prefersReducedMotion ? 0 : Math.min(180, sy * 0.36);
      const mistRiseY = prefersReducedMotion ? 0 : -Math.min(140, sy * 0.32);
      const mistScale = prefersReducedMotion ? 1 : 1 + Math.min(0.28, sy / 1600);
      const railOpacity = Math.max(0.05, 1 - sy / 420);
      const railLag = prefersReducedMotion ? 0 : Math.min(80, sy * 0.16);

      if (prevSlideWrapRef.current) {
        prevSlideWrapRef.current.style.transform = `translate3d(0, ${parallaxBgLag}px, 0)`;
      }
      if (activeSlideWrapRef.current) {
        activeSlideWrapRef.current.style.transform = `translate3d(0, ${parallaxBgLag}px, 0)`;
      }
      if (mistWrapRef.current) {
        mistWrapRef.current.style.transform = `translate3d(0, ${mistRiseY}px, 0) scale(${mistScale})`;
      }
      if (railWrapRef.current) {
        railWrapRef.current.style.opacity = String(railOpacity);
        railWrapRef.current.style.transform = `translate3d(0, ${railLag}px, 0)`;
      }
    };
    const onScroll = () => {
      if (!scrollRafRef.current) {
        scrollRafRef.current = requestAnimationFrame(applyScrollTransforms);
      }
    };
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    applyScrollTransforms();
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(scrollRafRef.current);
      cancelAnimationFrame(pointerRafRef.current);
    };
  }, [prefersReducedMotion]);

  // Close popovers on outside click
  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (searchBarRef.current && !searchBarRef.current.contains(e.target as Node)) {
        setOpenPopover(null);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  const triggerSlideSwitch = (nextIndex: number) => {
    const currentIdx = activeIdxRef.current;
    if (nextIndex === currentIdx) return;
    cancelAnimationFrame(wipeRafRef.current);
    if (prefersReducedMotion) {
      setPrevIdx(null);
      setActiveIdx(nextIndex);
      setWipeProgress(1);
      setCaptionRevealed(true);
      return;
    }

    setPrevIdx(currentIdx);
    setActiveIdx(nextIndex);
    setWipeProgress(0);
    setCaptionRevealed(false);

    const start = performance.now();
    const duration = 1250;
    const step = (now: number) => {
      const raw = Math.min(1, (now - start) / duration);
      setWipeProgress(easeInOutCubic(raw));
      if (raw >= 0.52) {
        setCaptionRevealed(true);
      }
      if (raw < 1) {
        wipeRafRef.current = requestAnimationFrame(step);
      } else {
        setPrevIdx(null);
      }
    };
    wipeRafRef.current = requestAnimationFrame(step);
  };

  // Auto-advance every 6.2s without resetting timer on every slide change
  useEffect(() => {
    if (prefersReducedMotion) return;
    const timer = setInterval(() => {
      triggerSlideSwitch((activeIdxRef.current + 1) % SLIDES.length);
    }, 6200);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion]);

  useEffect(() => () => cancelAnimationFrame(wipeRafRef.current), []);

  const clubsList = useMemo(() => {
    if (standings.length > 0) return standings;
    return [
      { team_id: 'arsenal', short_name: 'Arsenal', tla: 'ARS', primary_color: '#EF0107', secondary_color: '#FFFFFF' },
      { team_id: 'man-city', short_name: 'Man City', tla: 'MCI', primary_color: '#6CABDD', secondary_color: '#1C2C5B' },
      { team_id: 'liverpool', short_name: 'Liverpool', tla: 'LIV', primary_color: '#C8102E', secondary_color: '#F6EB61' },
      { team_id: 'chelsea', short_name: 'Chelsea', tla: 'CHE', primary_color: '#034694', secondary_color: '#FFFFFF' },
    ] as StandingRow[];
  }, [standings]);

  const activeClub = clubsList.find((c) => c.team_id === selectedTeamId) || clubsList[0];
  const selectedHomeClub = clubsList.find((c) => c.team_id === homeId) || clubsList[0];
  const selectedAwayClub = clubsList.find((c) => c.team_id === awayId) || clubsList[1] || clubsList[0];

  const heroAccents = useMemo(
    () =>
      resolveMatchupUiAccents(
        {
          teamId: selectedHomeClub?.team_id,
          primaryColor: selectedHomeClub?.primary_color || '#EF0107',
          secondaryColor: selectedHomeClub?.secondary_color || '#FFFFFF',
        },
        {
          teamId: selectedAwayClub?.team_id,
          primaryColor: selectedAwayClub?.primary_color || '#6CABDD',
          secondaryColor: selectedAwayClub?.secondary_color || '#1C2C5B',
        },
      ),
    [selectedHomeClub, selectedAwayClub],
  );
  const homeStadiumMeta = CLUB_IDENTITY_META[homeId];

  // Right-rail ring & thumbnail geometry (lit thumbnail maps cleanly: top=2, mid=1, bottom=0 just like spec!)
  const thumbOrder = [2, 1, 0]; // top slide 3 (idx 2), middle slide 2 (idx 1), bottom slide 1 (idx 0)
  const isCompact = viewportW < 768;
  const activeThumbSize = isCompact ? 76 : Math.min(138, Math.max(94, viewportW * 0.095));
  const inactiveThumbSize = isCompact ? 42 : Math.min(72, Math.max(46, viewportW * 0.048));
  const thumbGap = isCompact ? 8 : Math.max(10, viewportW * 0.009);

  // Compute y-centers of the 3 thumbnails dynamically so active thumbnail smoothly reflows its column
  const thumbRects = useMemo(() => {
    let curY = 0;
    const map: Record<number, { top: number; size: number; centerY: number }> = {};
    for (const sIdx of thumbOrder) {
      const sz = sIdx === activeIdx ? activeThumbSize : inactiveThumbSize;
      map[sIdx] = { top: curY, size: sz, centerY: curY + sz / 2 };
      curY += sz + thumbGap;
    }
    return { map, totalHeight: curY };
  }, [activeIdx, activeThumbSize, inactiveThumbSize, thumbGap]);

  const activeCenterY = thumbRects.map[activeIdx]?.centerY ?? 120;
  const innerRingD = activeThumbSize + (isCompact ? 48 : Math.min(130, viewportW * 0.088));
  const outerRingD = activeThumbSize + (isCompact ? 96 : Math.min(240, viewportW * 0.175));

  const wipeEdgePct = wipeProgress * 135;
  const wipeOpaquePct = Math.max(0, wipeEdgePct - 35);
  const wipeMidPct = Math.max(0, wipeEdgePct - 17.5);
  const isWiping = prevIdx !== null && wipeProgress < 1;
  const mistBandOpacity = isWiping ? Math.sin(Math.PI * wipeProgress) * 0.9 : 0;

  return (
    <section
      ref={heroRef}
      onPointerMove={(e) => {
        if (prefersReducedMotion || isWiping || !heroRef.current || !activeBgImgRef.current) return;
        const clientX = e.clientX;
        const clientY = e.clientY;
        if (!pointerRafRef.current) {
          pointerRafRef.current = requestAnimationFrame(() => {
            pointerRafRef.current = 0;
            if (!heroRef.current || !activeBgImgRef.current) return;
            const rect = heroRef.current.getBoundingClientRect();
            const nx = (clientX - rect.left) / rect.width - 0.5;
            const ny = (clientY - rect.top) / rect.height - 0.5;
            activeBgImgRef.current.style.transform = `scale(1.05) translate3d(${(-nx * 1.2).toFixed(2)}%, ${(-ny * 1.0).toFixed(2)}%, 0)`;
          });
        }
      }}
      className="relative w-full min-h-[600px] sm:min-h-[620px] md:h-[78vh] md:max-h-[840px] overflow-hidden rounded-2xl border border-[#34424E] shadow-[0_24px_80px_rgba(6,10,16,0.68)] select-none"
      aria-label="Premier League matchday showcase"
    >
      {/* Top atmospheric tint behind header/title with Rellax scroll lag */}
      <ParallaxLayer
        speed={0.75}
        maxShift={26}
        className="absolute inset-x-0 top-0 h-[48%] z-20 pointer-events-none"
      >
        <div
          className="w-full h-full"
          style={{
            background:
              'linear-gradient(180deg, rgba(13,19,26,0.72) 0%, rgba(27,39,50,0.28) 48%, transparent 100%)',
          }}
        />
      </ParallaxLayer>

      {/* Outgoing Slide (when misty wipe is running) */}
      {prevIdx !== null && isWiping && (
        <div
          ref={prevSlideWrapRef}
          className="absolute inset-0 z-10 overflow-hidden"
        >
          <div
            className="absolute -inset-[3%] bg-cover"
            style={{
              backgroundImage: `url(${SLIDES[prevIdx].image})`,
              backgroundPosition: SLIDES[prevIdx].bgPosition,
              transform: `scale(${1.04 + wipeProgress * 0.05}) translate3d(${-wipeProgress * 2}%, 0, 0)`,
            }}
          />
          <div className="absolute z-20 pointer-events-none max-w-[66%] sm:max-w-[74%]" style={SLIDES[prevIdx].titlePosStyle}>
            {SLIDES[prevIdx].titleLines.map((line) => (
              <div key={line} className="overflow-hidden">
                <div className={`hero-frosted-title ${SLIDES[prevIdx].titleSizeClass}`}>{line}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active / Incoming Slide with Moving Soft Right-to-Left Gradient Mask */}
      <div
        ref={activeSlideWrapRef}
        className="absolute inset-0 z-20 overflow-hidden"
        style={{
          WebkitMaskImage: isWiping
            ? `linear-gradient(to left, #000 ${wipeOpaquePct}%, rgba(0,0,0,0.6) ${wipeMidPct}%, transparent ${wipeEdgePct}%)`
            : undefined,
          maskImage: isWiping
            ? `linear-gradient(to left, #000 ${wipeOpaquePct}%, rgba(0,0,0,0.6) ${wipeMidPct}%, transparent ${wipeEdgePct}%)`
            : undefined,
        }}
      >
        <div
          ref={activeBgImgRef}
          className="absolute -inset-[3%] bg-cover transition-transform duration-700 ease-out"
          style={{
            backgroundImage: `url(${SLIDES[activeIdx].image})`,
            backgroundPosition: SLIDES[activeIdx].bgPosition,
            transform: isWiping
              ? `scale(${1.12 - wipeProgress * 0.08}) translate3d(${(1 - wipeProgress) * 2}%, 0, 0)`
              : 'scale(1.05)',
          }}
        />

        {/* Giant Frosted Metallic Gradient-Faded Title inside the slide so wipe overlaps words cleanly */}
        <div className="absolute z-20 pointer-events-none max-w-[64%] sm:max-w-[72%]" style={SLIDES[activeIdx].titlePosStyle}>
          {SLIDES[activeIdx].titleLines.map((line, idx) => (
            <div key={`${activeIdx}-${line}`} className="overflow-hidden">
              <div
                className={`hero-frosted-title ${SLIDES[activeIdx].titleSizeClass} transition-transform duration-[1150ms]`}
                style={{
                  transitionTimingFunction: 'cubic-bezier(.16, 1, .3, 1)',
                  transitionDelay: `${idx * 95}ms`,
                  transform: introReady ? 'translateY(0)' : 'translateY(106%)',
                }}
              >
                {line}
              </div>
            </div>
          ))}
          <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] sm:text-xs font-mono uppercase tracking-[0.12em] text-[#63E6A5]">
            <span>2026–27 English Premier League</span>
            {homeStadiumMeta && (
              <>
                <span className="text-white/40 hidden sm:inline">·</span>
                <span style={{ color: heroAccents.homeAccent }} className="font-bold">
                  {homeStadiumMeta.stadium} ({homeStadiumMeta.capacity.toLocaleString()})
                </span>
              </>
            )}
            <span className="text-white/40 hidden sm:inline">·</span>
            <span className="text-[#F4F7F5]/90">
              {featuredFixture
                ? `Next: ${featuredFixture.home_short} vs ${featuredFixture.away_short}`
                : 'Live Matchday Analytics'}
            </span>
          </div>
        </div>
      </div>

      {/* Misty Radial Glow Band Riding Along Wipe Edge */}
      {isWiping && (
        <div
          className="absolute top-[-10%] bottom-[-10%] w-[34vw] z-30 pointer-events-none blur-[12px]"
          style={{
            right: `calc(${wipeEdgePct - 17}% )`,
            opacity: mistBandOpacity,
            background: `radial-gradient(ellipse at center, ${hexToRgba(heroAccents.homeAccent, 0.4)} 0%, ${hexToRgba(heroAccents.awayAccent, 0.24)} 45%, transparent 75%)`,
          }}
        />
      )}

      {/* Broadcast Tunnel Chevron Light Accent */}
      <PremChevronBackdrop
        leftColor={heroAccents.homeAccent}
        rightColor={heroAccents.awayAccent}
        className="absolute inset-x-0 bottom-0 h-[36%] z-20 pointer-events-none opacity-65"
      />

      {/* Drifting Volumetric Stadium Haze Tinted by Matchup Club Colors */}
      <div
        ref={mistWrapRef}
        className="absolute -left-[4%] -right-[4%] -bottom-[8%] h-[62%] z-20 pointer-events-none"
        style={{
          mixBlendMode: 'screen',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.85) 45%, black 100%)',
          maskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.85) 45%, black 100%)',
        }}
      >
        <div
          className="mist-layer-front absolute inset-0 opacity-50"
          style={{
            background: `radial-gradient(ellipse 62% 48% at 24% 72%, ${hexToRgba(heroAccents.homeAccent, 0.28)}, transparent 72%), radial-gradient(ellipse 58% 45% at 76% 68%, ${hexToRgba(heroAccents.awayAccent, 0.26)}, transparent 74%)`,
          }}
        />
        <div
          className="mist-layer-back absolute inset-0 opacity-35"
          style={{
            background:
              'radial-gradient(ellipse 50% 42% at 50% 78%, rgba(99, 230, 165, 0.16), transparent 70%)',
          }}
        />
      </div>

      {/* Smooth Bottom Page Melt into Pitch Charcoal Canvas */}
      <div
        className="absolute inset-x-0 bottom-0 h-[46%] z-20 pointer-events-none"
        style={{
          background:
            'linear-gradient(to bottom, rgba(13,19,26,0) 0%, rgba(20,30,40,0.56) 48%, rgba(13,19,26,0.94) 84%, #0D131A 100%)',
        }}
      />

      {/* Right Rail: Concentric Rings + Round Thumbnails + Connector + Clip-Path Caption */}
      <div
        ref={railWrapRef}
        className="absolute right-[4%] sm:right-[7%] top-[48px] sm:top-[84px] z-30 flex items-start pointer-events-none"
      >
        {/* Left Caption Block (aligned vertically to active thumbnail) */}
        <div
          className="hidden md:flex items-center gap-4 mr-4 transition-all duration-[850ms]"
          style={{
            transform: `translateY(${Math.max(0, activeCenterY - 46)}px)`,
            transitionTimingFunction: 'cubic-bezier(.65, 0, .35, 1)',
          }}
        >
          <div
            className="text-right max-w-[235px] transition-[clip-path] duration-[850ms]"
            style={{
              clipPath: captionRevealed ? 'inset(0 0% 0 0)' : 'inset(0 100% 0 0)',
              transitionTimingFunction: 'cubic-bezier(.16, 1, .3, 1)',
            }}
          >
            <h3 className="font-display text-2xl font-light text-[#F4F7F5] drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
              {SLIDES[activeIdx].captionTitle}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[#E2E8F0]/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)]">
              {SLIDES[activeIdx].captionDesc}
            </p>
          </div>

          {/* Vertical 3px bar */}
          <div
            className="w-[3px] h-[84px] rounded-full bg-gradient-to-b from-[#63E6A5] via-[#F4F7F5] to-[#7DD3FC] origin-top transition-transform duration-500"
            style={{ transform: captionRevealed ? 'scaleY(1)' : 'scaleY(0)' }}
          />

          {/* Horizontal 3px connector line */}
          <div
            className="h-[3px] w-10 rounded-full bg-white/85 origin-right transition-transform duration-500"
            style={{ transform: captionRevealed ? 'scaleX(1)' : 'scaleX(0)' }}
          />
        </div>

        {/* Thumbnails Column + Sliding Concentric Rings */}
        <div
          className="relative pointer-events-auto"
          style={{ width: activeThumbSize, height: thumbRects.totalHeight }}
        >
          {/* Inner & Outer Concentric Rings centered on active thumbnail */}
          <div
            className="absolute rounded-full border border-white/45 pointer-events-none transition-all duration-[900ms]"
            style={{
              width: innerRingD,
              height: innerRingD,
              left: activeThumbSize / 2 - innerRingD / 2,
              top: activeCenterY - innerRingD / 2,
              transitionTimingFunction: 'cubic-bezier(.65, 0, .35, 1)',
            }}
          />
          <div
            className="absolute rounded-full border border-white/25 pointer-events-none transition-all duration-[900ms]"
            style={{
              width: outerRingD,
              height: outerRingD,
              left: activeThumbSize / 2 - outerRingD / 2,
              top: activeCenterY - outerRingD / 2,
              transitionTimingFunction: 'cubic-bezier(.65, 0, .35, 1)',
            }}
          />

          {/* 3 Round Spotlight Thumbnails */}
          {thumbOrder.map((slideIdx, orderIdx) => {
            const rect = thumbRects.map[slideIdx];
            const isActive = slideIdx === activeIdx;
            const slide = SLIDES[slideIdx];
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => triggerSlideSwitch(slideIdx)}
                aria-label={`Show ${slide.captionTitle} slide`}
                className="absolute rounded-full overflow-hidden border-[3px] border-white/90 shadow-[0_10px_28px_rgba(6,10,16,0.55)] hover:scale-[1.07] focus-visible:outline-[#63E6A5]"
                style={{
                  width: rect.size,
                  height: rect.size,
                  top: rect.top,
                  left: (activeThumbSize - rect.size) / 2,
                  boxShadow: isActive
                    ? '0 0 0 8px rgba(99, 230, 165, 0.30), 0 12px 30px rgba(6,10,16,0.65)'
                    : '0 8px 20px rgba(6,10,16,0.45)',
                  transition:
                    'top 900ms cubic-bezier(.65,0,.35,1), left 900ms cubic-bezier(.65,0,.35,1), width 900ms cubic-bezier(.65,0,.35,1), height 900ms cubic-bezier(.65,0,.35,1), transform 350ms cubic-bezier(.16,1,.3,1), box-shadow 500ms ease',
                  transform: introReady ? 'scale(1)' : 'scale(0)',
                  transitionDelay: introReady ? '0ms' : `${260 + orderIdx * 110}ms`,
                }}
              >
                <img
                  src={slide.image}
                  alt={slide.captionTitle}
                  className="w-full h-full object-cover"
                />
                {!isActive && <span className="absolute inset-0 bg-[#0D131A]/40 hover:bg-transparent transition-colors" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating Floodlit Charcoal Search & Instant Predictor Bar */}
      <div
        ref={searchBarRef}
        className="absolute left-1/2 -translate-x-1/2 bottom-5 sm:bottom-8 z-40 w-[min(940px,calc(100%-24px))] transition-all duration-1000"
        style={{
          transform: introReady ? 'translate(-50%, 0)' : 'translate(-50%, 30px)',
          opacity: introReady ? 1 : 0,
        }}
      >
        <div className="rounded-[22px] bg-[#141E28]/92 backdrop-blur-xl text-[#F4F7F5] shadow-[0_24px_64px_rgba(3,8,18,0.72)] border border-[#34424E] px-3 py-2.5 sm:px-4 sm:py-2.5 grid grid-cols-2 md:flex md:flex-row md:items-center gap-2">
          {/* Field 1: Home Club */}
          <div
            onClick={() => setActiveField('home')}
            className={`md:flex-[1.3] rounded-[14px] px-3 py-2 md:px-3.5 md:py-2.5 transition-all cursor-pointer border flex items-center gap-2.5 ${
              activeField === 'home'
                ? 'bg-[#1B2732] border-[#63E6A5]/45 shadow-[0_8px_24px_rgba(6,10,16,0.45)]'
                : 'border-transparent hover:bg-[#1B2732]/65'
            }`}
          >
            {selectedHomeClub && (
              <ClubKitBadge
                teamId={selectedHomeClub.team_id}
                primaryColor={selectedHomeClub.primary_color}
                secondaryColor={selectedHomeClub.secondary_color}
                tla={selectedHomeClub.tla}
                size="xs"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm" style={{ color: heroAccents.homeAccent }}>
                <Compass className="w-3.5 h-3.5 shrink-0" />
                <label htmlFor="hero-home-club" className="cursor-pointer">
                  Home Club
                </label>
              </div>
              <select
                id="hero-home-club"
                value={homeId}
                onChange={(e) => setHomeId(e.target.value)}
                className="mt-0.5 w-full bg-transparent text-xs font-medium text-[#F4F7F5] focus:outline-none cursor-pointer"
              >
                {clubsList.map((c) => (
                  <option key={c.team_id} value={c.team_id} disabled={c.team_id === awayId} className="bg-[#141E28] text-[#F4F7F5]">
                    {c.short_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="hidden md:block w-px h-9 bg-[#34424E]" />

          {/* Field 2: Away Club */}
          <div
            onClick={() => setActiveField('away')}
            className={`md:flex-[1.3] rounded-[14px] px-3 py-2 md:px-3.5 md:py-2.5 transition-all cursor-pointer border flex items-center gap-2.5 ${
              activeField === 'away'
                ? 'bg-[#1B2732] border-[#63E6A5]/45 shadow-[0_8px_24px_rgba(6,10,16,0.45)]'
                : 'border-transparent hover:bg-[#1B2732]/65'
            }`}
          >
            {selectedAwayClub && (
              <ClubKitBadge
                teamId={selectedAwayClub.team_id}
                primaryColor={selectedAwayClub.primary_color}
                secondaryColor={selectedAwayClub.secondary_color}
                tla={selectedAwayClub.tla}
                size="xs"
                isAway={heroAccents.isAwayKit}
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm" style={{ color: heroAccents.awayAccent }}>
                <ShieldHalf className="w-3.5 h-3.5 shrink-0" />
                <label htmlFor="hero-away-club" className="cursor-pointer">
                  Away Club
                </label>
              </div>
              <select
                id="hero-away-club"
                value={awayId}
                onChange={(e) => setAwayId(e.target.value)}
                className="mt-0.5 w-full bg-transparent text-xs font-medium text-[#F4F7F5] focus:outline-none cursor-pointer"
              >
                {clubsList.map((c) => (
                  <option key={c.team_id} value={c.team_id} disabled={c.team_id === homeId} className="bg-[#141E28] text-[#F4F7F5]">
                    {c.short_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="hidden md:block w-px h-9 bg-[#34424E]" />

          {/* Field 3: Analysis Lens Popover */}
          <div className="relative md:flex-1">
            <button
              type="button"
              onClick={() => {
                setActiveField('lens');
                setOpenPopover(openPopover === 'lens' ? null : 'lens');
              }}
              className={`w-full text-left rounded-[14px] px-3 py-2 md:px-3.5 md:py-2.5 transition-all border ${
                activeField === 'lens' || openPopover === 'lens'
                  ? 'bg-[#1B2732] border-[#63E6A5]/45 shadow-[0_8px_24px_rgba(6,10,16,0.45)]'
                  : 'border-transparent hover:bg-[#1B2732]/65'
              }`}
            >
              <div className="flex items-center gap-2 text-[#F4F7F5] font-semibold text-xs sm:text-sm">
                <CalendarDays className="w-4 h-4 text-[#63E6A5] shrink-0" />
                <span>Lens</span>
              </div>
              <div className="mt-0.5 text-xs font-medium text-[#A5B2BD] truncate">{analysisLens}</div>
            </button>

            <AnimatePresence>
              {openPopover === 'lens' && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                  className="absolute bottom-[calc(100%+12px)] left-0 w-56 rounded-2xl bg-[#141E28] p-2 shadow-[0_22px_50px_rgba(3,8,18,0.75)] border border-[#34424E] z-50"
                >
                  <div className="px-2.5 py-1.5 text-[11px] font-semibold text-[#A5B2BD] uppercase tracking-wider">
                    Tactical Workspace
                  </div>
                  {(
                    [
                      { id: 'Full 90 Poisson', hint: 'Compute full-90 outcome here' },
                      { id: 'Match Flow 0–90', hint: 'Open 0–30 / 31–60 / 61–90+ sim' },
                      { id: 'What-If Lab', hint: 'Test squad absences & formations' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setAnalysisLens(opt.id);
                        setOpenPopover(null);
                        if (opt.id === 'Match Flow 0–90') {
                          navigate(featuredFixture ? `/match-flow?fixture=${featuredFixture.id}` : '/match-flow');
                        } else if (opt.id === 'What-If Lab') {
                          navigate(`/what-if?home=${homeId}&away=${awayId}`);
                        }
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors ${
                        analysisLens === opt.id
                          ? 'bg-[#1B2732] text-[#63E6A5] border border-[#63E6A5]/35'
                          : 'text-[#F4F7F5] hover:bg-[#1B2732]/75'
                      }`}
                    >
                      <div className="font-semibold">{opt.id}</div>
                      <div className="text-[10px] text-[#A5B2BD]">
                        {opt.hint}
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="hidden md:block w-px h-9 bg-[#34424E]" />

          {/* Field 4: Real Engine Calibration & Quick Routes Popover */}
          <div className="relative md:flex-1">
            <button
              type="button"
              onClick={() => {
                setActiveField('mode');
                setOpenPopover(openPopover === 'mode' ? null : 'mode');
              }}
              className={`w-full text-left rounded-[14px] px-3 py-2 md:px-3.5 md:py-2.5 transition-all border ${
                activeField === 'mode' || openPopover === 'mode'
                  ? 'bg-[#1B2732] border-[#63E6A5]/45 shadow-[0_8px_24px_rgba(6,10,16,0.45)]'
                  : 'border-transparent hover:bg-[#1B2732]/65'
              }`}
            >
              <div className="flex items-center gap-2 text-[#F4F7F5] font-semibold text-xs sm:text-sm">
                <Users className="w-4 h-4 text-[#7DD3FC] shrink-0" />
                <span>Engine</span>
              </div>
              <div className="mt-0.5 text-xs font-medium text-[#A5B2BD] truncate">{engineLabel}</div>
            </button>

            <AnimatePresence>
              {openPopover === 'mode' && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                  className="absolute bottom-[calc(100%+12px)] right-0 w-72 rounded-2xl bg-[#141E28] p-3.5 shadow-[0_22px_50px_rgba(3,8,18,0.75)] border border-[#34424E] z-50"
                >
                  <div className="text-[11px] font-semibold text-[#A5B2BD] uppercase tracking-wider">
                    Live Calibration Status
                  </div>
                  <div className="mt-1.5 rounded-xl bg-[#1B2732] border border-[#34424E] text-[#F4F7F5] p-2.5 text-xs">
                    <div className="font-semibold text-[#63E6A5]">{engineLabel}</div>
                    <div className="mt-0.5 text-[11px] text-[#A5B2BD]">
                      Feed: {dataStatus?.provider || 'ESPN Live EPL API (eng.1)'}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-[#7DD3FC]">
                      Model: {dataStatus?.model_version?.version_tag || 'v1.2-poisson-dc'}
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenPopover(null);
                        navigate('/match-center');
                      }}
                      className="px-2.5 py-2 rounded-xl bg-[#1B2732] hover:bg-[#233240] border border-[#34424E] text-[#F4F7F5] text-xs font-semibold text-left transition-colors"
                    >
                      Match Center
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenPopover(null);
                        navigate(`/manager-clash?home=${homeId}&away=${awayId}`);
                      }}
                      className="px-2.5 py-2 rounded-xl bg-[#1B2732] hover:bg-[#233240] border border-[#34424E] text-[#F4F7F5] text-xs font-semibold text-left transition-colors"
                    >
                      Manager Clash
                    </button>
                  </div>
                  {activeClub && (
                    <div className="mt-2 pt-2 border-t border-[#34424E] flex items-center gap-2 text-xs text-[#A5B2BD]">
                      <ClubKitBadge
                        teamId={activeClub.team_id}
                        primaryColor={activeClub.primary_color}
                        secondaryColor={activeClub.secondary_color}
                        tla={activeClub.tla}
                        size="xs"
                      />
                      <span>Active Focus: <strong className="text-[#F4F7F5]">{activeClub.short_name}</strong></span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action Buttons: Predict + Open/Close Dashboard */}
          <div className="col-span-2 flex items-center gap-2 shrink-0 justify-between md:justify-end pt-1 md:pt-0 border-t border-[#34424E]/80 md:border-t-0">
            <button
              type="button"
              onClick={onToggleDashboard}
              className="px-3.5 py-2 rounded-[12px] text-xs font-semibold border border-[#34424E] bg-[#1B2732] text-[#F4F7F5] hover:border-[#63E6A5] hover:text-[#63E6A5] whitespace-nowrap transition-colors min-h-[40px]"
            >
              {dashboardOpen ? 'Close Dashboard' : 'Open Dashboard'}
            </button>
            <button
              type="button"
              disabled={homeId === awayId || isPredictingPair}
              onClick={() => {
                onPredictPair(homeId, awayId);
                onScrollToShelf();
              }}
              aria-label="Compute Python prediction"
              title="Run Python Poisson Prediction"
              className="w-11 h-11 rounded-[12px] bg-[#63E6A5] text-[#0D131A] flex items-center justify-center hover:scale-105 disabled:opacity-45 transition-transform duration-200 shadow-lg"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Inline instant prediction confirmation banner */}
        <AnimatePresence>
          {quickPairPrediction && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="mt-2 rounded-xl bg-[#141E28]/95 border border-[#63E6A5]/35 px-4 py-2 text-xs text-[#F4F7F5] flex flex-wrap items-center justify-between gap-3 backdrop-blur-md"
            >
              <div className="flex items-center gap-2 font-medium">
                <SoccerBallEmblem size={18} />
                <span>
                  Probabilistic Estimate (not guaranteed):{' '}
                  <strong style={{ color: heroAccents.homeAccent }}>{quickPairPrediction.homeShort}</strong>{' '}
                  <span className="font-mono text-[#63E6A5]">
                    {quickPairPrediction.prediction.home_xg.toFixed(2)}
                  </span>{' '}
                  –{' '}
                  <span className="font-mono text-[#F4F7F5]">
                    {quickPairPrediction.prediction.away_xg.toFixed(2)}
                  </span>{' '}
                  <strong style={{ color: heroAccents.awayAccent }}>{quickPairPrediction.awayShort}</strong>
                </span>
              </div>
              <div className="flex items-center gap-4 font-mono tabular-nums">
                <span style={{ color: heroAccents.homeAccent }} className="font-bold">
                  Home {(quickPairPrediction.prediction.prob_home * 100).toFixed(0)}%
                </span>
                <span className="text-[#A5B2BD]">
                  Draw {(quickPairPrediction.prediction.prob_draw * 100).toFixed(0)}%
                </span>
                <span style={{ color: heroAccents.awayAccent }} className="font-bold">
                  Away {(quickPairPrediction.prediction.prob_away * 100).toFixed(0)}%
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};
