import React, { useEffect, useRef } from 'react';
import { dwellController } from './DwellController';

interface DwellButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  id: string;
  onDwellTrigger: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'green' | 'gold' | 'danger' | 'ghost';
  className?: string;
}

export const DwellButton: React.FC<DwellButtonProps> = ({
  id,
  onDwellTrigger,
  children,
  variant = 'primary',
  className = '',
  onClick,
  ...rest
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = buttonRef.current;
    if (el) {
      dwellController.registerTarget(id, el, onDwellTrigger);
    }
    return () => {
      dwellController.unregisterTarget(id);
    };
  }, [id, onDwellTrigger]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      onClick(e);
    } else {
      onDwellTrigger();
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'green':
        return 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white border-2 border-emerald-400/50 shadow-lg shadow-emerald-900/40';
      case 'gold':
        return 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black border-2 border-yellow-200 shadow-lg shadow-amber-900/40';
      case 'danger':
        return 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white border border-red-400/30';
      case 'secondary':
        return 'bg-slate-800/80 hover:bg-slate-700/90 text-slate-200 border border-slate-600/50';
      case 'ghost':
        return 'bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md';
      case 'primary':
      default:
        return 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-2 border-blue-400/50 shadow-lg shadow-blue-900/40';
    }
  };

  return (
    <button
      ref={buttonRef}
      id={id}
      data-dwell-target={id}
      onClick={handleClick}
      className={`relative inline-flex items-center justify-center font-bold uppercase tracking-wider rounded-2xl px-6 py-4 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${getVariantStyles()} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};
