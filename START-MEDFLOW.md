# 🚀 Start MedFlow Application

## The Issue

**Audit logging is implemented correctly**, but no logs are visible because:
1. ❌ PostgreSQL database is not running
2. ❌ Backend server is not running
3. ❌ Database migration may not have been run

---

## ✅ Solution: Start Everything

Follow these steps **in order**:

### Step 1: Start PostgreSQL Database

#### On Windows:
```bash
# Using pg_ctl (if PostgreSQL is installed)
pg_ctl -D "C:\Program Files\PostgreSQL\15\data" start

# Or using Windows Services
services.msc
# Find "postgresql-x64-15" and click Start

# Or using net command
net start postgresql-x64-15
```

#### On Linux:
```bash
sudo systemctl start postgresql
# or
sudo service postgresql start
```

####Mac:
```bash
brew services start postgresql
# or
pg_ctl -D /usr/local/var/postgres start
```

#### Verify PostgreSQL is running:
```bash
psql -U medflow_app -d medflow -c "SELECT NOW();"
```

You should see the current timestamp.

---

### Step 2: Run Database Migration (if not already done)

```bash
cd /home/user/MedFlow
psql -U medflow_app -d medflow -f backend/migrations/040_create_audit_logs_table.sql
```

**Expected output:**
```
CREATE EXTENSION
CREATE TABLE
CREATE INDEX
CREATE INDEX
...
INSERT 0 1
```

**If you see "table already exists":**
That's fine! It means the migration was already run.

---

### Step 3: Start Backend Server

Open a new terminal:

```bash
cd /home/user/MedFlow/backend
npm install  # Only needed first time or after pulling new code
node server.js
```

**Expected output:**
```
✓ PostgreSQL Connected
Server running on port 3000
```

**Keep this terminal open!**

---

### Step 4: Start Frontend

Open ANOTHER new terminal:

```bash
cd /home/user/MedFlow/frontend
npm install  # Only needed first time
npm start
```

**Expected output:**
```
Compiled successfully!
...
webpack compiled successfully
```

Your browser should open automatically to http://localhost:3001

**Keep this terminal open too!**

---

### Step 5: Test Audit Logging

1. **Log in** to the application (as any user)
2. **Navigate** to Admin Panel → Audit Logs tab
3. **Open a form** (e.g., click "New Patient")
4. **Close the form** (click X or Cancel)
5. **Refresh the Audit Logs tab**

✅ You should now see audit log entries!

---

## Quick Test

Once everything is running, you can test the audit logging API directly:

```bash
# Test audit endpoint (should return 503 if migration not run, or 200 with empty array)
curl http://localhost:3000/api/audit

# Test server health
curl http://localhost:3000/health
```

---

## Troubleshooting

### "Connection refused" on port 5432
→ PostgreSQL is not running. See Step 1.

### "Connection refused" on port 3000
→ Backend server is not running. See Step 3.

### "relation 'audit_logs' does not exist"
→ Migration not run. See Step 2.

### Audit Logs tab shows "Migration Required"
→ Migration not run OR backend not running. Check Steps 2 & 3.

### Can't see any logs after opening forms
→ Check browser console (F12) for errors

---

## What Gets Logged?

Once everything is running, these actions create audit logs:

### Forms (20 forms):
- ✅ Opening a form → "view" action
- ✅ Creating a record → "create" action
- ✅ Updating a record → "update" action
- ✅ Errors → "error" action

### Modals (9 modals):
- ✅ Opening a modal → "open" action
- ✅ Closing a modal → "close" action
- ✅ Submit actions → create/update logs

### Views (23 views):
- ✅ Accessing a view → "view" action

**All with:**
- User information
- Timestamps
- Module classification
- Contextual metadata
- Duration tracking

---

## Success Checklist

- [ ] PostgreSQL is running and connectable
- [ ] Database migration completed successfully
- [ ] Backend server running on port 3000
- [ ] Frontend running on port 3001
- [ ] Can log in to the application
- [ ] Admin Panel → Audit Logs tab loads
- [ ] No "Migration Required" message
- [ ] Audit log entries appear after using forms/modals/views

---

## All 52 Components with Audit Logging

✅ **20 Forms**: MedicalRecordUploadForm, NewAppointmentForm, NewAppointmentTypeForm, NewCampaignForm, NewClaimForm, NewConsentFormForm, NewDenialForm, NewHealthcareOfferingForm, NewInsurancePayerForm, NewIntakeFlowForm, NewIntakeFormForm, NewLabOrderForm, NewLaboratoryForm, NewPatientForm, NewPaymentForm, NewPaymentPostingForm, NewPharmacyForm, NewPreapprovalForm, NewTaskForm, NewUserForm, DiagnosisForm

✅ **9 Modals**: CredentialModal, ePrescribeModal, ForgotPasswordModal, PatientLoginPage, RegisterPage, SettingsModal, UserFormModal, UserProfileModal, ViewEditModal

✅ **23 Views**: All views including AdminPanelView, DashboardView, EHRView, RCMView, CRMView, PatientPortalView, TelehealthView, and more

---

## Need Help?

1. Check that all 3 services are running (PostgreSQL, Backend, Frontend)
2. Look for error messages in each terminal
3. Check browser console (F12) for frontend errors
4. Refer to FIX-AUDIT-LOGGING.md for detailed troubleshooting
