import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  Alert,
  AlertTitle,
  Button,
  CircularProgress,
  Divider,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Grid
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Warning,
  Info,
  LocalShipping,
  Assignment,
  Science,
  Medication,
  AccessTime
} from '@mui/icons-material';
import axios from 'axios';

const FHIRTracking = ({ trackingNumber, resourceType, resourceId }) => {
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTracking();
  }, [trackingNumber, resourceType, resourceId]);

  const fetchTracking = async () => {
    try {
      setLoading(true);
      let response;

      if (trackingNumber) {
        response = await axios.get(`/api/fhir-tracking/${trackingNumber}`);
      } else if (resourceType && resourceId) {
        response = await axios.get(`/api/fhir-tracking/resource/${resourceType}/${resourceId}`);
      } else {
        throw new Error('Either trackingNumber or resourceType and resourceId must be provided');
      }

      setTracking(response.data.tracking);
      setError(null);
    } catch (err) {
      console.error('Error fetching tracking:', err);
      setError(err.response?.data?.error || 'Failed to fetch tracking information');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase();
    if (statusLower?.includes('completed')) return 'success';
    if (statusLower?.includes('cancelled') || statusLower?.includes('error')) return 'error';
    if (statusLower?.includes('pending') || statusLower?.includes('active')) return 'info';
    if (statusLower?.includes('on-hold')) return 'warning';
    return 'default';
  };

  const getEventIcon = (eventType) => {
    switch (eventType) {
      case 'created':
        return <Assignment />;
      case 'status_change':
        return <AccessTime />;
      case 'vendor_sync':
        return <LocalShipping />;
      case 'error':
        return <Error />;
      case 'completed':
        return <CheckCircle />;
      default:
        return <Info />;
    }
  };

  const getEventColor = (event) => {
    if (event.is_error) return 'error';
    if (event.event_type === 'completed') return 'success';
    if (event.event_type === 'error_resolved') return 'success';
    if (event.event_type === 'vendor_sync') return 'primary';
    return 'grey';
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
      case 'error':
        return <Error color="error" />;
      case 'warning':
        return <Warning color="warning" />;
      case 'info':
        return <Info color="info" />;
      default:
        return <Info color="info" />;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        <AlertTitle>Error</AlertTitle>
        {error}
      </Alert>
    );
  }

  if (!tracking) {
    return (
      <Alert severity="info">
        <AlertTitle>No Tracking Information</AlertTitle>
        No tracking information available for this resource.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <Box display="flex" alignItems="center" gap={1}>
                {tracking.resource_type === 'MedicationRequest' ? (
                  <Medication color="primary" />
                ) : (
                  <Science color="primary" />
                )}
                <Typography variant="h6">
                  {tracking.resource_type === 'MedicationRequest' ? 'Prescription' : 'Lab Order'} Tracking
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Tracking Number: <strong>{tracking.tracking_number}</strong>
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box display="flex" flexDirection="column" alignItems={{ xs: 'flex-start', md: 'flex-end' }} gap={1}>
                <Chip
                  label={tracking.current_status}
                  color={getStatusColor(tracking.current_status)}
                  size="medium"
                />
                {tracking.fhir_status && (
                  <Chip
                    label={`FHIR: ${tracking.fhir_status}`}
                    size="small"
                    variant="outlined"
                  />
                )}
              </Box>
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary">
                Priority
              </Typography>
              <Typography variant="body1">
                {tracking.priority || 'N/A'}
              </Typography>
            </Grid>
            {tracking.vendor_name && (
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary">
                  Vendor
                </Typography>
                <Typography variant="body1">
                  {tracking.vendor_name}
                </Typography>
              </Grid>
            )}
            {tracking.vendor_tracking_id && (
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary">
                  Vendor Tracking ID
                </Typography>
                <Typography variant="body1">
                  {tracking.vendor_tracking_id}
                </Typography>
              </Grid>
            )}
            {tracking.vendor_status && (
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary">
                  Vendor Status
                </Typography>
                <Typography variant="body1">
                  {tracking.vendor_status}
                </Typography>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {tracking.has_errors && (
        <Alert severity={tracking.action_required ? 'error' : 'warning'} sx={{ mb: 3 }}>
          <AlertTitle>
            {tracking.action_required ? 'Action Required' : 'Error Encountered'}
          </AlertTitle>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {tracking.last_error_message}
          </Typography>

          {tracking.suggested_actions && tracking.suggested_actions.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                Suggested Actions:
              </Typography>
              <List dense>
                {tracking.suggested_actions.map((action, index) => (
                  <ListItem key={index}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Typography variant="caption" color="primary">
                        {action.priority}
                      </Typography>
                    </ListItemIcon>
                    <ListItemText
                      primary={action.action}
                      secondary={action.type}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}

          {tracking.action_required && tracking.action_deadline && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              Action Deadline: {new Date(tracking.action_deadline).toLocaleString()}
            </Typography>
          )}
        </Alert>
      )}

      {/* Timeline */}
      {tracking.events && tracking.events.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Tracking Timeline
            </Typography>
            <Timeline>
              {tracking.events.map((event, index) => (
                <TimelineItem key={event.id || index}>
                  <TimelineSeparator>
                    <TimelineDot color={getEventColor(event)}>
                      {getEventIcon(event.event_type)}
                    </TimelineDot>
                    {index < tracking.events.length - 1 && <TimelineConnector />}
                  </TimelineSeparator>
                  <TimelineContent>
                    <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Box flex={1}>
                          <Typography variant="subtitle2">
                            {event.event_description}
                          </Typography>
                          {event.from_status && event.to_status && (
                            <Typography variant="body2" color="text.secondary">
                              {event.from_status} → {event.to_status}
                            </Typography>
                          )}
                          {event.error_message && (
                            <Alert severity={event.error_severity || 'error'} sx={{ mt: 1 }}>
                              {event.error_message}
                              {event.error_code && (
                                <Typography variant="caption" display="block">
                                  Error Code: {event.error_code}
                                </Typography>
                              )}
                            </Alert>
                          )}
                          {event.action_taken && (
                            <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
                              Action Taken: {event.action_taken}
                              {event.action_result && ` (${event.action_result})`}
                            </Typography>
                          )}
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                          {new Date(event.created_at).toLocaleString()}
                        </Typography>
                      </Box>
                    </Paper>
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default FHIRTracking;
