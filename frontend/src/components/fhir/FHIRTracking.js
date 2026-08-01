import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  ClipboardList,
  Clock,
  FlaskConical,
  Info,
  Loader2,
  Pill,
  Truck,
} from 'lucide-react';

import api from '../../api/apiService';

/**
 * Full tracking detail for one FHIR resource — header, error banner and the
 * event timeline. Looks the record up either by tracking number or by
 * resource type + id.
 */
const FHIRTracking = ({ trackingNumber, resourceType, resourceId, theme = 'light' }) => {
  const dark = theme === 'dark';

  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTracking = useCallback(async () => {
    try {
      setLoading(true);
      let record;
      if (trackingNumber) {
        record = await api.getFhirTracking(trackingNumber);
      } else if (resourceType && resourceId) {
        record = await api.getFhirTrackingForResource(resourceType, resourceId);
      } else {
        throw new Error('Either trackingNumber or resourceType and resourceId must be provided');
      }
      setTracking(record);
      setError(null);
    } catch (err) {
      console.error('Error fetching tracking:', err);
      setError(err.message || 'Failed to fetch tracking information');
    } finally {
      setLoading(false);
    }
  }, [trackingNumber, resourceType, resourceId]);

  useEffect(() => {
    fetchTracking();
  }, [fetchTracking]);

  const statusTone = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('completed')) return dark ? 'bg-green-500/15 text-green-300 border-green-500/30' : 'bg-green-50 text-green-700 border-green-200';
    if (s.includes('cancelled') || s.includes('error')) return dark ? 'bg-red-500/15 text-red-300 border-red-500/30' : 'bg-red-50 text-red-700 border-red-200';
    if (s.includes('on-hold')) return dark ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200';
    if (s.includes('pending') || s.includes('active')) return dark ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200';
    return dark ? 'bg-slate-700/50 text-slate-300 border-slate-600' : 'bg-gray-100 text-gray-600 border-gray-200';
  };

  const eventIcon = (eventType) => {
    switch (eventType) {
      case 'created': return ClipboardList;
      case 'status_change': return Clock;
      case 'vendor_sync': return Truck;
      case 'error': return AlertCircle;
      case 'completed': return CheckCircle;
      default: return Info;
    }
  };

  const eventDotTone = (event) => {
    if (event.is_error) return 'bg-red-500 text-white';
    if (event.event_type === 'completed' || event.event_type === 'error_resolved') return 'bg-green-500 text-white';
    if (event.event_type === 'vendor_sync') return 'bg-blue-500 text-white';
    return dark ? 'bg-slate-700 text-slate-300' : 'bg-gray-200 text-gray-600';
  };

  const panel = dark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-gray-200';
  const muted = dark ? 'text-slate-400' : 'text-gray-500';
  const heading = dark ? 'text-white' : 'text-gray-900';

  if (loading) {
    return (
      <div className={`flex items-center justify-center gap-2 py-10 ${muted}`}>
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading tracking…
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-xl border p-4 flex items-start gap-3 ${dark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'}`}>
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className={`font-medium ${dark ? 'text-red-300' : 'text-red-700'}`}>Error</p>
          <p className={`text-sm ${dark ? 'text-red-300/80' : 'text-red-600'}`}>{error}</p>
        </div>
      </div>
    );
  }

  if (!tracking) {
    return (
      <div className={`rounded-xl border p-4 flex items-start gap-3 ${dark ? 'bg-slate-900/50 border-slate-800' : 'bg-gray-50 border-gray-200'}`}>
        <Info className={`w-5 h-5 flex-shrink-0 mt-0.5 ${muted}`} />
        <div>
          <p className={`font-medium ${heading}`}>No tracking information</p>
          <p className={`text-sm ${muted}`}>Nothing has been tracked for this resource yet.</p>
        </div>
      </div>
    );
  }

  const isRx = tracking.resource_type === 'MedicationRequest';
  const ResourceIcon = isRx ? Pill : FlaskConical;

  const facts = [
    { label: 'Priority', value: tracking.priority },
    { label: 'Vendor', value: tracking.vendor_name },
    { label: 'Vendor Tracking ID', value: tracking.vendor_tracking_id },
    { label: 'Vendor Status', value: tracking.vendor_status },
  ].filter((f) => f.value);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className={`rounded-xl border p-5 ${panel}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ResourceIcon className={`w-5 h-5 ${dark ? 'text-cyan-400' : 'text-blue-600'}`} />
              <h3 className={`text-lg font-semibold ${heading}`}>
                {isRx ? 'Prescription' : 'Lab Order'} Tracking
              </h3>
            </div>
            <p className={`text-sm mt-1 ${muted}`}>
              Tracking Number: <span className={`font-mono font-medium ${heading}`}>{tracking.tracking_number}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`px-2.5 py-1 rounded-full border text-xs font-medium capitalize ${statusTone(tracking.current_status)}`}>
              {tracking.current_status}
            </span>
            {tracking.fhir_status && (
              <span className={`px-2.5 py-1 rounded-full border text-xs ${dark ? 'border-slate-700 text-slate-400' : 'border-gray-200 text-gray-500'}`}>
                FHIR: {tracking.fhir_status}
              </span>
            )}
          </div>
        </div>

        {facts.length > 0 && (
          <div className={`mt-4 pt-4 border-t grid grid-cols-2 lg:grid-cols-4 gap-4 ${dark ? 'border-slate-800' : 'border-gray-100'}`}>
            {facts.map((fact) => (
              <div key={fact.label} className="min-w-0">
                <p className={`text-xs ${muted}`}>{fact.label}</p>
                <p className={`text-sm truncate ${heading}`}>{fact.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Errors */}
      {tracking.has_errors && (
        <div
          className={`rounded-xl border p-4 ${
            tracking.action_required
              ? dark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'
              : dark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${tracking.action_required ? 'text-red-500' : 'text-amber-500'}`} />
            <div className="min-w-0 flex-1">
              <p className={`font-medium ${heading}`}>
                {tracking.action_required ? 'Action Required' : 'Error Encountered'}
              </p>
              <p className={`text-sm mt-0.5 ${muted}`}>{tracking.last_error_message}</p>

              {tracking.suggested_actions?.length > 0 && (
                <>
                  <p className={`text-xs font-semibold uppercase tracking-wider mt-3 mb-1.5 ${muted}`}>
                    Suggested actions
                  </p>
                  <ul className="space-y-1.5">
                    {tracking.suggested_actions.map((action, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium flex-shrink-0 ${dark ? 'bg-slate-700 text-slate-300' : 'bg-gray-200 text-gray-700'}`}>
                          {action.priority}
                        </span>
                        <span className="min-w-0">
                          <span className={`block text-sm ${heading}`}>{action.action}</span>
                          <span className={`block text-xs ${muted}`}>{action.type}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {tracking.action_required && tracking.action_deadline && (
                <p className={`text-xs mt-3 ${muted}`}>
                  Action deadline: {new Date(tracking.action_deadline).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      {tracking.events?.length > 0 && (
        <div className={`rounded-xl border p-5 ${panel}`}>
          <h3 className={`text-base font-semibold mb-4 ${heading}`}>Tracking Timeline</h3>
          <ol className="space-y-0">
            {tracking.events.map((event, index) => {
              const EventIcon = eventIcon(event.event_type);
              const isLast = index === tracking.events.length - 1;
              return (
                <li key={event.id || index} className="flex gap-3">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center ${eventDotTone(event)}`}>
                      <EventIcon className="w-3.5 h-3.5" />
                    </span>
                    {!isLast && <span className={`w-px flex-1 my-1 ${dark ? 'bg-slate-700' : 'bg-gray-200'}`} />}
                  </div>
                  <div className={`min-w-0 flex-1 ${isLast ? 'pb-0' : 'pb-5'}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className={`text-sm font-medium ${heading}`}>{event.event_description}</p>
                      <p className={`text-xs ${muted}`}>{new Date(event.created_at).toLocaleString()}</p>
                    </div>
                    {event.from_status && event.to_status && (
                      <p className={`text-sm ${muted}`}>{event.from_status} → {event.to_status}</p>
                    )}
                    {event.error_message && (
                      <div className={`mt-1.5 rounded-lg border px-3 py-2 ${dark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'}`}>
                        <p className={`text-sm ${dark ? 'text-red-300' : 'text-red-700'}`}>{event.error_message}</p>
                        {event.error_code && (
                          <p className={`text-xs mt-0.5 font-mono ${dark ? 'text-red-300/70' : 'text-red-500'}`}>
                            Error code: {event.error_code}
                          </p>
                        )}
                      </div>
                    )}
                    {event.action_taken && (
                      <p className={`text-sm mt-1 ${dark ? 'text-green-400' : 'text-green-600'}`}>
                        Action taken: {event.action_taken}
                        {event.action_result && ` (${event.action_result})`}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
};

export default FHIRTracking;
