import { useEffect, useId, useRef, type ReactNode } from 'react';
import { dwellEngine } from './DwellEngine';

interface DwellButtonProps {
  onSelect: () => void;
  children: ReactNode;
  className?: string;
  /** Visual weight. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'chip';
  disabled?: boolean;
  durationMs?: number;
  ariaLabel?: string;
  id?: string;
}

const VARIANTS: Record<string, string> = {
  primary: 'dwell-btn dwell-btn--primary',
  secondary: 'dwell-btn dwell-btn--secondary',
  ghost: 'dwell-btn dwell-btn--ghost',
  chip: 'dwell-btn dwell-btn--chip',
};

/**
 * A control that can be activated three ways — dwell (hand), click (mouse/touch)
 * and Enter (keyboard) — so the same UI works on a signage wall and on a laptop.
 */
export function DwellButton({
  onSelect,
  children,
  className = '',
  variant = 'primary',
  disabled = false,
  durationMs,
  ariaLabel,
  id,
}: DwellButtonProps) {
  const generatedId = useId();
  const targetId = id ?? generatedId;
  const ref = useRef<HTMLButtonElement>(null);
  const handler = useRef(onSelect);
  handler.current = onSelect;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return dwellEngine.register({
      id: targetId,
      element: el,
      onSelect: () => handler.current(),
      durationMs,
      disabled,
    });
  }, [targetId, durationMs, disabled]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    dwellEngine.update({ id: targetId, element: el, onSelect: () => handler.current(), durationMs, disabled });
  }, [disabled, durationMs, targetId]);

  return (
    <button
      ref={ref}
      id={targetId}
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      className={`${VARIANTS[variant]} ${className}`}
      onClick={() => !disabled && handler.current()}
    >
      <span className="dwell-btn__fill" aria-hidden="true" />
      <span className="dwell-btn__label">{children}</span>
    </button>
  );
}
