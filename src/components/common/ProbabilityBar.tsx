import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import type { PredictionData } from '../../types/tactical';
import { useAppPreferences } from '../../lib/quality';
import { AnimatedNumber } from './AnimatedNumber';
import { areKitColorsClose, liftHexLuminance } from './FootballMotifs';

interface ProbabilityBarProps {
  homeName: string;
  awayName: string;
  homeColor?: string;
  awayColor?: string;
  prediction: PredictionData;
  showExplainability?: boolean;
  lastUpdated?: string | null;
}

export const ProbabilityBar: React.FC<ProbabilityBarProps> = ({
  homeName,
  awayName,
  homeColor = '#7DD3FC',
  awayColor = '#F87171',
  prediction,
  showExplainability = true,
  lastUpdated,
}) => {
  const { prefersReducedMotion } = useAppPreferences();
  const [explainOpen, setExplainOpen] = useState(false);
  const safeHome = liftHexLuminance(homeColor, 0.25);
  const candAway = liftHexLuminance(awayColor, 0.25);
  const safeAway = areKitColorsClose(safeHome, candAway)
    ? areKitColorsClose(safeHome, '#F87171')
      ? '#7DD3FC'
      : '#F87171'
    : candAway;

  const pH = Math.round(prediction.prob_home * 1000) / 10;
  const pD = Math.round(prediction.prob_draw * 1000) / 10;
  const pA = Math.max(0, Math.round((100 - pH - pD) * 10) / 10);

  const transition = prefersReducedMotion
    ? { duration: 0.01 }
    : { duration: 0.65, ease: [0.16, 1, 0.3, 1] as const };

  const formattedUpdated = lastUpdated
    ? new Date(lastUpdated).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="rounded-xl floodlit-card p-5">
      {/* Header metadata */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#A5B2BD] tabular-nums">
        <span>
          Model {prediction.version_tag || 'v1.2-poisson-dc'} ·{' '}
          {prediction.xg_mode === 'xg_blended' ? 'xG + Goals Blended' : 'Goals-Based Fallback (xG Absent)'}
          {formattedUpdated ? ` · Updated ${formattedUpdated}` : ''}
        </span>
        <span>
          Confidence:{' '}
          <strong
            className={
              prediction.confidence_label === 'high'
                ? 'text-[#63E6A5]'
                : prediction.confidence_label === 'medium'
                ? 'text-[#FBBF24]'
                : 'text-[#F87171]'
            }
          >
            {prediction.confidence_label}
          </strong>
          {' '}· Min sample: {prediction.uncertainty.min_sample_size} matches
        </span>
      </div>

      {/* Team xG Projection */}
      <div className="mt-4 grid grid-cols-3 items-end gap-4 tabular-nums">
        <div>
          <div className="text-xs font-semibold truncate" style={{ color: safeHome }}>
            {homeName} (Home)
          </div>
          <div className="font-display text-2xl sm:text-3xl font-bold text-[#F4F7F5] mt-0.5">
            <AnimatedNumber value={prediction.home_xg} decimals={2} />{' '}
            <span className="text-xs font-normal text-[#A5B2BD]">xG</span>
          </div>
          <div className="text-[11px] text-[#A5B2BD]">
            Range {prediction.uncertainty.home_xg_interval[0].toFixed(2)}–{prediction.uncertainty.home_xg_interval[1].toFixed(2)}
          </div>
        </div>

        <div className="text-center pb-1">
          <div className="text-[11px] text-[#A5B2BD]">Over / Under 2.5</div>
          <div className="font-mono text-sm font-semibold text-[#F4F7F5] mt-0.5">
            <AnimatedNumber value={Math.round(prediction.over_2_5_prob * 100)} suffix="%" /> /{' '}
            <AnimatedNumber value={Math.round(prediction.under_2_5_prob * 100)} suffix="%" />
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs font-semibold truncate" style={{ color: safeAway }}>
            {awayName} (Away)
          </div>
          <div className="font-display text-2xl sm:text-3xl font-bold text-[#F4F7F5] mt-0.5">
            <AnimatedNumber value={prediction.away_xg} decimals={2} />{' '}
            <span className="text-xs font-normal text-[#A5B2BD]">xG</span>
          </div>
          <div className="text-[11px] text-[#A5B2BD]">
            Range {prediction.uncertainty.away_xg_interval[0].toFixed(2)}–{prediction.uncertainty.away_xg_interval[1].toFixed(2)}
          </div>
        </div>
      </div>

      {/* 100% Stacked 1X2 Probability Bar */}
      <div className="mt-5">
        <div className="flex flex-wrap justify-between gap-2 text-xs font-semibold mb-1.5 tabular-nums">
          <span style={{ color: safeHome }}>
            {homeName} Win <AnimatedNumber value={pH} decimals={1} suffix="%" />
          </span>
          <span className="text-[#A5B2BD]">
            Draw <AnimatedNumber value={pD} decimals={1} suffix="%" />
          </span>
          <span style={{ color: safeAway }}>
            {awayName} Win <AnimatedNumber value={pA} decimals={1} suffix="%" />
          </span>
        </div>

        <div
          className="h-3.5 w-full rounded-md overflow-hidden flex bg-[#0D131A] border border-[#34424E]"
          role="img"
          aria-label={`Win probabilities: ${homeName} ${pH}%, Draw ${pD}%, ${awayName} ${pA}%`}
        >
          <motion.div
            initial={prefersReducedMotion ? false : { width: 0 }}
            animate={{ width: `${pH}%` }}
            transition={transition}
            className="h-full"
            style={{ backgroundColor: safeHome }}
          />
          <motion.div
            initial={prefersReducedMotion ? false : { width: 0 }}
            animate={{ width: `${pD}%` }}
            transition={transition}
            className="h-full bg-[#64748B]"
          />
          <motion.div
            initial={prefersReducedMotion ? false : { width: 0 }}
            animate={{ width: `${pA}%` }}
            transition={transition}
            className="h-full"
            style={{ backgroundColor: safeAway }}
          />
        </div>
      </div>

      {/* Top Scorelines + Explainability Trigger */}
      <div className="mt-5 pt-4 border-t border-[#34424E] flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-xs tabular-nums">
          <span className="text-[#A5B2BD]">Most likely scorelines:</span>
          {prediction.top_scorelines.slice(0, 4).map((sc, idx) => (
            <div key={`${sc.home}-${sc.away}`} className="flex items-baseline gap-1.5">
              <span className={`font-mono text-sm font-semibold ${idx < 2 ? 'text-[#63E6A5]' : 'text-[#F4F7F5]'}`}>
                {sc.home}–{sc.away}
              </span>
              <span className="text-[#A5B2BD]">({(sc.probability * 100).toFixed(1)}%)</span>
            </div>
          ))}
        </div>

        {showExplainability && (
          <button
            type="button"
            onClick={() => setExplainOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7DD3FC] hover:text-[#63E6A5] transition-colors whitespace-nowrap shrink-0 min-h-[36px]"
          >
            Why this prediction?
            {explainOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {showExplainability && explainOpen && (
        <div className="mt-4 pt-4 border-t border-[#34424E] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {prediction.feature_contributions.map((fc) => (
            <div key={fc.key} className="rounded-lg bg-[#141E28] border border-[#34424E] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-[#F4F7F5]">{fc.label}</span>
                <span
                  className="font-mono font-semibold tabular-nums"
                  style={{
                    color:
                      fc.direction === 'home'
                        ? safeHome
                        : fc.direction === 'away'
                        ? safeAway
                        : '#A5B2BD',
                  }}
                >
                  {fc.key === 'xg_mode' ? (fc.value > 0 ? 'xG + Goals' : 'Goals only') : `${fc.value >= 0 ? '+' : ''}${fc.value.toFixed(3)}`}
                </span>
              </div>
              <p className="mt-1 text-[#A5B2BD]">{fc.detail}</p>
            </div>
          ))}
        </div>
      )}

      {/* Honest Probabilistic Disclaimer */}
      <div className="mt-4 pt-3 border-t border-[#34424E]/70 flex items-start gap-2 text-[11px] text-[#A5B2BD]">
        <Info className="w-3.5 h-3.5 text-[#63E6A5] shrink-0 mt-0.5" />
        <span>
          Probabilistic estimate — statistical projection from team attack/defense rates and recency weighting, not a guaranteed outcome or betting advice.
        </span>
      </div>
    </div>
  );
};
