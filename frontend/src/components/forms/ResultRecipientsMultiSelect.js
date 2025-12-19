import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

/**
 * Multi-select component for selecting result recipients
 * Similar to MedicalCodeMultiSelect but for selecting people (doctors, staff, patients)
 * Features:
 * - Live search as you type
 * - Selected recipients shown as chips
 * - Keyboard navigation
 */
const ResultRecipientsMultiSelect = ({
  theme,
  value = [], // Array of selected recipients: [{id: '...', name: '...', type: 'doctor|staff|patient'}]
  onChange,
  label,
  placeholder = 'Search or select recipients...',
  required = false,
  disabled = false,
  doctor = null, // Currently signed in doctor
  staff = [], // List of staff members
  patient = null // Selected patient
}) => {
  const [inputValue, setInputValue] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Build list of all available recipients
  const allRecipients = React.useMemo(() => {
    const recipients = [];

    // Add doctor
    if (doctor) {
      const doctorName = `${doctor.first_name || doctor.firstName || ''} ${doctor.last_name || doctor.lastName || ''}`.trim() || 'Doctor';
      recipients.push({
        id: doctor.id,
        name: doctorName,
        type: 'doctor',
        displayName: `${doctorName} (Doctor)`
      });
    }

    // Add staff
    if (staff && staff.length > 0) {
      staff.forEach(s => {
        const staffName = `${s.first_name || s.firstName || ''} ${s.last_name || s.lastName || ''}`.trim() || 'Staff Member';
        recipients.push({
          id: s.id,
          name: staffName,
          type: 'staff',
          displayName: `${staffName} (Staff)`
        });
      });
    }

    // Add patient
    if (patient) {
      const patientName = `${patient.first_name || patient.firstName || ''} ${patient.last_name || patient.lastName || ''}`.trim() || 'Patient';
      recipients.push({
        id: patient.id,
        name: patientName,
        type: 'patient',
        displayName: `${patientName} (Patient)`
      });
    }

    return recipients;
  }, [doctor, staff, patient]);

  // Search recipients
  const searchRecipients = (query) => {
    if (!query || query.length < 1) {
      setSearchResults(allRecipients);
      return;
    }

    const search = query.toLowerCase();
    const selectedIds = value.map(v => v.id);
    const filtered = allRecipients.filter(item =>
      !selectedIds.includes(item.id) &&
      (item.name.toLowerCase().includes(search) || item.displayName.toLowerCase().includes(search))
    );

    setSearchResults(filtered);
  };

  // Update search results when input changes
  useEffect(() => {
    searchRecipients(inputValue);
  }, [inputValue, allRecipients, value]);

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

  // Handle selecting a recipient from dropdown
  const selectRecipient = (recipient) => {
    const newValue = [...value, recipient];
    onChange(newValue);

    setInputValue('');
    setIsDropdownOpen(false);
    setSearchResults([]);
    inputRef.current?.focus();
  };

  // Handle removing a selected recipient
  const removeRecipient = (recipientToRemove) => {
    const newValue = value.filter(item => item.id !== recipientToRemove.id);
    onChange(newValue);
  };

  // Handle input change
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    if (!isDropdownOpen) {
      setIsDropdownOpen(true);
    }
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
          selectRecipient(searchResults[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsDropdownOpen(false);
        setSearchResults([]);
        break;
      case 'Backspace':
        // If input is empty, remove last selected item
        if (inputValue === '' && value.length > 0) {
          e.preventDefault();
          removeRecipient(value[value.length - 1]);
        }
        break;
      default:
        break;
    }
  };

  // Handle input focus
  const handleFocus = () => {
    setIsDropdownOpen(true);
    searchRecipients(inputValue);
  };

  // Get color for recipient type
  const getRecipientColor = (type) => {
    switch (type) {
      case 'doctor':
        return theme === 'dark'
          ? 'bg-blue-900/50 text-blue-200 border-blue-700'
          : 'bg-blue-100 text-blue-800 border-blue-300';
      case 'staff':
        return theme === 'dark'
          ? 'bg-green-900/50 text-green-200 border-green-700'
          : 'bg-green-100 text-green-800 border-green-300';
      case 'patient':
        return theme === 'dark'
          ? 'bg-orange-900/50 text-orange-200 border-orange-700'
          : 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return theme === 'dark'
          ? 'bg-gray-900/50 text-gray-200 border-gray-700'
          : 'bg-gray-100 text-gray-800 border-gray-300';
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
          {/* Selected recipient chips */}
          {value.map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${getRecipientColor(item.type)}`}
            >
              <span className="font-medium">{item.name}</span>
              <span className="text-xs opacity-75">({item.type})</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRecipient(item);
                  }}
                  className="ml-1 hover:bg-red-500 hover:text-white rounded-full p-0.5 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}

          {/* Input field */}
          <div className="flex-1 flex items-center min-w-[150px]">
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
                key={`${item.id}-${index}`}
                onClick={() => selectRecipient(item)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`px-4 py-2 cursor-pointer transition-colors ${
                  highlightedIndex === index
                    ? theme === 'dark'
                      ? 'bg-blue-900/50'
                      : 'bg-blue-50'
                    : theme === 'dark'
                    ? 'hover:bg-slate-700'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`font-medium text-sm ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    {item.name}
                  </span>
                  <span className={`px-1.5 py-0.5 text-xs rounded ${
                    item.type === 'doctor'
                      ? theme === 'dark'
                        ? 'bg-blue-900/50 text-blue-300'
                        : 'bg-blue-100 text-blue-700'
                      : item.type === 'staff'
                      ? theme === 'dark'
                        ? 'bg-green-900/50 text-green-300'
                        : 'bg-green-100 text-green-700'
                      : theme === 'dark'
                      ? 'bg-orange-900/50 text-orange-300'
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No results message */}
        {isDropdownOpen && searchResults.length === 0 && inputValue.length > 0 && (
          <div
            ref={dropdownRef}
            className={`absolute z-50 w-full mt-1 rounded-lg border shadow-lg p-4 text-center ${
              theme === 'dark'
                ? 'bg-slate-800 border-slate-600 text-gray-400'
                : 'bg-white border-gray-300 text-gray-500'
            }`}
          >
            No recipients found matching "{inputValue}"
          </div>
        )}
      </div>

      {/* Helper text */}
      <div className={`mt-1 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
        Select who should receive the lab results. Selected: {value.length}
      </div>
    </div>
  );
};

export default ResultRecipientsMultiSelect;
