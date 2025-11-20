# Fix Database Errors - Quick Guide

## Errors You're Seeing

```
❌ ERROR: column "preferred_date" does not exist
❌ ERROR: relation "appointment_types" does not exist
```

## Quick Fix (Copy & Paste SQL)

### Option 1: Run Both Fixes at Once

**Open pgAdmin or psql and run this:**

```sql
-- Fix 1: Create appointment_types table
CREATE TABLE IF NOT EXISTS appointment_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  duration_minutes INTEGER DEFAULT 30,
  color VARCHAR(20) DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO appointment_types (name, description, duration_minutes, color, display_order) VALUES
  ('General Consultation', 'General medical consultation and check-up', 30, '#3B82F6', 1),
  ('Follow-up', 'Follow-up visit for existing condition', 20, '#10B981', 2),
  ('Check-up', 'Routine health check-up', 30, '#F59E0B', 3),
  ('Physical Exam', 'Complete physical examination', 45, '#8B5CF6', 4),
  ('Vaccination', 'Immunization and vaccination services', 15, '#EC4899', 5),
  ('Lab Results', 'Review and discuss lab results', 15, '#06B6D4', 6)
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_appointment_types_active ON appointment_types(is_active);
CREATE INDEX IF NOT EXISTS idx_appointment_types_order ON appointment_types(display_order);

-- Fix 2: Create appointment_waitlist table
DROP TABLE IF EXISTS appointment_waitlist CASCADE;

CREATE TABLE appointment_waitlist (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id INTEGER REFERENCES providers(id) ON DELETE SET NULL,
  preferred_date DATE NOT NULL,
  preferred_time_start TIME,
  preferred_time_end TIME,
  appointment_type VARCHAR(100),
  reason TEXT,
  priority INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'notified', 'scheduled', 'cancelled', 'expired')),
  notified_at TIMESTAMP,
  expires_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_waitlist_patient ON appointment_waitlist(patient_id);
CREATE INDEX idx_waitlist_provider ON appointment_waitlist(provider_id);
CREATE INDEX idx_waitlist_date ON appointment_waitlist(preferred_date);
CREATE INDEX idx_waitlist_status ON appointment_waitlist(status);
CREATE INDEX idx_waitlist_priority ON appointment_waitlist(priority DESC);
CREATE INDEX idx_waitlist_active_lookup ON appointment_waitlist(provider_id, preferred_date, status) WHERE status = 'active';
```

### Option 2: Run Individual Fix Files

1. **For appointment_types error:**
   - Run: `backend/migrations/FIX_APPOINTMENT_TYPES_TABLE.sql`

2. **For preferred_date error:**
   - Run: `backend/migrations/FIX_WAITLIST_TABLE.sql`

## How to Run SQL

### Using pgAdmin:
1. Open pgAdmin
2. Connect to your database
3. Click "Query Tool" (or press F5)
4. Paste the SQL above
5. Click Execute (▶️ button)

### Using psql:
```bash
psql -U postgres -d medflow -f backend/migrations/FIX_APPOINTMENT_TYPES_TABLE.sql
psql -U postgres -d medflow -f backend/migrations/FIX_WAITLIST_TABLE.sql
```

## Verify It Worked

Run this query to check:

```sql
-- Should return 6 rows
SELECT COUNT(*) FROM appointment_types;

-- Should show table structure
SELECT column_name FROM information_schema.columns
WHERE table_name = 'appointment_waitlist'
ORDER BY ordinal_position;
```

## After Running Migrations

✅ Restart your backend server
✅ Refresh your browser
✅ Errors should be gone!

## What These Tables Do

**appointment_types** - Dynamic appointment type management
- Allows customizable appointment types
- Used in booking forms

**appointment_waitlist** - Waitlist for fully booked slots
- Patients can join waitlist when no slots available
- Automatic notification when slots open up
