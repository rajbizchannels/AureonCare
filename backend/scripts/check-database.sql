-- Quick Database Check and Setup Script
-- Run this to check your database status and create tables

-- Step 1: Check what database you're connected to
SELECT current_database();

-- Step 2: Check what tables exist (if any)
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Step 3: Check if UUID extension is enabled
SELECT * FROM pg_extension WHERE extname = 'uuid-ossp';

-- If no tables exist above, you need to run the full schema.
-- Continue below to create all tables...
