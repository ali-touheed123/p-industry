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
  return (
    <img
      src="/logo.png"
      alt="Pyntflow"
      style={{ height: typeof height === 'number' ? height * 1.2 : height, width: 'auto', display: 'block' }}
      className={`select-none transition-transform group-hover:scale-[1.02] duration-200 ${className}`}
    />
  );
};
