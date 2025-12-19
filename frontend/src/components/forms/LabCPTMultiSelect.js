import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

/**
 * Multi-select component for Laboratory CPT codes with live search
 * Similar to MedicalCodeMultiSelect but specifically for lab CPT codes (80000-89999 range)
 * Features:
 * - Live search as you type
 * - Comma-separated input support
 * - Selected codes shown as chips
 * - Keyboard navigation
 */
const LabCPTMultiSelect = ({
  theme,
  api,
  value = [], // Array of selected codes: [{code: '80047', description: '...'}]
  onChange,
  label,
  placeholder = 'Search lab CPT codes or type codes separated by commas...',
  required = false,
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

  // Get the search term (last term after last comma)
  const getSearchTerm = () => {
    const parts = inputValue.split(',');
    return parts[parts.length - 1].trim();
  };

  // Search for lab CPT codes
  const searchCodes = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    try {
      // Search CPT codes in 80000-89999 range (lab procedures)
      const response = await fetch(
        `${api.baseURL || 'http://localhost:3001/api'}/medical-codes/search?query=${encodeURIComponent(query)}&type=cpt`
      );
      const data = await response.json();

      // Filter for lab CPT codes (80000-89999) and exclude already selected
      const selectedCodes = value.map(v => v.code.toUpperCase());
      const filtered = data
        .filter(item => {
          const codeNum = parseInt(item.code);
          return codeNum >= 80000 && codeNum <= 89999 && !selectedCodes.includes(item.code.toUpperCase());
        });

      setSearchResults(filtered);
    } catch (error) {
      console.error('Error searching CPT codes:', error);
      // Fallback to common lab CPT codes if API fails
      const commonLabCPTCodes = [
        { code: '80047', description: 'Basic metabolic panel (Calcium, total)', type: 'CPT' },
        { code: '80048', description: 'Basic metabolic panel (Calcium, ionized)', type: 'CPT' },
        { code: '80050', description: 'General health panel', type: 'CPT' },
        { code: '80053', description: 'Comprehensive metabolic panel', type: 'CPT' },
        { code: '80061', description: 'Lipid panel', type: 'CPT' },
        { code: '81000', description: 'Urinalysis, by dip stick or tablet reagent', type: 'CPT' },
        { code: '81001', description: 'Urinalysis, automated with microscopy', type: 'CPT' },
        { code: '81002', description: 'Urinalysis, non-automated, with microscopy', type: 'CPT' },
        { code: '81003', description: 'Urinalysis, automated, without microscopy', type: 'CPT' },
        { code: '82947', description: 'Glucose; quantitative, blood', type: 'CPT' },
        { code: '83036', description: 'Hemoglobin; glycosylated (A1C)', type: 'CPT' },
        { code: '84439', description: 'Thyroid stimulating hormone (TSH)', type: 'CPT' },
        { code: '85025', description: 'Blood count; complete (CBC), automated', type: 'CPT' },
        { code: '85027', description: 'Blood count; complete (CBC) with differential', type: 'CPT' }
      ];

      const selectedCodes = value.map(v => v.code.toUpperCase());
      const search = query.toLowerCase();
      const filtered = commonLabCPTCodes.filter(item =>
        !selectedCodes.includes(item.code.toUpperCase()) &&
        (item.code.toLowerCase().includes(search) || item.description.toLowerCase().includes(search))
      );

      setSearchResults(filtered);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const searchTerm = getSearchTerm();

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchTerm.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchCodes(searchTerm);
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

  // Handle selecting a code from dropdown
  const selectCode = (code) => {
    const newValue = [...value, code];
    onChange(newValue);

    // Clear the last search term from input
    const parts = inputValue.split(',');
    parts.pop(); // Remove last term
    const newInput = parts.length > 0 ? parts.join(', ') + ', ' : '';
    setInputValue(newInput);

    setIsDropdownOpen(false);
    setSearchResults([]);
    inputRef.current?.focus();
  };

  // Handle removing a selected code
  const removeCode = (codeToRemove) => {
    const newValue = value.filter(item => item.code !== codeToRemove.code);
    onChange(newValue);
  };

  // Handle input change
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isDropdownOpen && searchResults.length === 0) {
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
        if (searchResults.length > 0 && highlightedIndex >= 0) {
          selectCode(searchResults[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsDropdownOpen(false);
        setSearchResults([]);
        break;
      case 'Backspace':
        // If input is empty or ends with comma+space, remove last selected item
        if ((inputValue === '' || inputValue === ', ') && value.length > 0) {
          e.preventDefault();
          removeCode(value[value.length - 1]);
        }
        break;
      default:
        break;
    }
  };

  // Handle input focus
  const handleFocus = () => {
    const searchTerm = getSearchTerm();
    if (searchTerm.length >= 2) {
      setIsDropdownOpen(true);
    }
  };

  return (
    <div className="w-full">
      {label && (
        <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {/* Input container with selected chips */}
        <div
          className={`min-h-[42px] border rounded-lg p-2 flex flex-wrap items-center gap-2 ${
            theme === 'dark'
              ? 'bg-slate-800 border-slate-600 text-white'
              : 'bg-white border-gray-300 text-gray-900'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text'}`}
          onClick={() => !disabled && inputRef.current?.focus()}
        >
          {/* Selected code chips */}
          {value.map((item, index) => (
            <div
              key={`${item.code}-${index}`}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                theme === 'dark'
                  ? 'bg-purple-900/50 text-purple-200 border border-purple-700'
                  : 'bg-purple-100 text-purple-800 border border-purple-300'
              }`}
            >
              <span className="font-bold">{item.code}</span>
              <span className="text-xs opacity-75 max-w-[200px] truncate">
                {item.description}
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeCode(item);
                  }}
                  className={`ml-1 hover:bg-red-500 hover:text-white rounded-full p-0.5 transition-colors ${
                    theme === 'dark' ? 'text-purple-300' : 'text-purple-600'
                  }`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}

          {/* Input field */}
          <div className="flex-1 flex items-center min-w-[200px]">
            <Search className={`w-4 h-4 mr-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              placeholder={value.length === 0 ? placeholder : ''}
              disabled={disabled}
              className={`flex-1 outline-none bg-transparent ${
                theme === 'dark' ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
              }`}
            />
            {isLoading && (
              <div className="ml-2">
                <div className={`animate-spin rounded-full h-4 w-4 border-b-2 ${
                  theme === 'dark' ? 'border-purple-400' : 'border-purple-600'
                }`}></div>
              </div>
            )}
          </div>
        </div>

        {/* Dropdown with search results */}
        {isDropdownOpen && searchResults.length > 0 && (
          <div
            ref={dropdownRef}
            className={`absolute z-50 w-full mt-1 max-h-60 overflow-auto rounded-lg border shadow-lg ${
              theme === 'dark'
                ? 'bg-slate-800 border-slate-600'
                : 'bg-white border-gray-300'
            }`}
          >
            {searchResults.map((item, index) => (
              <div
                key={`${item.code}-${index}`}
                onClick={() => selectCode(item)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`px-4 py-2 cursor-pointer transition-colors ${
                  highlightedIndex === index
                    ? theme === 'dark'
                      ? 'bg-purple-900/50'
                      : 'bg-purple-50'
                    : theme === 'dark'
                    ? 'hover:bg-slate-700'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className={`font-bold text-sm ${
                    theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                  }`}>
                    {item.code}
                  </span>
                  <span className={`px-1.5 py-0.5 text-xs rounded ${
                    theme === 'dark'
                      ? 'bg-purple-900/50 text-purple-300'
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    Lab CPT
                  </span>
                </div>
                <div className={`text-sm mt-1 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  {item.description}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No results message */}
        {isDropdownOpen && !isLoading && searchResults.length === 0 && getSearchTerm().length >= 2 && (
          <div
            ref={dropdownRef}
            className={`absolute z-50 w-full mt-1 rounded-lg border shadow-lg p-4 text-center ${
              theme === 'dark'
                ? 'bg-slate-800 border-slate-600 text-gray-400'
                : 'bg-white border-gray-300 text-gray-500'
            }`}
          >
            No lab CPT codes found matching "{getSearchTerm()}"
          </div>
        )}
      </div>

      {/* Helper text */}
      <div className={`mt-1 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
        Type to search lab tests (min 2 characters), or enter codes separated by commas. Selected: {value.length}
      </div>
    </div>
  );
};

export default LabCPTMultiSelect;
