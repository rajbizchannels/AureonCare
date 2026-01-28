# Medication Sample Data for ePrescribe

## Overview
This directory contains comprehensive medication data for testing and development of the ePrescribe functionality in AureonCare.

## Files

### `015_medications_sample_data.sql`
Comprehensive medication database with **45+ medications** across major drug classes.

## Installation

### Option 1: Run the SQL file directly (Recommended for comprehensive data)
```bash
psql -U your_username -d aureoncare_db -f backend/migrations/015_medications_sample_data.sql
```

### Option 2: Using psql interactive mode
```bash
psql -U your_username -d aureoncare_db
\i backend/migrations/015_medications_sample_data.sql
```

### Option 3: From Node.js migration runner
If your migration system supports it, the file can be run as part of the migration sequence.

## What's Included

### Drug Classes Covered (45+ medications):

1. **Cardiovascular (8 medications)**
   - ACE Inhibitors: Lisinopril 10mg, 20mg
   - Statins: Atorvastatin 20mg, 40mg
   - Calcium Channel Blockers: Amlodipine 5mg, 10mg
   - Beta Blockers: Metoprolol 50mg

2. **Diabetes (4 medications)**
   - Biguanides: Metformin 500mg, 1000mg
   - DPP-4 Inhibitors: Sitagliptin 100mg
   - Sulfonylureas: Glipizide 5mg

3. **Antibiotics (5 medications)**
   - Penicillins: Amoxicillin 500mg, 875mg
   - Fluoroquinolones: Ciprofloxacin 500mg
   - Macrolides: Azithromycin 250mg

4. **Pain Medications (6 medications)**
   - NSAIDs: Ibuprofen 600mg, 800mg
   - Opioids: Hydrocodone/APAP 5/325mg, 10/325mg, Tramadol 50mg

5. **Gastrointestinal (3 medications)**
   - PPIs: Omeprazole 20mg, 40mg
   - H2 Blockers: Ranitidine 150mg

6. **Respiratory (2 medications)**
   - Bronchodilators: Albuterol 90mcg inhaler
   - Inhaled Corticosteroids: Fluticasone 110mcg inhaler

7. **Psychiatric (3 medications)**
   - SSRIs: Sertraline 50mg, 100mg
   - Benzodiazepines: Alprazolam 0.5mg (Controlled IV)

8. **Thyroid (2 medications)**
   - Levothyroxine 50mcg, 100mcg

9. **Anticoagulants (2 medications)**
   - Warfarin 5mg
   - Apixaban 5mg (Eliquis)

## Data Fields Included

Each medication entry includes:

### Basic Information
- `ndc_code` - National Drug Code (unique identifier)
- `drug_name` - Common name with strength
- `generic_name` - Generic/chemical name
- `brand_name` - Brand/trade name
- `drug_class` - Therapeutic class
- `strength` - Dosage strength
- `dosage_form` - tablet, capsule, inhaler, etc.
- `route` - oral, inhalation, etc.
- `manufacturer` - Pharmaceutical company

### Clinical Information
- `common_dosages` - Array of typical dosing regimens
- `indications` - Array of approved uses
- `contraindications` - Array of when NOT to use
- `warnings` - Important safety information
- `side_effects` - Array of common adverse effects
- `drug_interactions` - Important drug interaction information
- `pregnancy_category` - FDA pregnancy category (A, B, C, D, X)

### Administrative
- `controlled_substance` - TRUE/FALSE
- `dea_schedule` - II, III, IV, V (if controlled)
- `requires_prior_auth` - TRUE/FALSE
- `formulary_status` - preferred, non-preferred, not-covered
- `average_cost` - Typical retail price
- `is_generic` - TRUE/FALSE
- `is_active` - TRUE/FALSE

## Testing the ePrescribe Search

After loading the data, you can test the search functionality with these common medication names:

- **Cardiovascular**: lisinopril, atorvastatin, amlodipine, metoprolol
- **Diabetes**: metformin, sitagliptin, glipizide
- **Antibiotics**: amoxicillin, ciprofloxacin, azithromycin
- **Pain**: ibuprofen, hydrocodone, tramadol
- **GI**: omeprazole, ranitidine
- **Other**: sertraline, levothyroxine, warfarin

## Search Indexes

