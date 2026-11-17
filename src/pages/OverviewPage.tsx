import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAppPreferences } from '../lib/quality';
import type { PredictionData, TacticalPhase } from '../types/tactical';
import { DataFreshnessStrip } from '../components/common/DataFreshnessStrip';
import { resolveVisibleUiAccent } from '../components/common/FootballMotifs';
import { ParallaxLayer } from '../components/common/ParallaxLayer';
import { useToast } from '../components/common/ToastProvider';
import { CollapsibleMatchDashboard } from '../components/dashboard/CollapsibleMatchDashboard';
import { CinematicStadiumHero } from '../components/hero/CinematicStadiumHero';
import { MatchdayShelf3D } from '../components/shelf/MatchdayShelf3D';

export const OverviewPage: React.FC = () => {
  const qc = useQueryClient();
  const { pushToast } = useToast();
  const { selectedTeamId } = useAppPreferences();
  const [previewPhase, setPreviewPhase] = useState<TacticalPhase>('in_possession');
  const [activeChapter, setActiveChapter] = useState(0);
  const [dashboardOpen, setDashboardOpen] = useState(true);
  const [quickPairResult, setQuickPairResult] = useState<{
    homeShort: string;
    awayShort: string;
    prediction: PredictionData;
  } | null>(null);
  const shelfWrapRef = useRef<HTMLDivElement>(null);

  const statusQuery = useQuery({
    queryKey: ['data-status'],
    queryFn: api.getDataStatus,
  });

  const standingsQuery = useQuery({
    queryKey: ['standings'],
    queryFn: api.getStandings,
  });

  const upcomingQuery = useQuery({
    queryKey: ['fixtures', 'SCHEDULED'],
    queryFn: () => api.getFixtures({ status: 'SCHEDULED', limit: 24 }),
  });

  const liveQuery = useQuery({
    queryKey: ['fixtures', 'LIVE'],
    queryFn: () => api.getFixtures({ status: 'LIVE', limit: 12 }),
    refetchInterval: 45_000,
  });

  const teamDetailQuery = useQuery({
    queryKey: ['team-detail', selectedTeamId],
    queryFn: () => api.getTeamDetail(selectedTeamId),
  });

  const managerId = teamDetailQuery.data?.current_appointment?.manager_id;
  const managerTacticsQuery = useQuery({
    queryKey: ['manager-tactics', managerId],
    queryFn: () => api.getManagerTactics(managerId!),
    enabled: Boolean(managerId),
  });

  const refreshMutation = useMutation({
    mutationFn: () => api.refreshData(),
    onSuccess: (res) => {
      qc.invalidateQueries();
      pushToast({
        variant: 'success',
        title: 'Premier League Feed Synchronized',
        description: `${res.status.fixtures_total} fixtures refreshed from ${res.status.provider}.`,
      });
    },
    onError: (err: Error) => {
      pushToast({
        variant: 'error',
        title: 'Feed Sync Failed',
        description: err.message,
      });
    },
  });

  const liveTickMutation = useMutation({
    mutationFn: () => api.liveTick(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['data-status'] });
      qc.invalidateQueries({ queryKey: ['fixtures'] });
      qc.invalidateQueries({ queryKey: ['standings'] });
    },
    onError: (err: Error) => {
      pushToast({
        variant: 'error',
        title: 'Live Scoreboard Sync Failed',
        description: err.message,
      });
    },
  });

  const predictPairMutation = useMutation({
    mutationFn: ({ homeId, awayId }: { homeId: string; awayId: string }) =>
      api.predictPair(homeId, awayId),
    onSuccess: (res) => {
      setQuickPairResult({
        homeShort: res.home_team.team.short_name,
        awayShort: res.away_team.team.short_name,
        prediction: res.prediction,
      });
      pushToast({
        variant: 'success',
        title: `${res.home_team.team.short_name} vs ${res.away_team.team.short_name}`,
        description: `Python model projected ${res.prediction.home_xg.toFixed(2)} – ${res.prediction.away_xg.toFixed(2)} xG.`,
      });
    },
    onError: (err: Error) => {
      pushToast({
        variant: 'error',
        title: 'Prediction Error',
        description: err.message,
      });
    },
  });

  // Periodic light scoreboard poll every 60s when dashboard is open
  useEffect(() => {
    if (!dashboardOpen) return;
    const id = setInterval(() => {
      liveTickMutation.mutate();
    }, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardOpen]);

  useEffect(() => {
    if (activeChapter === 0) setPreviewPhase('base');
    else if (activeChapter === 1) setPreviewPhase('in_possession');
    else if (activeChapter === 2) setPreviewPhase('out_of_possession');
  }, [activeChapter]);

  const combinedFixtures = [
    ...(liveQuery.data?.items || []),
    ...(upcomingQuery.data?.items || []),
  ];
  const featuredFixture = combinedFixtures[0];
  const showXgCol = Boolean(statusQuery.data?.xg_available);

  return (
    <div className="flex flex-col gap-8">
      {/* 1. Full-Bleed Misty-Wipe Stadium Hero + Concentric Rail + Floating Quick Predictor Bar */}
      <CinematicStadiumHero
        standings={standingsQuery.data?.standings || []}
        featuredFixture={featuredFixture}
        dataStatus={statusQuery.data}
        onPredictPair={(homeId, awayId) => predictPairMutation.mutate({ homeId, awayId })}
        quickPairPrediction={quickPairResult}
        isPredictingPair={predictPairMutation.isPending}
        onScrollToShelf={() => shelfWrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        onToggleDashboard={() => setDashboardOpen((prev) => !prev)}
        dashboardOpen={dashboardOpen}
      />

      {/* 2. Authoritative Data Freshness & Live Source Strip */}
      <ParallaxLayer speed={-0.35} maxShift={12}>
        <DataFreshnessStrip
          status={statusQuery.data}
          isLoading={statusQuery.isLoading}
          error={statusQuery.error as Error | null}
          onRefresh={() => refreshMutation.mutate()}
          isRefreshing={refreshMutation.isPending}
        />
      </ParallaxLayer>

      {/* 3. Signature 3D Turning-Spine Matchday Shelf + WAAPI Ink-Blot Dossier */}
      <div ref={shelfWrapRef}>
        <MatchdayShelf3D fixtures={combinedFixtures} />
      </div>

      {/* 4. Open & Close Collapsible Live Tactical Dashboard */}
      <CollapsibleMatchDashboard
        isOpen={dashboardOpen}
        onToggle={() => setDashboardOpen((prev) => !prev)}
        fixtures={combinedFixtures}
        standings={standingsQuery.data?.standings || []}
        isLoadingFixtures={upcomingQuery.isLoading}
        isLoadingStandings={standingsQuery.isLoading}
        showXgCol={showXgCol}
        isDemo={Boolean(statusQuery.data?.is_demo)}
        liveFixturesCount={liveQuery.data?.items?.length || statusQuery.data?.fixtures_live || 0}
        onLiveTick={() => {
          liveTickMutation.mutate(undefined, {
            onSuccess: (d) => {
              pushToast({
                variant: 'info',
                title: 'Scoreboard Checked',
                description: `Verified live feed (${d.tick.updated} events inspected).`,
              });
            },
          });
        }}
        isTickingLive={liveTickMutation.isPending}
        teamName={teamDetailQuery.data?.team.short_name || 'Arsenal'}
        managerName={teamDetailQuery.data?.current_appointment?.manager_name || 'Manager'}
        snapshots={managerTacticsQuery.data?.snapshots}
        teamPrimaryColor={
          teamDetailQuery.data?.team
            ? resolveVisibleUiAccent(
                teamDetailQuery.data.team.id,
                teamDetailQuery.data.team.primary_color,
                teamDetailQuery.data.team.secondary_color,
              )
            : '#7DD3FC'
        }
        previewPhase={previewPhase}
        onPhaseChange={setPreviewPhase}
        activeChapter={activeChapter}
        onChapterChange={setActiveChapter}
      />
    </div>
  );
};
