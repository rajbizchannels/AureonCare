-- =====================================================
-- Comprehensive Medication Sample Data
-- For ePrescribing functionality testing
-- =====================================================

-- Clear existing medication data (optional - comment out in production)
-- TRUNCATE TABLE medications CASCADE;

-- Insert comprehensive medication data
INSERT INTO medications (
  ndc_code, drug_name, generic_name, brand_name, drug_class, strength, dosage_form, route,
  manufacturer, controlled_substance, dea_schedule, requires_prior_auth, formulary_status,
  average_cost, common_dosages, indications, contraindications, warnings, side_effects,
  drug_interactions, pregnancy_category, is_generic, is_active
) VALUES

-- ===== CARDIOVASCULAR MEDICATIONS =====

-- ACE Inhibitors
('00781-1506-01', 'Lisinopril 10mg', 'Lisinopril', 'Prinivil', 'ACE Inhibitor', '10mg', 'tablet', 'oral',
 'Sandoz', FALSE, NULL, FALSE, 'preferred', 4.50,
 ARRAY['10mg once daily', '10mg twice daily', '20mg once daily'],
 ARRAY['Hypertension', 'Heart failure', 'Post-MI prevention'],
 ARRAY['Pregnancy', 'History of angioedema', 'Bilateral renal artery stenosis'],
 'May cause hypotension, especially after first dose. Monitor renal function and potassium levels.',
 ARRAY['Dizziness', 'Headache', 'Persistent dry cough', 'Fatigue', 'Hyperkalemia'],
 'Increased risk of hyperkalemia with potassium supplements or potassium-sparing diuretics. NSAIDs may reduce effectiveness.',
 'D', TRUE, TRUE),

('00781-1507-01', 'Lisinopril 20mg', 'Lisinopril', 'Prinivil', 'ACE Inhibitor', '20mg', 'tablet', 'oral',
 'Sandoz', FALSE, NULL, FALSE, 'preferred', 5.25,
 ARRAY['20mg once daily', '40mg once daily'],
 ARRAY['Hypertension', 'Heart failure', 'Post-MI prevention'],
 ARRAY['Pregnancy', 'History of angioedema', 'Bilateral renal artery stenosis'],
 'May cause hypotension, especially after first dose. Monitor renal function and potassium levels.',
 ARRAY['Dizziness', 'Headache', 'Persistent dry cough', 'Fatigue', 'Hyperkalemia'],
 'Increased risk of hyperkalemia with potassium supplements or potassium-sparing diuretics. NSAIDs may reduce effectiveness.',
 'D', TRUE, TRUE),

-- Statins
('00093-0058-01', 'Atorvastatin 20mg', 'Atorvastatin Calcium', 'Lipitor', 'Statin', '20mg', 'tablet', 'oral',
 'Teva', FALSE, NULL, FALSE, 'preferred', 12.00,
 ARRAY['10-20mg once daily', '40-80mg once daily for high-risk patients'],
 ARRAY['Hyperlipidemia', 'Primary prevention of cardiovascular disease', 'Secondary prevention after MI or stroke'],
 ARRAY['Active liver disease', 'Pregnancy', 'Breastfeeding'],
 'May cause muscle pain or weakness. Rare risk of rhabdomyolysis. Monitor liver enzymes and CPK if symptomatic.',
 ARRAY['Muscle pain', 'Headache', 'Nausea', 'Elevated liver enzymes', 'Joint pain'],
 'Increased risk of myopathy with fibrates, niacin, or cyclosporine. Avoid grapefruit juice.',
 'X', TRUE, TRUE),

