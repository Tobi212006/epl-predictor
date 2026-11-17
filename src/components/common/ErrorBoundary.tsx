import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[EPL Tactical ErrorBoundary]', error, info);
  }

  private handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  private handleSwitchLite = () => {
    try {
      localStorage.setItem('epl_ti_quality', 'lite');
    } catch {
      // ignore
    }
    window.location.href = '/';
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-2xl border border-[#F87171]/40 bg-[#1B2732] p-7 text-center shadow-2xl">
            <div className="w-12 h-12 mx-auto rounded-xl bg-[#F87171]/15 border border-[#F87171]/40 flex items-center justify-center text-[#F87171]">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="mt-4 font-display text-xl font-bold text-[#F4F7F5]">
              View Recovery Activated
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[#A5B2BD] leading-relaxed">
              {this.state.message}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#63E6A5] text-[#0D131A] text-xs font-bold hover:opacity-90"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry View
              </button>
              <button
                type="button"
                onClick={this.handleSwitchLite}
                className="px-4 py-2.5 rounded-xl bg-[#141E28] border border-[#34424E] text-[#F4F7F5] text-xs font-semibold hover:border-[#63E6A5]"
              >
                Return Home (2D Safe Mode)
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
