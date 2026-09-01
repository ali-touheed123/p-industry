import React from 'react';

interface PyntflowLogoProps {
  className?: string;
  variant?: 'dark' | 'light';
  height?: number | string;
}

export const PyntflowLogo: React.FC<PyntflowLogoProps> = ({
  className = '',
  variant = 'dark',
  height = 28,
}) => {
  const textColor = variant === 'light' ? '#FFFFFF' : '#0F172A';

  return (
    <svg
      viewBox="0 0 280 76"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ height, width: 'auto', display: 'block' }}
      className={`select-none transition-transform group-hover:scale-[1.02] duration-200 ${className}`}
      aria-label="Pyntflow"
    >
      <defs>
        {/* Exact gradient matching the uploaded wordmark: vibrant cyan-blue -> royal blue -> purple -> magenta */}
        <linearGradient id="pyntflow-flow-grad" x1="0%" y1="20%" x2="100%" y2="80%">
          <stop offset="0%" stopColor="#0080FF" />
          <stop offset="35%" stopColor="#0066FE" />
          <stop offset="70%" stopColor="#4F46E5" />
          <stop offset="88%" stopColor="#8B24D2" />
          <stop offset="100%" stopColor="#C026D3" />
        </linearGradient>
      </defs>

      {/* Single text container with tight natural kerning between Pynt and flow */}
      <text
        x="0"
        y="58"
        fontFamily="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
        fontWeight="800"
        fontSize="64"
        letterSpacing="-0.04em"
      >
        <tspan fill={textColor}>Pynt</tspan>
        <tspan fill="url(#pyntflow-flow-grad)" fontStyle="italic" letterSpacing="-0.04em">flow</tspan>
      </text>
    </svg>
  );
};