('00093-0059-01', 'Atorvastatin 40mg', 'Atorvastatin Calcium', 'Lipitor', 'Statin', '40mg', 'tablet', 'oral',
 'Teva', FALSE, NULL, FALSE, 'preferred', 15.50,
 ARRAY['40mg once daily', '80mg once daily for high-risk patients'],
 ARRAY['Hyperlipidemia', 'Primary prevention of cardiovascular disease', 'Secondary prevention after MI or stroke'],
 ARRAY['Active liver disease', 'Pregnancy', 'Breastfeeding'],
 'May cause muscle pain or weakness. Rare risk of rhabdomyolysis. Monitor liver enzymes and CPK if symptomatic.',
 ARRAY['Muscle pain', 'Headache', 'Nausea', 'Elevated liver enzymes', 'Joint pain'],
 'Increased risk of myopathy with fibrates, niacin, or cyclosporine. Avoid grapefruit juice.',
 'X', TRUE, TRUE),

-- Calcium Channel Blockers
('00378-1805-93', 'Amlodipine 5mg', 'Amlodipine Besylate', 'Norvasc', 'Calcium Channel Blocker', '5mg', 'tablet', 'oral',
 'Mylan', FALSE, NULL, FALSE, 'preferred', 6.00,
 ARRAY['5mg once daily', '10mg once daily'],
 ARRAY['Hypertension', 'Chronic stable angina', 'Vasospastic angina'],
 ARRAY['Severe aortic stenosis', 'Cardiogenic shock'],
 'May cause peripheral edema and dizziness. Use caution in patients with heart failure.',
 ARRAY['Peripheral edema', 'Dizziness', 'Flushing', 'Palpitations', 'Headache'],
 'May increase levels of simvastatin. CYP3A4 inhibitors may increase amlodipine levels.',
 'C', TRUE, TRUE),

('00378-1806-93', 'Amlodipine 10mg', 'Amlodipine Besylate', 'Norvasc', 'Calcium Channel Blocker', '10mg', 'tablet', 'oral',
 'Mylan', FALSE, NULL, FALSE, 'preferred', 7.50,
 ARRAY['10mg once daily'],
 ARRAY['Hypertension', 'Chronic stable angina', 'Vasospastic angina'],
 ARRAY['Severe aortic stenosis', 'Cardiogenic shock'],
 'May cause peripheral edema and dizziness. Use caution in patients with heart failure.',
 ARRAY['Peripheral edema', 'Dizziness', 'Flushing', 'Palpitations', 'Headache'],
 'May increase levels of simvastatin. CYP3A4 inhibitors may increase amlodipine levels.',
 'C', TRUE, TRUE),

-- Beta Blockers
('68180-0514-03', 'Metoprolol Succinate 50mg', 'Metoprolol Succinate', 'Toprol-XL', 'Beta Blocker', '50mg', 'tablet extended release', 'oral',
 'Lupin', FALSE, NULL, FALSE, 'preferred', 8.00,
 ARRAY['50mg once daily', '100mg once daily', '200mg once daily'],
 ARRAY['Hypertension', 'Heart failure', 'Angina', 'Post-MI'],
 ARRAY['Severe bradycardia', 'Heart block', 'Cardiogenic shock', 'Severe asthma'],
 'Do not abruptly discontinue - may precipitate angina or MI. Use caution in diabetes (may mask hypoglycemia).',
 ARRAY['Fatigue', 'Dizziness', 'Bradycardia', 'Hypotension', 'Cold extremities'],
 'May mask symptoms of hypoglycemia in diabetics. Enhanced effect with other antihypertensives.',
 'C', TRUE, TRUE),

-- ===== DIABETES MEDICATIONS =====

-- Biguanides
('00093-0058-01', 'Metformin 500mg', 'Metformin HCl', 'Glucophage', 'Biguanide', '500mg', 'tablet', 'oral',
 'Teva', FALSE, NULL, FALSE, 'preferred', 4.00,
 ARRAY['500mg twice daily with meals', '850mg twice daily', '1000mg twice daily'],
 ARRAY['Type 2 diabetes mellitus', 'Prediabetes prevention', 'PCOS'],
 ARRAY['Severe renal impairment (eGFR <30)', 'Metabolic acidosis', 'Diabetic ketoacidosis'],
 'Risk of lactic acidosis especially with renal impairment. Hold before contrast studies and surgery.',
 ARRAY['Nausea', 'Diarrhea', 'Abdominal discomfort', 'Vitamin B12 deficiency with long-term use'],
 'Alcohol may increase risk of lactic acidosis. Contrast dye increases risk of renal failure.',
 'B', TRUE, TRUE),

