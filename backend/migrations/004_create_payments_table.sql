-- Create payments table for online payment tracking
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  payment_number VARCHAR(50) UNIQUE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  claim_id UUID REFERENCES claims(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL, -- 'credit_card', 'debit_card', 'paypal', 'apple_pay', 'google_pay', etc.
  payment_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'refunded'
  transaction_id VARCHAR(100), -- External payment gateway transaction ID
  card_last_four VARCHAR(4), -- Last 4 digits of card (for display)
  card_brand VARCHAR(20), -- Visa, Mastercard, etc.
  payment_date TIMESTAMP,
  description TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on patient_id for faster queries
CREATE INDEX IF NOT EXISTS idx_payments_patient_id ON payments(patient_id);

-- Create index on claim_id for faster queries
CREATE INDEX IF NOT EXISTS idx_payments_claim_id ON payments(claim_id);

-- Create index on payment_status for filtering
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);
