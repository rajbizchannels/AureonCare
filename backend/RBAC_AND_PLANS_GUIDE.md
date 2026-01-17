# Role-Based Access Control (RBAC) and Plan Management Guide

## Overview

AureonCare now includes a comprehensive role-based access control system with subscription plan management and multi-language support. This guide covers all new features and how to use them.

## Features

### 1. **Role-Based Access Control (RBAC)**
- Predefined system roles (admin, doctor, patient, nurse, etc.)
- Custom role creation
- Granular permissions system
- Multiple roles per user
- Role switching functionality

### 2. **Subscription Plans**
- Multiple plan tiers (Free, Starter, Professional, Enterprise)
- Plan management (admin only)
- Feature gates based on plan
- Usage limits (users, patients)

### 3. **Multi-Language Support**
- User-specific language preferences
- Supported languages: English, Spanish, French, German, Portuguese, Arabic, Hindi
- Language persists across sessions

## Database Schema

### New Tables

#### `roles` - User Roles
```sql
- id: SERIAL PRIMARY KEY
- name: VARCHAR(100) UNIQUE -- System identifier (e.g., 'admin', 'doctor')
- display_name: VARCHAR(100) -- Display name (e.g., 'Administrator')
- description: TEXT
- is_system_role: BOOLEAN -- System roles cannot be deleted
- is_active: BOOLEAN
```

#### `permissions` - Granular Permissions
```sql
- id: SERIAL PRIMARY KEY
- name: VARCHAR(100) UNIQUE -- e.g., 'patients.view', 'billing.edit'
- display_name: VARCHAR(100)
- description: TEXT
- module: VARCHAR(50) -- e.g., 'patients', 'billing', 'crm'
- action: VARCHAR(50) -- e.g., 'view', 'create', 'edit', 'delete'
```

#### `role_permissions` - Role-Permission Mapping
```sql
- role_id: INTEGER (FK to roles)
- permission_id: INTEGER (FK to permissions)
```

#### `subscription_plans` - Available Plans
```sql
- id: SERIAL PRIMARY KEY
- name: VARCHAR(100) UNIQUE
- display_name: VARCHAR(100)
- description: TEXT
- price: DECIMAL(10, 2)
- billing_cycle: VARCHAR(20) -- 'monthly', 'yearly'
- max_users: INTEGER -- -1 for unlimited
- max_patients: INTEGER -- -1 for unlimited
- features: JSONB
```

#### `organization_settings` - Current Plan
```sql
- id: SERIAL PRIMARY KEY
- organization_name: VARCHAR(255)
- current_plan_id: INTEGER (FK to subscription_plans)
- plan_start_date: DATE
- plan_end_date: DATE
- auto_renew: BOOLEAN
```

#### `user_roles` - User-Role Assignments
```sql
- user_id: INTEGER (FK to users)
- role_id: INTEGER (FK to roles)
- assigned_at: TIMESTAMP
- assigned_by: INTEGER (FK to users)
```

### Modified Tables

#### `users` - Added Columns
```sql
- language: VARCHAR(10) DEFAULT 'en'
- active_role: VARCHAR(100) -- Currently active role
```

## Predefined Roles

### System Roles (Cannot be Deleted)

1. **Administrator** (`admin`)
   - Full system access
   - Can manage plans
   - Can manage all users and roles
   - All permissions

2. **Doctor/Provider** (`doctor`)
   - Patient management
   - Appointments
   - Medical records (EHR)
   - Reports

3. **Patient** (`patient`)
   - View appointments
   - Create appointments
   - View own medical records

4. **Nurse** (`nurse`)
   - Patient management (view, create, edit)
   - Appointments (view, create, edit)
   - Medical records (view, create, edit)

5. **Receptionist** (`receptionist`)
   - Patient management (view, create, edit)
   - Appointments (view, create, edit)

6. **Billing Manager** (`billing_manager`)
   - Full billing access
   - Patient information (view)
   - Reports