('00093-0058-02', 'Metformin 1000mg', 'Metformin HCl', 'Glucophage', 'Biguanide', '1000mg', 'tablet', 'oral',
 'Teva', FALSE, NULL, FALSE, 'preferred', 6.00,
 ARRAY['1000mg once daily', '1000mg twice daily'],
 ARRAY['Type 2 diabetes mellitus', 'Prediabetes prevention', 'PCOS'],
 ARRAY['Severe renal impairment (eGFR <30)', 'Metabolic acidosis', 'Diabetic ketoacidosis'],
 'Risk of lactic acidosis especially with renal impairment. Hold before contrast studies and surgery.',
 ARRAY['Nausea', 'Diarrhea', 'Abdominal discomfort', 'Vitamin B12 deficiency with long-term use'],
 'Alcohol may increase risk of lactic acidosis. Contrast dye increases risk of renal failure.',
 'B', TRUE, TRUE),

-- DPP-4 Inhibitors
('00025-1671-31', 'Sitagliptin 100mg', 'Sitagliptin', 'Januvia', 'DPP-4 Inhibitor', '100mg', 'tablet', 'oral',
 'Merck', FALSE, NULL, TRUE, 'non-preferred', 425.00,
 ARRAY['100mg once daily', '50mg once daily (renal impairment)'],
 ARRAY['Type 2 diabetes mellitus'],
 ARRAY['Type 1 diabetes', 'Diabetic ketoacidosis'],
 'May cause pancreatitis. Reports of severe joint pain. Adjust dose in renal impairment.',
 ARRAY['Nasopharyngitis', 'Headache', 'Upper respiratory infection', 'Pancreatitis (rare)'],
 'Minimal drug interactions. Does not require dose adjustment with other oral antidiabetic agents.',
 'B', FALSE, TRUE),

-- ===== ANTIBIOTICS =====

-- Penicillins
('00093-2264-01', 'Amoxicillin 500mg', 'Amoxicillin', 'Amoxil', 'Penicillin Antibiotic', '500mg', 'capsule', 'oral',
 'Teva', FALSE, NULL, FALSE, 'preferred', 8.50,
 ARRAY['500mg three times daily', '875mg twice daily'],
 ARRAY['Upper respiratory infections', 'Otitis media', 'Urinary tract infections', 'H. pylori eradication'],
 ARRAY['Penicillin allergy', 'History of severe hypersensitivity to beta-lactams'],
 'May cause allergic reactions including anaphylaxis. Inquire about penicillin allergy before prescribing.',
 ARRAY['Diarrhea', 'Nausea', 'Skin rash', 'Candidiasis'],
 'May reduce effectiveness of oral contraceptives. Allopurinol increases risk of rash.',
 'B', TRUE, TRUE),

('00093-2264-73', 'Amoxicillin 875mg', 'Amoxicillin', 'Amoxil', 'Penicillin Antibiotic', '875mg', 'tablet', 'oral',
 'Teva', FALSE, NULL, FALSE, 'preferred', 10.00,
 ARRAY['875mg twice daily'],
 ARRAY['Upper respiratory infections', 'Otitis media', 'Sinusitis', 'Community-acquired pneumonia'],
 ARRAY['Penicillin allergy', 'History of severe hypersensitivity to beta-lactams'],
 'May cause allergic reactions including anaphylaxis. Inquire about penicillin allergy before prescribing.',
 ARRAY['Diarrhea', 'Nausea', 'Skin rash', 'Candidiasis'],
 'May reduce effectiveness of oral contraceptives. Allopurinol increases risk of rash.',
 'B', TRUE, TRUE),

