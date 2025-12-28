import React from 'react';
import { Box, Chip, Tooltip, IconButton } from '@mui/material';
import { CheckCircle, Error, Warning, LocalShipping, Sync } from '@mui/icons-material';

/**
 * Compact badge component to show FHIR tracking status
 * Can be used in lists, cards, etc.
 */
const FHIRTrackingBadge = ({ trackingData, onClick }) => {
  if (!trackingData) {
    return null;
  }

  const getIcon = () => {
    if (trackingData.has_errors) {
      return <Error fontSize="small" />;
    }
    if (trackingData.vendor_tracking_id) {
      return <LocalShipping fontSize="small" />;
    }
    if (trackingData.current_status === 'completed') {
      return <CheckCircle fontSize="small" />;
    }
    return <Sync fontSize="small" />;
  };

  const getColor = () => {
    if (trackingData.has_errors) {
      return trackingData.action_required ? 'error' : 'warning';
    }
    if (trackingData.current_status === 'completed') {
      return 'success';
    }
    if (trackingData.vendor_tracking_id) {
      return 'primary';
    }
    return 'default';
  };

  const getLabel = () => {
    if (trackingData.has_errors) {
      return trackingData.action_required ? 'Action Required' : 'Error';
    }
    return trackingData.current_status || 'Tracking Active';
  };

  const getTooltip = () => {
    const parts = [`Tracking: ${trackingData.tracking_number}`];

    if (trackingData.vendor_name) {
      parts.push(`Vendor: ${trackingData.vendor_name}`);
    }

    if (trackingData.vendor_tracking_id) {
      parts.push(`Vendor ID: ${trackingData.vendor_tracking_id}`);
    }

    if (trackingData.has_errors) {
      parts.push(`Error: ${trackingData.last_error_message}`);
      if (trackingData.error_count > 1) {
        parts.push(`Total Errors: ${trackingData.error_count}`);
      }
    }

    return parts.join('\n');
  };

  return (
    <Tooltip title={getTooltip()} arrow>
      <Chip
        icon={getIcon()}
        label={getLabel()}
        color={getColor()}
        size="small"
        onClick={onClick}
        sx={{
          cursor: onClick ? 'pointer' : 'default',
          '&:hover': onClick ? { opacity: 0.8 } : {}
        }}
      />
    </Tooltip>
  );
};

export default FHIRTrackingBadge;
