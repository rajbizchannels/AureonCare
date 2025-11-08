-- =====================================================
-- ePrescribing and Pharmacy Network Integration
-- =====================================================

-- 1. Enhance prescriptions table with ePrescribing fields
ALTER TABLE prescriptions
ADD COLUMN IF NOT EXISTS ndc_code VARCHAR(20),                    -- National Drug Code
ADD COLUMN IF NOT EXISTS drug_strength VARCHAR(50),               -- e.g., "500mg"
ADD COLUMN IF NOT EXISTS drug_form VARCHAR(50),                   -- e.g., "tablet", "capsule", "liquid"
ADD COLUMN IF NOT EXISTS quantity INTEGER,                        -- Total quantity prescribed
ADD COLUMN IF NOT EXISTS days_supply INTEGER,                     -- Number of days supply
ADD COLUMN IF NOT EXISTS daw_code INTEGER DEFAULT 0,              -- Dispense As Written code (0-9)
ADD COLUMN IF NOT EXISTS prior_auth_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS prior_auth_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS pharmacy_id INTEGER,                     -- Pharmacy where sent
ADD COLUMN IF NOT EXISTS erx_message_id VARCHAR(100),             -- Electronic prescription message ID
ADD COLUMN IF NOT EXISTS erx_status VARCHAR(50) DEFAULT 'draft',  -- draft, sent, accepted, rejected, dispensed, cancelled
ADD COLUMN IF NOT EXISTS erx_sent_date TIMESTAMP,                 -- When sent electronically
ADD COLUMN IF NOT EXISTS erx_response_date TIMESTAMP,             -- When pharmacy responded
ADD COLUMN IF NOT EXISTS erx_error_message TEXT,                  -- Error messages from pharmacy
ADD COLUMN IF NOT EXISTS controlled_substance_class VARCHAR(10),  -- DEA schedule (II, III, IV, V)
ADD COLUMN IF NOT EXISTS prescriber_dea_number VARCHAR(20),        -- Prescriber's DEA number
ADD COLUMN IF NOT EXISTS diagnosis_code VARCHAR(20),              -- ICD-10 code for indication
ADD COLUMN IF NOT EXISTS substitution_allowed BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS sig_code TEXT,                           -- Structured SIG (directions)
ADD COLUMN IF NOT EXISTS notes_to_pharmacist TEXT,
ADD COLUMN IF NOT EXISTS refills_remaining INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_filled_date DATE,
ADD COLUMN IF NOT EXISTS cancelled_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS cancelled_by INTEGER REFERENCES users(id);