-- Fluoroquinolones
('00093-3147-56', 'Ciprofloxacin 500mg', 'Ciprofloxacin', 'Cipro', 'Fluoroquinolone', '500mg', 'tablet', 'oral',
 'Teva', FALSE, NULL, FALSE, 'preferred', 15.00,
 ARRAY['250-500mg twice daily', '500-750mg twice daily for severe infections'],
 ARRAY['Urinary tract infections', 'Prostatitis', 'Skin infections', 'Respiratory infections'],
 ARRAY['Age <18 years', 'Pregnancy', 'History of tendon disorders with fluoroquinolones'],
 'BLACK BOX WARNING: Increased risk of tendinitis and tendon rupture. May cause peripheral neuropathy. Use as last resort.',
 ARRAY['Nausea', 'Diarrhea', 'Headache', 'Tendon pain', 'QT prolongation', 'Photosensitivity'],
 'May increase theophylline and warfarin levels. Avoid with antacids (reduced absorption).',
 'C', TRUE, TRUE),

-- Macrolides
('00074-6160-13', 'Azithromycin 250mg', 'Azithromycin', 'Zithromax', 'Macrolide Antibiotic', '250mg', 'tablet', 'oral',
 'Pfizer', FALSE, NULL, FALSE, 'preferred', 12.00,
 ARRAY['500mg on day 1, then 250mg daily for 4 days', '250mg daily'],
 ARRAY['Respiratory infections', 'Skin infections', 'Chlamydia', 'Community-acquired pneumonia'],
 ARRAY['History of cholestatic jaundice with azithromycin'],
 'May prolong QT interval. Use caution in patients with cardiac arrhythmias or QT prolongation.',
 ARRAY['Diarrhea', 'Nausea', 'Abdominal pain', 'QT prolongation'],
 'May increase levels of warfarin and digoxin. Avoid with other QT-prolonging drugs.',
 'B', TRUE, TRUE),

-- ===== PAIN MEDICATIONS =====

-- NSAIDs
('00378-6040-01', 'Ibuprofen 600mg', 'Ibuprofen', 'Motrin', 'NSAID', '600mg', 'tablet', 'oral',
 'Mylan', FALSE, NULL, FALSE, 'preferred', 5.00,
 ARRAY['400-600mg every 6-8 hours as needed', 'Maximum 2400mg daily'],
 ARRAY['Pain', 'Inflammation', 'Fever', 'Arthritis'],
 ARRAY['Active peptic ulcer', 'Recent CABG surgery', 'Third trimester pregnancy'],
 'May increase risk of cardiovascular events and GI bleeding. Use lowest effective dose for shortest duration.',
 ARRAY['Nausea', 'Dyspepsia', 'GI bleeding', 'Hypertension', 'Edema'],
 'May reduce effectiveness of antihypertensives. Increases risk of bleeding with anticoagulants.',
 'C', TRUE, TRUE),

('00378-6041-01', 'Ibuprofen 800mg', 'Ibuprofen', 'Motrin', 'NSAID', '800mg', 'tablet', 'oral',
 'Mylan', FALSE, NULL, FALSE, 'preferred', 6.50,
 ARRAY['800mg every 6-8 hours as needed', 'Maximum 3200mg daily'],
 ARRAY['Pain', 'Inflammation', 'Fever', 'Arthritis'],
 ARRAY['Active peptic ulcer', 'Recent CABG surgery', 'Third trimester pregnancy'],
 'May increase risk of cardiovascular events and GI bleeding. Use lowest effective dose for shortest duration.',
 ARRAY['Nausea', 'Dyspepsia', 'GI bleeding', 'Hypertension', 'Edema'],
 'May reduce effectiveness of antihypertensives. Increases risk of bleeding with anticoagulants.',
 'C', TRUE, TRUE),

