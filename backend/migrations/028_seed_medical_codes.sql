-- Migration 028: Seed medical_codes table with ICD-10 and CPT codes
-- This migration populates the medical codes table with initial reference data

-- ICD-10 Codes - Common Primary Care Diagnoses
INSERT INTO medical_codes (code, description, code_type, category) VALUES
('Z00.00', 'Encounter for general adult medical examination without abnormal findings', 'ICD-10', 'Primary Care'),
('Z00.01', 'Encounter for general adult medical examination with abnormal findings', 'ICD-10', 'Primary Care'),
('I10', 'Essential (primary) hypertension', 'ICD-10', 'Primary Care'),
('E11.9', 'Type 2 diabetes mellitus without complications', 'ICD-10', 'Primary Care'),
('E11.65', 'Type 2 diabetes mellitus with hyperglycemia', 'ICD-10', 'Primary Care'),
('E78.5', 'Hyperlipidemia, unspecified', 'ICD-10', 'Primary Care'),
('J06.9', 'Acute upper respiratory infection, unspecified', 'ICD-10', 'Primary Care'),
('J02.9', 'Acute pharyngitis, unspecified', 'ICD-10', 'Primary Care'),
('J20.9', 'Acute bronchitis, unspecified', 'ICD-10', 'Primary Care'),
('J45.909', 'Unspecified asthma, uncomplicated', 'ICD-10', 'Primary Care'),
('M79.3', 'Panniculitis, unspecified', 'ICD-10', 'Primary Care'),
('M25.561', 'Pain in right knee', 'ICD-10', 'Primary Care'),
('M25.562', 'Pain in left knee', 'ICD-10', 'Primary Care'),
('M54.5', 'Low back pain', 'ICD-10', 'Primary Care'),
('R10.9', 'Unspecified abdominal pain', 'ICD-10', 'Primary Care'),
('R51', 'Headache', 'ICD-10', 'Primary Care'),
('R50.9', 'Fever, unspecified', 'ICD-10', 'Primary Care'),
('R05', 'Cough', 'ICD-10', 'Primary Care'),
('R06.02', 'Shortness of breath', 'ICD-10', 'Primary Care')
ON CONFLICT (code) DO NOTHING;

-- ICD-10 Codes - Chronic Conditions
INSERT INTO medical_codes (code, description, code_type, category) VALUES
('I25.10', 'Atherosclerotic heart disease of native coronary artery without angina pectoris', 'ICD-10', 'Chronic Conditions'),
('I50.9', 'Heart failure, unspecified', 'ICD-10', 'Chronic Conditions'),
('J44.9', 'Chronic obstructive pulmonary disease, unspecified', 'ICD-10', 'Chronic Conditions'),
('N18.3', 'Chronic kidney disease, stage 3 (moderate)', 'ICD-10', 'Chronic Conditions'),
('E66.9', 'Obesity, unspecified', 'ICD-10', 'Chronic Conditions'),
('F41.9', 'Anxiety disorder, unspecified', 'ICD-10', 'Chronic Conditions'),
('F32.9', 'Major depressive disorder, single episode, unspecified', 'ICD-10', 'Chronic Conditions'),
('F33.9', 'Major depressive disorder, recurrent, unspecified', 'ICD-10', 'Chronic Conditions'),
('G43.909', 'Migraine, unspecified, not intractable, without status migrainosus', 'ICD-10', 'Chronic Conditions'),
('K21.9', 'Gastro-esophageal reflux disease without esophagitis', 'ICD-10', 'Chronic Conditions')
ON CONFLICT (code) DO NOTHING;

-- ICD-10 Codes - Infections
INSERT INTO medical_codes (code, description, code_type, category) VALUES
('B34.9', 'Viral infection, unspecified', 'ICD-10', 'Infections'),
('A09', 'Infectious gastroenteritis and colitis, unspecified', 'ICD-10', 'Infections'),
('N39.0', 'Urinary tract infection, site not specified', 'ICD-10', 'Infections'),
('L03.90', 'Cellulitis, unspecified', 'ICD-10', 'Infections'),
('J18.9', 'Pneumonia, unspecified organism', 'ICD-10', 'Infections'),
('U07.1', 'COVID-19', 'ICD-10', 'Infections')
ON CONFLICT (code) DO NOTHING;

