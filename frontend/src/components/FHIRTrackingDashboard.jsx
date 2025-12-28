import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Alert,
  AlertTitle,
  CircularProgress,
  Button,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  Visibility,
  Error,
  Warning,
  Medication,
  Science
} from '@mui/icons-material';
import axios from 'axios';

const FHIRTrackingDashboard = ({ patientId, onViewTracking }) => {
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);

  useEffect(() => {
    fetchErrorsRequiringAction();
  }, [patientId]);

  const fetchErrorsRequiringAction = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/fhir-tracking/errors/action-required');

      let errorData = response.data.errors || [];

      // Filter by patient if patientId is provided
      if (patientId) {
        // We'd need to join with prescriptions/lab_orders to filter by patient
        // For now, showing all errors
      }

      setErrors(errorData);
      setError(null);
    } catch (err) {
      console.error('Error fetching tracking errors:', err);
      setError(err.response?.data?.error || 'Failed to fetch tracking errors');
    } finally {
      setLoading(false);
    }
  };

  const handleExpandRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'info';
    }
  };

  const getResourceIcon = (resourceType) => {
    return resourceType === 'MedicationRequest' ? (
      <Medication fontSize="small" />
    ) : (
      <Science fontSize="small" />
    );
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

  if (errors.length === 0) {
    return (
      <Alert severity="success">
        <AlertTitle>All Clear!</AlertTitle>
        No tracking items require attention at this time.
      </Alert>
    );
  }

  return (
    <Box>
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              FHIR Tracking - Action Required ({errors.length})
            </Typography>
            <Button
              startIcon={<ExpandMore />}
              onClick={fetchErrorsRequiringAction}
              size="small"
            >
              Refresh
            </Button>
          </Box>

          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell width="50px" />
                  <TableCell>Type</TableCell>
                  <TableCell>Tracking Number</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Error</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Vendor</TableCell>
                  <TableCell>Last Error</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {errors.map((item) => (
                  <React.Fragment key={item.id}>
                    <TableRow hover>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleExpandRow(item.id)}
                        >
                          {expandedRow === item.id ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          {getResourceIcon(item.resource_type)}
                          <Typography variant="body2">
                            {item.resource_type === 'MedicationRequest' ? 'Rx' : 'Lab'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {item.tracking_number}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={item.current_status} size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={item.last_error_code || 'Error'}
                          size="small"
                          color={getSeverityColor(item.error_severity)}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={item.error_severity || 'unknown'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        {item.vendor_name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {item.last_error_at
                            ? new Date(item.last_error_at).toLocaleString()
                            : 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => onViewTracking && onViewTracking(item.tracking_number)}
                        >
                          <Visibility />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={9} sx={{ p: 0 }}>
                        <Collapse in={expandedRow === item.id} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Error Details
                            </Typography>
                            <Alert severity={getSeverityColor(item.error_severity)} sx={{ mb: 2 }}>
                              <AlertTitle>{item.error_title || 'Error'}</AlertTitle>
                              <Typography variant="body2">
                                {item.last_error_message}
                              </Typography>
                              {item.error_description && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                  {item.error_description}
                                </Typography>
                              )}
                            </Alert>

                            {item.suggested_actions && item.suggested_actions.length > 0 && (
                              <>
                                <Typography variant="subtitle2" gutterBottom>
                                  Suggested Actions
                                </Typography>
                                <List dense>
                                  {item.suggested_actions.map((action, index) => (
                                    <ListItem key={index}>
                                      <ListItemIcon sx={{ minWidth: 36 }}>
                                        <Chip
                                          label={action.priority}
                                          size="small"
                                          color="primary"
                                        />
                                      </ListItemIcon>
                                      <ListItemText
                                        primary={action.action}
                                        secondary={`Type: ${action.type}`}
                                      />
                                    </ListItem>
                                  ))}
                                </List>
                              </>
                            )}

                            {item.resolution_guide && (
                              <>
                                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                                  Resolution Guide
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {item.resolution_guide}
                                </Typography>
                              </>
                            )}

                            {item.requires_manual_intervention && (
                              <Alert severity="warning" sx={{ mt: 2 }}>
                                This issue requires manual intervention
                              </Alert>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};

export default FHIRTrackingDashboard;