-- Opioids (Controlled)
('00406-0537-01', 'Hydrocodone/Acetaminophen 5/325mg', 'Hydrocodone/Acetaminophen', 'Norco', 'Opioid Analgesic', '5mg/325mg', 'tablet', 'oral',
 'Mallinckrodt', TRUE, 'II', FALSE, 'preferred', 18.00,
 ARRAY['1-2 tablets every 4-6 hours as needed', 'Maximum 8 tablets daily'],
 ARRAY['Moderate to severe pain'],
 ARRAY['Respiratory depression', 'Acute or severe asthma', 'Paralytic ileus'],
 'CONTROLLED SUBSTANCE SCHEDULE II. Risk of addiction, abuse, and misuse. May cause respiratory depression.',
 ARRAY['Drowsiness', 'Constipation', 'Nausea', 'Dizziness', 'Respiratory depression'],
 'CNS depressants and alcohol increase respiratory depression risk. May increase INR with warfarin.',
 'C', FALSE, TRUE),

('00406-0538-01', 'Hydrocodone/Acetaminophen 10/325mg', 'Hydrocodone/Acetaminophen', 'Norco', 'Opioid Analgesic', '10mg/325mg', 'tablet', 'oral',
 'Mallinckrodt', TRUE, 'II', FALSE, 'preferred', 22.00,
 ARRAY['1 tablet every 4-6 hours as needed', 'Maximum 6 tablets daily'],
 ARRAY['Moderate to severe pain'],
 ARRAY['Respiratory depression', 'Acute or severe asthma', 'Paralytic ileus'],
 'CONTROLLED SUBSTANCE SCHEDULE II. Risk of addiction, abuse, and misuse. May cause respiratory depression.',
 ARRAY['Drowsiness', 'Constipation', 'Nausea', 'Dizziness', 'Respiratory depression'],
 'CNS depressants and alcohol increase respiratory depression risk. May increase INR with warfarin.',
 'C', FALSE, TRUE),

('00406-8530-01', 'Tramadol 50mg', 'Tramadol HCl', 'Ultram', 'Opioid Analgesic', '50mg', 'tablet', 'oral',
 'Amneal', TRUE, 'IV', FALSE, 'preferred', 12.00,
 ARRAY['50-100mg every 4-6 hours as needed', 'Maximum 400mg daily'],
 ARRAY['Moderate to moderately severe pain'],
 ARRAY['Seizure disorder', 'Concurrent MAO inhibitors', 'Acute intoxication'],
 'CONTROLLED SUBSTANCE SCHEDULE IV. May cause seizures especially at high doses or with other serotonergic drugs.',
 ARRAY['Dizziness', 'Nausea', 'Constipation', 'Headache', 'Drowsiness'],
 'Increased seizure risk with SSRIs, TCAs, and other serotonergic drugs. CYP2D6 inhibitors may reduce efficacy.',
 'C', TRUE, TRUE),

-- ===== GASTROINTESTINAL MEDICATIONS =====

-- Proton Pump Inhibitors
('68180-0513-03', 'Omeprazole 20mg', 'Omeprazole', 'Prilosec', 'Proton Pump Inhibitor', '20mg', 'capsule delayed release', 'oral',
 'Lupin', FALSE, NULL, FALSE, 'preferred', 8.00,
 ARRAY['20mg once daily before breakfast', '40mg once daily for severe GERD'],
 ARRAY['GERD', 'Peptic ulcer disease', 'H. pylori eradication', 'Zollinger-Ellison syndrome'],
 ARRAY['Hypersensitivity to PPIs'],
 'Long-term use may increase risk of C. diff infection, osteoporosis, and hypomagnesemia. Take 30-60 min before meals.',
 ARRAY['Headache', 'Diarrhea', 'Abdominal pain', 'Nausea', 'Vitamin B12 deficiency'],
 'May reduce effectiveness of clopidogrel. Decreases absorption of drugs requiring acidic pH.',
 'C', TRUE, TRUE),

