import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Eye,
  FlaskConical,
  Loader2,
  Pill,
  RefreshCw,
} from 'lucide-react';

import api from '../../api/apiService';

/**
 * Worklist of FHIR tracking records whose errors need someone to act. Rows
 * expand to show the error detail, suggested actions and resolution guide.
 */
const FHIRTrackingDashboard = ({ onViewTracking, theme = 'light' }) => {
  const dark = theme === 'dark';

  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);

  const fetchErrorsRequiringAction = useCallback(async () => {
    try {
      setLoading(true);
      setErrors(await api.getFhirTrackingErrors());
      setError(null);
    } catch (err) {
      console.error('Error fetching tracking errors:', err);
      setError(err.message || 'Failed to fetch tracking errors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchErrorsRequiringAction();
  }, [fetchErrorsRequiringAction]);

  const severityTone = (severity) => {
    switch (severity) {
      case 'critical':
      case 'error':
        return dark ? 'bg-red-500/15 text-red-300 border-red-500/30' : 'bg-red-50 text-red-700 border-red-200';
      case 'warning':
        return dark ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return dark ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const panel = dark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-gray-200';
  const muted = dark ? 'text-slate-400' : 'text-gray-500';
  const heading = dark ? 'text-white' : 'text-gray-900';
  const chip = dark ? 'bg-slate-700/50 text-slate-300 border-slate-600' : 'bg-gray-100 text-gray-600 border-gray-200';

  if (loading) {
    return (
      <div className={`flex items-center justify-center gap-2 py-10 ${muted}`}>
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading tracking errors…
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-xl border p-4 flex items-start gap-3 ${dark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'}`}>
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className={`font-medium ${dark ? 'text-red-300' : 'text-red-700'}`}>Error</p>
          <p className={`text-sm ${dark ? 'text-red-300/80' : 'text-red-600'}`}>{error}</p>
        </div>
        <button
          onClick={fetchErrorsRequiringAction}
          className={`px-3 py-1.5 rounded-lg text-sm ${dark ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className={`text-base font-semibold ${heading}`}>
          Action required{errors.length > 0 && ` (${errors.length})`}
        </h3>
        <button
          onClick={fetchErrorsRequiringAction}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            dark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {errors.length === 0 ? (
        <div className={`rounded-xl border p-6 flex items-start gap-3 ${dark ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'}`}>
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className={`font-medium ${heading}`}>All clear</p>
            <p className={`text-sm ${muted}`}>No tracking items need attention right now.</p>
          </div>
        </div>
      ) : (
        <div className={`rounded-xl border overflow-hidden ${panel}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={dark ? 'bg-slate-800/50' : 'bg-gray-50'}>
                <tr className={`text-left ${muted}`}>
                  <th className="w-10 px-3 py-2.5" />
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 font-medium">Tracking Number</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Error</th>
                  <th className="px-3 py-2.5 font-medium">Severity</th>
                  <th className="px-3 py-2.5 font-medium">Vendor</th>
                  <th className="px-3 py-2.5 font-medium">Last Error</th>
                  <th className="px-3 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((item) => {
                  const expanded = expandedRow === item.id;
                  const ResourceIcon = item.resource_type === 'MedicationRequest' ? Pill : FlaskConical;
                  return (
                    <React.Fragment key={item.id}>
                      <tr className={`border-t ${dark ? 'border-slate-800 hover:bg-slate-800/40' : 'border-gray-100 hover:bg-gray-50'}`}>
                        <td className="px-3 py-2.5">
                          <button
                            onClick={() => setExpandedRow(expanded ? null : item.id)}
                            aria-expanded={expanded}
                            aria-label={expanded ? 'Hide error detail' : 'Show error detail'}
                            className={`p-1 rounded ${dark ? 'text-slate-400 hover:bg-slate-700' : 'text-gray-400 hover:bg-gray-100'}`}
                          >
                            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`flex items-center gap-1.5 ${heading}`}>
                            <ResourceIcon className={`w-4 h-4 ${muted}`} />
                            {item.resource_type === 'MedicationRequest' ? 'Rx' : 'Lab'}
                          </span>
                        </td>
                        <td className={`px-3 py-2.5 font-mono text-xs ${heading}`}>{item.tracking_number}</td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full border text-xs capitalize ${chip}`}>
                            {item.current_status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full border text-xs ${severityTone(item.error_severity)}`}>
                            {item.last_error_code || 'Error'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full border text-xs capitalize ${chip}`}>
                            {item.error_severity || 'unknown'}
                          </span>
                        </td>
                        <td className={`px-3 py-2.5 ${heading}`}>{item.vendor_name || 'N/A'}</td>
                        <td className={`px-3 py-2.5 text-xs ${muted}`}>
                          {item.last_error_at ? new Date(item.last_error_at).toLocaleString() : 'N/A'}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            onClick={() => onViewTracking && onViewTracking(item.tracking_number)}
                            title="View tracking detail"
                            className={`p-1.5 rounded-lg ${dark ? 'text-slate-400 hover:bg-slate-700 hover:text-slate-100' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'}`}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>

                      {expanded && (
                        <tr className={dark ? 'bg-slate-800/30' : 'bg-gray-50'}>
                          <td colSpan={9} className="px-4 py-4">
                            <div className={`rounded-lg border p-3 ${severityTone(item.error_severity)}`}>
                              <p className="font-medium">{item.error_title || 'Error'}</p>
                              <p className="text-sm mt-0.5">{item.last_error_message}</p>
                              {item.error_description && (
                                <p className="text-sm mt-1 opacity-80">{item.error_description}</p>
                              )}
                            </div>

                            {item.suggested_actions?.length > 0 && (
                              <>
                                <p className={`text-xs font-semibold uppercase tracking-wider mt-4 mb-1.5 ${muted}`}>
                                  Suggested actions
                                </p>
                                <ul className="space-y-1.5">
                                  {item.suggested_actions.map((action, index) => (
                                    <li key={index} className="flex items-start gap-2">
                                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium flex-shrink-0 border ${chip}`}>
                                        {action.priority}
                                      </span>
                                      <span className="min-w-0">
                                        <span className={`block ${heading}`}>{action.action}</span>
                                        <span className={`block text-xs ${muted}`}>Type: {action.type}</span>
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </>
                            )}

                            {item.resolution_guide && (
                              <>
                                <p className={`text-xs font-semibold uppercase tracking-wider mt-4 mb-1 ${muted}`}>
                                  Resolution guide
                                </p>
                                <p className={`text-sm ${muted}`}>{item.resolution_guide}</p>
                              </>
                            )}

                            {item.requires_manual_intervention && (
                              <div className={`mt-3 rounded-lg border px-3 py-2 flex items-center gap-2 text-sm ${dark ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                This issue requires manual intervention.
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default FHIRTrackingDashboard;
