import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Compass, Flame, Play, ShieldHalf, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppPreferences } from '../../lib/quality';
import type { FixtureItem } from '../../types/tactical';
import {
  ClubKitBadge,
  SoccerBallEmblem,
  TacticalPitchBackdrop,
  resolveMatchupKitPair,
} from '../common/FootballMotifs';

interface MatchdayShelf3DProps {
  fixtures: FixtureItem[];
}

type ShelfCategory = 'ALL' | 'LIVE_NEXT' | 'TITLE_RACE' | 'HIGH_XG' | 'UPSET_WATCH';

const TABS: Array<{ id: ShelfCategory; label: string }> = [
  { id: 'ALL', label: 'All Matchups' },
  { id: 'LIVE_NEXT', label: 'Live / Next' },
  { id: 'TITLE_RACE', label: 'Title Race' },
  { id: 'HIGH_XG', label: 'Goal Threat' },
  { id: 'UPSET_WATCH', label: 'Close Calls' },
];

const TOP_SIX = new Set(['arsenal', 'liverpool', 'man-city', 'chelsea', 'aston-villa', 'tottenham', 'newcastle']);

const INK_BLOBS = [
  { cx: 150, cy: 330, delay: 0 },
  { cx: 340, cy: 600, delay: 110 },
  { cx: 250, cy: 120, delay: 200 },
  { cx: 90, cy: 760, delay: 280 },
  { cx: 400, cy: 250, delay: 340 },
  { cx: 260, cy: 860, delay: 400 },
  { cx: 230, cy: 470, delay: 160 },
];

function smoothstep(x: number): number {
  const clamped = Math.max(0, Math.min(1, x));
  return clamped * clamped * (3 - 2 * clamped);
}

// Continuous smooth spacing B(r) for sliding open cover without jumps
function stepB(r: number): number {
  if (Math.abs(r) >= 1) return r > 0 ? 0.5 : -0.5;
  return (r + Math.sin(Math.PI * r) / Math.PI) / 2;
}

function getCategoryOfFixture(fx: FixtureItem): ShelfCategory {
  if (fx.status === 'LIVE') return 'LIVE_NEXT';
  if (TOP_SIX.has(fx.home_team_id) && TOP_SIX.has(fx.away_team_id)) return 'TITLE_RACE';
  const totalXg = (fx.home_xg || 0) + (fx.away_xg || 0);
  if (totalXg >= 2.85) return 'HIGH_XG';
  const pDiff = Math.abs((fx.prob_home || 0.33) - (fx.prob_away || 0.33));
  if (pDiff < 0.16) return 'UPSET_WATCH';
  return 'LIVE_NEXT';
}

