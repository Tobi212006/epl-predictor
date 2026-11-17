import React, { useEffect, useRef, useState } from 'react';
import { useAppPreferences } from '../../lib/quality';

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  durationMs?: number;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  decimals = 0,
  suffix = '',
  prefix = '',
  durationMs = 420,
  className = '',
}) => {
  const { prefersReducedMotion } = useAppPreferences();
  const [displayValue, setDisplayValue] = useState<number>(value);
  const currentRef = useRef<number>(value);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!Number.isFinite(value)) return;
    if (prefersReducedMotion || Math.abs(currentRef.current - value) < 1e-6) {
      currentRef.current = value;
      setDisplayValue(value);
      return;
    }

    const from = currentRef.current;
    const to = value;
    const start = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;
      currentRef.current = next;
      setDisplayValue(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        currentRef.current = to;
        setDisplayValue(to);
      }
    };

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, durationMs, prefersReducedMotion]);

  const formatted = Number.isFinite(displayValue) ? displayValue.toFixed(decimals) : '—';

  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};
