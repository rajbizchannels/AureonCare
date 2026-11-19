import React from 'react';
import { ToggleLeft, ToggleRight } from 'lucide-react';

/**
 * Toggle Switch Component
 *
 * The app-wide on/off switch. Same look as the Vendor Integrations card
 * (Settings › Integrations): lucide ToggleRight in green when on, ToggleLeft in grey when
 * off, faded when disabled. A visually hidden checkbox keeps keyboard and screen-reader
 * behaviour (role="switch").
 *
 * @param {boolean} checked - Whether the toggle is on/off
 * @param {function} onChange - Callback when toggle is clicked
 * @param {string} label - Label text for the toggle
 * @param {string} theme - 'dark' or 'light' theme
 * @param {boolean} disabled - Whether the toggle is disabled
 * @param {string} size - 'sm', 'md', 'lg' size of toggle
 * @param {string} ariaLabel - accessible name when there is no visible label
 */
const Toggle = ({
  checked = false,
  onChange,
  label,
  theme = 'light',
  disabled = false,
  size = 'md',
  ariaLabel
}) => {
  const iconSize = { sm: 'w-5 h-5', md: 'w-6 h-6', lg: 'w-7 h-7' }[size] || 'w-6 h-6';

  return (
    <label className={`flex items-center gap-3 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:opacity-80'} transition-opacity`}>
      <span className="relative inline-flex items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
          aria-label={label ? undefined : ariaLabel}
          role="switch"
          aria-checked={checked}
          className="sr-only peer"
        />
        {checked
          ? <ToggleRight aria-hidden="true" className={`${iconSize} text-green-400 rounded peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500`} />
          : <ToggleLeft aria-hidden="true" className={`${iconSize} text-gray-400 rounded peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500`} />}
      </span>
      {label && (
        <span className={`text-sm font-medium select-none ${
          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        }`}>
          {label}
        </span>
      )}
    </label>
  );
};

export default Toggle;