7. **CRM Manager** (`crm_manager`)
   - Full CRM access
   - Reports

8. **Staff** (`staff`)
   - Limited access
   - Basic permissions

## API Endpoints

### Role Management

#### Get All Roles
```http
GET /api/roles
```

Response:
```json
[
  {
    "id": 1,
    "name": "admin",
    "display_name": "Administrator",
    "description": "Full system access",
    "is_system_role": true,
    "is_active": true,
    "user_count": 5,
    "permission_count": 24
  }
]
```

#### Get Role by ID (with permissions)
```http
GET /api/roles/:id
```

Response:
```json
{
  "id": 1,
  "name": "admin",
  "display_name": "Administrator",
  "permissions": [
    {
      "id": 1,
      "name": "patients.view",
      "display_name": "View Patients",
      "module": "patients",
      "action": "view"
    }
  ]
}
```

#### Create Custom Role
```http
POST /api/roles
Content-Type: application/json

{
  "name": "lab_technician",
  "display_name": "Lab Technician",
  "description": "Laboratory staff with limited access",
  "permissions": [1, 2, 5, 10]
}
```

#### Update Role
```http
PUT /api/roles/:id
Content-Type: application/json

{
  "display_name": "Senior Lab Technician",
  "description": "Updated description",
  "permissions": [1, 2, 5, 10, 15],
  "is_active": true
}
```

#### Delete Custom Role
```http
DELETE /api/roles/:id
```

Note: Cannot delete system roles or roles assigned to users.

#### Get All Permissions (Grouped by Module)
```http
GET /api/roles/permissions/all
```

Response:
```json
{
  "patients": [
    {"id": 1, "name": "patients.view", "display_name": "View Patients"},
    {"id": 2, "name": "patients.create", "display_name": "Create Patients"}
  ],
  "billing": [
    {"id": 10, "name": "billing.view", "display_name": "View Billing"}
  ]
}
```

### User Role Management

#### Get User's Roles
```http
GET /api/users/:id/roles
```

Response:
```json
[
  {
    "id": 2,
    "name": "doctor",
    "display_name": "Doctor/Provider",
    "description": "Medical provider",
    "assigned_at": "2025-11-05T10:00:00Z",
    "is_active": true
  },
  {
    "id": 3,
    "name": "patient",
    "display_name": "Patient",
    "is_active": false
  }
]
```

#### Assign Role to User
```http
POST /api/users/:id/roles
Content-Type: application/json

{
  "role_id": 2,
  "assigned_by": 1
}
```

#### Remove Role from User
```http
DELETE /api/users/:id/roles/:role_id
```

Note: Cannot remove last role from user.

#### Switch Active Role
```http
PUT /api/users/:id/switch-role
Content-Type: application/json

{
  "role_name": "doctor"
}
```

Response:
```json
{
  "message": "Role switched successfully",
  "user": { ... },
  "new_role": {
    "id": 2,
    "name": "doctor",
    "display_name": "Doctor/Provider"
  }
}
```

### Language Management

#### Update User Language
```http
PUT /api/users/:id/language
Content-Type: application/json

{
  "language": "es"
}
```

Supported languages: `en`, `es`, `fr`, `de`, `pt`, `zh`, `ar`, `hi`

### Plan Management

#### Get All Plans
```http
GET /api/plans
```

Response:
```json
[
  {
    "id": 1,
    "name": "free",
    "display_name": "Free Plan",
    "description": "Basic features for small practices",
    "price": 0.00,
    "billing_cycle": "monthly",
    "max_users": 3,
    "max_patients": 50,
    "features": {
      "ehr": true,
      "appointments": true,
      "billing": false,
      "crm": false
    },
    "is_active": true
  }
]
```

#### Get Current Organization Plan
```http
GET /api/plans/current
```