-- ICD-10 Codes - Preventive Care
INSERT INTO medical_codes (code, description, code_type, category) VALUES
('Z23', 'Encounter for immunization', 'ICD-10', 'Preventive Care'),
('Z12.11', 'Encounter for screening for malignant neoplasm of colon', 'ICD-10', 'Preventive Care'),
('Z13.89', 'Encounter for screening for other disorder', 'ICD-10', 'Preventive Care'),
('Z79.4', 'Long term (current) use of insulin', 'ICD-10', 'Preventive Care'),
('Z79.84', 'Long term (current) use of oral hypoglycemic drugs', 'ICD-10', 'Preventive Care')
ON CONFLICT (code) DO NOTHING;

-- ICD-10 Codes - Women's Health
INSERT INTO medical_codes (code, description, code_type, category) VALUES
('Z01.419', 'Encounter for gynecological examination (general) (routine) without abnormal findings', 'ICD-10', 'Women''s Health'),
('N94.6', 'Dysmenorrhea, unspecified', 'ICD-10', 'Women''s Health'),
('Z30.09', 'Encounter for other general counseling and advice on contraception', 'ICD-10', 'Women''s Health'),
('Z34.90', 'Encounter for supervision of normal pregnancy, unspecified, unspecified trimester', 'ICD-10', 'Women''s Health')
ON CONFLICT (code) DO NOTHING;

-- ICD-10 Codes - Pediatrics
INSERT INTO medical_codes (code, description, code_type, category) VALUES
('Z00.129', 'Encounter for routine child health examination without abnormal findings', 'ICD-10', 'Pediatrics'),
('Z00.121', 'Encounter for routine child health examination with abnormal findings', 'ICD-10', 'Pediatrics'),
('J03.90', 'Acute tonsillitis, unspecified', 'ICD-10', 'Pediatrics'),
('H66.90', 'Otitis media, unspecified, unspecified ear', 'ICD-10', 'Pediatrics')
ON CONFLICT (code) DO NOTHING;

-- ICD-10 Codes - Mental Health
INSERT INTO medical_codes (code, description, code_type, category) VALUES
('F43.10', 'Post-traumatic stress disorder, unspecified', 'ICD-10', 'Mental Health'),
('F90.9', 'Attention-deficit hyperactivity disorder, unspecified type', 'ICD-10', 'Mental Health'),
('F10.20', 'Alcohol dependence, uncomplicated', 'ICD-10', 'Mental Health'),
('F17.210', 'Nicotine dependence, cigarettes, uncomplicated', 'ICD-10', 'Mental Health')
ON CONFLICT (code) DO NOTHING;

-- ICD-10 Codes - Injuries
INSERT INTO medical_codes (code, description, code_type, category) VALUES
('S93.40XA', 'Sprain of unspecified ligament of ankle, initial encounter', 'ICD-10', 'Injuries'),
('S83.6XXA', 'Sprain of the superior tibiofibular joint and ligament, unspecified knee, initial encounter', 'ICD-10', 'Injuries'),
('T14.90XA', 'Injury, unspecified, initial encounter', 'ICD-10', 'Injuries')
ON CONFLICT (code) DO NOTHING;

-- ICD-10 Codes - Other Common
INSERT INTO medical_codes (code, description, code_type, category) VALUES
('R73.09', 'Other abnormal glucose', 'ICD-10', 'Other Common'),
('E55.9', 'Vitamin D deficiency, unspecified', 'ICD-10', 'Other Common'),
('D64.9', 'Anemia, unspecified', 'ICD-10', 'Other Common'),
('E03.9', 'Hypothyroidism, unspecified', 'ICD-10', 'Other Common'),
('L70.0', 'Acne vulgaris', 'ICD-10', 'Other Common'),
('H52.13', 'Myopia, bilateral', 'ICD-10', 'Other Common'),
('Z71.3', 'Dietary counseling and surveillance', 'ICD-10', 'Other Common')
ON CONFLICT (code) DO NOTHING;