export const MatchdayShelf3D: React.FC<MatchdayShelf3DProps> = ({ fixtures }) => {
  const navigate = useNavigate();
  const { setSelectedFixtureId, prefersReducedMotion } = useAppPreferences();

  // Select up to 12 diverse matches for the wrapped 3D shelf (3x12 = 36 cuboids)
  const shelfFixtures = useMemo(() => {
    const liveAndScheduled = fixtures.filter((f) => f.status === 'LIVE' || f.status === 'SCHEDULED');
    const source = liveAndScheduled.length >= 8 ? liveAndScheduled : fixtures;
    const base = source.slice(0, 12);
    if (base.length === 0) return [];
    // Guarantee at least 10 items by cycling if seasonal schedule is nearly done
    const padded = [...base];
    while (padded.length < 10) {
      padded.push(base[padded.length % base.length]);
    }
    return padded;
  }, [fixtures]);

  const N = shelfFixtures.length;
  const COPIES = 3;
  const TOTAL_V = N * COPIES;

  const stageSectionRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 80 });

  // Measure actual --H height in pixels
  const [dims, setDims] = useState({ H: 310, ws: 52, d: 164, gap: 10, stageW: 1200 });

  // Motion engine refs (single rAF physics loop)
  const sRef = useRef(N > 0 ? N + Math.min(2, Math.floor(N / 2)) : 0);
  const TRef = useRef(sRef.current);
  const hoverVRef = useRef<number>(-1);
  const liftsRef = useRef<Record<number, number>>({});
  const tiltRef = useRef({ x: 0, y: 0 });
  const pointerRef = useRef({ mx: 0, my: 0, insideCover: false });
  const dragRef = useRef({ active: false, startX: 0, T0: 0, moved: false });
  const wheelSnapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapeRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const playRingRef = useRef<HTMLButtonElement>(null);

  const [activeIdx, setActiveIdx] = useState(N > 0 ? Math.min(2, Math.floor(N / 2)) : 0);
  const [captionDir, setCaptionDir] = useState<1 | -1>(1);
  const prevActiveRef = useRef(activeIdx);

  // Dossier Dialog + WAAPI Expansion + SVG Ink Reveal State
  const [isOpen, setIsOpen] = useState(false);
  const [openedFixture, setOpenedFixture] = useState<FixtureItem | null>(null);
  const [textRevealed, setTextRevealed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inkCirclesRef = useRef<Array<SVGCircleElement | null>>([]);
  const inkRafRef = useRef<number>(0);

  // Keep sRef centered when N initializes
  useEffect(() => {
    if (N > 0 && sRef.current === 0) {
      const startIdx = Math.min(2, N - 1);
      sRef.current = N + startIdx;
      TRef.current = N + startIdx;
      setActiveIdx(startIdx);
    }
  }, [N]);

  // Measure viewport & --H probe
  useEffect(() => {
    const measure = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const H = vw < 768 ? Math.min(vw * 0.56, vh * 0.36) : Math.min(vh * 0.42, vw * 0.28, 360);
      const ws = H * 0.21;
      const d = H * 0.60;
      const gap = H * 0.032;
      const stageW = stageSectionRef.current?.clientWidth || vw;
      setDims({ H, ws, d, gap, stageW });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Update active sliding cobalt/lime tab indicator block
  const activeFixture = shelfFixtures[activeIdx];
  const activeCategory: ShelfCategory = activeFixture ? getCategoryOfFixture(activeFixture) : 'LIVE_NEXT';

  useEffect(() => {
    const btn = tabRefs.current[activeCategory];
    if (btn) {
      setIndicatorStyle({ left: btn.offsetLeft, width: btn.offsetWidth });
    }
  }, [activeCategory, dims.stageW]);

  // Main Single rAF Physics Spring Loop
  useEffect(() => {
    if (N === 0) return;
    let last = performance.now();
    let rafId = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;

      const springK = dragRef.current.active ? 18 : 5.6;
      const factor = prefersReducedMotion ? 1 : 1 - Math.exp(-springK * dt);
      const diff = TRef.current - sRef.current;

      if (Math.abs(diff) < 1e-4) {
        sRef.current = TRef.current;
      } else {
        sRef.current += diff * factor;
      }

      // Normalize beyond +/- loop boundaries so infinite scroll never overflows
      if (sRef.current < N * 0.5) {
        sRef.current += N;
        TRef.current += N;
      } else if (sRef.current > N * 2.5) {
        sRef.current -= N;
        TRef.current -= N;
      }

      const rounded = ((Math.round(sRef.current) % N) + N) % N;
      if (rounded !== prevActiveRef.current) {
        setCaptionDir(TRef.current >= sRef.current ? 1 : -1);
        prevActiveRef.current = rounded;
        setActiveIdx(rounded);
      }

      // Pointer tilt toward cursor
      const stageEl = stageSectionRef.current;
      let targetTiltY = 0;
      let targetTiltX = 0;
      if (stageEl && !isOpen && !prefersReducedMotion) {
        const rect = stageEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = pointerRef.current.mx - cx;
        const dy = pointerRef.current.my - cy;
        const onCover =
          Math.abs(dx) < dims.d * 0.58 &&
          Math.abs(dy) < dims.H * 0.55 &&
          Math.abs(TRef.current - sRef.current) < 0.3;
        pointerRef.current.insideCover = onCover;
        if (onCover) {
          targetTiltY = (dx / (dims.d * 0.58)) * 9;
          targetTiltX = -(dy / (dims.H * 0.55)) * 6;
        } else {
          targetTiltY = (dx / Math.max(1, rect.width)) * 5;
          targetTiltX = 0;
        }
      }
      const tiltLerp = prefersReducedMotion ? 1 : 1 - Math.exp(-7 * dt);
      tiltRef.current.x += (targetTiltX - tiltRef.current.x) * tiltLerp;
      tiltRef.current.y += (targetTiltY - tiltRef.current.y) * tiltLerp;

      // Play/Scout ring settle scale
      if (playRingRef.current) {
        const settleScale = isOpen ? 0 : smoothstep(Math.max(0, 1 - Math.abs(TRef.current - sRef.current) * 3));
        playRingRef.current.style.transform = `scale(${settleScale.toFixed(3)})`;
        playRingRef.current.style.pointerEvents = settleScale > 0.7 ? 'auto' : 'none';
      }

      // Position & rotate all 3*N 3D cuboid tapes
      const liftLerp = prefersReducedMotion ? 1 : 1 - Math.exp(-12 * dt);
      const halfTotal = TOTAL_V / 2;

      for (let v = 0; v < TOTAL_V; v++) {
        const el = tapeRefs.current[v];
        if (!el) continue;

        let r = (v - sRef.current) % TOTAL_V;
        if (r > halfTotal) r -= TOTAL_V;
        if (r < -halfTotal) r += TOTAL_V;

        const x = r * (dims.ws + dims.gap) + (dims.d - dims.ws + 1.6 * dims.gap) * stepB(r);
        if (Math.abs(x) > dims.stageW / 2 + 1.6 * dims.d) {
          el.style.visibility = 'hidden';
          continue;
        }
        el.style.visibility = 'visible';

        const o = smoothstep(Math.max(0, 1 - Math.abs(r)));
        const wantLift = hoverVRef.current === v && Math.abs(r) > 0.5 ? 1 : 0;
        const curLift = (liftsRef.current[v] || 0) + (wantLift - (liftsRef.current[v] || 0)) * liftLerp;
        liftsRef.current[v] = curLift;

        const rotY = -90 * o + tiltRef.current.y * o;
        const rotX = tiltRef.current.x * o;
        const rotZ = -4.2 * o;
        const tz = o * 0.19 * dims.H;
        const ty = -o * 0.025 * dims.H - curLift * 0.045 * dims.H;
        const zIdx = Math.round(100 - Math.abs(r) * 4);

        el.style.zIndex = String(zIdx);
        el.style.transform = `translate3d(${x.toFixed(2)}px, ${ty.toFixed(2)}px, ${tz.toFixed(2)}px) rotateZ(${rotZ.toFixed(2)}deg) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;

        const spineShade = o * 0.55;
        const coverShade = (1 - o) * 0.5;
        const spineFace = el.firstElementChild as HTMLElement | null;
        const coverFace = el.lastElementChild as HTMLElement | null;
        if (spineFace) spineFace.style.setProperty('--shade', spineShade.toFixed(3));
        if (coverFace) coverFace.style.setProperty('--shade', coverShade.toFixed(3));
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [N, TOTAL_V, dims, isOpen, prefersReducedMotion]);

  const openDetail = useCallback(
    (fixture: FixtureItem, virtualIndex?: number) => {
      TRef.current = Math.round(TRef.current);
      setOpenedFixture(fixture);
      setIsOpen(true);
      setTextRevealed(false);

      // Compute active cover screen bounding rect for WAAPI clip-path growth
      const activeV =
        virtualIndex !== undefined
          ? virtualIndex
          : (() => {
              let bestV = 0;
              let bestAbs = 999;
              const halfTotal = TOTAL_V / 2;
              for (let v = 0; v < TOTAL_V; v++) {
                let r = (v - sRef.current) % TOTAL_V;
                if (r > halfTotal) r -= TOTAL_V;
                if (r < -halfTotal) r += TOTAL_V;
                if (Math.abs(r) < bestAbs) {
                  bestAbs = Math.abs(r);
                  bestV = v;
                }
              }
              return bestV;
            })();

      const coverEl = tapeRefs.current[activeV]?.lastElementChild as HTMLElement | null;
      const rect = coverEl?.getBoundingClientRect();
      const sheetEl = dialogRef.current;

      requestAnimationFrame(() => {
        if (!sheetEl) return;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const top = rect ? Math.max(0, rect.top) : vh * 0.25;
        const left = rect ? Math.max(0, rect.left) : vw * 0.4;
        const right = rect ? Math.max(0, vw - rect.right) : vw * 0.4;
        const bottom = rect ? Math.max(0, vh - rect.bottom) : vh * 0.25;

        sheetEl.getAnimations().forEach((a) => a.cancel());
        const duration = prefersReducedMotion ? 1 : 920;
        sheetEl.animate(
          [
            {
              clipPath: `inset(${top}px ${right}px ${bottom}px ${left}px round 6px)`,
              transform: 'rotate(-4.2deg)',
            },
            {
              clipPath: 'inset(0px 0px 0px 0px round 0px)',
              transform: 'rotate(0deg)',
            },
          ],
          {
            duration,
            easing: 'cubic-bezier(.76, 0, .18, 1)',
            fill: 'both',
          },
        );

        setTimeout(() => setTextRevealed(true), prefersReducedMotion ? 0 : 480);

        // SVG Ink-Blot Poster Reveal loop (7 expanding organic displaced circles)
        cancelAnimationFrame(inkRafRef.current);
        if (prefersReducedMotion) {
          inkCirclesRef.current.forEach((c) => c?.setAttribute('r', '760'));
        } else {
          inkCirclesRef.current.forEach((c) => c?.setAttribute('r', '0'));
          const inkStart = performance.now() + 440;
          const runInk = (now: number) => {
            const elapsed = now - inkStart;
            let done = true;
            INK_BLOBS.forEach((b, idx) => {
              const circle = inkCirclesRef.current[idx];
              if (!circle) return;
              const p = Math.max(0, Math.min(1, (elapsed - b.delay) / 1150));
              if (p < 1) done = false;
              const eased = 1 - Math.pow(1 - p, 3);
              circle.setAttribute('r', (eased * 760).toFixed(1));
            });
            if (!done && elapsed < 2500) {
              inkRafRef.current = requestAnimationFrame(runInk);
            }
          };
          inkRafRef.current = requestAnimationFrame(runInk);
        }
      });
    },
    [TOTAL_V, prefersReducedMotion],
  );

  const closeDetail = useCallback(() => {
    const sheetEl = dialogRef.current;
    if (!sheetEl) {
      setIsOpen(false);
      return;
    }
    cancelAnimationFrame(inkRafRef.current);
    const activeV = (() => {
      let bestV = 0;
      let bestAbs = 999;
      const halfTotal = TOTAL_V / 2;
      for (let v = 0; v < TOTAL_V; v++) {
        let r = (v - sRef.current) % TOTAL_V;
        if (r > halfTotal) r -= TOTAL_V;
        if (r < -halfTotal) r += TOTAL_V;
        if (Math.abs(r) < bestAbs) {
          bestAbs = Math.abs(r);
          bestV = v;
        }
      }
      return bestV;
    })();
    const coverEl = tapeRefs.current[activeV]?.lastElementChild as HTMLElement | null;
    const rect = coverEl?.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const top = rect ? Math.max(0, rect.top) : vh * 0.3;
    const left = rect ? Math.max(0, rect.left) : vw * 0.42;
    const right = rect ? Math.max(0, vw - rect.right) : vw * 0.42;
    const bottom = rect ? Math.max(0, vh - rect.bottom) : vh * 0.3;

    const anim = sheetEl.animate(
      [
        {
          clipPath: 'inset(0px 0px 0px 0px round 0px)',
          transform: 'rotate(0deg)',
        },
        {
          clipPath: `inset(${top}px ${right}px ${bottom}px ${left}px round 6px)`,
          transform: 'rotate(-4.2deg)',
        },
      ],
      {
        duration: prefersReducedMotion ? 1 : 720,
        easing: 'cubic-bezier(.76, 0, .18, 1)',
        fill: 'both',
      },
    );
    anim.onfinish = () => {
      sheetEl.getAnimations().forEach((a) => a.cancel());
      setIsOpen(false);
      setTextRevealed(false);
    };
  }, [TOTAL_V, prefersReducedMotion]);

  // Keyboard navigation & Escape close
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isOpen) {
        if (e.key === 'Escape') closeDetail();
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'ArrowRight') {
        TRef.current = Math.round(TRef.current) + 1;
      } else if (e.key === 'ArrowLeft') {
        TRef.current = Math.round(TRef.current) - 1;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, closeDetail]);

  const jumpToCategory = (cat: ShelfCategory) => {
    if (cat === 'ALL') {
      const diff = (0 - (((Math.round(TRef.current) % N) + N) % N) + N) % N;
      const shortest = diff > N / 2 ? diff - N : diff;
      TRef.current = Math.round(TRef.current) + shortest;
      return;
    }
    const targetIdx = shelfFixtures.findIndex((f) => getCategoryOfFixture(f) === cat);
    if (targetIdx === -1) return;
    const curMod = ((Math.round(TRef.current) % N) + N) % N;
    let diff = targetIdx - curMod;
    if (diff > N / 2) diff -= N;
    if (diff < -N / 2) diff += N;
    TRef.current = Math.round(TRef.current) + diff;
  };

  if (N === 0) return null;

  return (
    <section
      ref={stageSectionRef}
      aria-label="3D Matchday Tactical Shelf"
      className="relative rounded-2xl border border-[#34424E] bg-[#141E28] pt-6 pb-8 overflow-hidden shadow-[0_20px_60px_rgba(6,10,16,0.55)]"
    >
      {/* Top Header + Sliding Slate/Mint Tab Bar */}
      <div className="px-4 sm:px-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#63E6A5]">
            3D Tactical Archive Shelf · Spin Spines or Scout Cover
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[#F4F7F5] mt-0.5">
            Matchweek Tactical Slate
          </h2>
        </div>

        {/* Sliding Tab Indicator Navigation */}
        <nav aria-label="Matchday Shelf Categories" className="relative inline-flex flex-wrap sm:flex-nowrap border border-[#34424E] rounded-lg overflow-hidden bg-[#0D131A]">
          <div
            aria-hidden="true"
            className="absolute top-0 bottom-0 bg-[#1B2732] border-b-2 border-[#63E6A5] transition-all duration-[600ms]"
            style={{
              width: indicatorStyle.width,
              transform: `translateX(${indicatorStyle.left}px)`,
              transitionTimingFunction: 'cubic-bezier(.2, .8, .2, 1)',
            }}
          />
          {TABS.map((t) => {
            const isTabActive = t.id !== 'ALL' && activeCategory === t.id;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[t.id] = el;
                }}
                type="button"
                onClick={() => jumpToCategory(t.id)}
                className={`relative z-10 px-3 py-2 text-[11px] font-mono uppercase tracking-wider whitespace-nowrap transition-colors duration-300 border-r last:border-r-0 border-[#34424E] ${
                  isTabActive ? 'text-[#63E6A5] font-bold' : 'text-[#A5B2BD] hover:text-[#F4F7F5]'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 3D Turning-Spine Shelf Stage */}
      <div
        className="shelf-stage relative w-full touch-pan-y select-none"
        style={{ height: dims.H + 66 }}
        onPointerMove={(e) => {
          pointerRef.current.mx = e.clientX;
          pointerRef.current.my = e.clientY;
          if (dragRef.current.active) {
            const dx = e.clientX - dragRef.current.startX;
            if (Math.abs(dx) > 5) dragRef.current.moved = true;
            TRef.current = dragRef.current.T0 - dx / Math.max(20, dims.ws + dims.gap);
          }
        }}
        onPointerDown={(e) => {
          dragRef.current = { active: true, startX: e.clientX, T0: TRef.current, moved: false };
        }}
        onPointerUp={() => {
          if (dragRef.current.active) {
            dragRef.current.active = false;
            TRef.current = Math.round(TRef.current);
          }
        }}
        onPointerLeave={() => {
          hoverVRef.current = -1;
          if (dragRef.current.active) {
            dragRef.current.active = false;
            TRef.current = Math.round(TRef.current);
          }
        }}
        onWheel={(e) => {
          if (isOpen) return;
          const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
          if (Math.abs(delta) < 2) return;
          e.preventDefault();
          TRef.current += (delta / Math.max(20, dims.ws + dims.gap)) * 0.45;
          if (wheelSnapTimerRef.current) clearTimeout(wheelSnapTimerRef.current);
          wheelSnapTimerRef.current = setTimeout(() => {
            TRef.current = Math.round(TRef.current);
          }, 160);
        }}
      >
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            transformStyle: 'preserve-3d',
            ['--ws' as string]: `${dims.ws}px`,
            ['--d' as string]: `${dims.d}px`,
          }}
        >
          {Array.from({ length: TOTAL_V }, (_, v) => {
            const fx = shelfFixtures[v % N];
            const isLive = fx.status === 'LIVE';
            const homePct = fx.prob_home !== null ? `${Math.round(fx.prob_home * 100)}%` : '—';
            const drawPct = fx.prob_draw !== null ? `${Math.round(fx.prob_draw * 100)}%` : '—';
            const awayPct = fx.prob_away !== null ? `${Math.round(fx.prob_away * 100)}%` : '—';

            const kitPair = resolveMatchupKitPair(
              { teamId: fx.home_team_id, primaryColor: fx.home_color, secondaryColor: fx.home_secondary || '#F4F7F5' },
              { teamId: fx.away_team_id, primaryColor: fx.away_color, secondaryColor: fx.away_secondary || '#F4F7F5' },
            );

            return (
              <div
                key={`v-${v}-${fx.id}`}
                ref={(el) => {
                  tapeRefs.current[v] = el;
                }}
                className="shelf-cuboid absolute top-0 left-0 cursor-pointer"
                onPointerEnter={() => {
                  hoverVRef.current = v;
                }}
                onPointerLeave={() => {
                  if (hoverVRef.current === v) hoverVRef.current = -1;
                }}
                onClick={() => {
                  if (dragRef.current.moved) return;
                  let r = (v - sRef.current) % TOTAL_V;
                  if (r > TOTAL_V / 2) r -= TOTAL_V;
                  if (r < -TOTAL_V / 2) r += TOTAL_V;
                  if (Math.abs(r) < 0.5) {
                    openDetail(fx, v);
                  } else {
                    TRef.current = Math.round(TRef.current + r);
                  }
                }}
              >
                {/* SPINE FACE (top half Home team color, bottom half Away/Alt team color) */}
                <div
                  className="shelf-face-spine absolute flex flex-col items-center justify-between py-2.5 px-0 border border-white/25 overflow-hidden"
                  style={{
                    width: dims.ws,
                    height: dims.H,
                    left: -dims.ws / 2,
                    top: -dims.H / 2,
                    transform: `translateZ(${dims.d / 2}px)`,
                    background: `linear-gradient(180deg, ${kitPair.homeKit.primary} 0%, ${kitPair.homeKit.primary} 48%, ${kitPair.awayKit.primary} 52%, ${kitPair.awayKit.primary} 100%)`,
                  }}
                >
                  {/* Top & Bottom Secondary Trim Bands */}
                  <span
                    aria-hidden="true"
                    className="absolute top-0 inset-x-0 h-1.5"
                    style={{ backgroundColor: kitPair.homeKit.secondary }}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 inset-x-0 h-1.5"
                    style={{ backgroundColor: kitPair.awayKit.secondary }}
                  />

                  <span
                    className="relative z-10 mt-1 font-mono text-[9px] font-extrabold tracking-tight"
                    style={{ color: kitPair.homeKit.textColor }}
                  >
                    MW{fx.matchweek}
                  </span>

                  {/* Vertical Fixture TLA Spine Plate for 100% WCAG legibility across any kit colors */}
                  <div className="relative z-10 w-full py-2.5 bg-[#0D131A]/85 border-y border-white/25 flex items-center justify-center shadow-sm">
                    <div
                      className="font-display font-bold text-xs tracking-[0.16em] text-[#F4F7F5] uppercase whitespace-nowrap"
                      style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                    >
                      {fx.home_tla} × {fx.away_tla}
                    </div>
                  </div>

                  <span
                    className="relative z-10 mb-1 font-mono text-[8px] font-extrabold tracking-wider uppercase"
                    style={{ color: kitPair.awayKit.textColor }}
                  >
                    {kitPair.isAwayKit ? 'ALT' : 'H·A'}
                  </span>
                  <div className="shelf-shade-overlay" />
                </div>

                {/* COVER FACE (true diagonal Home vs Away team-colored matchday book cover) */}
                <div
                  className="shelf-face-cover absolute flex flex-col justify-between p-3.5 border overflow-hidden"
                  style={{
                    width: dims.d,
                    height: dims.H,
                    left: -dims.d / 2,
                    top: -dims.H / 2,
                    transform: `rotateY(90deg) translateZ(${dims.ws / 2}px)`,
                    borderColor: `${kitPair.homeAccent}80`,
                    backgroundColor: '#141E28',
                  }}
                >
                  {/* Full-Bleed Home (Left) vs Away (Right) Diagonal Book Cover Artwork */}
                  <svg
                    viewBox="0 0 200 300"
                    preserveAspectRatio="none"
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    aria-hidden="true"
                  >
                    {/* Home Half */}
                    <polygon points="0,0 122,0 78,300 0,300" fill={kitPair.homeKit.primary} />
                    <polygon points="0,0 14,0 14,300 0,300" fill={kitPair.homeKit.secondary} fillOpacity="0.88" />
                    <polygon points="116,0 123,0 79,300 72,300" fill={kitPair.homeKit.secondary} fillOpacity="0.65" />

                    {/* Away Half (uses authentic Away Kit automatically if primaries clash) */}
                    <polygon points="122,0 200,0 200,300 78,300" fill={kitPair.awayKit.primary} />
                    <polygon points="186,0 200,0 200,300 186,300" fill={kitPair.awayKit.secondary} fillOpacity="0.88" />
                    <polygon points="122,0 129,0 85,300 78,300" fill={kitPair.awayKit.secondary} fillOpacity="0.65" />

                    {/* Subtle Fabric Bookbinding Vignette */}
                    <rect x="0" y="0" width="200" height="300" fill={`url(#cover-sheen-${v})`} opacity="0.22" />
                    <defs>
                      <linearGradient id={`cover-sheen-${v}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0D131A" stopOpacity="0.35" />
                        <stop offset="48%" stopColor="#0D131A" stopOpacity="0.05" />
                        <stop offset="100%" stopColor="#0D131A" stopOpacity="0.65" />
                      </linearGradient>
                    </defs>
                  </svg>

                  {/* Subtle Pitch Line Art Backdrop */}
                  <TacticalPitchBackdrop className="absolute inset-0 w-full h-full opacity-25 pointer-events-none mix-blend-screen" />

                  {/* High-Contrast Top Header Strip */}
                  <div className="relative z-10 -mx-3.5 -mt-3.5 px-3 py-2 bg-[#0D131A]/85 backdrop-blur-sm border-b border-white/15 flex items-center justify-between text-[10px] font-mono uppercase tracking-wider">
                    <span className={isLive ? 'text-[#F87171] font-bold' : 'text-[#63E6A5] font-bold'}>
                      {isLive ? `LIVE ${fx.live_clock || ''}` : `MW ${fx.matchweek}`}
                    </span>
                    <span className="flex items-center gap-1.5 text-[#E2E8F0]">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm border border-white/40"
                        style={{ backgroundColor: kitPair.homeKit.primary }}
                        title={`${fx.home_short} Home Color`}
                      />
                      <span className="text-[9px] text-[#A5B2BD]">vs</span>
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm border border-white/40"
                        style={{ backgroundColor: kitPair.awayKit.primary }}
                        title={`${fx.away_short} ${kitPair.isAwayKit ? 'Away Kit' : 'Club Color'}`}
                      />
                    </span>
                  </div>

                  {/* Sculpted Club Kit Duel Art framed for crisp separation against team-colored halves */}
                  <div className="relative z-10 flex items-center justify-center gap-1.5 my-1">
                    <div className="rounded-xl p-1 bg-[#0D131A]/42 backdrop-blur-[2px] border border-white/20 shadow-md">
                      <ClubKitBadge
                        teamId={fx.home_team_id}
                        primaryColor={fx.home_color}
                        secondaryColor={fx.home_secondary || '#F4F7F5'}
                        tla={fx.home_tla}
                        size="md"
                      />
                    </div>
                    <div className="flex flex-col items-center px-1.5 py-1 rounded-lg bg-[#0D131A]/85 border border-white/20 shadow">
                      <SoccerBallEmblem size={18} />
                      <span className="mt-0.5 font-mono text-[10px] text-[#63E6A5] font-bold">
                        {fx.status === 'LIVE' || fx.status === 'FINISHED'
                          ? `${fx.home_goals ?? 0}–${fx.away_goals ?? 0}`
                          : 'VS'}
                      </span>
                    </div>
                    <div className="rounded-xl p-1 bg-[#0D131A]/42 backdrop-blur-[2px] border border-white/20 shadow-md">
                      <ClubKitBadge
                        teamId={fx.away_team_id}
                        primaryColor={fx.away_color}
                        secondaryColor={fx.away_secondary || '#F4F7F5'}
                        tla={fx.away_tla}
                        size="md"
                        isAway={kitPair.isAwayKit}
                      />
                    </div>
                  </div>

                  {/* High-Contrast Footer Matchup Readout */}
                  <div className="relative z-10 bg-[#0D131A]/90 backdrop-blur-md rounded-lg p-2 border border-white/15 shadow-md">
                    <div className="font-editorial text-sm sm:text-base leading-tight text-[#F4F7F5] font-semibold truncate text-center">
                      {fx.home_short} vs {fx.away_short}
                    </div>
                    <div className="mt-1 flex items-center justify-between font-mono text-[10px] font-bold tabular-nums text-[#E2E8F0]">
                      <span style={{ color: kitPair.homeAccent }}>H {homePct}</span>
                      <span className="text-[#A5B2BD] font-normal">D {drawPct}</span>
                      <span style={{ color: kitPair.awayAccent }}>A {awayPct}</span>
                    </div>
                  </div>
                  <div className="shelf-shade-overlay" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Play / Scout Action Ring on Lower-Left Corner of Active Cover */}
        <button
          ref={playRingRef}
          type="button"
          onClick={() => activeFixture && openDetail(activeFixture)}
          aria-label="Open tactical match dossier"
          className="absolute z-30 w-11 h-11 rounded-full bg-[#1B2732]/95 border-2 border-[#63E6A5] text-[#63E6A5] flex items-center justify-center shadow-[0_6px_20px_rgba(99,230,165,0.28)] hover:bg-[#63E6A5] hover:text-[#0D131A] transition-colors"
          style={{
            left: `calc(50% - ${dims.d * 0.52}px - 8px)`,
            top: `calc(50% + ${dims.H * 0.34}px)`,
          }}
        >
          <Play className="w-4 h-4 fill-current translate-x-[1px]" />
        </button>

        {/* Left & Right Carousel Navigation Arrows */}
        <button
          type="button"
          onClick={() => {
            TRef.current = Math.round(TRef.current) - 1;
          }}
          aria-label="Previous matchup"
          className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-[#1B2732]/90 border border-[#34424E] text-[#F4F7F5] hover:border-[#63E6A5] hover:text-[#63E6A5] flex items-center justify-center transition-colors shadow-lg"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            TRef.current = Math.round(TRef.current) + 1;
          }}
          aria-label="Next matchup"
          className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-[#1B2732]/90 border border-[#34424E] text-[#F4F7F5] hover:border-[#63E6A5] hover:text-[#63E6A5] flex items-center justify-center transition-colors shadow-lg"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Masked Line-Swap Caption Below Shelf */}
      {activeFixture && (
        <div
          aria-live="polite"
          className="mt-2 px-4 flex flex-col items-center text-center gap-1.5 pointer-events-none"
        >
          <div className="overflow-hidden h-9 flex items-center justify-center">
            <div
              key={`title-${activeFixture.id}-${activeIdx}`}
              className="font-editorial text-2xl sm:text-3xl text-[#F4F7F5] leading-none"
              style={{
                animation: prefersReducedMotion
                  ? 'none'
                  : `shelf-slide-${captionDir > 0 ? 'up' : 'down'} 580ms cubic-bezier(.2,.8,.2,1) both`,
              }}
            >
              {activeFixture.home_short} vs {activeFixture.away_short}
            </div>
          </div>

          <div className="overflow-hidden h-5 flex items-center justify-center">
            <div
              key={`sub-${activeFixture.id}-${activeIdx}`}
              className="font-mono text-[11px] tracking-[0.12em] uppercase text-[#7DD3FC]"
              style={{
                animation: prefersReducedMotion
                  ? 'none'
                  : `shelf-slide-${captionDir > 0 ? 'up' : 'down'} 580ms cubic-bezier(.2,.8,.2,1) 60ms both`,
              }}
            >
              {activeFixture.venue} ·{' '}
              {activeFixture.home_xg !== null && activeFixture.away_xg !== null
                ? `Python xG ${activeFixture.home_xg.toFixed(2)} – ${activeFixture.away_xg.toFixed(2)}`
                : 'Click active cover to open tactical dossier'}
            </div>
          </div>

          <div className="font-mono text-[11px] text-[#A5B2BD] tabular-nums">
            {activeFixture.status === 'LIVE'
              ? `LIVE NOW · ${activeFixture.live_clock || ''} · ${activeFixture.home_goals ?? 0}–${activeFixture.away_goals ?? 0}`
              : new Date(activeFixture.kickoff_utc).toLocaleString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
          </div>
        </div>
      )}

      {/* Keyframes only for caption mask swap helper (shelf itself uses single rAF physics + WAAPI dossier) */}
      <style>{`
        @keyframes shelf-slide-up {
          from { transform: translateY(108%); }
          to { transform: translateY(0%); }
        }
        @keyframes shelf-slide-down {
          from { transform: translateY(-108%); }
          to { transform: translateY(0%); }
        }
      `}</style>

      {/* FULL-SCREEN TACTICAL DOSSIER SHEET (WAAPI clip-path expansion + SVG Ink-Blot Poster Reveal) */}
      {isOpen && openedFixture && (() => {
        const dossierAccents = resolveMatchupKitPair(
          { teamId: openedFixture.home_team_id, primaryColor: openedFixture.home_color, secondaryColor: openedFixture.home_secondary || '#F4F7F5' },
          { teamId: openedFixture.away_team_id, primaryColor: openedFixture.away_color, secondaryColor: openedFixture.away_secondary || '#F4F7F5' },
        );
        return (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${openedFixture.home_short} vs ${openedFixture.away_short} Tactical Dossier`}
          className="fixed inset-0 z-[90] bg-[#0D131A] text-[#F4F7F5] overflow-y-auto px-5 sm:px-10 lg:px-16 py-8"
        >
          {/* Top Bar */}
          <div className="max-w-6xl mx-auto flex items-center justify-between pb-6 border-b border-[#34424E]">
            <button
              type="button"
              onClick={closeDetail}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#34424E] bg-[#1B2732] text-xs font-mono uppercase tracking-wider text-[#F4F7F5] hover:border-[#63E6A5] hover:text-[#63E6A5]"
            >
              <X className="w-3.5 h-3.5" />
              Close Dossier
            </button>

            <div className="text-center">
              <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[#63E6A5]">
                EPL Tactical Dossier
              </div>
              <div className="font-display text-sm font-bold text-[#F4F7F5]">
                Matchweek {openedFixture.matchweek} · 2026–27
              </div>
            </div>

            <div className="font-mono text-[11px] text-[#A5B2BD] hidden sm:block">
              {openedFixture.xg_mode === 'goals_based_fallback' ? 'Goals-Based Model' : 'xG Blended Model'}
            </div>
          </div>

          {/* 2-Column Editorial Dossier Body */}
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 py-8 items-center">
            {/* Left Column: Staggered Masked Line Rises */}
            <div className="lg:col-span-6 flex flex-col gap-5">
              {[
                <div key="l1" className="font-mono text-xs uppercase tracking-[0.14em] text-[#7DD3FC]">
                  {openedFixture.venue} · {openedFixture.status}
                  {openedFixture.live_clock ? ` (${openedFixture.live_clock})` : ''}
                </div>,
                <div key="l2" className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <ClubKitBadge
                      teamId={openedFixture.home_team_id}
                      primaryColor={openedFixture.home_color}
                      secondaryColor={openedFixture.home_secondary || '#F4F7F5'}
                      tla={openedFixture.home_tla}
                      size="md"
                    />
                    <span className="font-mono text-xs uppercase tracking-widest text-[#63E6A5] font-bold">
                      {openedFixture.status === 'FINISHED' || openedFixture.status === 'LIVE'
                        ? `${openedFixture.home_goals ?? 0} : ${openedFixture.away_goals ?? 0}`
                        : 'VS'}
                    </span>
                    <ClubKitBadge
                      teamId={openedFixture.away_team_id}
                      primaryColor={openedFixture.away_color}
                      secondaryColor={openedFixture.away_secondary || '#F4F7F5'}
                      tla={openedFixture.away_tla}
                      size="md"
                      isAway={dossierAccents.isAwayKit}
                    />
                  </div>
                  <h2 className="font-editorial text-4xl sm:text-5xl lg:text-6xl text-[#F4F7F5] leading-[1.02]">
                    {openedFixture.home_name} <span className="text-[#63E6A5] italic">vs</span>{' '}
                    {openedFixture.away_name}
                  </h2>
                </div>,
                <div key="l3" className="font-mono text-xs text-[#A5B2BD] tabular-nums">
                  MODEL OUTPUT ·{' '}
                  {openedFixture.home_xg !== null && openedFixture.away_xg !== null
                    ? `EXPECTED GOALS ${openedFixture.home_xg.toFixed(2)} – ${openedFixture.away_xg.toFixed(2)}`
                    : 'PROBABILISTIC DISTRIBUTION'}
                </div>,
                <div
                  key="l4"
                  className="grid grid-cols-3 gap-3 rounded-xl bg-[#1B2732] border border-[#34424E] p-4 tabular-nums"
                >
                  <div>
                    <div className="text-[11px] text-[#A5B2BD]">{openedFixture.home_short} Win</div>
                    <div className="font-mono text-2xl font-bold" style={{ color: dossierAccents.homeAccent }}>
                      {openedFixture.prob_home !== null ? `${Math.round(openedFixture.prob_home * 100)}%` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#A5B2BD]">Draw</div>
                    <div className="font-mono text-2xl font-bold text-[#F4F7F5]">
                      {openedFixture.prob_draw !== null ? `${Math.round(openedFixture.prob_draw * 100)}%` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#A5B2BD]">{openedFixture.away_short} Win</div>
                    <div className="font-mono text-2xl font-bold" style={{ color: dossierAccents.awayAccent }}>
                      {openedFixture.prob_away !== null ? `${Math.round(openedFixture.prob_away * 100)}%` : '—'}
                    </div>
                  </div>
                </div>,
                <p key="l5" className="font-editorial text-lg text-[#A5B2BD] leading-relaxed max-w-xl">
                  All probabilities are computed by our walk-forward Python Poisson + Dixon–Coles model (not a guaranteed outcome).
                  {openedFixture.top_scorelines && openedFixture.top_scorelines.length > 0
                    ? ` Top projected scorelines: ${openedFixture.top_scorelines
                        .slice(0, 2)
                        .map((s) => `${s.home}–${s.away} (${(s.probability * 100).toFixed(1)}%)`)
                        .join(' · ')}.`
                    : ''}
                </p>,
                <div key="l6" className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFixtureId(openedFixture.id);
                      closeDetail();
                      navigate(`/match-center/${openedFixture.id}`);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#63E6A5] text-[#0D131A] text-xs font-bold uppercase tracking-wider hover:opacity-90"
                  >
                    <Compass className="w-4 h-4" />
                    Open Full Match Center
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFixtureId(openedFixture.id);
                      closeDetail();
                      navigate(`/match-flow?fixture=${openedFixture.id}`);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-[#1B2732] border border-[#7DD3FC]/35 text-[#F4F7F5] text-xs font-semibold hover:border-[#7DD3FC]"
                  >
                    <Flame className="w-4 h-4 text-[#63E6A5]" />
                    90-Min Match Flow
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closeDetail();
                      navigate(`/manager-clash?home=${openedFixture.home_team_id}&away=${openedFixture.away_team_id}`);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-[#1B2732] border border-[#34424E] text-[#A5B2BD] text-xs font-semibold hover:text-[#F4F7F5] hover:border-[#F87171]/50"
                  >
                    <ShieldHalf className="w-4 h-4 text-[#F87171]" />
                    Manager Clash
                  </button>
                </div>,
              ].map((lineEl, idx) => (
                <div key={idx} className="overflow-hidden">
                  <div
                    className="transition-transform duration-[850ms]"
                    style={{
                      transform: textRevealed ? 'translateY(0)' : 'translateY(110%)',
                      transitionTimingFunction: 'cubic-bezier(.2, .8, .2, 1)',
                      transitionDelay: `${idx * 75}ms`,
                    }}
                  >
                    {lineEl}
                  </div>
                </div>
              ))}
            </div>

            {/* Right Column: SVG Ink/Chalk-Blot Displaced Tactical Match Poster */}
            <div className="lg:col-span-6 flex justify-center">
              <div className="w-full max-w-[440px] aspect-[474/680] relative rounded-2xl overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,0.65)] border border-[#63E6A5]/30 bg-[#0D131A]">
                <svg
                  viewBox="0 0 474 900"
                  className="w-full h-full"
                  aria-hidden="true"
                >
                  <defs>
                    <filter id="dossier-ink-turb" x="-30%" y="-30%" width="160%" height="160%">
                      <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="3" seed="7" result="noise" />
                      <feDisplacementMap in="SourceGraphic" in2="noise" scale="120" xChannelSelector="R" yChannelSelector="G" />
                    </filter>
                    <mask id="dossier-ink-mask" maskUnits="userSpaceOnUse" x="-200" y="-200" width="874" height="1300">
                      <g filter="url(#dossier-ink-turb)" fill="#FFFFFF">
                        {INK_BLOBS.map((b, idx) => (
                          <circle
                            key={idx}
                            ref={(el) => {
                              inkCirclesRef.current[idx] = el;
                            }}
                            cx={b.cx}
                            cy={b.cy}
                            r="0"
                          />
                        ))}
                      </g>
                    </mask>
                    <linearGradient id="poster-bg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={dossierAccents.awayKit.primary} stopOpacity="0.34" />
                      <stop offset="50%" stopColor="#141E28" stopOpacity="1" />
                      <stop offset="100%" stopColor={dossierAccents.homeKit.primary} stopOpacity="0.36" />
                    </linearGradient>
                  </defs>

                  <g mask="url(#dossier-ink-mask)">
                    <rect x="0" y="0" width="474" height="900" fill="#0D131A" />
                    <rect x="0" y="0" width="474" height="900" fill="url(#poster-bg)" />

                    {/* Pitch Vertical Chalk Lines */}
                    <rect x="34" y="34" width="406" height="832" rx="12" fill="none" stroke="rgba(99,230,165,0.42)" strokeWidth="2.5" />
                    <line x1="34" y1="450" x2="440" y2="450" stroke="rgba(99,230,165,0.38)" strokeWidth="2" />
                    <circle cx="237" cy="450" r="68" fill="none" stroke="rgba(99,230,165,0.42)" strokeWidth="2" />
                    <rect x="122" y="34" width="230" height="106" fill="none" stroke="rgba(99,230,165,0.38)" strokeWidth="2" />
                    <rect x="122" y="760" width="230" height="106" fill="none" stroke="rgba(99,230,165,0.38)" strokeWidth="2" />

                    {/* Header Badge */}
                    <text x="237" y="102" textAnchor="middle" fill="#63E6A5" fontSize="15" fontFamily="JetBrains Mono, monospace" letterSpacing="4">
                      2026–27 MATCHDAY DOSSIER
                    </text>

                    {/* Top Club Emblem (Away) */}
                    <circle cx="237" cy="245" r="76" fill={dossierAccents.awayAccent} fillOpacity="0.22" stroke={dossierAccents.awayAccent} strokeWidth="3" />
                    <text x="237" y="255" textAnchor="middle" fill="#FFFFFF" fontSize="42" fontWeight="800" fontFamily="Outfit, sans-serif">
                      {openedFixture.away_tla}
                    </text>
                    <text x="237" y="294" textAnchor="middle" fill={dossierAccents.awayAccent} fontSize="14" fontFamily="JetBrains Mono, monospace">
                      AWAY · {openedFixture.away_xg !== null ? `${openedFixture.away_xg.toFixed(2)} xG` : ''}
                    </text>

                    {/* Center Clash */}
                    <text x="237" y="458" textAnchor="middle" fill="#63E6A5" fontSize="22" fontWeight="700" fontFamily="JetBrains Mono, monospace">
                      {openedFixture.status === 'FINISHED' || openedFixture.status === 'LIVE'
                        ? `${openedFixture.home_goals ?? 0} : ${openedFixture.away_goals ?? 0}`
                        : 'VS'}
                    </text>

                    {/* Bottom Club Emblem (Home) */}
                    <circle cx="237" cy="655" r="76" fill={dossierAccents.homeAccent} fillOpacity="0.22" stroke={dossierAccents.homeAccent} strokeWidth="3" />
                    <text x="237" y="665" textAnchor="middle" fill="#FFFFFF" fontSize="42" fontWeight="800" fontFamily="Outfit, sans-serif">
                      {openedFixture.home_tla}
                    </text>
                    <text x="237" y="704" textAnchor="middle" fill={dossierAccents.homeAccent} fontSize="14" fontFamily="JetBrains Mono, monospace">
                      HOME · {openedFixture.home_xg !== null ? `${openedFixture.home_xg.toFixed(2)} xG` : ''}
                    </text>

                    {/* Footer */}
                    <text x="237" y="818" textAnchor="middle" fill="#A5B2BD" fontSize="13" fontFamily="JetBrains Mono, monospace">
                      PYTHON POISSON + DIXON–COLES GRID
                    </text>
                  </g>
                </svg>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </section>
  );
};
