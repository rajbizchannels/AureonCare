# Fix Audit Logging - Troubleshooting Guide

## Issue: No audit logs visible in Admin Panel

There are several possible causes. Follow these steps in order:

---

## Step 1: Install Backend Dependencies

The backend server needs its dependencies installed to run properly.

```bash
cd backend
npm install
cd ..
```

---

## Step 2: Run the Database Migration

The `audit_logs` table must be created in the database:

```bash
# Using psql directly
psql -U aureoncare_app -d aureoncare -f backend/migrations/040_create_audit_logs_table.sql

# Or using the migration script
cd backend
node migrations/run-migration.js 040_create_audit_logs_table.sql
cd ..
```

### Verify Migration Success

You should see output like:
```
CREATE TABLE
CREATE INDEX
CREATE INDEX
...
INSERT 0 1
```

---

## Step 3: Start the Backend Server

```bash
cd backend
node server.js
```

You should see:
```
✓ PostgreSQL Connected
Server running on port 3000
```

Keep this terminal open.

---

## Step 4: Start the Frontend

In a NEW terminal:

```bash
cd frontend
npm start
```

---

## Step 5: Test Audit Logging

1. Open the application in your browser (usually http://localhost:3001)
2. Log in as an admin user
3. Navigate to **Admin Panel** → **Audit Logs** tab
4. Open any form (e.g., New Patient Form)
5. Close the form
6. Refresh the Audit Logs tab

You should now see audit log entries!

---

## Quick Diagnostic Commands

### Check if backend is running:
```bash
curl http://localhost:3000/health
```

### Check if audit_logs table exists:
```bash
psql -U aureoncare_app -d aureoncare -c "SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'audit_logs');"
```

### Check if any audit logs exist:
```bash
psql -U aureoncare_app -d aureoncare -c "SELECT COUNT(*) FROM audit_logs;"
```

### View recent audit logs directly:
```bash
psql -U aureoncare_app -d aureoncare -c "SELECT resource_name, action_type, module, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 10;"
```

---

## Common Issues

### Issue: "Cannot find module 'express'" or similar
**Fix:** Run `npm install` in the backend directory

### Issue: "relation 'audit_logs' does not exist"
**Fix:** Run the database migration (Step 2)

### Issue: Backend won't start - Port 3000 in use
**Fix:** Kill the process using port 3000:
```bash
# On Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# On Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### Issue: Can't connect to database
**Fix:** Ensure PostgreSQL is running and credentials are correct in backend/server.js

### Issue: Audit logs tab shows "Migration Required"
**Fix:** The migration hasn't been run. See Step 2.

---

## Browser Console Checks

Open browser DevTools (F12) and check the Console tab for errors:

### Expected (normal):
- No errors related to audit logging
- You might see: "POST /api/audit 201" or "POST /api/audit 200"

### If you see errors:
- **404 on /api/audit**: Backend isn't running or route not registered
- **503 on /api/audit**: Migration not run
- **500 on /api/audit**: Backend error (check backend terminal)
- **Network error**: Backend not running

---

## Verify Implementation

### Check a form has audit logging:
```bash
grep -n "useAudit" frontend/src/components/forms/NewPatientForm.js
```

Should show:
- Import statement
- Hook initialization
- logFormView call
- logCreate/logError calls

### Check API service has audit methods:
```bash
grep -n "createAuditLog" frontend/src/api/apiService.js
```

Should show the createAuditLog method around line 2011.

---

## Still Not Working?

1. **Clear browser cache** and hard reload (Ctrl+Shift+R)
2. **Restart both backend and frontend** servers
3. **Check backend terminal** for error messages
4. **Check browser console** for network errors
5. **Verify you're logged in as an admin user** (only admins can view audit logs)

---

## Success Indicators

✅ Backend running on port 3000
✅ Frontend running on port 3001
✅ Database migration completed successfully
✅ audit_logs table exists in database
✅ No errors in browser console
✅ Audit Logs tab loads without "Migration Required" message
✅ Audit log entries visible after interacting with forms/views

---

## Next Steps After Fix

Once audit logging is working:
1. All 52 components (20 forms, 9 modals, 23 views) will automatically log user interactions
2. View audit logs in Admin Panel → Audit Logs tab
3. Filter by user, action type, module, date range
4. Export logs to CSV for analysis
5. Monitor user activity for security and compliance

---

## Need More Help?

Check the backend terminal output for specific error messages and search for those errors in this guide.
