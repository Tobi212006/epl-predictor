import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { AppPreferencesProvider } from './lib/quality';
import { AppShell } from './components/layout/AppShell';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ToastProvider } from './components/common/ToastProvider';
import { OverviewPage } from './pages/OverviewPage';
import { FixturesPage } from './pages/FixturesPage';
import { MatchCenterPage } from './pages/MatchCenterPage';
import { TacticalLabPage } from './pages/TacticalLabPage';
import { ManagerDNAPage } from './pages/ManagerDNAPage';
import { ManagerClashPage } from './pages/ManagerClashPage';
import { MatchFlowPage } from './pages/MatchFlowPage';
import { WhatIfLabPage } from './pages/WhatIfLabPage';
import { MethodologyPage } from './pages/MethodologyPage';
import { IntelligencePage } from './pages/IntelligencePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const AnimatedRoutes: React.FC = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      >
        <Routes location={location}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/fixtures" element={<FixturesPage />} />
          <Route path="/match-center" element={<MatchCenterPage />} />
          <Route path="/match-center/:fixtureId" element={<MatchCenterPage />} />
          <Route path="/tactical-lab" element={<TacticalLabPage />} />
          <Route path="/manager-dna" element={<ManagerDNAPage />} />
          <Route path="/manager-clash" element={<ManagerClashPage />} />
          <Route path="/match-flow" element={<MatchFlowPage />} />
          <Route path="/what-if" element={<WhatIfLabPage />} />
          <Route path="/intelligence" element={<IntelligencePage />} />
          <Route path="/methodology" element={<MethodologyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppPreferencesProvider>
        <MotionConfig reducedMotion="user">
          <ToastProvider>
            <BrowserRouter>
              <AppShell>
                <ErrorBoundary>
                  <AnimatedRoutes />
                </ErrorBoundary>
              </AppShell>
            </BrowserRouter>
          </ToastProvider>
        </MotionConfig>
      </AppPreferencesProvider>
    </QueryClientProvider>
  );
}
