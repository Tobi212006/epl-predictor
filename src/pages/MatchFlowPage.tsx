import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAppPreferences } from '../lib/quality';
import type { TacticalPhase, TacticalSnapshot } from '../types/tactical';
import { DataFreshnessStrip, EmptyState, LoadingSkeleton } from '../components/common/DataFreshnessStrip';
import { resolveMatchupUiAccents } from '../components/common/FootballMotifs';
import { StadiumBattleBanner } from '../components/common/StadiumBattleBanner';
import { TacticalTheatreStage } from '../components/pitch/TacticalTheatreStage';

type GameStateKey = 'level' | 'home_leads' | 'away_leads';

function offsetSnapshotX(snap: TacticalSnapshot, dx: number): TacticalSnapshot {
  return {
    ...snap,
    players: snap.players.map((p, idx) => ({
      ...p,
      x: idx === 0 ? p.x : Number(Math.max(8, Math.min(94, p.x + dx)).toFixed(1)),
    })),
  };
}

export const MatchFlowPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedFixtureId, setSelectedFixtureId } = useAppPreferences();

  const [chapterIdx, setChapterIdx] = useState(0);
  const [gameState, setGameState] = useState<GameStateKey>('level');
  const [phase, setPhase] = useState<TacticalPhase>('in_possession');

  const statusQuery = useQuery({ queryKey: ['data-status'], queryFn: api.getDataStatus });
  const fixturesQuery = useQuery({
    queryKey: ['fixtures', 'match-flow-picker'],
    queryFn: async () => {
      const scheduled = await api.getFixtures({ status: 'SCHEDULED', limit: 25 });
      if (scheduled.items.length > 0) return scheduled;
      return api.getFixtures({ limit: 25 });
    },
  });

  const fixtureOptions = fixturesQuery.data?.items || [];
  const activeFixtureId = searchParams.get('fixture') || selectedFixtureId || fixtureOptions[0]?.id || '';

  const flowQuery = useQuery({
    queryKey: ['match-flow', activeFixtureId],
    queryFn: () => api.getMatchFlow(activeFixtureId),
    enabled: Boolean(activeFixtureId),
  });

  const fixture = flowQuery.data?.fixture;
  const prediction = flowQuery.data?.prediction;
  const clashQuery = useQuery({
    queryKey: ['manager-clash', fixture?.home_team_id, fixture?.away_team_id],
    queryFn: () => api.getManagerClash(fixture!.home_team_id, fixture!.away_team_id),
    enabled: Boolean(fixture?.home_team_id && fixture?.away_team_id),
  });

  const activeChapter = flowQuery.data?.flow.chapters[chapterIdx];
  const activeState = activeChapter?.states[gameState];

  const shiftedHomeSnapshots = useMemo(() => {
    if (!clashQuery.data || !activeState) return null;
    const out: Record<TacticalPhase, TacticalSnapshot> = {} as Record<TacticalPhase, TacticalSnapshot>;
    (Object.keys(clashQuery.data.home.snapshots) as TacticalPhase[]).forEach((ph) => {
      out[ph] = offsetSnapshotX(clashQuery.data.home.snapshots[ph], activeState.home_line_offset_x);
    });
    return out;
  }, [clashQuery.data, activeState]);

  const shiftedAwaySnapshots = useMemo(() => {
    if (!clashQuery.data || !activeState) return null;
    const out: Record<TacticalPhase, TacticalSnapshot> = {} as Record<TacticalPhase, TacticalSnapshot>;
    (Object.keys(clashQuery.data.away.snapshots) as TacticalPhase[]).forEach((ph) => {
      out[ph] = offsetSnapshotX(clashQuery.data.away.snapshots[ph], activeState.away_line_offset_x);
    });
    return out;
  }, [clashQuery.data, activeState]);

  const homePrimary = clashQuery.data?.home.team.primary_color || '#7DD3FC';
  const awayPrimary = clashQuery.data?.away.team.primary_color || '#F87171';
  const { homeAccent: resolvedHomeColor, awayAccent: resolvedAwayColor } = fixture
    ? resolveMatchupUiAccents(
        {
          teamId: fixture.home_team_id,
          primaryColor: homePrimary,
          secondaryColor: clashQuery.data?.home.team.secondary_color,
        },
        {
          teamId: fixture.away_team_id,
          primaryColor: awayPrimary,
          secondaryColor: clashQuery.data?.away.team.secondary_color,
        },
      )
    : { homeAccent: '#7DD3FC', awayAccent: '#F87171' };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F4F7F5]">
            90-Minute Match-Flow Simulator
          </h1>
          <p className="mt-1 text-sm text-[#A5B2BD]">
            Conditional tactical adaptations across 0–30&apos;, 31–60&apos;, and 61–90+&apos; score states.
          </p>
        </div>

        <select
          aria-label="Select fixture for match-flow scenario"
          value={activeFixtureId}
          onChange={(e) => {
            setSelectedFixtureId(e.target.value);
            setSearchParams({ fixture: e.target.value });
          }}
          className="rounded-lg bg-[#141E28] border border-[#34424E] px-3 py-2 text-xs text-[#F4F7F5] min-h-[38px]"
        >
          {(fixturesQuery.data?.items || []).map((fx) => (
            <option key={fx.id} value={fx.id}>
              MW {fx.matchweek}: {fx.home_short} vs {fx.away_short}
            </option>
          ))}
        </select>
      </div>

      <DataFreshnessStrip
        status={statusQuery.data}
        isLoading={statusQuery.isLoading}
        error={statusQuery.error as Error | null}
      />

      {/* Mandatory Scenario Disclaimer */}
      <div className="rounded-xl bg-[#FBBF24]/10 border border-[#FBBF24]/35 px-4 py-3 text-xs text-[#FBBF24]">
        <strong>Scenario analysis — not observed future events.</strong> Timeline states model conditional tactical height and pressing shifts from manager profiles; no match events, goals, or cards are fabricated.
      </div>

      {flowQuery.isError ? (
        <EmptyState
          title="Unable to Load Match-Flow Simulation"
          description={(flowQuery.error as Error)?.message || 'Failed to retrieve conditional timeline states.'}
          actionLabel={searchParams.get('fixture') && fixtureOptions[0] ? 'Load Next Fixture' : 'Retry Simulation'}
          onAction={() => {
            if (searchParams.get('fixture') && fixtureOptions[0]) {
              setSelectedFixtureId(fixtureOptions[0].id);
              setSearchParams({ fixture: fixtureOptions[0].id });
            } else {
              flowQuery.refetch();
            }
          }}
        />
      ) : flowQuery.isLoading || !flowQuery.data || !activeChapter || !activeState ? (
        <LoadingSkeleton rows={4} height="h-24" />
      ) : (
        <>
          {/* Stadium Home vs Away Battle Banner */}
          {fixture && (
            <StadiumBattleBanner
              home={{
                id: fixture.home_team_id,
                name: fixture.home_name,
                shortName: fixture.home_short,
                tla: fixture.home_tla,
                primaryColor: homePrimary,
                secondaryColor: clashQuery.data?.home.team.secondary_color,
                managerName: clashQuery.data?.home.appointment?.manager_name,
                formation: activeState.home_shape,
                xg: prediction?.home_xg,
              }}
              away={{
                id: fixture.away_team_id,
                name: fixture.away_name,
                shortName: fixture.away_short,
                tla: fixture.away_tla,
                primaryColor: awayPrimary,
                secondaryColor: clashQuery.data?.away.team.secondary_color,
                managerName: clashQuery.data?.away.appointment?.manager_name,
                formation: activeState.away_shape,
                xg: prediction?.away_xg,
              }}
              venue={fixture.venue}
              matchweek={fixture.matchweek}
              status={fixture.status}
              liveClock={fixture.live_clock}
              homeGoals={fixture.home_goals}
              awayGoals={fixture.away_goals}
              probHome={prediction?.prob_home}
              probDraw={prediction?.prob_draw}
              probAway={prediction?.prob_away}
              fixtureId={fixture.id}
              mode="flow"
            />
          )}

          {/* Timeline Scrubber & Score State Selector */}
          <div className="rounded-xl floodlit-card p-5 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Match timeline window">
                {flowQuery.data.flow.chapters.map((ch, idx) => (
                  <button
                    key={ch.window}
                    type="button"
                    onClick={() => setChapterIdx(idx)}
                    className={`px-4 py-2 rounded-lg text-xs font-mono font-semibold whitespace-nowrap min-h-[40px] transition-colors ${
                      chapterIdx === idx
                        ? 'bg-[#63E6A5] text-[#0D131A] font-bold'
                        : 'bg-[#141E28] text-[#A5B2BD] hover:text-[#F4F7F5] border border-[#34424E]'
                    }`}
                  >
                    {ch.window}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#141E28] border border-[#34424E]" role="group" aria-label="Score state">
                {(
                  [
                    ['level', 'Level'],
                    ['home_leads', `${fixture?.home_short || 'Home'} Leads`],
                    ['away_leads', `${fixture?.away_short || 'Away'} Leads`],
                  ] as Array<[GameStateKey, string]>
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setGameState(key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap min-h-[36px] transition-colors ${
                      gameState === key ? 'bg-[#7DD3FC] text-[#0D131A] font-bold' : 'text-[#A5B2BD] hover:text-[#F4F7F5]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="flow-range" className="sr-only">Match timeline scrubber</label>
              <input
                id="flow-range"
                type="range"
                min={0}
                max={2}
                step={1}
                value={chapterIdx}
                onChange={(e) => setChapterIdx(Number(e.target.value))}
                className="w-full accent-[#63E6A5]"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs pt-2 border-t border-[#34424E]">
              <div>
                <div className="text-[#A5B2BD]">{activeChapter.window} · {activeChapter.title}</div>
                <p className="mt-1.5 text-sm text-[#F4F7F5] leading-relaxed">{activeState.summary}</p>
              </div>
              <div className="rounded-lg bg-[#141E28] border border-[#34424E] p-3">
                <div className="text-[#7DD3FC] font-semibold">
                  Hypothetical Shapes &amp; Pressing Shift
                </div>
                <div className="mt-1 font-mono text-[#F4F7F5] tabular-nums">
                  {fixture?.home_short}: {activeState.home_shape} ({activeState.home_press_shift >= 0 ? '+' : ''}{activeState.home_press_shift} press idx)
                </div>
                <div className="mt-1 font-mono text-[#F87171] tabular-nums">
                  {fixture?.away_short}: {activeState.away_shape} ({activeState.away_press_shift >= 0 ? '+' : ''}{activeState.away_press_shift} press idx)
                </div>
              </div>
              <div className="rounded-lg bg-[#141E28] border border-[#34424E] p-3">
                <div className="text-[#63E6A5] font-semibold">Key Tactical Hypothesis &amp; Subs</div>
                <p className="mt-1 text-[#A5B2BD]">{activeState.key_hypothesis}</p>
                <p className="mt-1 text-[#A5B2BD]">{activeState.substitutions_note}</p>
              </div>
            </div>
          </div>

          {/* Animated Shared Tactical Pitch */}
          {shiftedHomeSnapshots && shiftedAwaySnapshots && (
            <TacticalTheatreStage
              snapshots={shiftedHomeSnapshots}
              awaySnapshots={shiftedAwaySnapshots}
              homeColor={resolvedHomeColor}
              awayColor={resolvedAwayColor}
              phase={phase}
              onPhaseChange={setPhase}
              heightClass="h-[440px] sm:h-[520px]"
            />
          )}

          {/* Accessible Textual Summary Table */}
          <section className="rounded-xl floodlit-card p-5">
            <h2 className="font-display text-base font-semibold text-[#F4F7F5]">
              Accessible Timeline Summary ({gameState.replace('_', ' ')})
            </h2>
            <div className="mt-3 flex flex-col divide-y divide-[#34424E] text-xs">
              {flowQuery.data.flow.chapters.map((ch) => {
                const st = ch.states[gameState];
                return (
                  <div key={ch.window} className="py-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="font-mono font-semibold text-[#63E6A5]">{ch.window} · {ch.title}</div>
                    <div className="md:col-span-2 text-[#F4F7F5]/90">{st.summary}</div>
                    <div className="text-[#A5B2BD]">{st.substitutions_note}</div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
};
