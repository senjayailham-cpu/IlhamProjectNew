import React from 'react';

export interface BrandLogoProps {
  variant?: 'sidebar' | 'collapsed' | 'mobile' | 'login';
  className?: string;
}

export const BrandMarkSvg: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="epc-frame-grad" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#9b1c2e" />
        <stop offset="100%" stopColor="#701120" />
      </linearGradient>
      <linearGradient id="epc-amber-grad" x1="20" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fbbf24" />
        <stop offset="100%" stopColor="#d97706" />
      </linearGradient>
    </defs>

    {/* Chamfered Steel Plate / Engineering Hexagon Housing */}
    <path
      d="M18 6H46L58 18V46L46 58H18L6 46V18L18 6Z"
      fill="url(#epc-frame-grad)"
    />
    {/* Subtle Inner Structural Bevel */}
    <path
      d="M19.5 9.5H44.5L54.5 19.5V44.5L44.5 54.5H19.5L9.5 44.5V19.5L19.5 9.5Z"
      stroke="rgba(255,255,255,0.22)"
      strokeWidth="1.5"
    />

    {/* Precision Engineering Control Monogram & Nodes */}
    {/* Left vertical structural spine (E/P/C pillar) */}
    <path
      d="M21 20V44"
      stroke="#ffffff"
      strokeWidth="4.2"
      strokeLinecap="square"
    />
    {/* Top engineering rail */}
    <path
      d="M21 20H37"
      stroke="#ffffff"
      strokeWidth="4.2"
      strokeLinecap="square"
    />
    {/* Bottom construction rail */}
    <path
      d="M21 44H37"
      stroke="#ffffff"
      strokeWidth="4.2"
      strokeLinecap="square"
    />
    {/* Middle procurement / control vector */}
    <path
      d="M21 32H34"
      stroke="url(#epc-amber-grad)"
      strokeWidth="4.2"
      strokeLinecap="square"
    />

    {/* Right-side Control Loop / Isometric Arc */}
    <path
      d="M39 20L45 26V38L39 44"
      stroke="url(#epc-amber-grad)"
      strokeWidth="3.6"
      strokeLinecap="square"
      strokeLinejoin="miter"
    />

    {/* Control Center Node */}
    <rect x="33" y="29" width="6" height="6" rx="1" fill="#ffffff" />
  </svg>
);

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'sidebar',
  className = '',
}) => {
  if (variant === 'collapsed') {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        title="EPC Control System"
      >
        <BrandMarkSvg className="w-8 h-8 shrink-0 drop-shadow-xs" />
      </div>
    );
  }

  if (variant === 'login') {
    return (
      <div className={`flex flex-col items-center text-center select-none ${className}`}>
        <div className="mb-3 p-1.5 rounded-2xl bg-base-surface2/80 border border-base-border shadow-md">
          <BrandMarkSvg className="w-14 h-14" />
        </div>
        <div className="flex flex-col items-center">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-condensed font-black tracking-wider uppercase text-[#9b1c2e] dark:text-amber-400">
              EPC
            </span>
            <span className="text-2xl font-condensed font-extrabold tracking-wide uppercase text-base-text">
              Control System
            </span>
          </div>
          <p className="mt-1 text-[11px] text-base-muted font-condensed tracking-[0.18em] uppercase font-bold">
            Engineering · Procurement · Construction
          </p>
        </div>
      </div>
    );
  }

  if (variant === 'mobile') {
    return (
      <div className={`flex items-center gap-2 min-w-0 select-none ${className}`}>
        <BrandMarkSvg className="w-7 h-7 shrink-0" />
        <div className="flex flex-col leading-none min-w-0">
          <div className="flex items-baseline gap-1 whitespace-nowrap">
            <span className="font-condensed font-black text-base tracking-wider text-[#9b1c2e] dark:text-amber-400">
              EPC
            </span>
            <span className="font-condensed font-extrabold text-sm tracking-wide text-base-text truncate">
              CONTROL SYSTEM
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Default: 'sidebar'
  return (
    <div className={`flex items-center gap-2.5 min-w-0 select-none ${className}`}>
      <BrandMarkSvg className="w-8 h-8 shrink-0 drop-shadow-xs" />
      <div className="flex flex-col leading-none min-w-0">
        <span className="font-condensed font-black text-[15px] tracking-wider uppercase text-base-text whitespace-nowrap truncate">
          <span className="text-[#9b1c2e] dark:text-amber-400">EPC</span> Control System
        </span>
        <span className="text-[9px] font-condensed font-bold uppercase tracking-[0.16em] text-base-muted mt-0.5 whitespace-nowrap truncate">
          Operations Console
        </span>
      </div>
    </div>
  );
};

export default BrandLogo;
