/**
 * Design tokens, lifted from the web app rather than re-picked.
 *
 * frontend/ runs stock Tailwind 3.4 with an empty `theme.extend`, so every
 * value here is the literal Tailwind colour the web components already use
 * (slate-* surfaces, the cyan-500 → blue-500 accent). Keeping the hexes
 * literal — not re-derived — is what stops the two apps drifting apart.
 */

export const palette = {
  // Surfaces (dark is the default; the web app defaults to dark too)
  bg: '#020617',        // slate-950 — app background
  surface: '#0f172a',   // slate-900 — header, tab bar, cards
  raised: '#1e293b',    // slate-800 — inputs, secondary buttons
  border: '#334155',    // slate-700 — card borders
  hairline: '#1e293b',  // slate-800 — dividers inside surfaces

  // Text
  text: '#ffffff',
  textSecondary: '#94a3b8', // slate-400
  textMuted: '#64748b',     // slate-500
  textFaint: '#475569',     // slate-600
  textStrong: '#cbd5e1',    // slate-300
  textOnRaised: '#f1f5f9',  // slate-100

  // Accent — the app's one gradient, cyan-500 → blue-500
  accentFrom: '#06b6d4',
  accentTo: '#3b82f6',
  accent: '#22d3ee',        // cyan-400, for active icons and links

  // Status
  success: '#22c55e',
  successText: '#4ade80',
  warning: '#f59e0b',
  warningText: '#d97706',
  danger: '#ef4444',
  info: '#14b8a6',
  violet: '#a855f7',
} as const;

/** Translucent fills, matching the web's `bg-<color>/N` utilities. */
export const tint = {
  accentSoft: 'rgba(6,182,212,0.10)',
  successSoft: 'rgba(34,197,94,0.14)',
  warningSoft: 'rgba(245,158,11,0.15)',
  warningBorder: 'rgba(245,158,11,0.30)',
  dangerSoft: 'rgba(239,68,68,0.08)',
  dangerBorder: 'rgba(239,68,68,0.35)',
  infoSoft: 'rgba(20,184,166,0.08)',
  infoBorder: 'rgba(20,184,166,0.35)',
  neutralSoft: 'rgba(148,163,184,0.12)',
} as const;

/** Tailwind's type scale — size paired with its line-height. */
export const type = {
  xs: { fontSize: 12, lineHeight: 16 },
  sm: { fontSize: 13, lineHeight: 18 },
  base: { fontSize: 14, lineHeight: 20 },
  md: { fontSize: 15, lineHeight: 20 },
  lg: { fontSize: 16, lineHeight: 22 },
  xl: { fontSize: 19, lineHeight: 26 },
  display: { fontSize: 22, lineHeight: 28 },
} as const;

export const radius = {
  sm: 7,
  md: 8,   // rounded-lg
  lg: 12,  // rounded-xl
  pill: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
} as const;

/**
 * Minimum tap target. Both platforms' guidance lands at 44pt; the scope doc
 * calls it out explicitly, so it is a token rather than a number sprinkled
 * through the screens.
 */
export const HIT_SLOP_MIN = 44;