-- CPT Codes - Office Visits New Patient
INSERT INTO medical_codes (code, description, code_type, category) VALUES
('99201', 'Office visit, new patient, problem-focused (Retired 2021)', 'CPT', 'Office Visits'),
('99202', 'Office visit, new patient, straightforward medical decision making, 15-29 min', 'CPT', 'Office Visits'),
('99203', 'Office visit, new patient, low level medical decision making, 30-44 min', 'CPT', 'Office Visits'),
('99204', 'Office visit, new patient, moderate level medical decision making, 45-59 min', 'CPT', 'Office Visits'),
('99205', 'Office visit, new patient, high level medical decision making, 60-74 min', 'CPT', 'Office Visits')
ON CONFLICT (code) DO NOTHING;

-- CPT Codes - Office Visits Established Patient
INSERT INTO medical_codes (code, description, code_type, category) VALUES
('99211', 'Office visit, established patient, minimal presenting problem, nurse visit', 'CPT', 'Office Visits'),
('99212', 'Office visit, established patient, straightforward medical decision making, 10-19 min', 'CPT', 'Office Visits'),
('99213', 'Office visit, established patient, low level medical decision making, 20-29 min', 'CPT', 'Office Visits'),
('99214', 'Office visit, established patient, moderate level medical decision making, 30-39 min', 'CPT', 'Office Visits'),
('99215', 'Office visit, established patient, high level medical decision making, 40-54 min', 'CPT', 'Office Visits')
ON CONFLICT (code) DO NOTHING;

-- CPT Codes - Preventive Medicine New Patient
INSERT INTO medical_codes (code, description, code_type, category) VALUES
('99381', 'Initial comprehensive preventive medicine evaluation, infant (younger than 1 year)', 'CPT', 'Preventive Medicine'),
('99382', 'Initial comprehensive preventive medicine evaluation, age 1-4', 'CPT', 'Preventive Medicine'),
('99383', 'Initial comprehensive preventive medicine evaluation, age 5-11', 'CPT', 'Preventive Medicine'),
('99384', 'Initial comprehensive preventive medicine evaluation, age 12-17', 'CPT', 'Preventive Medicine'),
('99385', 'Initial comprehensive preventive medicine evaluation, age 18-39', 'CPT', 'Preventive Medicine'),
('99386', 'Initial comprehensive preventive medicine evaluation, age 40-64', 'CPT', 'Preventive Medicine'),
('99387', 'Initial comprehensive preventive medicine evaluation, age 65 and older', 'CPT', 'Preventive Medicine')
ON CONFLICT (code) DO NOTHING;

-- CPT Codes - Preventive Medicine Established Patient
INSERT INTO medical_codes (code, description, code_type, category) VALUES
('99391', 'Periodic comprehensive preventive medicine reevaluation, infant (younger than 1 year)', 'CPT', 'Preventive Medicine'),
('99392', 'Periodic comprehensive preventive medicine reevaluation, age 1-4', 'CPT', 'Preventive Medicine'),
('99393', 'Periodic comprehensive preventive medicine reevaluation, age 5-11', 'CPT', 'Preventive Medicine'),
('99394', 'Periodic comprehensive preventive medicine reevaluation, age 12-17', 'CPT', 'Preventive Medicine'),
('99395', 'Periodic comprehensive preventive medicine reevaluation, age 18-39', 'CPT', 'Preventive Medicine'),
('99396', 'Periodic comprehensive preventive medicine reevaluation, age 40-64', 'CPT', 'Preventive Medicine'),
('99397', 'Periodic comprehensive preventive medicine reevaluation, age 65 and older', 'CPT', 'Preventive Medicine')
ON CONFLICT (code) DO NOTHING;

-- CPT Codes - Consultations
INSERT INTO medical_codes (code, description, code_type, category) VALUES
('99241', 'Office consultation, problem focused', 'CPT', 'Consultations'),
('99242', 'Office consultation, expanded problem focused', 'CPT', 'Consultations'),
('99243', 'Office consultation, detailed', 'CPT', 'Consultations'),
('99244', 'Office consultation, comprehensive, moderate complexity', 'CPT', 'Consultations'),
('99245', 'Office consultation, comprehensive, high complexity', 'CPT', 'Consultations')
ON CONFLICT (code) DO NOTHING;

