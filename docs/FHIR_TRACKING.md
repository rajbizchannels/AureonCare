# FHIR Tracking System

## Overview

The FHIR Tracking System provides comprehensive end-to-end tracking for FHIR resources (MedicationRequest and ServiceRequest) with automatic error handling, vendor integration monitoring, and actionable suggestions for issue resolution.

## Features

### 1. End-to-End Tracking
- **Unique Tracking Numbers**: Each prescription and lab order gets a unique tracking number (RX-* or LAB-*)
- **Status Monitoring**: Real-time status updates throughout the lifecycle
- **Vendor Integration**: Track interactions with external vendors (Surescripts, Labcorp)
- **Event Timeline**: Complete audit trail of all status changes and events

### 2. Error Handling
- **Automatic Error Detection**: Intelligent error code determination based on error messages
- **Suggested Actions**: Pre-configured action plans for common errors
- **Priority-Based Resolution**: Actions are prioritized by importance
- **Auto-Retry Support**: Configurable automatic retry for transient errors

### 3. FHIR Compliance
- **FHIR R4 Resources**: Full support for MedicationRequest and ServiceRequest
- **Status Mapping**: Automatic mapping between internal and FHIR statuses
- **Resource Storage**: FHIR resources stored in standardized format

## Database Schema

### Tables

#### `fhir_tracking`
Main tracking table for FHIR resources.

**Key Fields:**
- `tracking_number`: Unique tracking identifier (RX-YYYYMMDDHHMMSS-XXXXXX or LAB-YYYYMMDDHHMMSS-XXXXXX)
- `resource_type`: MedicationRequest or ServiceRequest
- `current_status`: Current tracking status
- `fhir_status`: Official FHIR status
- `vendor_tracking_id`: External vendor tracking ID
- `has_errors`: Boolean flag for error state
- `suggested_actions`: JSONB array of suggested fix actions
- `action_required`: Boolean flag for manual intervention needed

#### `fhir_tracking_events`
Event log for all tracking changes.

**Event Types:**
- `created`: Initial creation
- `status_change`: Status update
- `vendor_sync`: Vendor interaction
- `error`: Error occurred
- `error_resolved`: Error fixed
- `completed`: Resource completed

#### `fhir_error_actions`
Lookup table for error resolution guidance.

**Predefined Errors:**
- `MED_REQ_INVALID_PATIENT`: Invalid patient reference
- `MED_REQ_INVALID_MEDICATION`: Invalid medication code
- `MED_REQ_MISSING_PRESCRIBER`: Missing prescriber info
- `MED_REQ_PHARMACY_ERROR`: Pharmacy system error
- `SVC_REQ_INVALID_TEST_CODE`: Invalid lab test code
- `SVC_REQ_SPECIMEN_ERROR`: Specimen collection issue
- `SVC_REQ_LAB_UNAVAILABLE`: Laboratory system unavailable
- `FHIR_AUTH_ERROR`: Authentication failure
- `FHIR_NETWORK_ERROR`: Network connection error
- `FHIR_RATE_LIMIT`: API rate limit exceeded

### Views

#### `v_prescription_tracking`
Combined view of prescriptions with tracking data.

#### `v_lab_order_tracking`
Combined view of lab orders with tracking data.

#### `v_fhir_tracking_errors`
View of all tracking records with errors and suggested actions.

#### `v_fhir_tracking_timeline`
Complete timeline view for tracking events.

## API Endpoints

### Get Tracking by Tracking Number
```
GET /api/fhir-tracking/:trackingNumber
```

**Response:**
```json
{
  "success": true,
  "tracking": {
    "id": "uuid",
    "tracking_number": "RX-20250101120000-ABC123",
    "resource_type": "MedicationRequest",
    "current_status": "active",
    "has_errors": false,
    "events": [...]
  }
}
```

### Get Tracking by Resource
```
GET /api/fhir-tracking/resource/:resourceType/:resourceId
```