Response:
```json
{
  "id": 1,
  "organization_name": "AureonCare Practice",
  "current_plan_id": 2,
  "plan_name": "starter",
  "plan_display_name": "Starter Plan",
  "plan_price": 99.00,
  "billing_cycle": "monthly",
  "max_users": 10,
  "max_patients": 200,
  "plan_start_date": "2025-11-01",
  "plan_end_date": "2025-12-01",
  "auto_renew": true,
  "features": { ... }
}
```

#### Update Plan (Admin Only)
```http
PUT /api/plans/current
Content-Type: application/json

{
  "plan_id": 3,
  "auto_renew": true
}
```

#### Get Plan Features and Usage
```http
GET /api/plans/features
```

Response:
```json
{
  "features": {
    "ehr": true,
    "appointments": true,
    "billing": true,
    "crm": true,
    "telehealth": true,
    "integrations": true
  },
  "limits": {
    "users": {
      "max": 25,
      "current": 15,
      "unlimited": false
    },
    "patients": {
      "max": 1000,
      "current": 450,
      "unlimited": false
    }
  }
}
```

## Usage Examples

### Example 1: Creating a Custom Role

```javascript
// Step 1: Get all available permissions
const permissions = await fetch('/api/roles/permissions/all');
const permissionsData = await permissions.json();

// Step 2: Select permissions for new role
const selectedPermissions = [
  1,  // patients.view
  5,  // appointments.view
  6,  // appointments.create
  13  // ehr.view
];

// Step 3: Create the role
const response = await fetch('/api/roles', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'medical_assistant',
    display_name: 'Medical Assistant',
    description: 'Assists doctors with patient care',
    permissions: selectedPermissions
  })
});

const newRole = await response.json();
console.log('Created role:', newRole);
```

### Example 2: Assigning Multiple Roles to a User

```javascript
// Assign doctor role
await fetch(`/api/users/${userId}/roles`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    role_id: 2,  // doctor
    assigned_by: adminId
  })
});

// Assign patient role (user can be both)
await fetch(`/api/users/${userId}/roles`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    role_id: 3,  // patient
    assigned_by: adminId
  })
});

// User now has both doctor and patient roles
```

### Example 3: Role Switching

```javascript
// Get user's roles
const rolesResponse = await fetch(`/api/users/${userId}/roles`);
const roles = await rolesResponse.json();

// Display role switcher in UI
roles.forEach(role => {
  console.log(role.display_name, role.is_active ? '(Active)' : '');
});

// Switch to different role
await fetch(`/api/users/${userId}/switch-role`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    role_name: 'patient'  // Switch from doctor to patient view
  })
});
```

### Example 4: Language Setting

```javascript
// Update user language preference
await fetch(`/api/users/${userId}/language`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    language: 'es'  // Spanish
  })
});

// On next login, load translations based on user.language
const user = await fetch(`/api/users/${userId}`).then(r => r.json());
const translations = await import(`./i18n/${user.language}.json`);
```

### Example 5: Plan Upgrade (Admin Only)

```javascript
// Get available plans
const plansResponse = await fetch('/api/plans');
const plans = await plansResponse.json();

// Display plans to admin
plans.forEach(plan => {
  console.log(`${plan.display_name} - $${plan.price}/${plan.billing_cycle}`);
});

// Upgrade to professional plan
await fetch('/api/plans/current', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    plan_id: 3,  // Professional plan
    auto_renew: true
  })
});

// Check new features
const features = await fetch('/api/plans/features').then(r => r.json());
if (features.features.crm) {
  // CRM module now available
  enableCRMModule();
}
```

## Security Considerations

### Permission Checking

Always check permissions before allowing actions:

```javascript
// Backend middleware example
async function checkPermission(userId, permissionName) {
  const result = await pool.query(`
    SELECT COUNT(*) as has_permission
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = $1 AND p.name = $2
  `, [userId, permissionName]);

  return parseInt(result.rows[0].has_permission) > 0;
}

// Usage
if (await checkPermission(userId, 'patients.delete')) {
  // Allow patient deletion
} else {
  return res.status(403).json({ error: 'Insufficient permissions' });
}
```