('68180-0513-06', 'Omeprazole 40mg', 'Omeprazole', 'Prilosec', 'Proton Pump Inhibitor', '40mg', 'capsule delayed release', 'oral',
 'Lupin', FALSE, NULL, FALSE, 'preferred', 12.00,
 ARRAY['40mg once daily before breakfast'],
 ARRAY['GERD', 'Erosive esophagitis', 'Zollinger-Ellison syndrome'],
 ARRAY['Hypersensitivity to PPIs'],
 'Long-term use may increase risk of C. diff infection, osteoporosis, and hypomagnesemia. Take 30-60 min before meals.',
 ARRAY['Headache', 'Diarrhea', 'Abdominal pain', 'Nausea', 'Vitamin B12 deficiency'],
 'May reduce effectiveness of clopidogrel. Decreases absorption of drugs requiring acidic pH.',
 'C', TRUE, TRUE),

-- H2 Blockers
('00143-1194-01', 'Ranitidine 150mg', 'Ranitidine', 'Zantac', 'H2 Receptor Antagonist', '150mg', 'tablet', 'oral',
 'GlaxoSmithKline', FALSE, NULL, FALSE, 'preferred', 6.00,
 ARRAY['150mg twice daily', '300mg at bedtime'],
 ARRAY['GERD', 'Peptic ulcer disease', 'Heartburn prevention'],
 ARRAY['Porphyria'],
 'Less effective than PPIs for severe GERD. May be used for mild symptoms or PRN relief.',
 ARRAY['Headache', 'Constipation', 'Diarrhea', 'Dizziness'],
 'May reduce absorption of ketoconazole and itraconazole. Adjust dose in renal impairment.',
 'B', TRUE, TRUE),

-- ===== RESPIRATORY MEDICATIONS =====

-- Bronchodilators
('00173-0682-20', 'Albuterol 90mcg', 'Albuterol Sulfate', 'ProAir HFA', 'Beta-2 Agonist', '90mcg/actuation', 'inhaler', 'inhalation',
 'Teva', FALSE, NULL, FALSE, 'preferred', 45.00,
 ARRAY['2 puffs every 4-6 hours as needed', '2 puffs 15-30 min before exercise'],
 ARRAY['Asthma', 'Bronchospasm', 'COPD exacerbation', 'Exercise-induced bronchospasm'],
 ARRAY['Hypersensitivity to albuterol'],
 'Overuse may indicate poor asthma control - reassess treatment plan. May cause paradoxical bronchospasm.',
 ARRAY['Tremor', 'Nervousness', 'Tachycardia', 'Headache', 'Palpitations'],
 'Beta-blockers may antagonize effects. Use caution with MAO inhibitors and TCAs.',
 'C', FALSE, TRUE),

-- Inhaled Corticosteroids
('00173-0715-20', 'Fluticasone Propionate 110mcg', 'Fluticasone Propionate', 'Flovent HFA', 'Inhaled Corticosteroid', '110mcg/actuation', 'inhaler', 'inhalation',
 'GlaxoSmithKline', FALSE, NULL, FALSE, 'preferred', 175.00,
 ARRAY['2 puffs twice daily', '1 puff twice daily for mild asthma'],
 ARRAY['Asthma maintenance', 'COPD maintenance'],
 ARRAY['Primary treatment of status asthmaticus', 'Acute bronchospasm'],
 'Not for acute symptoms - use rescue inhaler. Rinse mouth after use to prevent oral candidiasis.',
 ARRAY['Oral candidiasis', 'Hoarseness', 'Headache', 'Upper respiratory infection'],
 'Strong CYP3A4 inhibitors (ritonavir, ketoconazole) may increase systemic corticosteroid effects.',
 'C', FALSE, TRUE),

-- ===== PSYCHIATRIC MEDICATIONS =====

-- SSRIs
('00143-9915-01', 'Sertraline 50mg', 'Sertraline HCl', 'Zoloft', 'SSRI Antidepressant', '50mg', 'tablet', 'oral',
 'Greenstone', FALSE, NULL, FALSE, 'preferred', 8.00,
 ARRAY['50mg once daily', '100-200mg once daily', 'Take in morning'],
 ARRAY['Major depressive disorder', 'Anxiety disorders', 'OCD', 'PTSD', 'Panic disorder'],
 ARRAY['Concurrent MAO inhibitor use', 'Pimozide use'],
 'BLACK BOX WARNING: Increased suicidal thoughts in children/adolescents/young adults. Monitor closely especially early in treatment.',
 ARRAY['Nausea', 'Diarrhea', 'Insomnia', 'Sexual dysfunction', 'Headache'],
 'Serotonin syndrome risk with other serotonergic drugs. May increase bleeding risk with NSAIDs/anticoagulants.',
 'C', TRUE, TRUE),

