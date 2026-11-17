import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAppPreferences } from '../lib/quality';
import { DataFreshnessStrip, EmptyState, LoadingSkeleton } from '../components/common/DataFreshnessStrip';
import {
  CLUB_IDENTITY_META,
  ClubKitBadge,
  resolveMatchupUiAccents,
} from '../components/common/FootballMotifs';

export const FixturesPage: React.FC = () => {
  const { setSelectedFixtureId } = useAppPreferences();
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LIVE' | 'SCHEDULED' | 'FINISHED'>('ALL');
  const [matchweekFilter, setMatchweekFilter] = useState<string>('');
  const [teamFilter, setTeamFilter] = useState<string>('');

  const statusQuery = useQuery({ queryKey: ['data-status'], queryFn: api.getDataStatus });
  const standingsQuery = useQuery({ queryKey: ['standings'], queryFn: api.getStandings });
  const fixturesQuery = useQuery({
    queryKey: ['fixtures', statusFilter, matchweekFilter, teamFilter],
    queryFn: () =>
      api.getFixtures({
        status: statusFilter,
        matchweek: matchweekFilter ? Number(matchweekFilter) : undefined,
        team_id: teamFilter || undefined,
        limit: 150,
      }),
  });

  const teams = standingsQuery.data?.standings || [];
  const items = fixturesQuery.data?.items || [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F4F7F5]">
          2026–27 Premier League Fixtures &amp; Results
        </h1>
        <p className="mt-1 text-sm text-[#A5B2BD]">
          Browse all 38 matchweeks with Python-computed 1X2 probabilities, live clocks, and authentic club kits.
        </p>
      </div>

      <DataFreshnessStrip
        status={statusQuery.data}
        isLoading={statusQuery.isLoading}
        error={statusQuery.error as Error | null}
      />

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl floodlit-card p-3.5">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#141E28] border border-[#34424E] rounded-lg" role="group" aria-label="Fixture status filter">
          {(['ALL', 'LIVE', 'SCHEDULED', 'FINISHED'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 min-h-[36px] transition-colors ${
                statusFilter === st ? 'bg-[#63E6A5] text-[#0D131A] font-bold' : 'text-[#A5B2BD] hover:text-[#F4F7F5]'
              }`}
            >
              {st === 'ALL' ? 'All Matches' : st === 'LIVE' ? 'Live Now' : st === 'SCHEDULED' ? 'Upcoming' : 'Completed'}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Filter by matchweek"
            value={matchweekFilter}
            onChange={(e) => setMatchweekFilter(e.target.value)}
            className="rounded-lg bg-[#141E28] border border-[#34424E] px-3 py-1.5 text-xs text-[#F4F7F5] min-h-[36px]"
          >
            <option value="">All Matchweeks (1–38)</option>
            {Array.from({ length: 38 }, (_, i) => i + 1).map((mw) => (
              <option key={mw} value={mw}>
                Matchweek {mw}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by team"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="rounded-lg bg-[#141E28] border border-[#34424E] px-3 py-1.5 text-xs text-[#F4F7F5] min-h-[36px]"
          >
            <option value="">All 20 Clubs</option>
            {teams.map((t) => (
              <option key={t.team_id} value={t.team_id}>
                {t.short_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Fixture Cards */}
      {fixturesQuery.isLoading ? (
        <LoadingSkeleton rows={6} height="h-24" />
      ) : fixturesQuery.isError ? (
        <EmptyState
          title="Unable to Load Fixtures"
          description={(fixturesQuery.error as Error)?.message || 'Failed to query fixtures API.'}
          actionLabel="Retry"
          onAction={() => fixturesQuery.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="No fixtures match your filter"
          description="Adjust matchweek, club, or status filters to view available fixtures."
          actionLabel="Clear Filters"
          onAction={() => {
            setStatusFilter('ALL');
            setMatchweekFilter('');
            setTeamFilter('');
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((fx) => {
            const isFin = fx.status === 'FINISHED';
            const isLive = fx.status === 'LIVE';
            const accents = resolveMatchupUiAccents(
              { teamId: fx.home_team_id, primaryColor: fx.home_color, secondaryColor: fx.home_secondary },
              { teamId: fx.away_team_id, primaryColor: fx.away_color, secondaryColor: fx.away_secondary },
            );
            const stadiumCap = CLUB_IDENTITY_META[fx.home_team_id]?.capacity;
            return (
              <div
                key={fx.id}
                className="rounded-xl floodlit-card p-4 flex flex-col justify-between gap-3 transition-transform hover:-translate-y-0.5 relative overflow-hidden"
                style={{
                  backgroundImage: `linear-gradient(105deg, ${accents.homeAccent}14 0%, transparent 45%, ${accents.awayAccent}14 100%)`,
                }}
              >
                <div className="flex items-center justify-between text-xs text-[#A5B2BD] tabular-nums">
                  <span className="flex items-center gap-2">
                    <span className={isLive ? 'text-[#F87171] font-bold' : 'text-[#63E6A5] font-semibold'}>
                      {isLive ? `LIVE ${fx.live_clock || ''}` : `MW ${fx.matchweek}`}
                    </span>
                    <span>·</span>
                    <span>
                      {new Date(fx.kickoff_utc).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </span>
                  <span className="truncate max-w-[45%]">
                    {fx.venue}
                    {stadiumCap ? ` (${Math.round(stadiumCap / 1000)}k)` : ''}
                  </span>
                </div>

                {/* Home vs Away Real Jerseys Battle Row */}
                <div className="flex items-center justify-between gap-3 py-1">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <ClubKitBadge
                      teamId={fx.home_team_id}
                      primaryColor={fx.home_color}
                      secondaryColor={fx.home_secondary}
                      tla={fx.home_tla}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="font-display text-base font-bold text-[#F4F7F5] truncate">{fx.home_short}</div>
                      <div className="text-[10px] font-mono font-bold" style={{ color: accents.homeAccent }}>
                        HOME
                      </div>
                    </div>
                  </div>

                  {isFin || isLive ? (
                    <div className="font-mono text-lg font-extrabold text-[#F4F7F5] tabular-nums px-3 py-1 rounded-lg bg-[#141E28] border border-[#34424E] shrink-0">
                      {fx.home_goals ?? 0} – {fx.away_goals ?? 0}
                    </div>
                  ) : (
                    <div className="text-xs font-mono font-bold text-[#63E6A5] px-2.5 py-1 rounded bg-[#141E28] border border-[#34424E] shrink-0">
                      VS
                    </div>
                  )}

                  <div className="flex items-center gap-2.5 min-w-0 flex-1 justify-end text-right">
                    <div className="min-w-0">
                      <div className="font-display text-base font-bold text-[#F4F7F5] truncate">{fx.away_short}</div>
                      <div className="text-[10px] font-mono font-bold" style={{ color: accents.awayAccent }}>
                        {accents.isAwayKit ? 'AWAY ALT' : 'AWAY'}
                      </div>
                    </div>
                    <ClubKitBadge
                      teamId={fx.away_team_id}
                      primaryColor={fx.away_color}
                      secondaryColor={fx.away_secondary}
                      tla={fx.away_tla}
                      size="sm"
                      isAway={accents.isAwayKit}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#34424E] text-xs tabular-nums">
                  {fx.prob_home !== null && fx.prob_draw !== null && fx.prob_away !== null ? (
                    <div className="font-mono text-[#A5B2BD]">
                      <span className="font-semibold" style={{ color: accents.homeAccent }}>
                        H {Math.round(fx.prob_home * 100)}%
                      </span>
                      {' · '}
                      <span>D {Math.round(fx.prob_draw * 100)}%</span>
                      {' · '}
                      <span className="font-semibold" style={{ color: accents.awayAccent }}>
                        A {Math.round(fx.prob_away * 100)}%
                      </span>
                      {fx.home_xg !== null && fx.away_xg !== null && (
                        <span className="ml-2 text-[#A5B2BD]">({fx.home_xg.toFixed(2)}–{fx.away_xg.toFixed(2)} xG)</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[#A5B2BD]">Model pending</span>
                  )}

                  <div className="flex items-center gap-3">
                    <Link
                      to={`/match-center/${fx.id}`}
                      onClick={() => setSelectedFixtureId(fx.id)}
                      className="text-[#7DD3FC] hover:text-[#63E6A5] font-semibold whitespace-nowrap"
                    >
                      Match Center →
                    </Link>
                    <Link
                      to={`/match-flow?fixture=${fx.id}`}
                      onClick={() => setSelectedFixtureId(fx.id)}
                      className="text-[#A5B2BD] hover:text-[#F4F7F5] whitespace-nowrap"
                    >
                      Match Flow
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
