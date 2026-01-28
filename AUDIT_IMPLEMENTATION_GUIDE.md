# Audit Logging Implementation Guide

This guide provides comprehensive instructions for adding audit logging to all forms, modals, and views in AureonCare.

## Table of Contents
- [Overview](#overview)
- [Quick Start](#quick-start)
- [Implementation Patterns](#implementation-patterns)
- [Component List](#component-list)
- [Examples](#examples)

## Overview

The audit logging system tracks all user interactions with forms, modals, and views across the AureonCare application. It provides:

- **Comprehensive Tracking**: View, create, update, delete actions
- **Detailed Context**: User info, timestamps, IP addresses, duration
- **Data Changes**: Before/after values for updates
- **Error Tracking**: Failed actions and error messages
- **Security**: Audit trail for compliance and security monitoring

## Quick Start

### 1. Import the useAudit Hook

```javascript
import { useAudit } from '../../hooks/useAudit';
```

### 2. Initialize the Hook

```javascript
const { logFormView, logFormSubmit, logCreate, logUpdate, logDelete, logError, logModalOpen, logModalClose, logViewAccess, startAction } = useAudit();
```

### 3. Add Logging Calls

See the implementation patterns below for specific examples.

## Implementation Patterns

### Pattern 1: Forms

Forms should log three main events:
1. **View**: When the form opens
2. **Submit**: When the form is submitted (with success/failure)
3. **Create/Update**: When data is successfully saved

#### Example (DiagnosisForm.js - ALREADY IMPLEMENTED):

```javascript
import { useAudit } from '../../hooks/useAudit';

const DiagnosisForm = ({ theme, api, patient, ...props }) => {
  const { logFormView, logCreate, logUpdate, logError, startAction } = useAudit();

  // Log form view on mount
  useEffect(() => {
    startAction(); // Start timing
    logFormView('DiagnosisForm', {
      module: 'EHR',
      patient_id: patient?.id,
      metadata: {
        mode: editMode ? 'edit' : 'create',
      },
    });
  }, []);

  const handleSubmit = async () => {
    try {
      const result = await api.createDiagnosis(data);

      // Log successful creation
      logCreate('DiagnosisForm', data, {
        module: 'EHR',
        resource_id: result.id,
        patient_id: data.patientId,
        provider_id: data.providerId,
      });

      // Or log update if editing
      if (editMode) {
        logUpdate('DiagnosisForm', oldData, newData, {
          module: 'EHR',
          resource_id: result.id,
          patient_id: data.patientId,
        });
      }
    } catch (error) {
      // Log errors
      logError('DiagnosisForm', 'form', error.message, {
        module: 'EHR',
        patient_id: data.patientId,
      });
    }
  };
};
```

### Pattern 2: Modals

Modals should log:
1. **Open**: When modal opens
2. **Close**: When modal closes
3. **Submit** (if applicable): When action is taken

#### Example (CredentialModal.js):

```javascript
import { useAudit } from '../../hooks/useAudit';

const CredentialModal = ({ isOpen, onClose, providerName, ...props }) => {
  const { logModalOpen, logModalClose, logError, startAction } = useAudit();

  useEffect(() => {
    if (isOpen) {
      startAction();
      logModalOpen('CredentialModal', {
        module: 'Admin',
        metadata: {
          provider: providerName,
        },
      });
    }
  }, [isOpen]);

  const handleClose = () => {
    logModalClose('CredentialModal', {
      module: 'Admin',
      metadata: {
        provider: providerName,
      },
    });
    onClose();
  };

  const handleSubmit = async () => {
    try {
      await api.saveCredentials(credentials);
      logModalClose('CredentialModal', {
        module: 'Admin',
        status: 'success',
      });
      onClose();
    } catch (error) {
      logError('CredentialModal', 'modal', error.message, {
        module: 'Admin',
      });
    }
  };
};
```

### Pattern 3: Views/Pages

Views should log access when the component mounts:

#### Example (PatientLoginPage.js):

```javascript
import { useAudit } from '../../hooks/useAudit';

const PatientLoginPage = () => {
  const { logViewAccess, logError } = useAudit();

  useEffect(() => {
    logViewAccess('PatientLoginPage', {
      module: 'Patient Portal',
    });
  }, []);

  const handleLogin = async (credentials) => {
    try {
      await api.login(credentials);
      // Login success is logged by auth system
    } catch (error) {
      logError('PatientLoginPage', 'view', error.message, {
        module: 'Patient Portal',
        metadata: {
          email: credentials.email,
        },
      });
    }
  };
};
```

## Component List

### Forms (21 total)

Apply **Pattern 1** to these forms:

1. ✅ **DiagnosisForm.js** - ALREADY IMPLEMENTED
2. **MedicalRecordUploadForm.js** - Module: 'EHR', track file uploads
3. **NewAppointmentForm.js** - Module: 'Scheduling', track patient_id, provider_id
4. **NewAppointmentTypeForm.js** - Module: 'Admin', track configuration changes
5. **NewCampaignForm.js** - Module: 'CRM', track campaign data
6. **NewClaimForm.js** - Module: 'RCM', track claim_id, patient_id
7. **NewConsentFormForm.js** - Module: 'Admin', track form template creation
8. **NewDenialForm.js** - Module: 'RCM', track claim_id, denial reason
9. **NewHealthcareOfferingForm.js** - Module: 'Offerings', track offering details
10. **NewInsurancePayerForm.js** - Module: 'RCM', track payer info
11. **NewIntakeFlowForm.js** - Module: 'Patient Intake', track flow configuration
12. **NewIntakeFormForm.js** - Module: 'Patient Intake', track form template
13. **NewLaboratoryForm.js** - Module: 'EHR', track lab info
14. **NewLabOrderForm.js** - Module: 'EHR', track patient_id, provider_id, lab tests
15. **NewPatientForm.js** - Module: 'EHR', track patient creation
16. **NewPaymentForm.js** - Module: 'RCM', track payment_id, patient_id, amount
17. **NewPaymentPostingForm.js** - Module: 'RCM', track claim_id, payment details
18. **NewPharmacyForm.js** - Module: 'EHR', track pharmacy info
19. **NewPreapprovalForm.js** - Module: 'RCM', track claim_id, patient_id
20. **NewTaskForm.js** - Module: 'Practice Management', track task assignment
21. **NewUserForm.js** - Module: 'Admin', track user creation/updates

### Modals (9 total)

Apply **Pattern 2** to these modals:

1. **CredentialModal.js** - Module: 'Admin', track provider type
2. **ePrescribeModal.js** - Module: 'EHR', track patient_id, medication
3. **ForgotPasswordModal.js** - Module: 'Auth', track email
4. **PatientLoginPage.js** - Module: 'Patient Portal'
5. **RegisterPage.js** - Module: 'Auth', track registration attempts
6. **SettingsModal.js** - Module: 'Settings', track settings changes
7. **UserFormModal.js** - Module: 'Admin', track user operations
8. **UserProfileModal.js** - Module: 'Profile', track profile updates
9. **ViewEditModal.js** - Module: 'General', track viewed entity

### Views (21 total)

Apply **Pattern 3** to these views:

1. **AdminPanelView.backup.js** - Module: 'Admin'
2. **AdminPanelView.js** - Module: 'Admin'
3. **AppointmentTypesManagementView.js** - Module: 'Admin'
4. **CampaignsManagementView.js** - Module: 'CRM'
5. **ClinicalServicesView.js** - Module: 'EHR'
6. **CRMView.js** - Module: 'CRM'
7. **DashboardView.js** - Module: 'Dashboard'
8. **EHRView.js** - Module: 'EHR'
9. **FHIRView.js** - Module: 'FHIR'
10. **IntegrationsView.js** - Module: 'Admin'
11. **LaboratoryManagementView.js** - Module: 'EHR'
12. **OfferingManagementView.js** - Module: 'Offerings'
13. **PatientDiagnosisView.js** - Module: 'EHR', track patient_id
14. **PatientHistoryView.js** - Module: 'EHR', track patient_id
15. **PatientIntakeView.js** - Module: 'Patient Intake', track patient_id
16. **PatientPortalView.js** - Module: 'Patient Portal', track patient_id
17. **PharmacyManagementView.js** - Module: 'EHR'
18. **PracticeManagementView.js** - Module: 'Practice Management'
19. **ProviderManagementView.js** - Module: 'Admin'
20. **RCMView.js** - Module: 'RCM'
21. **ReportsView.js** - Module: 'Reports'
22. **TelehealthView.js** - Module: 'Telehealth', track session_id
23. **WaitlistManagementView.js** - Module: 'Scheduling'

## Best Practices

### 1. Always Include Module Information

```javascript
logFormView('MyForm', {
  module: 'EHR', // or 'RCM', 'Admin', 'CRM', etc.
  // ... other options
});
```

### 2. Track Related Entities

```javascript
logCreate('NewClaimForm', claimData, {
  module: 'RCM',
  patient_id: claim.patient_id,
  claim_id: result.id,
  provider_id: claim.provider_id,
});
```

### 3. Include Meaningful Metadata

```javascript
logFormView('NewPaymentForm', {
  module: 'RCM',
  metadata: {
    payment_method: 'credit_card',
    amount: formData.amount,
  },
});
```

### 4. Always Log Errors

```javascript
try {
  await api.submitForm(data);
} catch (error) {
  logError('MyForm', 'form', error.message, {
    module: 'EHR',
    metadata: { formData: data },
  });
  throw error;
}
```

### 5. Use startAction() for Duration Tracking

```javascript
useEffect(() => {
  startAction(); // Starts timer
  logFormView('MyForm', {
    module: 'EHR',
    includeDuration: true, // Will include time from startAction() to this call
  });
}, []);
```

## Testing

After adding audit logging to a component:

1. **Open the component** - Check that a 'view' audit log is created
2. **Perform actions** - Verify create/update/delete logs are created
3. **Trigger errors** - Confirm error logs are created
4. **Check Admin Panel** - View logs in Admin Panel > Audit Logs tab
5. **Verify data** - Ensure all relevant IDs and metadata are captured

## Viewing Audit Logs

1. Navigate to **Admin Panel** (admin users only)
2. Click the **Audit Logs** tab
3. Use filters to find specific logs:
   - Filter by user email
   - Filter by action type (view, create, update, delete)
   - Filter by resource (form, modal, view)
   - Filter by date range
4. Click **View Details** to see full log information
5. Use **Export** button to download logs as CSV

## Permissions

By default, only users with the **admin** role can:
- View audit logs
- Export audit logs
- Delete old audit logs

This is configured in the database migration `040_create_audit_logs_table.sql`.

## Maintenance

### Automatic Cleanup

The audit logs table can grow large over time. Use the cleanup endpoint:

```bash
DELETE /api/audit/cleanup?days=90
```

This deletes logs older than 90 days (configurable).

### Manual Cleanup

Administrators can delete old logs from the Admin Panel or via API.

## Troubleshooting

### Logs Not Appearing

1. Check browser console for errors
2. Verify API is running: `http://localhost:3001/health`
3. Check database migration 040 was run
4. Verify user has required permissions

### Missing Context Data

Ensure you're passing all relevant IDs:
- patient_id
- provider_id
- claim_id
- etc.

### Performance Issues

If audit logging is slowing down the app:
1. Check that audit API calls are not blocking UI (they shouldn't be)
2. Verify database indexes are created (they are in migration 040)
3. Consider implementing rate limiting for high-frequency actions

## Summary

This comprehensive audit logging system provides:
- ✅ Complete audit trail for compliance
- ✅ Security monitoring and breach detection
- ✅ User activity tracking
- ✅ Error tracking and debugging
- ✅ Performance monitoring (via duration tracking)
- ✅ Easy integration with existing components
- ✅ Admin GUI for viewing and managing logs

For questions or issues, refer to the useAudit hook source code at `frontend/src/hooks/useAudit.js`.
