import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Pill } from 'lucide-react';

/**
 * MedicationMultiSelect Component
 *
 * A multi-select dropdown with live search for medications
 * Features:
 * - Live search as you type
 * - Shows drug name, strength, and form
 * - Previously selected items displayed as chips
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 */
const MedicationMultiSelect = ({
  theme,
  value = [], // Array of selected medications: [{id, ndc_code, drug_name, strength, dosage_form, ...}]
  onChange,
  placeholder = 'Search medications...',
  label,
  required = false,
  api,
  disabled = false
}) => {
  const [inputValue, setInputValue] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Search for medications
  const searchMedications = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const data = await api.searchMedications(query, null, null, 20);

      // Filter out already selected medications
      const selectedNdcs = value.map(v => v.ndc_code);
      const filtered = data.filter(item => !selectedNdcs.includes(item.ndc_code));

      setSearchResults(filtered);
    } catch (error) {
      console.error('Error searching medications:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (inputValue.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchMedications(inputValue);
        setIsDropdownOpen(true);
      }, 300);
    } else {
      setSearchResults([]);
      setIsDropdownOpen(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [inputValue]);

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchResults]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        !inputRef.current.contains(event.target)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle selecting a medication from dropdown
  const selectMedication = (medication) => {
    const newValue = [...value, medication];
    onChange(newValue);
    setInputValue('');
    setIsDropdownOpen(false);
    setSearchResults([]);
    inputRef.current?.focus();
  };

  // Handle removing a selected medication
  const removeMedication = (medicationToRemove) => {
    const newValue = value.filter(item => item.ndc_code !== medicationToRemove.ndc_code);
    onChange(newValue);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isDropdownOpen || searchResults.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (searchResults[highlightedIndex]) {
          selectMedication(searchResults[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsDropdownOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className="relative">
      {label && (
        <label className={`block text-sm font-medium mb-2 ${
          theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
        }`}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Selected medications chips */}
      {value.length > 0 && (
        <div className={`flex flex-wrap gap-2 mb-2 p-2 rounded-lg border ${
          theme === 'dark' ? 'border-slate-600 bg-slate-800' : 'border-gray-300 bg-gray-50'
        }`}>
          {value.map((medication) => (
            <div
              key={medication.ndc_code}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm ${
                theme === 'dark'
                  ? 'bg-purple-900/30 text-purple-300 border border-purple-700'
                  : 'bg-purple-100 text-purple-800 border border-purple-300'
              }`}
            >
              <Pill className="w-3.5 h-3.5" />
              <span className="font-medium">
                {medication.drug_name}
                {medication.strength && ` ${medication.strength}`}
                {medication.dosage_form && ` (${medication.dosage_form})`}
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeMedication(medication)}
                  className={`hover:bg-red-500/20 rounded-full p-0.5 transition-colors ${
                    theme === 'dark' ? 'hover:text-red-400' : 'hover:text-red-600'
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
            theme === 'dark' ? 'text-slate-500' : 'text-gray-400'
          }`} />
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (inputValue.length >= 2) {
                setIsDropdownOpen(true);
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            className={`w-full pl-10 pr-4 py-2 rounded-lg border transition-colors ${
              disabled ? 'opacity-50 cursor-not-allowed' : ''
            } ${
              theme === 'dark'
                ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:border-purple-500'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-purple-500'
            } focus:outline-none focus:ring-2 focus:ring-purple-500/20`}
          />
        </div>

        {/* Dropdown results */}
        {isDropdownOpen && (
          <div
            ref={dropdownRef}
            className={`absolute z-50 w-full mt-1 rounded-lg border shadow-lg max-h-64 overflow-y-auto ${
              theme === 'dark'
                ? 'bg-slate-800 border-slate-600'
                : 'bg-white border-gray-300'
            }`}
          >
            {isLoading ? (
              <div className={`p-4 text-center text-sm ${
                theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
              }`}>
                Searching medications...
              </div>
            ) : searchResults.length === 0 ? (
              <div className={`p-4 text-center text-sm ${
                theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
              }`}>
                {inputValue.length < 2
                  ? 'Type at least 2 characters to search'
                  : 'No medications found'}
              </div>
            ) : (
              <div className="py-1">
                {searchResults.map((medication, index) => (
                  <button
                    key={medication.ndc_code}
                    type="button"
                    onClick={() => selectMedication(medication)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      index === highlightedIndex
                        ? theme === 'dark'
                          ? 'bg-purple-900/30'
                          : 'bg-purple-50'
                        : theme === 'dark'
                          ? 'hover:bg-slate-700'
                          : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <Pill className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>
                          {medication.drug_name}
                        </div>
                        <div className={`text-xs mt-0.5 ${
                          theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
                        }`}>
                          {medication.strength && <span>{medication.strength}</span>}
                          {medication.strength && medication.dosage_form && <span> • </span>}
                          {medication.dosage_form && <span>{medication.dosage_form}</span>}
                          {(medication.strength || medication.dosage_form) && medication.generic_name && <span> • </span>}
                          {medication.generic_name && <span className="italic">{medication.generic_name}</span>}
                        </div>
                        {medication.drug_class && (
                          <div className={`text-xs mt-1 ${
                            theme === 'dark' ? 'text-slate-500' : 'text-gray-500'
                          }`}>
                            {medication.drug_class}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Helper text */}
      {!disabled && (
        <p className={`text-xs mt-1.5 ${
          theme === 'dark' ? 'text-slate-500' : 'text-gray-500'
        }`}>
          Start typing to search medications. Use arrow keys to navigate.
        </p>
      )}
    </div>
  );
};

export default MedicationMultiSelect;
