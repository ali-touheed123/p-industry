import React from 'react';

interface PyntflowLogoProps {
  className?: string;
  variant?: 'dark' | 'light';
  height?: number | string;
}

export const PyntflowLogo: React.FC<PyntflowLogoProps> = ({
  className = '',
  variant = 'dark',
  height = 42,
}) => {
  const computedHeight = typeof height === 'number' ? Math.round(height * 1.2) : 48;
  const computedWidth = Math.round(computedHeight * 3);

  return (
    <img
      src="/logo.png"
      alt="Pyntflow"
      width={computedWidth}
      height={computedHeight}
      style={{ height: computedHeight, width: 'auto', display: 'block' }}
      className={`select-none transition-transform group-hover:scale-[1.02] duration-200 ${className}`}
    />
  );
};
