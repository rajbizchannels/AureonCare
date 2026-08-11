import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * A native <select> wearing the same chrome as the code multi-selects.
 *
 * The multi-selects draw their own box, so beside them a bare <select> reads as
 * a different control: different height, an OS-drawn arrow, and — in dark mode —
 * a white option list. This keeps the markup native (so keyboard, mobile and
 * form validation all behave) but paints the box to match and hands the browser
 * a colour scheme for the popup list.
 *
 * Props are passed straight through, so it drops in wherever a <select> was.
 */
// Most callers pass the app's theme prop. A few screens style themselves with
// Tailwind's `dark:` variants instead and have no theme in scope; omitting the
// prop falls back to those, so the select still matches its neighbours.
const PALETTE = {
  dark: {
    box: 'bg-slate-800 border-slate-600 text-white focus:border-blue-500',
    chevron: 'text-slate-400',
  },
  light: {
    box: 'bg-white border-gray-300 text-gray-900 focus:border-blue-500',
    chevron: 'text-gray-500',
  },
  auto: {
    box: 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 '
       + 'text-gray-900 dark:text-white focus:border-blue-500 '
       + '[color-scheme:light] dark:[color-scheme:dark]',
    chevron: 'text-gray-500 dark:text-slate-400',
  },
};

const ThemedSelect = ({ theme, className = '', children, disabled, ...props }) => {
  const mode = theme === 'dark' ? 'dark' : theme === 'light' ? 'light' : 'auto';
  const palette = PALETTE[mode];

  const style = mode === 'auto'
    ? props.style
    : { colorScheme: mode, ...(props.style || {}) };

  return (
    <div className="relative">
      <select
        {...props}
        disabled={disabled}
        style={style}
        className={`w-full min-h-[42px] appearance-none border rounded-lg pl-3 pr-9 py-2 outline-none transition-colors ${
          palette.box
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 ${palette.chevron}`}
      />
    </div>
  );
};

export default ThemedSelect;
