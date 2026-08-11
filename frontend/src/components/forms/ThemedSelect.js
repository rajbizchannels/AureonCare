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
const ThemedSelect = ({ theme, className = '', children, disabled, ...props }) => {
  const dark = theme === 'dark';

  return (
    <div className="relative">
      <select
        {...props}
        disabled={disabled}
        style={{ colorScheme: dark ? 'dark' : 'light', ...(props.style || {}) }}
        className={`w-full min-h-[42px] appearance-none border rounded-lg pl-3 pr-9 py-2 outline-none transition-colors ${
          dark
            ? 'bg-slate-800 border-slate-600 text-white focus:border-blue-500'
            : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
          dark ? 'text-slate-400' : 'text-gray-500'
        }`}
      />
    </div>
  );
};

export default ThemedSelect;