-- CPT Codes - Hospital Visits
INSERT INTO medical_codes (code, description, code_type, category) VALUES
('99221', 'Initial hospital care, straightforward or low level medical decision making', 'CPT', 'Hospital Visits'),
('99222', 'Initial hospital care, moderate level medical decision making', 'CPT', 'Hospital Visits'),
('99223', 'Initial hospital care, high level medical decision making', 'CPT', 'Hospital Visits'),
('99231', 'Subsequent hospital care, straightforward or low level medical decision making', 'CPT', 'Hospital Visits'),
('99232', 'Subsequent hospital care, moderate level medical decision making', 'CPT', 'Hospital Visits'),
('99233', 'Subsequent hospital care, high level medical decision making', 'CPT', 'Hospital Visits')
ON CONFLICT (code) DO NOTHING;

-- CPT Codes - Emergency Department
INSERT INTO medical_codes (code, description, code_type, category) VALUES
('99281', 'Emergency department visit, straightforward medical decision making', 'CPT', 'Emergency Department'),
('99282', 'Emergency department visit, low level medical decision making', 'CPT', 'Emergency Department'),
('99283', 'Emergency department visit, moderate level medical decision making', 'CPT', 'Emergency Department'),
('99284', 'Emergency department visit, high level medical decision making', 'CPT', 'Emergency Department'),
('99285', 'Emergency department visit, highly complex medical decision making', 'CPT', 'Emergency Department')
ON CONFLICT (code) DO NOTHING;

-- CPT Codes - Telehealth
INSERT INTO medical_codes (code, description, code_type, category) VALUES
('99441', 'Telephone evaluation and management service, 5-10 min', 'CPT', 'Telehealth'),
('99442', 'Telephone evaluation and management service, 11-20 min', 'CPT', 'Telehealth'),
('99443', 'Telephone evaluation and management service, 21-30 min', 'CPT', 'Telehealth')
ON CONFLICT (code) DO NOTHING;

-- CPT Codes - Vaccinations
INSERT INTO medical_codes (code, description, code_type, category) VALUES
('90460', 'Immunization administration, first component', 'CPT', 'Vaccinations'),
('90461', 'Immunization administration, each additional component', 'CPT', 'Vaccinations'),
('90471', 'Immunization administration, percutaneous, subcutaneous, or intramuscular, first injection', 'CPT', 'Vaccinations'),
('90472', 'Immunization administration, each additional injection', 'CPT', 'Vaccinations'),
('90686', 'Influenza virus vaccine, quadrivalent, split virus', 'CPT', 'Vaccinations'),
('90688', 'Influenza virus vaccine, quadrivalent, recombinant', 'CPT', 'Vaccinations'),
('90670', 'Pneumococcal conjugate vaccine, 13 valent', 'CPT', 'Vaccinations'),
('90732', 'Pneumococcal polysaccharide vaccine, 23-valent', 'CPT', 'Vaccinations'),
('91300', 'COVID-19 vaccine, mRNA-based', 'CPT', 'Vaccinations'),
('0001A', 'COVID-19 vaccine administration, first dose', 'CPT', 'Vaccinations'),
('0002A', 'COVID-19 vaccine administration, second dose', 'CPT', 'Vaccinations'),
('90707', 'Measles, mumps and rubella virus vaccine (MMR)', 'CPT', 'Vaccinations'),
('90714', 'Tetanus and diphtheria toxoids (Td)', 'CPT', 'Vaccinations'),
('90715', 'Tetanus, diphtheria toxoids and acellular pertussis vaccine (Tdap)', 'CPT', 'Vaccinations')
ON CONFLICT (code) DO NOTHING;

-- CPT Codes - Laboratory
INSERT INTO medical_codes (code, description, code_type, category) VALUES
('80053', 'Comprehensive metabolic panel', 'CPT', 'Laboratory'),
('80061', 'Lipid panel', 'CPT', 'Laboratory'),
('83036', 'Hemoglobin A1C', 'CPT', 'Laboratory'),
('85025', 'Complete blood count (CBC) with automated differential', 'CPT', 'Laboratory'),
('84443', 'Thyroid stimulating hormone (TSH)', 'CPT', 'Laboratory'),
('82947', 'Glucose, quantitative', 'CPT', 'Laboratory'),
('81001', 'Urinalysis, automated', 'CPT', 'Laboratory'),
('87880', 'Strep test, rapid', 'CPT', 'Laboratory'),
('87426', 'Influenza virus antigen detection, rapid', 'CPT', 'Laboratory'),
('87635', 'SARS-CoV-2 (COVID-19) amplified probe technique', 'CPT', 'Laboratory')
ON CONFLICT (code) DO NOTHING;

