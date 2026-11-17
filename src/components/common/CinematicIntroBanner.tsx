import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, X } from 'lucide-react';
import { useAppPreferences } from '../../lib/quality';

interface CinematicIntroBannerProps {
  onExploreTheatre: () => void;
}

export const CinematicIntroBanner: React.FC<CinematicIntroBannerProps> = ({ onExploreTheatre }) => {
  const { introSeen, dismissIntro, prefersReducedMotion } = useAppPreferences();

  useEffect(() => {
    if (introSeen || prefersReducedMotion) return;
    const timer = setTimeout(() => {
      dismissIntro();
    }, 3200);
    return () => clearTimeout(timer);
  }, [introSeen, prefersReducedMotion, dismissIntro]);

  if (introSeen) return null;

  return (
    <motion.section
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-xl border border-[#63E6A5]/30 bg-[#1B2732] px-6 py-6 mb-6"
      aria-label="Studio introduction"
    >
      {/* Animated pitch line SVG drawing */}
      <svg
        viewBox="0 0 900 180"
        className="absolute inset-0 w-full h-full opacity-25 pointer-events-none"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <motion.rect
          x="16"
          y="16"
          width="868"
          height="148"
          fill="none"
          stroke="#63E6A5"
          strokeWidth="2"
          initial={prefersReducedMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
        />
        <motion.line
          x1="450"
          y1="16"
          x2="450"
          y2="164"
          stroke="#63E6A5"
          strokeWidth="2"
          initial={prefersReducedMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, delay: 0.25 }}
        />
        <motion.circle
          cx="450"
          cy="90"
          r="38"
          fill="none"
          stroke="#7DD3FC"
          strokeWidth="1.5"
          initial={prefersReducedMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, delay: 0.4 }}
        />
      </svg>

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="max-w-2xl">
          <div className="text-xs font-medium text-[#63E6A5]">
            2026–27 English Premier League Studio
          </div>
          <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#F4F7F5] headline-balance">
            Read the game. Model the outcome.
          </h2>
          <p className="mt-1.5 text-sm text-[#A5B2BD]">
            Python-computed Poisson distributions, dated manager tactical systems, and 3D phase-morphing formations.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              dismissIntro();
              onExploreTheatre();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#63E6A5] text-[#0D131A] text-xs font-semibold hover:opacity-90 whitespace-nowrap shrink-0 min-h-[40px]"
          >
            Open Tactical Lab
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={dismissIntro}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-[#141E28] border border-[#34424E] text-xs text-[#A5B2BD] hover:text-[#F4F7F5] whitespace-nowrap shrink-0 min-h-[40px]"
          >
            <X className="w-3.5 h-3.5" />
            Skip Intro
          </button>
        </div>
      </div>
    </motion.section>
  );
};