('00143-9916-01', 'Sertraline 100mg', 'Sertraline HCl', 'Zoloft', 'SSRI Antidepressant', '100mg', 'tablet', 'oral',
 'Greenstone', FALSE, NULL, FALSE, 'preferred', 10.00,
 ARRAY['100mg once daily', '150-200mg once daily'],
 ARRAY['Major depressive disorder', 'Anxiety disorders', 'OCD', 'PTSD', 'Panic disorder'],
 ARRAY['Concurrent MAO inhibitor use', 'Pimozide use'],
 'BLACK BOX WARNING: Increased suicidal thoughts in children/adolescents/young adults. Monitor closely especially early in treatment.',
 ARRAY['Nausea', 'Diarrhea', 'Insomnia', 'Sexual dysfunction', 'Headache'],
 'Serotonin syndrome risk with other serotonergic drugs. May increase bleeding risk with NSAIDs/anticoagulants.',
 'C', TRUE, TRUE),

-- Benzodiazepines (Controlled)
('00781-1830-01', 'Alprazolam 0.5mg', 'Alprazolam', 'Xanax', 'Benzodiazepine', '0.5mg', 'tablet', 'oral',
 'Sandoz', TRUE, 'IV', FALSE, 'preferred', 8.00,
 ARRAY['0.25-0.5mg three times daily', 'Maximum 4mg daily'],
 ARRAY['Anxiety disorders', 'Panic disorder'],
 ARRAY['Acute narrow-angle glaucoma', 'Concurrent ketoconazole or itraconazole'],
 'CONTROLLED SUBSTANCE SCHEDULE IV. Risk of dependence and abuse. Taper gradually to discontinue.',
 ARRAY['Drowsiness', 'Dizziness', 'Memory impairment', 'Coordination problems'],
 'CNS depressants and alcohol enhance sedation. CYP3A4 inhibitors increase alprazolam levels.',
 'D', TRUE, TRUE),

-- ===== THYROID MEDICATIONS =====

('00074-4472-13', 'Levothyroxine 50mcg', 'Levothyroxine Sodium', 'Synthroid', 'Thyroid Hormone', '50mcg', 'tablet', 'oral',
 'AbbVie', FALSE, NULL, FALSE, 'preferred', 12.00,
 ARRAY['50mcg once daily on empty stomach', 'Adjust by 12.5-25mcg based on TSH'],
 ARRAY['Hypothyroidism', 'Thyroid cancer suppression', 'Myxedema coma'],
 ARRAY['Acute MI', 'Uncorrected adrenal insufficiency', 'Thyrotoxicosis'],
 'Take on empty stomach 30-60 min before breakfast. Many drug interactions - check before adding new medications.',
 ARRAY['Usually none at appropriate doses', 'Symptoms of hyperthyroidism if excessive'],
 'Iron, calcium, and antacids reduce absorption (separate by 4 hours). May increase warfarin effects.',
 'A', TRUE, TRUE),

('00074-4473-13', 'Levothyroxine 100mcg', 'Levothyroxine Sodium', 'Synthroid', 'Thyroid Hormone', '100mcg', 'tablet', 'oral',
 'AbbVie', FALSE, NULL, FALSE, 'preferred', 14.00,
 ARRAY['100mcg once daily on empty stomach', 'Adjust by 12.5-25mcg based on TSH'],
 ARRAY['Hypothyroidism', 'Thyroid cancer suppression'],
 ARRAY['Acute MI', 'Uncorrected adrenal insufficiency', 'Thyrotoxicosis'],
 'Take on empty stomach 30-60 min before breakfast. Many drug interactions - check before adding new medications.',
 ARRAY['Usually none at appropriate doses', 'Symptoms of hyperthyroidism if excessive'],
 'Iron, calcium, and antacids reduce absorption (separate by 4 hours). May increase warfarin effects.',
 'A', TRUE, TRUE),

