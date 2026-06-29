import React from 'react';

export function PageLoadingFallback() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] gap-4 text-base-muted animate-fade-in">
      <div className="relative">
        <div className="h-10 w-10 rounded-xl bg-base-accent-dim flex items-center justify-center">
          <span className="font-condensed font-black text-base-accent">AB</span>
        </div>
        <div className="absolute -inset-1 border-2 border-base-accent/30 border-t-base-accent rounded-xl animate-spin" />
      </div>
      <p className="text-xs font-condensed font-bold uppercase tracking-widest">
        Loading...
      </p>
    </div>
  );
}

export default PageLoadingFallback;
