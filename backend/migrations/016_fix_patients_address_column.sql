-- Migration 016: Fix patients address column type
-- The address column should be TEXT, not JSON, to match the schema and frontend expectations

-- First, convert any existing JSON addresses to plain text strings
UPDATE patients
SET address = CASE
  WHEN address::text LIKE '{%' THEN
    -- If it's JSON, extract the components and concatenate them
    CONCAT_WS(', ',
      NULLIF(address->>'street', ''),
      NULLIF(address->>'city', ''),
      NULLIF(CONCAT(address->>'state', ' ', address->>'zip'), ' ')
    )
  ELSE
    -- If it's already text (or null), keep it as is
    address::text
END
WHERE address IS NOT NULL;

-- Change the column type from JSON/JSONB to TEXT
ALTER TABLE patients
ALTER COLUMN address TYPE TEXT USING address::text;
