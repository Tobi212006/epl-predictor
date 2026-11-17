import React, { useEffect, useRef } from 'react';
import { useAppPreferences } from '../../lib/quality';

interface RegisteredLayer {
  el: HTMLDivElement;
  speed: number;
  maxShift: number;
}

const layers = new Set<RegisteredLayer>();
let listening = false;
let rafPending = false;

function updateAllLayers() {
  rafPending = false;
  if (typeof window === 'undefined') return;
  const scrollY = window.scrollY || 0;
  const vh = window.innerHeight || 800;
  const isMobile = window.innerWidth < 768;
  const mobileScale = isMobile ? 0.45 : 1;

  layers.forEach(({ el, speed, maxShift }) => {
    const rect = el.getBoundingClientRect();
    const elementCenter = rect.top + scrollY + rect.height / 2;
    const viewportCenter = scrollY + vh / 2;
    const delta = (viewportCenter - elementCenter) * speed * 0.14 * mobileScale;
    const clamped = Math.max(-maxShift, Math.min(maxShift, delta));
    el.style.transform = `translate3d(0, ${clamped.toFixed(2)}px, 0)`;
  });
}

function scheduleUpdate() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(updateAllLayers);
}

function attachGlobalListeners() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate, { passive: true });
}

function detachIfEmpty() {
  if (layers.size > 0 || !listening || typeof window === 'undefined') return;
  listening = false;
  window.removeEventListener('scroll', scheduleUpdate);
  window.removeEventListener('resize', scheduleUpdate);
}

interface ParallaxLayerProps {
  /** Rellax-style speed factor: negative moves slower/back, positive rises slightly faster. Recommended: -2 to +2. */
  speed?: number;
  /** Maximum pixel translation clamp to prevent overlap. */
  maxShift?: number;
  className?: string;
  children: React.ReactNode;
}

/**
 * Lightweight GPU-only scroll parallax layer (Rellax-inspired).
 * Shares a single passive scroll listener and requestAnimationFrame loop across the page,
 * automatically scales down on mobile viewports, and disables under prefers-reduced-motion.
 */
export const ParallaxLayer: React.FC<ParallaxLayerProps> = ({
  speed = -1,
  maxShift = 42,
  className = '',
  children,
}) => {
  const { prefersReducedMotion } = useAppPreferences();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion) {
      if (el) el.style.transform = 'none';
      return;
    }

    const entry: RegisteredLayer = { el, speed, maxShift };
    layers.add(entry);
    attachGlobalListeners();
    scheduleUpdate();

    return () => {
      layers.delete(entry);
      el.style.transform = '';
      detachIfEmpty();
    };
  }, [speed, maxShift, prefersReducedMotion]);

  return (
    <div ref={ref} className={`will-change-transform ${className}`}>
      {children}
    </div>
  );
};
