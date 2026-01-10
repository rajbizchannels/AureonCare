import React, { useState, useEffect } from 'react';
import {
  Search,
  X,
  Users,
  Calendar,
  UserCog,
  FileText,
  DollarSign,
  Pill,
  TestTube,
  Activity,
  CheckSquare,
  Briefcase,
  Megaphone,
  Shield,
  AlertCircle
} from 'lucide-react';
import { formatDate, formatTime } from '../../utils/formatters';
import api from '../../api/apiService';

const SearchPanel = ({
  theme,
  onClose,
  onSelectResult
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [onClose]);

  // Debounced search effect
  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery || searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await api.universalSearch(searchQuery, 20);
        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(performSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  // Get icon for result type
  const getResultIcon = (resultType) => {
    const iconProps = { className: "w-5 h-5" };

    switch (resultType) {
      case 'patient':
        return <Users {...iconProps} className="w-5 h-5 text-purple-400" />;
      case 'appointment':
        return <Calendar {...iconProps} className="w-5 h-5 text-blue-400" />;
      case 'provider':
        return <UserCog {...iconProps} className="w-5 h-5 text-green-400" />;
      case 'claim':
        return <FileText {...iconProps} className="w-5 h-5 text-orange-400" />;
      case 'payment':
        return <DollarSign {...iconProps} className="w-5 h-5 text-emerald-400" />;
      case 'prescription':
        return <Pill {...iconProps} className="w-5 h-5 text-pink-400" />;
      case 'lab_order':
        return <TestTube {...iconProps} className="w-5 h-5 text-cyan-400" />;
      case 'diagnosis':
        return <Activity {...iconProps} className="w-5 h-5 text-red-400" />;
      case 'task':
        return <CheckSquare {...iconProps} className="w-5 h-5 text-indigo-400" />;
      case 'offering':
        return <Briefcase {...iconProps} className="w-5 h-5 text-teal-400" />;
      case 'campaign':
        return <Megaphone {...iconProps} className="w-5 h-5 text-violet-400" />;
      case 'preapproval':
        return <Shield {...iconProps} className="w-5 h-5 text-amber-400" />;
      case 'denial':
        return <AlertCircle {...iconProps} className="w-5 h-5 text-rose-400" />;
      default:
        return <FileText {...iconProps} className="w-5 h-5 text-gray-400" />;
    }
  };

  // Get friendly type label
  const getTypeLabel = (resultType) => {
    const labels = {
      patient: 'Patient',
      appointment: 'Appointment',
      provider: 'Provider',
      claim: 'Claim',
      payment: 'Payment',
      prescription: 'Prescription',
      lab_order: 'Lab Order',
      diagnosis: 'Diagnosis',
      task: 'Task',
      offering: 'Service Offering',
      campaign: 'Campaign',
      preapproval: 'Pre-authorization',
      denial: 'Denial'
    };
    return labels[resultType] || resultType;
  };

  return (
    <div className={`fixed top-16 left-1/2 transform -translate-x-1/2 w-full max-w-3xl rounded-xl border shadow-2xl z-50 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`}>
      <div className="p-4">
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search across all modules: patients, appointments, claims, tasks, and more..."
            className={`w-full pl-10 pr-10 py-3 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'}`}
            autoFocus
          />
          <button onClick={onClose} className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}>
            <X className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        </div>
      </div>
      {searchQuery && searchQuery.trim().length >= 2 && (
        <div className={`border-t max-h-96 overflow-y-auto ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          {isSearching ? (
            <div className={`p-8 text-center ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cyan-500"></div>
                <span>Searching...</span>
              </div>
            </div>
          ) : searchResults.length > 0 ? (
            <div>
              {searchResults.map((result, idx) => (
                <div
                  key={`${result.result_type}-${result.id}-${idx}`}
                  onClick={() => {
                    onSelectResult(result);
                    onClose();
                  }}
                  className={`p-4 transition-colors cursor-pointer border-b last:border-b-0 hover:bg-opacity-50 ${theme === 'dark' ? 'hover:bg-slate-800 border-slate-800' : 'hover:bg-gray-100 border-gray-200'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getResultIcon(result.result_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {result.display_name}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-gray-200 text-gray-700'}`}>
                          {getTypeLabel(result.result_type)}
                        </span>
                      </div>
                      {result.display_subtitle && (
                        <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                          {result.display_subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`p-8 text-center ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              <p>No results found for "{searchQuery}"</p>
              <p className="text-sm mt-2">Try searching for patients, appointments, claims, providers, or other records</p>
            </div>
          )}
        </div>
      )}
      {(!searchQuery || searchQuery.trim().length < 2) && (
        <div className={`border-t p-4 ${theme === 'dark' ? 'border-slate-700 text-slate-400' : 'border-gray-300 text-gray-600'}`}>
          <p className="text-sm text-center">
            Start typing to search across all modules (minimum 2 characters)
          </p>
        </div>
      )}
    </div>
  );
};

export default SearchPanel;
