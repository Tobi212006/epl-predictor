import React, { useMemo } from 'react';
import { BarChart3, FlaskConical, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { areKitColorsClose, liftHexLuminance } from '../common/FootballMotifs';
import type {
  ObservedTeamMatchStats,
  PredictionData,
  TacticalProfile,
} from '../../types/tactical';

interface MatchStatsMomentumPanelProps {
  homeShort: string;
  awayShort: string;
  homeColor?: string;
  awayColor?: string;
  fixtureStatus: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED';
  observedHome?: ObservedTeamMatchStats | null;
  observedAway?: ObservedTeamMatchStats | null;
  homeProfile?: TacticalProfile | null;
  awayProfile?: TacticalProfile | null;
  prediction: PredictionData;
}

export const MatchStatsMomentumPanel: React.FC<MatchStatsMomentumPanelProps> = ({
  homeShort,
  awayShort,
  homeColor = '#7DD3FC',
  awayColor = '#F87171',
  fixtureStatus,
  observedHome,
  observedAway,
  homeProfile,
  awayProfile,
  prediction,
}) => {
  const safeHomeColor = liftHexLuminance(homeColor, 0.28);
  const candidateAway = liftHexLuminance(awayColor, 0.28);
  const safeAwayColor = areKitColorsClose(safeHomeColor, candidateAway)
    ? areKitColorsClose(safeHomeColor, '#F87171')
      ? '#7DD3FC'
      : '#F87171'
    : candidateAway;
  const hasBoxscore = Boolean(
    (observedHome &&
      (observedHome.shots !== null ||
        observedHome.shots_on_target !== null ||
        observedHome.corners !== null ||
        observedHome.possession_pct !== null)) ||
      (observedAway &&
        (observedAway.shots !== null ||
          observedAway.shots_on_target !== null ||
          observedAway.corners !== null ||
          observedAway.possession_pct !== null)),
  );

  const statRows = useMemo(() => {
    if (!hasBoxscore || !observedHome || !observedAway) return [];
    const rows: Array<{
      label: string;
      homeVal: number | null;
      awayVal: number | null;
      suffix?: string;
      decimals?: number;
    }> = [
      {
        label: 'Ball Possession',
        homeVal: observedHome.possession_pct,
        awayVal: observedAway.possession_pct,
        suffix: '%',
        decimals: 1,
      },
      {
        label: 'Total Shots',
        homeVal: observedHome.shots,
        awayVal: observedAway.shots,
      },
      {
        label: 'Shots on Target',
        homeVal: observedHome.shots_on_target,
        awayVal: observedAway.shots_on_target,
      },
      {
        label: 'Corners Won',
        homeVal: observedHome.corners,
        awayVal: observedAway.corners,
      },
    ];
    if (observedHome.xg !== null && observedAway.xg !== null) {
      rows.unshift({
        label: 'Expected Goals (xG)',
        homeVal: observedHome.xg,
        awayVal: observedAway.xg,
        decimals: 2,
      });
    }
    return rows.filter((r) => r.homeVal !== null && r.awayVal !== null);
  }, [hasBoxscore, observedHome, observedAway]);

  // Deterministic illustrative territorial momentum curve grounded in tactical indices & xG share
  const momentumData = useMemo(() => {
    const hPress = homeProfile?.pressing_intensity_idx ?? 0.65;
    const aPress = awayProfile?.pressing_intensity_idx ?? 0.62;
    const hTempo = homeProfile?.tempo_idx ?? 0.66;
    const aTempo = awayProfile?.tempo_idx ?? 0.63;
    const xgEdge = (prediction.home_xg - prediction.away_xg) * 14;
    const possEdge =
      hasBoxscore && observedHome?.possession_pct != null && observedAway?.possession_pct != null
        ? (observedHome.possession_pct - observedAway.possession_pct) * 0.45
        : 0;

    return Array.from({ length: 19 }, (_, idx) => {
      const minute = idx * 5;
      const phaseWave =
        Math.sin(idx * 0.65 + hPress * 3.1) * (16 + hTempo * 10) -
        Math.cos(idx * 0.52 + aPress * 2.7) * (15 + aTempo * 10);
      const lateSwing = minute >= 65 ? (hTempo - aTempo) * 28 : 0;
      const net = Math.max(-55, Math.min(55, Math.round(xgEdge + possEdge + phaseWave + lateSwing)));
      return {
        minute: `${minute}'`,
        homePressure: net > 0 ? net : 0,
        awayPressure: net < 0 ? net : 0,
        net,
      };
    });
  }, [homeProfile, awayProfile, prediction.home_xg, prediction.away_xg, hasBoxscore, observedHome, observedAway]);

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-6" aria-label="Match Statistics and Momentum">
      {/* Left 5 cols: Observed Match Statistics Comparison */}
      <div className="lg:col-span-5 rounded-xl floodlit-card p-5 flex flex-col justify-between gap-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-semibold text-[#F4F7F5] flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#63E6A5]" />
              Match Statistics Comparison
            </h3>
            <span className="font-mono text-[11px] text-[#A5B2BD]">
              {hasBoxscore ? 'Observed Boxscore' : fixtureStatus}
            </span>
          </div>
          <p className="text-xs text-[#A5B2BD] mt-1">
            {hasBoxscore
              ? observedHome?.stats_provenance || 'Verified boxscore totals from connected feed.'
              : 'Detailed shot and possession boxscore totals populate once the match enters play or completes.'}
          </p>
        </div>

        {statRows.length > 0 ? (
          <div className="flex flex-col gap-3.5 text-xs tabular-nums">
            {statRows.map((row) => {
              const h = row.homeVal ?? 0;
              const a = row.awayVal ?? 0;
              const total = h + a;
              const hPct = total > 0 ? (h / total) * 100 : 50;
              const dec = row.decimals ?? 0;
              return (
                <div key={row.label} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-bold" style={{ color: safeHomeColor }}>
                      {h.toFixed(dec)}
                      {row.suffix || ''}
                    </span>
                    <span className="font-sans text-[#A5B2BD]">{row.label}</span>
                    <span className="font-bold" style={{ color: safeAwayColor }}>
                      {a.toFixed(dec)}
                      {row.suffix || ''}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[#141E28] border border-[#34424E] overflow-hidden flex">
                    <div
                      className="h-full transition-all duration-300"
                      style={{ width: `${hPct}%`, backgroundColor: safeHomeColor }}
                    />
                    <div
                      className="h-full transition-all duration-300"
                      style={{ width: `${100 - hPct}%`, backgroundColor: safeAwayColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg bg-[#141E28] border border-[#34424E] p-4 text-xs text-[#A5B2BD] flex flex-col gap-2">
            <div className="font-semibold text-[#F4F7F5]">Pre-Match Expected Profile</div>
            <div className="flex justify-between tabular-nums">
              <span>Projected Expected Goals (xG)</span>
              <span className="font-mono text-[#63E6A5]">
                {prediction.home_xg.toFixed(2)} – {prediction.away_xg.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between tabular-nums">
              <span>Over 2.5 Goals Probability</span>
              <span className="font-mono text-[#F4F7F5]">
                {(prediction.over_2_5_prob * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between tabular-nums">
              <span>Pressing Intensity Index</span>
              <span className="font-mono text-[#F4F7F5]">
                {Math.round((homeProfile?.pressing_intensity_idx ?? 0.65) * 100)} vs{' '}
                {Math.round((awayProfile?.pressing_intensity_idx ?? 0.62) * 100)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Right 7 cols: Match Momentum / Territorial Swing */}
      <div className="lg:col-span-7 rounded-xl floodlit-card p-5 flex flex-col justify-between gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-semibold text-[#F4F7F5] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#63E6A5]" />
              Match Momentum &amp; Territorial Flow
            </h3>
            <p className="text-xs text-[#A5B2BD] mt-0.5">
              Positive swing favors{' '}
              <span className="font-semibold" style={{ color: safeHomeColor }}>{homeShort}</span>; negative favors{' '}
              <span className="font-semibold" style={{ color: safeAwayColor }}>{awayShort}</span>.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border bg-[#FBBF24]/10 border-[#FBBF24]/35 text-[#FBBF24]">
            <FlaskConical className="w-3 h-3 shrink-0" />
            Estimated Tactical Momentum · Not Live Event Stream
          </span>
        </div>

        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={momentumData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
              <XAxis dataKey="minute" stroke="#A5B2BD" fontSize={11} />
              <YAxis stroke="#A5B2BD" fontSize={11} domain={[-60, 60]} />
              <ReferenceLine y={0} stroke="#34424E" strokeWidth={1.5} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#141E28',
                  borderColor: '#34424E',
                  fontSize: '12px',
                  color: '#F4F7F5',
                }}
              />
              <Area
                type="monotone"
                dataKey="homePressure"
                name={`${homeShort} Momentum`}
                stroke={safeHomeColor}
                fill={safeHomeColor}
                fillOpacity={0.32}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="awayPressure"
                name={`${awayShort} Momentum`}
                stroke={safeAwayColor}
                fill={safeAwayColor}
                fillOpacity={0.32}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
};
