import React from 'react';
import { AlertCircle, CheckCircle, RefreshCw, Truck } from 'lucide-react';

/**
 * Compact status badge for a FHIR tracking record. Drops into lists, table
 * cells and cards next to a prescription or lab order.
 */
const FHIRTrackingBadge = ({ trackingData, onClick, theme = 'light' }) => {
  if (!trackingData) return null;

  const dark = theme === 'dark';

  const { Icon, label, tone } = (() => {
    if (trackingData.has_errors) {
      return trackingData.action_required
        ? { Icon: AlertCircle, label: 'Action Required', tone: 'red' }
        : { Icon: AlertCircle, label: 'Error', tone: 'amber' };
    }
    if (trackingData.current_status === 'completed') {
      return { Icon: CheckCircle, label: 'Completed', tone: 'green' };
    }
    if (trackingData.vendor_tracking_id) {
      return { Icon: Truck, label: trackingData.current_status || 'In Transit', tone: 'blue' };
    }
    return { Icon: RefreshCw, label: trackingData.current_status || 'Tracking Active', tone: 'slate' };
  })();

  const tones = {
    red: dark ? 'bg-red-500/15 text-red-300 border-red-500/30' : 'bg-red-50 text-red-700 border-red-200',
    amber: dark ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200',
    green: dark ? 'bg-green-500/15 text-green-300 border-green-500/30' : 'bg-green-50 text-green-700 border-green-200',
    blue: dark ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200',
    slate: dark ? 'bg-slate-700/50 text-slate-300 border-slate-600' : 'bg-gray-100 text-gray-600 border-gray-200',
  };

  // Native title attribute keeps the detail on hover without a tooltip library.
  const tooltip = [
    `Tracking: ${trackingData.tracking_number}`,
    trackingData.vendor_name && `Vendor: ${trackingData.vendor_name}`,
    trackingData.vendor_tracking_id && `Vendor ID: ${trackingData.vendor_tracking_id}`,
    trackingData.has_errors && `Error: ${trackingData.last_error_message}`,
    trackingData.has_errors && trackingData.error_count > 1 && `Total Errors: ${trackingData.error_count}`,
  ]
    .filter(Boolean)
    .join('\n');

  const Element = onClick ? 'button' : 'span';

  return (
    <Element
      {...(onClick ? { onClick, type: 'button' } : {})}
      title={tooltip}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${tones[tone]} ${
        onClick ? 'hover:opacity-80 transition-opacity cursor-pointer' : ''
      }`}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="capitalize">{label}</span>
    </Element>
  );
};

export default FHIRTrackingBadge;
