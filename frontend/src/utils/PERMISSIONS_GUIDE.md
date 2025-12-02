# Role-Based Access Control (RBAC) Guide

This guide explains how to use the role-based permission system in MedFlow.

## Overview

MedFlow uses a comprehensive RBAC system that controls access to modules and features based on user roles. The system combines:
- **Plan-based access** (starter, professional, enterprise)
- **Role-based permissions** (admin, doctor, patient, nurse, receptionist, billing_manager, crm_manager, staff)

## User Roles

### System Roles

1. **admin** - Full system access including user management, settings, and all modules
2. **doctor** - Medical provider with access to patients, appointments, and EHR
3. **patient** - Limited access to patient portal, appointments, and their own records
4. **nurse** - Clinical staff with patient care support access
5. **receptionist** - Front desk with appointment and patient management
6. **billing_manager** - Billing and claims management access
7. **crm_manager** - Customer relationship management access
8. **staff** - General staff with limited viewing access

## Permission Modules

The system controls access to these modules:
- `patients` - Patient management
- `appointments` - Appointment scheduling
- `billing` - Billing and claims
- `crm` - Customer relationship management
- `ehr` - Electronic health records
- `reports` - System reports
- `admin` - Administrative functions

Each module has actions:
- `view` - View data
- `create` - Create new records
- `edit` - Modify existing records
- `delete` - Remove records
- `process` - Special actions (e.g., process payments)
- `export` - Export data

## Usage in Components

### Using the Hook

```javascript
import { usePermissions } from '../hooks/usePermissions';

function MyComponent() {
  const {
    hasPermission,
    canAccessModule,
    canPerformAction,
    isAdmin,
    isProvider,
    isPatient,
    user
  } = usePermissions();

  // Check if user can view patients
  if (hasPermission('patients', 'view')) {
    // Show patient list
  }

  // Check if user can create appointments
  if (canPerformAction('appointments', 'create')) {
    // Show "New Appointment" button
  }

  // Check if user can access EHR module
  if (canAccessModule('ehr')) {
    // Show EHR navigation link
  }

  // Role-based checks
  if (isAdmin()) {
    // Show admin-only features
  }

  return (
    <div>
      {/* Conditionally render based on permissions */}
      {hasPermission('patients', 'create') && (
        <button>Add Patient</button>
      )}

      {hasPermission('billing', 'view') && (
        <BillingSection />
      )}
    </div>
  );
}
```

### Using Utility Functions Directly

```javascript
import {
  hasPermission,
  canAccessModule,
  canPerformAction,
  isAdmin
} from '../utils/rolePermissions';

// In a function where you have the user object
function checkUserAccess(user) {
  if (hasPermission(user, 'patients', 'edit')) {
    // User can edit patients
  }

  if (canAccessModule(user, 'ehr')) {
    // User can access EHR
  }

  if (isAdmin(user)) {
    // User is an admin
  }
}
```

## Examples

### Hide/Show Buttons Based on Permissions

```javascript
function PatientList() {
  const { hasPermission } = usePermissions();

  return (
    <div>
      <h1>Patients</h1>

      {/* Only show Add button if user can create patients */}
      {hasPermission('patients', 'create') && (
        <button onClick={handleAddPatient}>Add Patient</button>
      )}

      {/* Only show Delete button if user can delete patients */}
      {hasPermission('patients', 'delete') && (
        <button onClick={handleDeletePatient}>Delete</button>
      )}
    </div>
  );
}
```

### Filter Navigation Items

```javascript
function Navigation() {
  const { canAccessModule } = usePermissions();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', module: 'dashboard' },
    { id: 'patients', label: 'Patients', module: 'practiceManagement' },
    { id: 'billing', label: 'Billing', module: 'rcm' },
    { id: 'reports', label: 'Reports', module: 'reports' },
    { id: 'admin', label: 'Admin', module: 'adminPanel' }
  ];

  // Filter navigation based on user permissions
  const accessibleNavItems = navItems.filter(item =>
    canAccessModule(item.module)
  );

  return (
    <nav>
      {accessibleNavItems.map(item => (
        <NavItem key={item.id} {...item} />
      ))}
    </nav>
  );
}
```

### Conditional Form Fields

```javascript
function AppointmentForm() {
  const { hasPermission, isProvider } = usePermissions();

  return (
    <form>
      <input name="patientName" />
      <input name="date" />

      {/* Only providers can add diagnosis */}
      {isProvider() && (
        <textarea name="diagnosis" placeholder="Diagnosis" />
      )}

      {/* Only users with billing access can see pricing */}
      {hasPermission('billing', 'view') && (
        <input name="price" type="number" />
      )}
    </form>
  );
}
```

## Permission Matrix

| Role | Patients | Appointments | Billing | CRM | EHR | Reports | Admin |
|------|----------|-------------|---------|-----|-----|---------|-------|
| **admin** | Full | Full | Full | Full | Full | Full | Full |
| **doctor** | Full | Full | - | - | Full | View | - |
| **patient** | - | View/Create | - | - | View | - | - |
| **nurse** | View/Edit | View/Edit | - | - | View/Edit | - | - |
| **receptionist** | View/Edit | View/Edit | - | - | - | - | - |
| **billing_manager** | View | - | Full | - | - | View | - |
| **crm_manager** | - | - | - | Full | - | View | - |
| **staff** | View | View | - | - | - | - | - |

*Full = View/Create/Edit/Delete, - = No Access*

## Best Practices

1. **Always check permissions** before showing UI elements or allowing actions
2. **Use the hook** (`usePermissions`) in React components for reactivity
3. **Check on backend** - Frontend permissions are for UX only; always validate on the server
4. **Be specific** - Check the exact permission needed (e.g., 'edit' not just 'view')
5. **Graceful degradation** - Hide features rather than showing disabled buttons when possible

## Backend Validation

**Important:** Frontend permission checks are for user experience only. Always validate permissions on the backend:

```javascript
// Backend route example
router.put('/patients/:id', async (req, res) => {
  const user = req.user; // From authentication middleware

  // Check if user has permission to edit patients
  const canEdit = await checkUserPermission(user.id, 'patients', 'edit');

  if (!canEdit) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  // Proceed with update
  // ...
});
```

## Extending the System

To add a new custom role:

1. Create the role in the database via Admin Panel
2. Assign appropriate permissions
3. The frontend will automatically respect the permissions set in the database

To add a new module permission:

1. Add the module to `modulePermissions` in `rolePermissions.js`
2. Update role permissions in the database
3. Use the permission checks in your components
