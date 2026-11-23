-- Add user_id column to providers table and email unique constraint
ALTER TABLE providers ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE providers ADD CONSTRAINT providers_email_unique UNIQUE (email);

-- Add user_id column to patients table and email unique constraint
ALTER TABLE patients ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE patients ADD CONSTRAINT patients_email_unique UNIQUE (email);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_providers_user_id ON providers(user_id);
CREATE INDEX IF NOT EXISTS idx_providers_email ON providers(email);
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id);
CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email);