-- 2. Create medication formulary/drug database table
CREATE TABLE IF NOT EXISTS medications (
  id SERIAL PRIMARY KEY,
  ndc_code VARCHAR(20) UNIQUE NOT NULL,
  drug_name VARCHAR(255) NOT NULL,
  generic_name VARCHAR(255),
  brand_name VARCHAR(255),
  drug_class VARCHAR(100),                        -- e.g., "Antibiotic", "Antihypertensive"
  strength VARCHAR(50),
  dosage_form VARCHAR(50),                        -- tablet, capsule, liquid, injection, etc.
  route VARCHAR(50),                              -- oral, topical, IV, IM, etc.
  manufacturer VARCHAR(255),
  controlled_substance BOOLEAN DEFAULT FALSE,
  dea_schedule VARCHAR(10),                       -- II, III, IV, V for controlled substances
  requires_prior_auth BOOLEAN DEFAULT FALSE,
  formulary_status VARCHAR(50) DEFAULT 'preferred', -- preferred, non-preferred, not-covered
  average_cost DECIMAL(10,2),
  common_dosages TEXT[],                          -- Array of common dosing regimens
  indications TEXT[],                             -- Array of common uses
  contraindications TEXT[],                       -- Array of contraindications
  warnings TEXT,
  side_effects TEXT[],
  drug_interactions TEXT,
  pregnancy_category VARCHAR(5),
  is_generic BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create pharmacy network table
CREATE TABLE IF NOT EXISTS pharmacies (
  id SERIAL PRIMARY KEY,
  ncpdp_id VARCHAR(20) UNIQUE,                   -- National Council for Prescription Drug Programs ID
  npi VARCHAR(20),                               -- National Provider Identifier
  pharmacy_name VARCHAR(255) NOT NULL,
  chain_name VARCHAR(255),                       -- e.g., "CVS", "Walgreens"
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(2),
  zip_code VARCHAR(10),
  phone VARCHAR(20),
  fax VARCHAR(20),
  email VARCHAR(255),
  website VARCHAR(255),
  is_24_hours BOOLEAN DEFAULT FALSE,
  accepts_erx BOOLEAN DEFAULT TRUE,              -- Accepts electronic prescriptions
  erx_endpoint_url VARCHAR(500),                 -- URL for sending ePrescriptions
  erx_system_type VARCHAR(50),                   -- e.g., "SureScripts", "NewCrop"
  delivery_available BOOLEAN DEFAULT FALSE,
  drive_through BOOLEAN DEFAULT FALSE,
  accepts_insurance BOOLEAN DEFAULT TRUE,
  preferred_network BOOLEAN DEFAULT FALSE,       -- In preferred pharmacy network
  distance_miles DECIMAL(10,2),                  -- Distance from clinic/patient
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  operating_hours JSONB,                         -- Store hours by day of week
  services JSONB,                                -- Array of services offered
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create patient preferred pharmacies
CREATE TABLE IF NOT EXISTS patient_pharmacies (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
  pharmacy_id INTEGER REFERENCES pharmacies(id) ON DELETE CASCADE,
  is_preferred BOOLEAN DEFAULT FALSE,
  added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(patient_id, pharmacy_id)
);

-- 5. Create prescription history/audit log
CREATE TABLE IF NOT EXISTS prescription_history (
  id SERIAL PRIMARY KEY,
  prescription_id INTEGER REFERENCES prescriptions(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,                   -- created, sent, modified, dispensed, cancelled, refilled
  action_by INTEGER REFERENCES users(id),
  action_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  pharmacy_id INTEGER REFERENCES pharmacies(id),
  fill_number INTEGER,                           -- Which refill (0 = original)
  quantity_dispensed INTEGER,
  pharmacist_name VARCHAR(255),
  pharmacist_license VARCHAR(50),
  notes TEXT,
  metadata JSONB                                 -- Additional context data
);

-- 6. Create drug interactions tracking
CREATE TABLE IF NOT EXISTS drug_interactions (
  id SERIAL PRIMARY KEY,
  drug1_ndc VARCHAR(20) NOT NULL,
  drug2_ndc VARCHAR(20) NOT NULL,
  interaction_severity VARCHAR(50) NOT NULL,     -- mild, moderate, severe, contraindicated
  interaction_type VARCHAR(100),                 -- e.g., "pharmacokinetic", "pharmacodynamic"
  description TEXT NOT NULL,
  clinical_effects TEXT,
  management_recommendations TEXT,
  references TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(drug1_ndc, drug2_ndc)
);

-- 7. Create patient allergies tracking (enhanced)
CREATE TABLE IF NOT EXISTS patient_allergies (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
  allergen_type VARCHAR(50) NOT NULL,            -- drug, food, environmental
  allergen_name VARCHAR(255) NOT NULL,
  ndc_code VARCHAR(20),                          -- If drug allergy
  reaction_type VARCHAR(100),                    -- e.g., "anaphylaxis", "rash", "nausea"
  severity VARCHAR(50),                          -- mild, moderate, severe, life-threatening
  onset_date DATE,
  reported_date DATE DEFAULT CURRENT_DATE,
  reported_by INTEGER REFERENCES users(id),
  verified BOOLEAN DEFAULT FALSE,
  verified_by INTEGER REFERENCES users(id),
  verified_date TIMESTAMP,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Create ePrescription message queue (for async processing)
CREATE TABLE IF NOT EXISTS erx_message_queue (
  id SERIAL PRIMARY KEY,
  prescription_id INTEGER REFERENCES prescriptions(id) ON DELETE CASCADE,
  message_type VARCHAR(50) NOT NULL,             -- NewRx, RefillRequest, CancelRx, ChangeRequest
  message_direction VARCHAR(20) NOT NULL,        -- outbound, inbound
  pharmacy_id INTEGER REFERENCES pharmacies(id),
  message_payload JSONB NOT NULL,
  message_status VARCHAR(50) DEFAULT 'pending',  -- pending, processing, sent, delivered, failed
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  sent_date TIMESTAMP,
  delivered_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Create formulary alternatives (generic/brand equivalents)
CREATE TABLE IF NOT EXISTS medication_alternatives (
  id SERIAL PRIMARY KEY,
  original_ndc VARCHAR(20) REFERENCES medications(ndc_code),
  alternative_ndc VARCHAR(20) REFERENCES medications(ndc_code),
  relationship_type VARCHAR(50) NOT NULL,        -- generic-of, brand-of, therapeutic-equivalent
  cost_difference DECIMAL(10,2),                 -- Price difference
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_prescriptions_pharmacy ON prescriptions(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_erx_status ON prescriptions(erx_status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_ndc ON prescriptions(ndc_code);
CREATE INDEX IF NOT EXISTS idx_medications_ndc ON medications(ndc_code);
CREATE INDEX IF NOT EXISTS idx_medications_drug_name ON medications(drug_name);
CREATE INDEX IF NOT EXISTS idx_medications_generic_name ON medications(generic_name);
CREATE INDEX IF NOT EXISTS idx_medications_drug_class ON medications(drug_class);
CREATE INDEX IF NOT EXISTS idx_pharmacies_ncpdp ON pharmacies(ncpdp_id);
CREATE INDEX IF NOT EXISTS idx_pharmacies_city_state ON pharmacies(city, state);
CREATE INDEX IF NOT EXISTS idx_pharmacies_zip ON pharmacies(zip_code);
CREATE INDEX IF NOT EXISTS idx_patient_pharmacies_patient ON patient_pharmacies(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_allergies_patient ON patient_allergies(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescription_history_prescription ON prescription_history(prescription_id);
CREATE INDEX IF NOT EXISTS idx_erx_queue_status ON erx_message_queue(message_status);
CREATE INDEX IF NOT EXISTS idx_drug_interactions_drug1 ON drug_interactions(drug1_ndc);
CREATE INDEX IF NOT EXISTS idx_drug_interactions_drug2 ON drug_interactions(drug2_ndc);

-- Add comments for documentation
COMMENT ON TABLE medications IS 'Drug formulary database with NDC codes and drug information';
COMMENT ON TABLE pharmacies IS 'Network of pharmacies that accept electronic prescriptions';
COMMENT ON TABLE patient_pharmacies IS 'Patient preferred pharmacy selections';
COMMENT ON TABLE prescription_history IS 'Audit log of all prescription actions and fills';
COMMENT ON TABLE drug_interactions IS 'Known drug-drug interactions database';
COMMENT ON TABLE patient_allergies IS 'Patient allergy and adverse reaction tracking';
COMMENT ON TABLE erx_message_queue IS 'Queue for electronic prescription messages to/from pharmacies';
COMMENT ON TABLE medication_alternatives IS 'Generic and therapeutic alternatives for cost savings';

-- Sample data for testing (some common medications)
INSERT INTO medications (ndc_code, drug_name, generic_name, brand_name, drug_class, strength, dosage_form, route, is_generic) VALUES
('00781-1506-01', 'Lisinopril', 'Lisinopril', 'Prinivil', 'ACE Inhibitor', '10mg', 'tablet', 'oral', TRUE),
('00093-0058-01', 'Metformin', 'Metformin HCl', 'Glucophage', 'Antidiabetic', '500mg', 'tablet', 'oral', TRUE),
('00591-0405-01', 'Atorvastatin', 'Atorvastatin', 'Lipitor', 'Statin', '20mg', 'tablet', 'oral', TRUE),
('00378-1805-93', 'Amlodipine', 'Amlodipine Besylate', 'Norvasc', 'Calcium Channel Blocker', '5mg', 'tablet', 'oral', TRUE),
('68180-0513-03', 'Omeprazole', 'Omeprazole', 'Prilosec', 'Proton Pump Inhibitor', '20mg', 'capsule', 'oral', TRUE),
('00093-2063-01', 'Levothyroxine', 'Levothyroxine Sodium', 'Synthroid', 'Thyroid Hormone', '50mcg', 'tablet', 'oral', TRUE),
('00093-1045-56', 'Amoxicillin', 'Amoxicillin', 'Amoxil', 'Antibiotic', '500mg', 'capsule', 'oral', TRUE),
('00093-0147-01', 'Azithromycin', 'Azithromycin', 'Zithromax', 'Antibiotic', '250mg', 'tablet', 'oral', TRUE)
ON CONFLICT (ndc_code) DO NOTHING;

-- Sample pharmacies for testing
INSERT INTO pharmacies (ncpdp_id, pharmacy_name, chain_name, address_line1, city, state, zip_code, phone, accepts_erx) VALUES
('1234567', 'CVS Pharmacy #1234', 'CVS', '123 Main St', 'Medical City', 'MC', '12345', '(555) 123-4567', TRUE),
('2345678', 'Walgreens #5678', 'Walgreens', '456 Oak Ave', 'Medical City', 'MC', '12345', '(555) 234-5678', TRUE),
('3456789', 'Rite Aid #9012', 'Rite Aid', '789 Elm St', 'Medical City', 'MC', '12345', '(555) 345-6789', TRUE),
('4567890', 'Local Community Pharmacy', NULL, '321 Pine St', 'Medical City', 'MC', '12345', '(555) 456-7890', TRUE)
ON CONFLICT (ncpdp_id) DO NOTHING;

SELECT 'ePrescribing and pharmacy network integration schema created successfully' as status;
