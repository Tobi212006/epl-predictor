import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../lib/api';
import { DataFreshnessStrip, EmptyState, LoadingSkeleton } from '../components/common/DataFreshnessStrip';

export const MethodologyPage: React.FC = () => {
  const statusQuery = useQuery({ queryKey: ['data-status'], queryFn: api.getDataStatus });
  const methQuery = useQuery({ queryKey: ['methodology'], queryFn: api.getMethodology });

  const meth = methQuery.data;
  const activeModel = meth?.models?.[0];

  const calChartData = (activeModel?.calibration || []).map((b) => ({
    bin: b.bin_label,
    predictedPct: Number((b.predicted_avg * 100).toFixed(1)),
    observedPct: Number((b.observed_freq * 100).toFixed(1)),
    idealPct: Number((b.predicted_avg * 100).toFixed(1)),
    count: b.count,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F4F7F5]">
          Methodology, Calibration &amp; Data Sources
        </h1>
        <p className="mt-1 text-sm text-[#A5B2BD]">
          Transparent Python Poisson + Dixon–Coles specification, walk-forward backtesting, provider freshness, and known limitations.
        </p>
      </div>

      <DataFreshnessStrip
        status={statusQuery.data}
        isLoading={statusQuery.isLoading}
        error={statusQuery.error as Error | null}
      />

      {methQuery.isError ? (
        <EmptyState
          title="Unable to Load Methodology Diagnostics"
          description={(methQuery.error as Error)?.message || 'Methodology API request failed.'}
          actionLabel="Retry"
          onAction={() => methQuery.refetch()}
        />
      ) : methQuery.isLoading || !meth ? (
        <LoadingSkeleton rows={4} height="h-28" />
      ) : (
        <>
          {/* Model Version & Out-of-Sample Backtest Metrics */}
          {activeModel && (
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 rounded-xl floodlit-card p-5 flex flex-col justify-between gap-4">
                <div>
                  <div className="text-xs text-[#63E6A5] font-mono">{activeModel.version_tag}</div>
                  <h2 className="mt-1 font-display text-lg font-bold text-[#F4F7F5]">
                    {activeModel.algorithm}
                  </h2>
                  <p className="mt-2 text-xs text-[#A5B2BD] leading-relaxed">{activeModel.notes}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs tabular-nums">
                  <div className="rounded-lg bg-[#141E28] border border-[#34424E] p-3">
                    <div className="text-[#A5B2BD]">Model Brier Score</div>
                    <div className="font-mono text-lg font-bold text-[#7DD3FC] mt-0.5">
                      {activeModel.brier_score.toFixed(4)}
                    </div>
                    <div className="text-[11px] text-[#A5B2BD]">
                      Baseline: {activeModel.baseline_brier.toFixed(4)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#141E28] border border-[#34424E] p-3">
                    <div className="text-[#A5B2BD]">Multi-class Log Loss</div>
                    <div className="font-mono text-lg font-bold text-[#63E6A5] mt-0.5">
                      {activeModel.log_loss.toFixed(4)}
                    </div>
                    <div className="text-[11px] text-[#A5B2BD]">
                      Baseline: {activeModel.baseline_log_loss.toFixed(4)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#141E28] border border-[#34424E] p-3">
                    <div className="text-[#A5B2BD]">Dixon–Coles ρ</div>
                    <div className="font-mono text-base font-semibold text-[#F4F7F5] mt-0.5">
                      {activeModel.dixon_coles_rho}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#141E28] border border-[#34424E] p-3">
                    <div className="text-[#A5B2BD]">Backtest Sample</div>
                    <div className="font-mono text-base font-semibold text-[#F4F7F5] mt-0.5">
                      {activeModel.sample_matches} matches
                    </div>
                  </div>
                </div>
              </div>

              {/* Reliability / Calibration Chart + Accessible Table */}
              <div className="lg:col-span-7 rounded-xl floodlit-card p-5">
                <h2 className="font-display text-base font-semibold text-[#F4F7F5]">
                  Walk-Forward Calibration Curve (Out-of-Sample)
                </h2>
                <p className="text-xs text-[#A5B2BD] mt-0.5">
                  Compares predicted probability bins against observed match outcome frequency (no future leakage).
                </p>

                <div className="h-60 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={calChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="bin" stroke="#A5B2BD" fontSize={12} />
                      <YAxis stroke="#A5B2BD" fontSize={12} unit="%" domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#141E28', borderColor: '#34424E', fontSize: '12px', color: '#F4F7F5' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Line type="monotone" dataKey="idealPct" name="Perfect Calibration" stroke="#7DD3FC" strokeDasharray="4 4" dot={false} />
                      <Line type="monotone" dataKey="observedPct" name="Observed Frequency" stroke="#63E6A5" strokeWidth={2.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Accessible HTML table equivalent */}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-xs text-left tabular-nums">
                    <thead>
                      <tr className="border-b border-[#34424E] text-[#A5B2BD]">
                        <th className="py-1.5">Probability Bin</th>
                        <th className="py-1.5 text-right">Predicted Avg</th>
                        <th className="py-1.5 text-right">Observed Freq</th>
                        <th className="py-1.5 text-right">Outcome Samples</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calChartData.map((row) => (
                        <tr key={row.bin} className="border-b border-[#34424E]/60">
                          <td className="py-1.5 font-mono text-[#F4F7F5]">{row.bin}</td>
                          <td className="py-1.5 text-right font-mono text-[#7DD3FC]">{row.predictedPct}%</td>
                          <td className="py-1.5 text-right font-mono text-[#63E6A5]">{row.observedPct}%</td>
                          <td className="py-1.5 text-right font-mono text-[#A5B2BD]">{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* Real Data Provider Setup Instructions */}
          <section className="rounded-xl floodlit-card p-5">
            <h2 className="font-display text-base font-semibold text-[#F4F7F5]">
              Connecting Real Authorized EPL Data
            </h2>
            <p className="mt-1.5 text-xs text-[#A5B2BD] leading-relaxed">
              The platform supports real-time synchronization via the zero-key <code className="text-[#63E6A5]">ESPN Live EPL API (eng.1)</code> by default, as well as <code className="text-[#7DD3FC]">football-data.org</code> when <code className="text-[#63E6A5]">FOOTBALL_DATA_API_KEY</code> is configured.
            </p>
            <ol className="mt-3 list-decimal list-inside text-xs text-[#A5B2BD] flex flex-col gap-1.5">
              <li>Live 2026–27 standings, 380 fixtures, live scores, and match clock sync automatically via <code className="text-[#63E6A5]">DATA_PROVIDER=&quot;espn-live&quot;</code> (or switch to <code className="text-[#7DD3FC]">football-data</code> with your token in <code className="text-[#F4F7F5]">.env</code>).</li>
              <li>Click <strong>Sync Feed</strong> on the freshness strip (or call <code className="text-[#F4F7F5]">POST /api/v1/data/refresh</code>) to pull the latest scores and recompute team strength ratings in Python.</li>
              <li>When live feeds do not supply verified xG/xGA, the model automatically disables xG blending and runs in transparent <strong>goals-based fallback</strong> mode with explicitly lowered confidence rather than inventing xG.</li>
            </ol>
          </section>

          {/* Reference Repo Audit & Known Limitations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl floodlit-card p-5 text-xs">
              <h2 className="font-display text-base font-semibold text-[#F4F7F5]">
                Reference Repository Inspection
              </h2>
              <p className="mt-1 text-[#A5B2BD]">
                Inspired by <span className="text-[#7DD3FC]">{meth.reference_inspiration.repo}</span>
              </p>
              <div className="mt-3">
                <div className="font-semibold text-[#63E6A5]">Reusable Concepts Adopted</div>
                <ul className="mt-1 flex flex-col gap-1 text-[#A5B2BD]">
                  {meth.reference_inspiration.reusable_ideas.map((idea) => (
                    <li key={idea}>• {idea}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-3">
                <div className="font-semibold text-[#F87171]">Adapted / Not Reused</div>
                <ul className="mt-1 flex flex-col gap-1 text-[#A5B2BD]">
                  {meth.reference_inspiration.not_reused_or_adapted.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-xl floodlit-card p-5 text-xs">
              <h2 className="font-display text-base font-semibold text-[#F4F7F5]">
                Honest Modeling Limitations
              </h2>
              <ul className="mt-3 flex flex-col gap-2 text-[#A5B2BD] leading-relaxed">
                {meth.limitations.map((lim) => (
                  <li key={lim}>• {lim}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Sources & Sync History */}
          <section className="rounded-xl floodlit-card p-5">
            <h2 className="font-display text-base font-semibold text-[#F4F7F5] mb-3">
              Registered Sources &amp; Recent Provider Syncs
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {meth.sources.map((src) => (
                <div key={src.id} className="rounded-lg bg-[#141E28] border border-[#34424E] p-3">
                  <div className="font-medium text-[#F4F7F5]">{src.title}</div>
                  <div className="text-[#7DD3FC] mt-0.5">
                    {src.publisher} · {src.evidence_type} · {src.published_at}
                  </div>
                  <p className="text-[#A5B2BD] mt-1">{src.notes}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
};
