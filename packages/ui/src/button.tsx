import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * The primary action primitive.
 *
 * Variants map to the §6 accent system rather than to colour names, so a
 * palette change is a token change. `gold` is the Zedek accent and is used
 * sparingly — §6 is explicit that accents lose their meaning when everything
 * carries one.
 */
export type ButtonVariant = 'gold' | 'ink' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  /** Leading decoration. Marked aria-hidden: it must never carry meaning alone. */
  readonly icon?: ReactNode;
}

const SIZES: Record<ButtonSize, { padding: string; fontSize: string; minHeight: string }> = {
  // 44px minimum height throughout: §32 requires touch targets that a thumb
  // can hit, and the design is mobile-first (§5).
  sm: { padding: '0 0.95rem', fontSize: '0.8125rem', minHeight: '2.5rem' },
  md: { padding: '0 1.4rem', fontSize: '0.9375rem', minHeight: '2.875rem' },
  lg: { padding: '0 1.9rem', fontSize: '1rem', minHeight: '3.25rem' },
};

const VARIANTS: Record<ButtonVariant, React.CSSProperties> = {
  gold: {
    background: 'linear-gradient(135deg, #e3c884 0%, #c5a253 52%, #ae8c40 100%)',
    color: '#1c2430',
    border: '1px solid rgba(197,162,83,0.55)',
    boxShadow: '0 1px 2px rgba(23,32,51,0.28), inset 0 1px 0 rgba(255,255,255,0.35)',
  },
  ink: {
    background: 'var(--color-action)',
    color: 'var(--color-action-text)',
    border: '1px solid transparent',
  },
  ghost: {
    background: 'rgba(255,255,255,0.08)',
    color: '#f3f0e8',
    border: '1px solid rgba(255,255,255,0.22)',
    backdropFilter: 'blur(8px)',
  },
  outline: {
    background: 'transparent',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border)',
  },
};

export function Button({
  variant = 'gold',
  size = 'md',
  icon,
  children,
  style,
  type = 'button',
  ...rest
}: ButtonProps) {
  const dims = SIZES[size];

  return (
    <button
      // Explicit, because a button inside a form defaults to submit and
      // silently submitting is a real bug rather than a style choice.
      type={type}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.55rem',
        borderRadius: '999px',
        fontFamily: 'var(--font-ui)',
        fontWeight: 600,
        letterSpacing: '0.01em',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease',
        ...dims,
        ...VARIANTS[variant],
        ...style,
      }}
      {...rest}
    >
      {icon ? <span aria-hidden="true" style={{ display: 'inline-flex' }}>{icon}</span> : null}
      {children}
    </button>
  );
}