**Parameters:**
- `resourceType`: MedicationRequest or ServiceRequest
- `resourceId`: Internal resource ID (prescription ID or lab order ID)

### Get Patient Tracking Summary
```
GET /api/fhir-tracking/patient/:patientId/summary
```

**Response:**
```json
{
  "success": true,
  "patientId": "uuid",
  "prescriptions": [...],
  "labOrders": [...],
  "summary": {
    "total_prescriptions": 10,
    "total_lab_orders": 5,
    "prescriptions_with_errors": 1,
    "lab_orders_with_errors": 0,
    "items_requiring_action": 1
  }
}
```

### Get Errors Requiring Action
```
GET /api/fhir-tracking/errors/action-required
```

Returns all tracking records with errors that require manual intervention.

### Get Tracking Timeline
```
GET /api/fhir-tracking/:trackingId/timeline
```

Returns complete event timeline for a tracking record.

### Update Tracking Status
```
PUT /api/fhir-tracking/:trackingId/status
```

**Request Body:**
```json
{
  "status": "completed",
  "statusReason": "Prescription filled",
  "vendorStatus": "completed",
  "vendorTrackingId": "VENDOR-123"
}
```

### Record Error
```
POST /api/fhir-tracking/:trackingId/error
```

**Request Body:**
```json
{
  "errorCode": "MED_REQ_PHARMACY_ERROR",
  "errorMessage": "Pharmacy system unavailable",
  "errorDetails": {},
  "vendorName": "surescripts"
}
```

### Resolve Error
```
POST /api/fhir-tracking/:trackingId/resolve-error
```

**Request Body:**
```json
{
  "actionTaken": "Retried sending to pharmacy",
  "actionResult": "success"
}
```

## Backend Integration

### Prescription Tracking

When creating a prescription:
```javascript
const tracking = await fhirTrackingIntegration.initializePrescriptionTracking({
  prescriptionId: prescription.id,
  prescription,
  patientData: patient,
  providerData: provider,
  vendorName: 'surescripts',
  userId: providerId
});
```

Recording vendor interaction:
```javascript
await fhirTrackingIntegration.recordPrescriptionVendorInteraction({
  prescriptionId: prescription.id,
  vendorName: 'surescripts',
  vendorTrackingId: vendorResponse.vendorId,
  vendorStatus: vendorResponse.status,
  vendorResponse: vendorResponse.response,
  success: true,
  userId: providerId
});
```

Recording errors:
```javascript
await fhirTrackingIntegration.recordPrescriptionError({
  prescriptionId: prescription.id,
  errorMessage: error.message,
  errorDetails: { response: error.response },
  vendorName: 'surescripts',
  userId: providerId
});
```

### Lab Order Tracking

Similar pattern as prescriptions:
```javascript
await fhirTrackingIntegration.initializeLabOrderTracking({
  labOrderId: labOrder.id,
  labOrder,
  vendorName: 'labcorp',
  userId: providerId
});
```

## Frontend Components

### FHIRTracking Component

Displays complete tracking information with timeline.

**Usage:**
```jsx
import FHIRTracking from './components/FHIRTracking';

<FHIRTracking trackingNumber="RX-20250101120000-ABC123" />

// OR

<FHIRTracking resourceType="MedicationRequest" resourceId="123" />
```

### FHIRTrackingBadge Component

Compact badge for displaying in lists.

**Usage:**
```jsx
import FHIRTrackingBadge from './components/FHIRTrackingBadge';

<FHIRTrackingBadge
  trackingData={trackingInfo}
  onClick={() => handleViewTracking(trackingInfo.tracking_number)}
/>
```

### FHIRTrackingDashboard Component

Dashboard view showing all items requiring action.

**Usage:**
```jsx
import FHIRTrackingDashboard from './components/FHIRTrackingDashboard';

<FHIRTrackingDashboard
  patientId={patientId}
  onViewTracking={(trackingNumber) => handleView(trackingNumber)}
/>
```

## Error Handling Flow

