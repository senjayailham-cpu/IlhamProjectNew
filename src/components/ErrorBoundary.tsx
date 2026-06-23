import React, { ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends React.Component<Props, State> {
  props!: Props;
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App Error Boundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-base-bg p-8 text-center bg-slate-900">
          <div className="space-y-4 max-w-md p-6 bg-slate-800 rounded-2xl border border-slate-700 shadow-xl">
            <h1 className="text-xl font-bold text-red-400">Terjadi kesalahan tak terduga</h1>
            <p className="text-slate-300 text-sm">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 transition text-white rounded-lg text-sm font-medium shadow-md"
            >
              Muat ulang halaman
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