### Plan Feature Gates

Check plan features before allowing access:

```javascript
async function hasFeature(featureName) {
  const result = await pool.query(`
    SELECT sp.features
    FROM organization_settings os
    JOIN subscription_plans sp ON os.current_plan_id = sp.id
    LIMIT 1
  `);

  if (result.rows.length === 0) return false;

  const features = result.rows[0].features || {};
  return features[featureName] === true;
}

// Usage
if (!await hasFeature('crm')) {
  return res.status(403).json({
    error: 'CRM module not available in your plan',
    upgrade_url: '/admin/plans'
  });
}
```

## Migration

### Applying the Migration

```bash
cd backend
psql -h localhost -U aureoncare_user -d aureoncare -f migrations/014_create_rbac_and_plans.sql
```

### Expected Output

```
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
INSERT 0 8  (8 roles created)
INSERT 0 24 (24 permissions created)
NOTICE: Assigning permissions to roles...
INSERT 0 4  (4 plans created)
CREATE INDEX
...
┌─────────────────────────────────────────────────────────┬────────────┬───────────────────┬─────────────┐
│ status                                                  │ total_roles│ total_permissions │ total_plans │
├─────────────────────────────────────────────────────────┼────────────┼───────────────────┼─────────────┤
│ Role-based access control system created successfully  │ 8          │ 24                │ 4           │
└─────────────────────────────────────────────────────────┴────────────┴───────────────────┴─────────────┘
```

## Frontend Integration (Overview)

The frontend implementation will be provided in separate commits. Here's what to expect:

### Admin Panel Updates

1. **Role Management Tab**
   - List all roles
   - Create custom roles
   - Edit role permissions
   - Delete custom roles

2. **User Management Updates**
   - Assign multiple roles to users
   - View user's roles
   - Role badges/chips display

3. **Plan Management (Admin Only)**
   - View current plan
   - Compare available plans
   - Upgrade/downgrade plan
   - View usage limits

### User Profile Updates

1. **Language Selector**
   - Dropdown with supported languages
   - Saves to user profile
   - Applies immediately

2. **Role Switcher**
   - Show when user has multiple roles
   - Quick switch between roles
   - Different dashboard per role

## Benefits

✅ **Security**: Granular permission control
✅ **Flexibility**: Custom roles and multiple roles per user
✅ **Scalability**: Plan-based features and limits
✅ **User Experience**: Role switching and language preferences
✅ **Compliance**: Audit trail for role assignments
✅ **Revenue**: Subscription plan management

## Troubleshooting

### Issue: Cannot delete role

**Error**: "Cannot delete system roles"

**Solution**: Only custom roles can be deleted. System roles (admin, doctor, patient, etc.) are protected.

### Issue: Cannot remove role from user

**Error**: "Cannot remove last role from user"

**Solution**: Users must have at least one role. Assign a different role first, then remove the unwanted one.

### Issue: Plan limit reached

**Error**: "Maximum users exceeded for current plan"

**Solution**: Admin needs to upgrade the plan or remove inactive users.

### Issue: Feature not available

**Error**: "CRM module not available in your plan"

**Solution**: Check current plan features. Upgrade to a plan that includes the desired feature.

## Related Files

- `migrations/014_create_rbac_and_plans.sql` - Database schema
- `routes/roles.js` - Role management API
- `routes/plans.js` - Plan management API
- `routes/users.js` - Updated with language and role switching
- `server.js` - Registered new routes

## Next Steps

1. Frontend implementation (Admin Panel UI for roles and plans)
2. Permission middleware for route protection
3. Feature gates based on subscription plan
4. Multi-language support in frontend (i18n)
5. Role switching UI component
6. Plan comparison page
7. Usage analytics and limits enforcement