1. **Error Occurs**: During prescription/lab order creation or vendor sync
2. **Error Detection**: System determines error code based on message pattern
3. **Action Lookup**: System retrieves suggested actions from `fhir_error_actions` table
4. **Error Recording**: Error logged with suggested actions in tracking
5. **Notification**: Error appears in tracking dashboard if action required
6. **Resolution**: User follows suggested actions
7. **Error Resolution**: User marks error as resolved with action taken

## Status Flow

### Prescription (MedicationRequest)
1. **Draft/Active** → Initial creation
2. **Active** → Sent to pharmacy
3. **Completed** → Prescription filled
4. **Cancelled** → Prescription cancelled
5. **On-Hold** → Temporarily paused
6. **Stopped** → Discontinued

### Lab Order (ServiceRequest)
1. **Pending** → Initial creation
2. **Active/Sent_to_Lab** → Sent to laboratory
3. **In_Progress** → Sample collected/processing
4. **Completed** → Results received
5. **Cancelled** → Order cancelled

## Configuration

### Adding New Error Actions

Insert into `fhir_error_actions` table:
```sql
INSERT INTO fhir_error_actions (
  error_code,
  error_pattern,
  resource_type,
  vendor_name,
  error_title,
  error_description,
  error_severity,
  suggested_actions,
  requires_manual_intervention
) VALUES (
  'CUSTOM_ERROR',
  'pattern.*to.*match',
  'MedicationRequest',
  NULL,
  'Custom Error Title',
  'Description of the error',
  'error',
  '[
    {"priority": 1, "action": "First action", "type": "verification"},
    {"priority": 2, "action": "Second action", "type": "update"}
  ]'::jsonb,
  TRUE
);
```

## Migration

Run the migration to set up tracking tables:
```bash
cd backend
psql -U aureoncare_user -d aureoncare_db -f migrations/035_add_fhir_tracking.sql
```

## Monitoring & Maintenance

### Check for Items Requiring Action
```sql
SELECT * FROM v_fhir_tracking_errors
WHERE action_required = TRUE;
```

### View Tracking Statistics
```sql
SELECT
  resource_type,
  COUNT(*) as total,
  SUM(CASE WHEN has_errors THEN 1 ELSE 0 END) as with_errors,
  SUM(CASE WHEN action_required THEN 1 ELSE 0 END) as requiring_action
FROM fhir_tracking
GROUP BY resource_type;
```

### View Recent Tracking Events
```sql
SELECT * FROM v_fhir_tracking_timeline
WHERE event_time >= NOW() - INTERVAL '24 hours'
ORDER BY event_time DESC;
```

## Best Practices

1. **Always Initialize Tracking**: Call tracking initialization immediately after creating prescriptions/lab orders
2. **Record All Vendor Interactions**: Log both successful and failed vendor responses
3. **Use Specific Error Codes**: Provide error codes when available for better action suggestions
4. **Update Status Regularly**: Keep tracking status in sync with actual resource status
5. **Monitor Action Required Items**: Regularly check dashboard for items needing attention
6. **Document Custom Errors**: Add new error patterns to the lookup table as they're discovered

## Troubleshooting

### Tracking Not Created
- Check that `fhirTrackingIntegration` is imported and called after resource creation
- Verify migration has been run and tables exist
- Check application logs for tracking initialization errors

### No Suggested Actions
- Error code might not exist in `fhir_error_actions` table
- Check error pattern matching in the table
- Consider adding new error action definition

### Events Not Showing
- Verify tracking ID exists in `fhir_tracking` table
- Check that events are being logged (look at `fhir_tracking_events` table directly)
- Ensure frontend is fetching from correct endpoint

## Future Enhancements

- [ ] Webhook notifications for error events
- [ ] Automated retry mechanism for transient errors
- [ ] Machine learning for error pattern detection
- [ ] Integration with monitoring/alerting systems
- [ ] Bulk tracking operations
- [ ] Export tracking data for analytics