-- CPT Codes - Radiology
INSERT INTO medical_codes (code, description, code_type, category) VALUES
('71045', 'Chest X-ray, single view', 'CPT', 'Radiology'),
('71046', 'Chest X-ray, 2 views', 'CPT', 'Radiology'),
('73560', 'Knee X-ray, 1 or 2 views', 'CPT', 'Radiology'),
('73562', 'Knee X-ray, 3 views', 'CPT', 'Radiology'),
('72040', 'Cervical spine X-ray, 2 or 3 views', 'CPT', 'Radiology'),
('72100', 'Lumbar spine X-ray, 2 or 3 views', 'CPT', 'Radiology')
ON CONFLICT (code) DO NOTHING;

-- CPT Codes - Procedures
INSERT INTO medical_codes (code, description, code_type, category) VALUES
('12001', 'Simple repair of superficial wounds, 2.5 cm or less', 'CPT', 'Procedures'),
('11055', 'Paring or cutting of benign hyperkeratotic lesion, single lesion', 'CPT', 'Procedures'),
('11056', 'Paring or cutting, 2 to 4 lesions', 'CPT', 'Procedures'),
('11200', 'Removal of skin tags, up to and including 15 lesions', 'CPT', 'Procedures'),
('17000', 'Destruction of premalignant lesions, first lesion', 'CPT', 'Procedures'),
('17110', 'Destruction of benign lesions other than skin tags or cutaneous vascular lesions, up to 14 lesions', 'CPT', 'Procedures'),
('29125', 'Application of short arm splint (forearm to hand)', 'CPT', 'Procedures'),
('29505', 'Application of long leg splint (thigh to ankle)', 'CPT', 'Procedures'),
('69210', 'Removal of impacted earwax, unilateral', 'CPT', 'Procedures')
ON CONFLICT (code) DO NOTHING;

-- CPT Codes - EKG
INSERT INTO medical_codes (code, description, code_type, category) VALUES
('93000', 'Electrocardiogram, complete', 'CPT', 'EKG'),
('93005', 'Electrocardiogram, tracing only', 'CPT', 'EKG')
ON CONFLICT (code) DO NOTHING;

-- CPT Codes - Spirometry
INSERT INTO medical_codes (code, description, code_type, category) VALUES
('94010', 'Spirometry, complete', 'CPT', 'Spirometry'),
('94060', 'Bronchodilation responsiveness, spirometry', 'CPT', 'Spirometry')
ON CONFLICT (code) DO NOTHING;

-- CPT Codes - Counseling
INSERT INTO medical_codes (code, description, code_type, category) VALUES
('99406', 'Smoking and tobacco use cessation counseling, 3-10 min', 'CPT', 'Counseling'),
('99407', 'Smoking and tobacco use cessation counseling, greater than 10 min', 'CPT', 'Counseling'),
('97802', 'Medical nutrition therapy, initial assessment, 15 min', 'CPT', 'Counseling'),
('97803', 'Medical nutrition therapy, re-assessment, 15 min', 'CPT', 'Counseling')
ON CONFLICT (code) DO NOTHING;

-- CPT Codes - Mental Health
INSERT INTO medical_codes (code, description, code_type, category) VALUES
('90791', 'Psychiatric diagnostic evaluation', 'CPT', 'Mental Health'),
('90792', 'Psychiatric diagnostic evaluation with medical services', 'CPT', 'Mental Health'),
('90832', 'Psychotherapy, 30 min', 'CPT', 'Mental Health'),
('90834', 'Psychotherapy, 45 min', 'CPT', 'Mental Health'),
('90837', 'Psychotherapy, 60 min', 'CPT', 'Mental Health')
ON CONFLICT (code) DO NOTHING;
