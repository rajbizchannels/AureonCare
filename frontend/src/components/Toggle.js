import React from 'react';

/**
 * Toggle Switch Component
 *
 * A modern toggle switch to replace checkboxes
 *
 * @param {boolean} checked - Whether the toggle is on/off
 * @param {function} onChange - Callback when toggle is clicked
 * @param {string} label - Label text for the toggle
 * @param {string} theme - 'dark' or 'light' theme
 * @param {boolean} disabled - Whether the toggle is disabled
 * @param {string} size - 'sm', 'md', 'lg' size of toggle
 */
const Toggle = ({
  checked = false,
  onChange,
  label,
  theme = 'light',
  disabled = false,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: {
      container: 'w-9 h-5',
      circle: 'w-4 h-4',
      translate: 'translate-x-4'
    },
    md: {
      container: 'w-11 h-6',
      circle: 'w-5 h-5',
      translate: 'translate-x-5'
    },
    lg: {
      container: 'w-14 h-7',
      circle: 'w-6 h-6',
      translate: 'translate-x-7'
    }
  };

  const currentSize = sizeClasses[size] || sizeClasses.md;

  return (
    <label className={`flex items-center gap-3 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <div className="relative inline-flex items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div
          className={`${currentSize.container} rounded-full transition-colors duration-200 ease-in-out ${
            checked
              ? 'bg-blue-600'
              : theme === 'dark'
              ? 'bg-slate-700'
              : 'bg-gray-300'
          } ${disabled ? '' : 'peer-focus:ring-2 peer-focus:ring-blue-500 peer-focus:ring-offset-2'} ${
            theme === 'dark' ? 'peer-focus:ring-offset-slate-900' : 'peer-focus:ring-offset-white'
          }`}
        >
          <div
            className={`${currentSize.circle} rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
              checked ? currentSize.translate : 'translate-x-0.5'
            }`}
          />
        </div>
      </div>
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
