import React from 'react';
import { RefreshCw } from 'lucide-react';
import type { DataStatus } from '../../types/tactical';

interface DataFreshnessStripProps {
  status?: DataStatus | null;
  isLoading?: boolean;
  error?: Error | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const DataFreshnessStrip: React.FC<DataFreshnessStripProps> = ({
  status,
  isLoading,
  error,
  onRefresh,
  isRefreshing,
}) => {
  if (isLoading) {
    return (
      <div className="h-9 w-full max-w-xl rounded-lg bg-[#1B2732] border border-[#34424E] animate-pulse" aria-label="Loading data freshness" />
    );
  }

  if (error) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#1B2732] border border-[#F87171]/45 px-4 py-2.5 text-xs text-[#F87171]">
        <span>Backend unavailable: {error.message}. Verify API server on port 3000.</span>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-1 rounded-lg bg-[#141E28] border border-[#34424E] text-[#F4F7F5] hover:border-[#63E6A5]"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!status) return null;

  const formattedTime = status.last_synced_at
    ? new Date(status.last_synced_at).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Unknown';

  const stateColor = status.is_demo
    ? 'text-[#FBBF24]'
    : status.status === 'error'
    ? 'text-[#F87171]'
    : 'text-[#63E6A5]';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#34424E] pb-3 text-xs text-[#A5B2BD] tabular-nums">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`font-semibold ${stateColor}`}>
          {status.is_demo ? 'Synthetic Demo Mode' : 'Live Provider Feed'}
        </span>
        <span aria-hidden="true">·</span>
        <span>{status.season.label}</span>
        <span aria-hidden="true">·</span>
        <span>Provider: {status.provider}</span>
        <span aria-hidden="true">·</span>
        <span>{status.xg_available ? 'xG available' : 'Goals-based fallback (xG absent)'}</span>
        <span aria-hidden="true">·</span>
        <span>Updated {formattedTime}</span>
      </div>

      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B2732] hover:bg-[#233240] border border-[#63E6A5]/35 text-xs text-[#F4F7F5] whitespace-nowrap shrink-0 min-h-[36px] transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#63E6A5] ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Syncing...' : 'Sync Feed'}
        </button>
      )}
    </div>
  );
};

export const LoadingSkeleton: React.FC<{ rows?: number; height?: string }> = ({
  rows = 4,
  height = 'h-12',
}) => (
  <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Loading content">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className={`${height} w-full rounded-xl bg-[#1B2732] border border-[#34424E] animate-pulse`} />
    ))}
  </div>
);

export const EmptyState: React.FC<{
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, description, actionLabel, onAction }) => (
  <div className="rounded-xl border border-[#34424E] bg-[#1B2732] p-8 text-center">
    <h3 className="font-display text-base font-semibold text-[#F4F7F5]">{title}</h3>
    <p className="mt-1.5 text-sm text-[#A5B2BD] max-w-md mx-auto">{description}</p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="mt-4 px-4 py-2 rounded-lg bg-[#63E6A5] text-[#0D131A] text-xs font-bold hover:opacity-90"
      >
        {actionLabel}
      </button>
    )}
  </div>
);
