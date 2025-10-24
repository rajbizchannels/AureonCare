# MedFlow Setup Guide

Complete guide for setting up the MedFlow application with all features including OAuth social login, Telehealth, FHIR integration, and Patient Portal.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Database Setup](#database-setup)
3. [OAuth Configuration](#oauth-configuration)
4. [Backend Setup](#backend-setup)
5. [Frontend Setup](#frontend-setup)
6. [Running the Application](#running-the-application)
7. [Testing](#testing)

---

## Prerequisites

Ensure you have the following installed:

- **Node.js** (v16 or higher)
- **PostgreSQL** (v12 or higher)
- **npm** or **yarn**

```bash
# Verify installations
node --version
npm --version
psql --version
```

---

## Database Setup

### 1. Create PostgreSQL Database

```bash
# Login to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE medflow;
CREATE USER medflow_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE medflow TO medflow_user;
\q
```

### 2. Configure Database Connection

Create a `.env` file in the `backend` directory:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and update:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=medflow
DB_USER=medflow_user
DB_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret_key_here
```

### 3. Run Database Migrations

**IMPORTANT:** Use `migrate-enhanced.js` for a fresh installation. This creates all tables with the correct schema.

```bash
cd backend

# Install dependencies
npm install

# Run the complete migration script
node scripts/migrate-enhanced.js
```

**If you have existing tables with old schema:**

```bash
# Drop all existing tables (⚠️ WARNING: This deletes all data!)
node scripts/drop-tables.js

# Then run the enhanced migration
node scripts/migrate-enhanced.js
```

This will create the following tables:
- `users` - User accounts
- `patients` - Patient information
- `appointments` - Appointment scheduling
- `claims` - Billing and claims
- `telehealth_sessions` - Video consultation sessions
- `fhir_resources` - HL7 FHIR resources
- `medical_records` - Patient medical history
- `patient_portal_sessions` - Patient portal authentication
- `social_auth` - OAuth social login connections

**Note:** Do NOT run `migrate.js` - it's an older version. Use `migrate-enhanced.js` instead.

### 4. Load Seed Data (Optional)

```bash
# Load sample data for testing
psql -U medflow_user -d medflow -f scripts/seed-data.sql
```

---

## OAuth Configuration

To enable social login (Google, Microsoft, Facebook), you need to obtain OAuth credentials from each provider.

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select existing
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth 2.0 Client ID**
5. Configure:
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:3001`
   - Authorized redirect URIs: `http://localhost:3001`
6. Copy the **Client ID**

### Microsoft OAuth Setup

1. Go to [Azure Portal](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps)
2. Click **New registration**
3. Configure:
   - Name: MedFlow
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI: `http://localhost:3001`
4. Copy the **Application (client) ID**

### Facebook OAuth Setup

1. Go to [Facebook Developers](https://developers.facebook.com/apps/)
2. Click **Create App**
3. Choose **Consumer** and click **Next**
4. Enter app name and click **Create App**
5. In dashboard, go to **Settings** > **Basic**
6. Add platform: **Website**
7. Site URL: `http://localhost:3001`
8. Copy the **App ID**

### Configure Frontend OAuth

Create `frontend/.env` file:

```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env`:

```env
REACT_APP_API_URL=http://localhost:3000/api

# OAuth Credentials
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id_here
REACT_APP_MICROSOFT_CLIENT_ID=your_microsoft_client_id_here
REACT_APP_FACEBOOK_APP_ID=your_facebook_app_id_here

# Redirect URI
REACT_APP_REDIRECT_URI=http://localhost:3001
```

---

## Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Verify .env configuration
cat .env

# Start the server
npm start
```

The backend server will start on `http://localhost:3000`.

### Backend API Endpoints

The following endpoints are available:

#### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register
- `POST /api/auth/social-login` - OAuth login

#### Telehealth
- `GET /api/telehealth` - Get all sessions
- `POST /api/telehealth` - Create session
- `PUT /api/telehealth/:id` - Update session
- `POST /api/telehealth/:id/join` - Join session

#### FHIR
- `GET /api/fhir/resources` - Get FHIR resources
- `POST /api/fhir/resources` - Create FHIR resource
- `GET /api/fhir/patient/:id` - Get patient FHIR resource
- `POST /api/fhir/sync/patient/:id` - Sync patient to FHIR
- `GET /api/fhir/bundle/:id` - Get FHIR bundle

#### Patient Portal
- `POST /api/patient-portal/login` - Patient login
- `GET /api/patient-portal/:id/appointments` - Get appointments
- `PUT /api/patient-portal/:id/profile` - Update profile
- `GET /api/patient-portal/:id/medical-records` - Get records

#### Medical Records
- `GET /api/medical-records` - Get all records
- `POST /api/medical-records` - Create record
- `PUT /api/medical-records/:id` - Update record

---

## Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Verify .env configuration
cat .env

# Start the development server
npm start
```

The frontend will start on `http://localhost:3001`.

---

## Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

### Default Login Credentials

After running migrations, you can create a test user:

```sql
-- Run in psql
INSERT INTO users (email, password, first_name, last_name, role, plan_tier)
VALUES (
  'admin@medflow.com',
  '$2a$10$YourHashedPasswordHere',  -- Use bcrypt to hash
  'Admin',
  'User',
  'admin',
  'enterprise'
);
```

Or use the registration endpoint:
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@medflow.com",
    "password": "securepassword123",
    "firstName": "Admin",
    "lastName": "User",
    "role": "admin",
    "planTier": "enterprise"
  }'
```

---

## Testing

### Test Telehealth Module

1. Navigate to **Telehealth** from the dashboard
2. Click **New Session** to create a video consultation
3. Join an active session to test the meeting functionality
4. Check recordings for completed sessions

### Test FHIR Integration

1. Navigate to **FHIR HL7** from the dashboard
2. View existing FHIR resources (Patient, Observation, Condition)
3. Select a patient and click **Sync to FHIR** to create FHIR resources
4. Download FHIR bundle as JSON

### Test Patient Portal

1. Navigate to **Patient Portal** from the dashboard
2. Login with patient credentials (email from patients table)
3. View appointments, medical records, and profile
4. Edit profile information
5. Test appointment viewing

### Test Social Login

1. On the login page, click **Google**, **Microsoft**, or **Facebook** button
2. Complete the OAuth flow
3. Verify automatic user creation and login

---

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Start PostgreSQL if stopped
sudo systemctl start postgresql

# Check connection
psql -U medflow_user -d medflow -c "SELECT 1"
```

### Migration Errors

**Error: "column 'start_time' does not exist"**

This means you have an old version of the tables in your database. Solution:

```bash
# Option 1: Drop all tables and recreate (⚠️ WARNING: Deletes all data!)
cd backend
node scripts/drop-tables.js
node scripts/migrate-enhanced.js

# Option 2: Drop tables manually in psql
psql -U medflow_user -d medflow
DROP TABLE IF EXISTS social_auth CASCADE;
DROP TABLE IF EXISTS patient_portal_sessions CASCADE;
DROP TABLE IF EXISTS medical_records CASCADE;
DROP TABLE IF EXISTS fhir_resources CASCADE;
DROP TABLE IF EXISTS telehealth_sessions CASCADE;
DROP TABLE IF EXISTS claims CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS practices CASCADE;
DROP TABLE IF EXISTS users CASCADE;
\q

# Then run migration
node scripts/migrate-enhanced.js
```

**Error: "relation already exists"**

The table already exists but with correct schema. This is usually safe to ignore if the migration completes successfully. If not, use the drop-tables.js script above.

### OAuth Issues

- Ensure redirect URIs match exactly in provider console and `.env`
- Check that OAuth credentials are correctly copied
- Verify domains are whitelisted in OAuth provider settings
- Check browser console for OAuth errors

### Port Conflicts

If ports 3000 or 3001 are in use:

**Backend:**
Edit `backend/server.js` and change port

**Frontend:**
Create `.env` in frontend:
```env
PORT=3002
```

---

## Production Deployment

### Environment Variables

For production, update these in your hosting platform:

**Backend:**
```env
NODE_ENV=production
DB_HOST=your-production-db-host
DB_NAME=medflow_production
JWT_SECRET=long-random-secure-string
```

**Frontend:**
```env
REACT_APP_API_URL=https://api.yourdomain.com/api
REACT_APP_GOOGLE_CLIENT_ID=production-google-client-id
REACT_APP_MICROSOFT_CLIENT_ID=production-microsoft-client-id
REACT_APP_FACEBOOK_APP_ID=production-facebook-app-id
REACT_APP_REDIRECT_URI=https://app.yourdomain.com
```

### Build Frontend

```bash
cd frontend
npm run build
```

### Security Considerations

- Use HTTPS in production
- Enable CORS only for your domains
- Rotate JWT secrets regularly
- Use strong database passwords
- Enable rate limiting on API endpoints
- Implement proper HIPAA compliance measures
- Regular security audits

---

## Additional Resources

- [React Documentation](https://reactjs.org/)
- [Express.js Guide](https://expressjs.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [FHIR R4 Specification](https://hl7.org/fhir/R4/)
- [OAuth 2.0 Guide](https://oauth.net/2/)

---

## Support

For issues or questions:
1. Check existing GitHub issues
2. Review application logs
3. Verify database connectivity
4. Test API endpoints with curl/Postman
5. Check browser console for frontend errors

## License

Copyright 2025 MedFlow. All rights reserved.