The migration file automatically creates indexes on:
- `drug_name` (case-insensitive)
- `generic_name` (case-insensitive)
- `brand_name` (case-insensitive)
- `ndc_code`
- `drug_class`

These indexes ensure fast search performance even with large medication databases.

## Controlled Substances

The following medications are marked as controlled substances:
- **Schedule II**: Hydrocodone/Acetaminophen 5/325mg, 10/325mg
- **Schedule IV**: Alprazolam 0.5mg, Tramadol 50mg

These require special handling in the ePrescribe system including:
- DEA number validation
- Quantity limits
- Refill restrictions
- Enhanced documentation

## Prior Authorization Medications

The following medications require prior authorization:
- Sitagliptin 100mg (Januvia) - DPP-4 Inhibitor
- Apixaban 5mg (Eliquis) - Anticoagulant

## Formulary Status

Medications are categorized as:
- **Preferred** (most medications) - Lower copays, no prior auth
- **Non-Preferred** (Sitagliptin, Apixaban) - Higher copays, may need prior auth

## Safety Features

Each medication includes comprehensive safety information:

### Black Box Warnings
- Opioids: Addiction, abuse, misuse risk
- SSRIs: Suicidal thoughts in young patients
- Fluoroquinolones: Tendon rupture risk

### Common Interactions
- Warfarin: Numerous drug and food interactions
- SSRIs: Serotonin syndrome with other serotonergic drugs
- Metformin: Lactic acidosis risk

### Special Populations
- Pregnancy categories documented for all medications
- Renal adjustment notes where applicable
- Hepatic impairment warnings

## Verification

After loading, verify the data:

```sql
-- Count total medications
SELECT COUNT(*) FROM medications WHERE is_active = true;
-- Should return 45+

-- List all drug classes
SELECT DISTINCT drug_class, COUNT(*) as count
FROM medications
GROUP BY drug_class
ORDER BY drug_class;

-- Test search functionality
SELECT drug_name, generic_name, strength
FROM medications
WHERE LOWER(drug_name) LIKE '%lisinopril%'
   OR LOWER(generic_name) LIKE '%lisinopril%';

-- Verify controlled substances
SELECT drug_name, dea_schedule
FROM medications
WHERE controlled_substance = true
ORDER BY dea_schedule;
```

## Updates and Maintenance

To add more medications, use the same structure:

```sql
INSERT INTO medications (
  ndc_code, drug_name, generic_name, brand_name, drug_class, strength,
  dosage_form, route, manufacturer, controlled_substance, dea_schedule,
  requires_prior_auth, formulary_status, average_cost, common_dosages,
  indications, contraindications, warnings, side_effects, drug_interactions,
  pregnancy_category, is_generic, is_active
) VALUES (
  '00000-0000-00',
  'Drug Name',
  'Generic Name',
  'Brand Name',
  'Drug Class',
  '10mg',
  'tablet',
  'oral',
  'Manufacturer',
  FALSE,
  NULL,
  FALSE,
  'preferred',
  10.00,
  ARRAY['10mg once daily'],
  ARRAY['Indication 1', 'Indication 2'],
  ARRAY['Contraindication 1'],
  'Important warnings',
  ARRAY['Side effect 1', 'Side effect 2'],
  'Drug interaction notes',
  'C',
  TRUE,
  TRUE
);
```

## Troubleshooting

### Issue: "ERROR: duplicate key value violates unique constraint"
**Solution**: The NDC code already exists. Use a different NDC or update the existing record.

### Issue: "ERROR: null value in column ndc_code"
**Solution**: NDC code is required. Ensure every medication has a unique NDC code.

### Issue: "ERROR: invalid input syntax for type boolean"
**Solution**: Use TRUE/FALSE (not 'true'/'false' strings) for boolean fields.

### Issue: Search returns no results
**Solution**:
1. Verify data was loaded: `SELECT COUNT(*) FROM medications;`
2. Check backend is running
3. Check migration 015 tables exist
4. Review browser console for API errors

## Support

For issues or questions:
1. Check the browser console (F12) for detailed error messages
2. Verify backend server is running on port 3001
3. Ensure migration 015 was run successfully
4. Check PostgreSQL logs for database errors

## License

This sample data is provided for development and testing purposes.
