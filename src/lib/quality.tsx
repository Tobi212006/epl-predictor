import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

interface HardwareCapabilities {
  webglAvailable: boolean;
  isSoftwareGl: boolean;
  prefersReducedMotion: boolean;
}

function detectCapabilities(): HardwareCapabilities {
  if (typeof window === 'undefined') {
    return {
      webglAvailable: false,
      isSoftwareGl: true,
      prefersReducedMotion: false,
    };
  }

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let webglAvailable = false;
  let isSoftwareGl = false;

  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (gl) {
      webglAvailable = true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param) || '');
      isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    webglAvailable = false;
  }

  return {
    webglAvailable,
    isSoftwareGl,
    prefersReducedMotion,
  };
}

interface AppPreferencesContextValue {
  use3D: boolean;
  isSoftwareGl: boolean;
  prefersReducedMotion: boolean;
  webglFailed: boolean;
  reportWebglFailed: () => void;
  selectedTeamId: string;
  setSelectedTeamId: (id: string) => void;
  selectedFixtureId: string;
  setSelectedFixtureId: (id: string) => void;
  introSeen: boolean;
  dismissIntro: () => void;
  replayIntro: () => void;
}

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);

export function AppPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [caps, setCaps] = useState<HardwareCapabilities>(() => detectCapabilities());
  const [webglFailed, setWebglFailed] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState('arsenal');
  const [selectedFixtureId, setSelectedFixtureId] = useState('');
  const [introSeen, setIntroSeen] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('epl_ti_intro_seen') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const onChange = () => setCaps((prev) => ({ ...prev, prefersReducedMotion: mq.matches }));
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const dismissIntro = () => {
    setIntroSeen(true);
    try {
      sessionStorage.setItem('epl_ti_intro_seen', '1');
    } catch {
      // ignore
    }
  };

  const replayIntro = () => {
    setIntroSeen(false);
  };

  // Always deliver full 3D premium theatre whenever WebGL is supported; fall back cleanly to 2D SVG only if unavailable or lost
  const use3D = useMemo(() => {
    if (webglFailed || !caps.webglAvailable) return false;
    return true;
  }, [caps.webglAvailable, webglFailed]);

  const value: AppPreferencesContextValue = {
    use3D,
    isSoftwareGl: caps.isSoftwareGl,
    prefersReducedMotion: caps.prefersReducedMotion,
    webglFailed,
    reportWebglFailed: () => setWebglFailed(true),
    selectedTeamId,
    setSelectedTeamId,
    selectedFixtureId,
    setSelectedFixtureId,
    introSeen,
    dismissIntro,
    replayIntro,
  };

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export function useAppPreferences(): AppPreferencesContextValue {
  const ctx = useContext(AppPreferencesContext);
  if (!ctx) throw new Error('useAppPreferences must be used inside AppPreferencesProvider');
  return ctx;
}
