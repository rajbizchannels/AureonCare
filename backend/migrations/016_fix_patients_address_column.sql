-- Migration 016: Fix patients address column type
-- The address column should be TEXT, not JSON, to match the schema and frontend expectations

-- Change the column type from JSONB to TEXT
-- The USING clause handles the conversion: if it's a JSON object, extract and concatenate fields
-- If it's already a plain string in quotes, just extract the string value
ALTER TABLE patients
ALTER COLUMN address TYPE TEXT
USING CASE
  -- If address is a JSON object (starts with {), extract and concatenate the fields
  WHEN address::text LIKE '{%' THEN
    CONCAT_WS(', ',
      NULLIF(address->>'street', ''),
      NULLIF(address->>'city', ''),
      NULLIF(CONCAT(address->>'state', ' ', address->>'zip'), ' ')
    )
  -- If address is NULL, keep it NULL
  WHEN address IS NULL THEN NULL
  -- Otherwise convert JSONB to text (handles simple string values like "123 Main St")
  ELSE address::text
END;
