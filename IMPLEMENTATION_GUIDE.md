# Implementation Guide: New Features

This guide provides step-by-step instructions for implementing the following features:
1. **Country Field with Timezone Calculation** for patients, providers, and clinics
2. **Google Calendar Integration** for patient portal
3. **Medical Records File Upload** with classification

---

## Table of Contents
- [Prerequisites](#prerequisites)
- [Database Migration](#database-migration)
- [Backend Setup](#backend-setup)
- [Frontend Integration](#frontend-integration)
- [Testing](#testing)
- [Environment Variables](#environment-variables)

---

## Prerequisites

### Required Dependencies

1. **Backend (Node.js)**
   ```bash
   npm install googleapis
   ```

   Note: `multer` is already installed in the project

2. **Frontend**
   - No additional dependencies required
   - Components use existing `lucide-react` icons

---

## Database Migration

### Step 1: Run the Country Field Migration

The migration file has been created at: `backend/migrations/20251121000000_add_country_field.sql`

**Option A: Using the migration runner**
```bash
cd backend
node run-migrations.js
```

**Option B: Manual execution**
```bash
psql -U postgres -d medflow -f backend/migrations/20251121000000_add_country_field.sql
```

**What this migration does:**
- Adds `country` field (VARCHAR(2)) to `users`, `patients`, and `practices` tables
- Adds `timezone` field (VARCHAR(100)) to `users`, `patients`, and `practices` tables
- Creates indexes for faster queries
- Sets default timezone to 'UTC' for existing records

### Step 2: Verify Migration

```sql
-- Check that columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('users', 'patients', 'practices')
  AND column_name IN ('country', 'timezone');
```

---

## Backend Setup

### 1. Timezone Utility (Already Created)

The country-to-timezone mapping utility is located at:
- `backend/utils/timezoneUtils.js`

**Features:**
- Maps 100+ countries to their primary IANA timezones
- Supports countries with multiple timezones (US, Canada, Russia, etc.)
- Provides helper functions for timezone validation and display

**Usage Example:**
```javascript
const { getTimezoneFromCountry } = require('./utils/timezoneUtils');

const timezone = getTimezoneFromCountry('US'); // Returns 'America/New_York'
const allTimezones = getAllTimezonesForCountry('US'); // Returns array of all US timezones
```

### 2. Updated API Endpoints

The following routes have been updated to support country and timezone:

**Patient Portal API** (`backend/routes/patient-portal.js`)
- `GET /api/patient-portal/:patientId/profile` - Now returns country and timezone
- `PUT /api/patient-portal/:patientId/profile` - Now accepts country field and auto-calculates timezone

**Users API** (`backend/routes/users.js`)
- `PUT /api/users/:id` - Now accepts country field and auto-calculates timezone

### 3. Medical Records File Upload

**New Endpoints** (`backend/routes/medical-records.js`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/medical-records/upload` | POST | Upload a single file |
| `/api/medical-records/with-file` | POST | Create medical record with file attachment |

**File Upload Configuration:**
- **Maximum file size:** 10MB
- **Allowed formats:** JPEG, PNG, PDF, DOC, DOCX, TXT
- **Storage location:** `backend/uploads/medical-records/`
- **File naming:** Timestamped unique filenames

**Request Example:**
```javascript
const formData = new FormData();
formData.append('file', fileBlob);
formData.append('patientId', patientId);
formData.append('title', 'Blood Test Results');
formData.append('classification', 'Lab Results');
formData.append('description', 'Annual checkup');

fetch('/api/medical-records/with-file', {
  method: 'POST',
  body: formData
});
```

### 4. Google Calendar Integration

**New Endpoints** (`backend/routes/calendar-sync.js`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/calendar-sync/auth-url` | GET | Get Google OAuth authorization URL |
| `/api/calendar-sync/callback` | GET | OAuth callback handler |
| `/api/calendar-sync/status/:patientId` | GET | Check calendar connection status |
| `/api/calendar-sync/disconnect/:patientId` | DELETE | Disconnect Google Calendar |
| `/api/calendar-sync/sync-appointment` | POST | Sync appointment to Google Calendar |
| `/api/calendar-sync/auto-sync/:patientId` | PUT | Enable/disable auto-sync |

**Server Configuration:**

The route has been registered in `backend/server.js`:
```javascript
app.use('/api/calendar-sync', require('./routes/calendar-sync'));
app.use('/uploads', express.static('uploads')); // Serve uploaded files
```

---

## Frontend Integration

### 1. Country Field in Patient Profile (Already Integrated)

**Location:** `frontend/src/views/PatientPortalView.js`

The country dropdown has been added to the profile form (after the Language field). It includes 30+ common countries.

**To add more countries**, edit line ~1277-1316 in PatientPortalView.js:
```javascript
<option value="XX">Country Name</option>
```

### 2. Medical Records Upload Form Component

**Component Location:** `frontend/src/components/forms/MedicalRecordUploadForm.js`

**Integration Example:**

```javascript
import MedicalRecordUploadForm from '../components/forms/MedicalRecordUploadForm';

// In your patient portal view
const [showUploadForm, setShowUploadForm] = useState(false);

// Render the upload form
{showUploadForm && (
  <MedicalRecordUploadForm
    patientId={user.id}
    theme={theme}
    onSuccess={(record) => {
      console.log('Record uploaded:', record);
      setShowUploadForm(false);
      // Refresh medical records list
      fetchMedicalRecords();
    }}
    onCancel={() => setShowUploadForm(false)}
  />
)}

// Button to open upload form
<button onClick={() => setShowUploadForm(true)}>
  Upload Medical Record
</button>
```

**Component Props:**
- `patientId` (required): Patient's UUID
- `theme` (optional): 'light' or 'dark'
- `onSuccess` (optional): Callback when upload succeeds
- `onCancel` (optional): Callback when user cancels

**Classification Options:**
- General
- Lab Results
- Imaging
- Prescription
- Vaccination Record
- Insurance
- Consultation Notes
- Surgery Report
- Discharge Summary
- Other

### 3. Google Calendar Integration Component

**Component Location:** `frontend/src/components/calendar/GoogleCalendarIntegration.js`

**Integration Example in Patient Portal:**

```javascript
import GoogleCalendarIntegration from '../components/calendar/GoogleCalendarIntegration';

// Add a new section in the patient portal
const renderSettings = () => (
  <div className="space-y-6">
    {/* Other settings */}

    <GoogleCalendarIntegration
      patientId={user.id}
      theme={theme}
    />
  </div>
);
```

**To Add Sync Button to Appointments:**

```javascript
import { useSyncAppointment } from '../components/calendar/GoogleCalendarIntegration';

const { syncAppointment } = useSyncAppointment(user.id);

// In appointment list
<button
  onClick={async () => {
    const result = await syncAppointment(appointment.id);
    if (result.success) {
      alert('Synced to Google Calendar!');
    }
  }}
>
  Sync to Calendar
</button>
```

### 4. PatientPortalView Integration Points

**Recommended Integration Locations:**

1. **Medical Records Section** (around line 2000-2500)
   - Add "Upload Record" button
   - Show MedicalRecordUploadForm when clicked

2. **Settings/Profile Section** (around line 1100-1500)
   - Add GoogleCalendarIntegration component
   - Display after profile form or in a separate "Integrations" tab

**Example Integration:**

```javascript
// In the Medical Records view (around line 2200)
const renderMedicalRecords = () => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <h2 className="text-2xl font-bold">Medical Records</h2>
      <button
        onClick={() => setShowUploadForm(true)}
        className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-white"
      >
        <Upload className="w-4 h-4" />
        Upload Record
      </button>
    </div>

    {showUploadForm && (
      <MedicalRecordUploadForm
        patientId={user.id}
        theme={theme}
        onSuccess={(record) => {
          setShowUploadForm(false);
          fetchMedicalRecords();
        }}
        onCancel={() => setShowUploadForm(false)}
      />
    )}

    {/* Existing medical records list */}
  </div>
);

// In the Profile/Settings view (around line 1320)
const renderProfile = () => (
  <div className="space-y-6">
    {/* Existing profile form */}

    {/* Add calendar integration */}
    <GoogleCalendarIntegration
      patientId={user.id}
      theme={theme}
    />
  </div>
);
```

---

## Environment Variables

### Required Environment Variables

Add these to your `.env` file in the backend directory:

```bash
# Google OAuth Configuration (Required for Calendar Integration)
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:3001/api/calendar-sync/callback

# For production
# GOOGLE_REDIRECT_URI=https://yourdomain.com/api/calendar-sync/callback
```

### How to Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google Calendar API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Set application type to **Web application**
6. Add authorized redirect URIs:
   - `http://localhost:3001/api/calendar-sync/callback` (development)
   - `https://yourdomain.com/api/calendar-sync/callback` (production)
7. Copy the **Client ID** and **Client Secret** to your `.env` file

---

## Testing

### 1. Test Country Field and Timezone

**Test Patient Profile Update:**
```bash
curl -X PUT http://localhost:3000/api/patient-portal/{patientId}/profile \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "country": "US"
  }'

# Expected: timezone should be automatically set to "America/New_York"
```

**Verify in Database:**
```sql
SELECT id, first_name, last_name, country, timezone
FROM patients
WHERE id = '{patientId}';
```

### 2. Test File Upload

**Test Medical Record Upload:**
```bash
curl -X POST http://localhost:3000/api/medical-records/upload \
  -F "file=@/path/to/test-file.pdf" \
  -F "patientId={patientId}" \
  -F "classification=Lab Results"
```

**Check Upload Directory:**
```bash
ls -lh backend/uploads/medical-records/
```

### 3. Test Google Calendar Integration

1. **Check Auth URL Generation:**
   ```
   GET http://localhost:3000/api/calendar-sync/auth-url?patientId={patientId}
   ```
   Should return: `{ "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..." }`

2. **Test Calendar Status:**
   ```
   GET http://localhost:3000/api/calendar-sync/status/{patientId}
   ```
   Should return: `{ "connected": false }` (before connecting)

3. **Complete OAuth Flow:**
   - Click "Connect Google Calendar" button in UI
   - Sign in with Google
   - Grant calendar permissions
   - Verify redirect back to patient portal

4. **Test Appointment Sync:**
   ```bash
   curl -X POST http://localhost:3000/api/calendar-sync/sync-appointment \
     -H "Content-Type: application/json" \
     -d '{
       "appointmentId": "{appointmentId}",
       "patientId": "{patientId}"
     }'
   ```

---

## Appointment Booking Timezone Integration

### Update Appointment Creation

When creating appointments, the system should use the patient's timezone from their profile.

**Example in `backend/routes/appointments.js`:**

```javascript
// When creating appointment, fetch patient's timezone
const patientResult = await pool.query(
  'SELECT timezone, country FROM patients WHERE id = $1',
  [patientId]
);

const patientTimezone = patientResult.rows[0]?.timezone || 'UTC';

// Create appointment with patient's timezone
await pool.query(`
  INSERT INTO appointments (
    patient_id, provider_id, start_time, end_time,
    timezone, appointment_type, status
  )
  VALUES ($1, $2, $3, $4, $5, $6, 'Scheduled')
`, [
  patientId, providerId, startTime, endTime,
  patientTimezone, appointmentType
]);
```

---

## Production Deployment Checklist

- [ ] Run database migration on production database
- [ ] Install `googleapis` package: `npm install googleapis`
- [ ] Create `backend/uploads/medical-records/` directory with proper permissions
- [ ] Set up Google OAuth credentials for production domain
- [ ] Update environment variables in production:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REDIRECT_URI` (production URL)
- [ ] Configure file upload limits in production (nginx/apache)
- [ ] Set up backup for uploaded files directory
- [ ] Test all features in production environment
- [ ] Update API documentation

---

## Troubleshooting

### Issue: Timezone not calculating

**Solution:**
- Check that country code is valid (2-letter ISO code)
- Verify `timezoneUtils.js` is imported correctly
- Check console for errors

### Issue: File upload fails

**Possible causes:**
1. `multer` not installed
2. Upload directory doesn't exist or lacks permissions
3. File size exceeds 10MB limit
4. Invalid file type

**Solution:**
```bash
# Install multer
npm install multer

# Create upload directory
mkdir -p backend/uploads/medical-records
chmod 755 backend/uploads/medical-records
```

### Issue: Google Calendar not connecting

**Possible causes:**
1. Missing environment variables
2. Invalid OAuth credentials
3. Redirect URI mismatch
4. `googleapis` package not installed

**Solution:**
```bash
# Install googleapis
npm install googleapis

# Verify environment variables
echo $GOOGLE_CLIENT_ID
echo $GOOGLE_CLIENT_SECRET

# Check redirect URI in Google Console matches .env
```

### Issue: Calendar API returns 403 error

**Solution:**
- Ensure Google Calendar API is enabled in Google Cloud Console
- Check OAuth scopes are correct
- Verify access token is valid

---

## Additional Notes

### Security Considerations

1. **File Uploads:**
   - Validate file types on both client and server
   - Scan uploaded files for malware in production
   - Implement rate limiting for uploads
   - Store files outside web root if possible

2. **Google Calendar:**
   - Store OAuth tokens securely (already in database)
   - Refresh tokens automatically when expired
   - Implement token revocation on disconnect

3. **Timezone:**
   - Always store times in UTC in database
   - Convert to user's timezone for display
   - Validate timezone strings

### Performance Optimization

1. **File Uploads:**
   - Consider using cloud storage (AWS S3, Azure Blob) for production
   - Implement CDN for serving uploaded files
   - Add image compression for image files

2. **Calendar Sync:**
   - Implement background job queue for syncing
   - Cache calendar status to reduce API calls
   - Batch sync multiple appointments

### Future Enhancements

1. **Timezone:**
   - Add automatic timezone detection based on browser
   - Support multiple timezones for practices with multiple locations
   - Add timezone conversion display for appointments

2. **File Uploads:**
   - Add OCR for scanning documents
   - Implement file preview without download
   - Add tags and search functionality

3. **Calendar:**
   - Support other calendar providers (Outlook, Apple)
   - Implement two-way sync (calendar → appointments)
   - Add calendar availability blocking

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review console logs for error messages
3. Check database migrations ran successfully
4. Verify environment variables are set correctly

---

## Summary of Changes

### Backend Files Created/Modified:
- ✅ `backend/migrations/20251121000000_add_country_field.sql` (NEW)
- ✅ `backend/utils/timezoneUtils.js` (NEW)
- ✅ `backend/routes/calendar-sync.js` (NEW)
- ✅ `backend/routes/patient-portal.js` (MODIFIED - added country/timezone support)
- ✅ `backend/routes/users.js` (MODIFIED - added country/timezone support)
- ✅ `backend/routes/medical-records.js` (MODIFIED - added file upload)
- ✅ `backend/server.js` (MODIFIED - added calendar-sync route and uploads static serving)

### Frontend Files Created/Modified:
- ✅ `frontend/src/views/PatientPortalView.js` (MODIFIED - added country dropdown)
- ✅ `frontend/src/components/forms/MedicalRecordUploadForm.js` (NEW)
- ✅ `frontend/src/components/calendar/GoogleCalendarIntegration.js` (NEW)

### Dependencies to Install:
- ✅ Backend: `googleapis` (npm install googleapis)
- ✅ Frontend: None (uses existing dependencies)

---

**Implementation Status:** Ready for testing and deployment
**Last Updated:** 2025-11-21