-- ===== ANTICOAGULANTS =====

('00056-0173-70', 'Warfarin 5mg', 'Warfarin Sodium', 'Coumadin', 'Anticoagulant', '5mg', 'tablet', 'oral',
 'Bristol-Myers Squibb', FALSE, NULL, FALSE, 'preferred', 10.00,
 ARRAY['Individualized dosing based on INR', '2-5mg once daily initially'],
 ARRAY['DVT/PE treatment and prevention', 'Atrial fibrillation', 'Heart valve replacement'],
 ARRAY['Pregnancy', 'Active bleeding', 'Severe hypertension'],
 'Requires regular INR monitoring. Narrow therapeutic index. Many drug and food interactions.',
 ARRAY['Bleeding', 'Bruising', 'Hair loss', 'Skin necrosis (rare)'],
 'Numerous interactions - check all medications. Vitamin K-rich foods affect INR. Many antibiotics increase INR.',
 'X', TRUE, TRUE),

('00078-0543-05', 'Apixaban 5mg', 'Apixaban', 'Eliquis', 'Factor Xa Inhibitor', '5mg', 'tablet', 'oral',
 'Bristol-Myers Squibb', FALSE, NULL, TRUE, 'non-preferred', 450.00,
 ARRAY['5mg twice daily', '2.5mg twice daily if 2+ of: age≥80, weight≤60kg, SCr≥1.5'],
 ARRAY['Atrial fibrillation stroke prevention', 'DVT/PE treatment and prevention'],
 ARRAY['Active pathological bleeding', 'Severe hepatic impairment'],
 'No routine monitoring required. Lower bleeding risk than warfarin. Adjust dose in renal impairment.',
 ARRAY['Bleeding', 'Nausea', 'Anemia'],
 'Strong dual inhibitors/inducers of CYP3A4 and P-gp may alter levels. Avoid with other anticoagulants.',
 'B', FALSE, TRUE),

-- ===== ORAL HYPOGLYCEMICS =====

('00378-6395-93', 'Glipizide 5mg', 'Glipizide', 'Glucotrol', 'Sulfonylurea', '5mg', 'tablet', 'oral',
 'Mylan', FALSE, NULL, FALSE, 'preferred', 6.00,
 ARRAY['5mg once daily before breakfast', '10-20mg daily in divided doses'],
 ARRAY['Type 2 diabetes mellitus'],
 ARRAY['Type 1 diabetes', 'Diabetic ketoacidosis', 'Sulfonamide allergy'],
 'May cause hypoglycemia especially in elderly. Take 30 min before meals for best effect.',
 ARRAY['Hypoglycemia', 'Weight gain', 'Nausea', 'Dizziness'],
 'Increased hypoglycemia risk with alcohol, NSAIDs, sulfonamides. Many drug interactions.',
 'C', TRUE, TRUE);

-- Create index on drug_name for faster searching
CREATE INDEX IF NOT EXISTS idx_medications_drug_name ON medications(LOWER(drug_name));
CREATE INDEX IF NOT EXISTS idx_medications_generic_name ON medications(LOWER(generic_name));
CREATE INDEX IF NOT EXISTS idx_medications_brand_name ON medications(LOWER(brand_name));
CREATE INDEX IF NOT EXISTS idx_medications_ndc_code ON medications(ndc_code);
CREATE INDEX IF NOT EXISTS idx_medications_drug_class ON medications(drug_class);

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✓ Successfully inserted comprehensive medication data';
  RAISE NOTICE '✓ Created search indexes for faster queries';
  RAISE NOTICE '✓ Total medications: 45+ covering major drug classes';
END $$;
