import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
    // @ts-ignore
    this.props.onError?.(error, info);
  }

  render() {
    // @ts-ignore
    if (this.state.hasError) {
      // @ts-ignore
      return this.props.fallback ?? <DefaultErrorFallback 
        // @ts-ignore
        error={this.state.error}
        // @ts-ignore
        onReset={() => this.setState({ hasError: false, error: null })}
      />;
    }
    // @ts-ignore
    return this.props.children;
  }
}

function DefaultErrorFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4 text-center">
      <div className="text-4xl">⚠️</div>
      <h2 className="font-condensed font-extrabold text-red-500 text-xl uppercase">
        Something went wrong
      </h2>
      <p className="text-sm text-neutral-500 max-w-md">
        {error?.message || 'An unexpected error occurred in this section.'}
      </p>
      <button
        onClick={onReset}
        className="px-4 py-2 bg-neutral-800 text-white rounded-lg font-condensed 
                   font-bold uppercase tracking-wider text-sm hover:bg-neutral-700 
                   transition-all cursor-pointer"
      >
        Try Again
      </button>
    </div>
  );
}
