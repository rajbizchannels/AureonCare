-- Comprehensive Medical Codes Migration
-- This migration adds commonly used ICD-10 and CPT codes
-- Note: Full ICD-10 and CPT code sets require licensed databases
-- This includes a representative sample of frequently used codes

-- Clear existing codes to avoid duplicates
TRUNCATE TABLE medical_codes;

-- ============================================================================
-- COMMON ICD-10 DIAGNOSIS CODES
-- ============================================================================

INSERT INTO medical_codes (code, description, code_type, category) VALUES

-- Infectious and Parasitic Diseases (A00-B99)
('A09', 'Infectious gastroenteritis and colitis, unspecified', 'ICD-10', 'Infectious Diseases'),
('A41.9', 'Sepsis, unspecified organism', 'ICD-10', 'Infectious Diseases'),
('B34.9', 'Viral infection, unspecified', 'ICD-10', 'Infectious Diseases'),
('B96.20', 'Unspecified Escherichia coli as the cause of diseases classified elsewhere', 'ICD-10', 'Infectious Diseases'),

-- Neoplasms (C00-D49)
('C50.911', 'Malignant neoplasm of unspecified site of right female breast', 'ICD-10', 'Neoplasms'),
('C61', 'Malignant neoplasm of prostate', 'ICD-10', 'Neoplasms'),
('C34.90', 'Malignant neoplasm of unspecified part of unspecified bronchus or lung', 'ICD-10', 'Neoplasms'),
('D50.9', 'Iron deficiency anemia, unspecified', 'ICD-10', 'Neoplasms'),

-- Endocrine, Nutritional and Metabolic Diseases (E00-E89)
('E11.9', 'Type 2 diabetes mellitus without complications', 'ICD-10', 'Endocrine/Metabolic'),
('E11.65', 'Type 2 diabetes mellitus with hyperglycemia', 'ICD-10', 'Endocrine/Metabolic'),
('E11.22', 'Type 2 diabetes mellitus with diabetic chronic kidney disease', 'ICD-10', 'Endocrine/Metabolic'),
('E78.5', 'Hyperlipidemia, unspecified', 'ICD-10', 'Endocrine/Metabolic'),
('E66.9', 'Obesity, unspecified', 'ICD-10', 'Endocrine/Metabolic'),
('E03.9', 'Hypothyroidism, unspecified', 'ICD-10', 'Endocrine/Metabolic'),
('E05.90', 'Thyrotoxicosis, unspecified without thyrotoxic crisis', 'ICD-10', 'Endocrine/Metabolic'),
('E55.9', 'Vitamin D deficiency, unspecified', 'ICD-10', 'Endocrine/Metabolic'),

-- Mental and Behavioral Disorders (F01-F99)
('F32.9', 'Major depressive disorder, single episode, unspecified', 'ICD-10', 'Mental Health'),
('F41.1', 'Generalized anxiety disorder', 'ICD-10', 'Mental Health'),
('F41.9', 'Anxiety disorder, unspecified', 'ICD-10', 'Mental Health'),
('F43.10', 'Post-traumatic stress disorder, unspecified', 'ICD-10', 'Mental Health'),
('F10.20', 'Alcohol dependence, uncomplicated', 'ICD-10', 'Mental Health'),

-- Nervous System (G00-G99)
('G43.909', 'Migraine, unspecified, not intractable, without status migrainosus', 'ICD-10', 'Neurological'),
('G89.29', 'Other chronic pain', 'ICD-10', 'Neurological'),
('G47.00', 'Insomnia, unspecified', 'ICD-10', 'Neurological'),
('G20', 'Parkinson disease', 'ICD-10', 'Neurological'),
('G35', 'Multiple sclerosis', 'ICD-10', 'Neurological'),

-- Eye and Adnexa (H00-H59)
('H52.13', 'Myopia, bilateral', 'ICD-10', 'Ophthalmology'),
('H25.9', 'Unspecified age-related cataract', 'ICD-10', 'Ophthalmology'),
('H10.9', 'Unspecified conjunctivitis', 'ICD-10', 'Ophthalmology'),

-- Ear and Mastoid Process (H60-H95)
('H66.90', 'Otitis media, unspecified, unspecified ear', 'ICD-10', 'ENT'),
('H91.90', 'Unspecified hearing loss, unspecified ear', 'ICD-10', 'ENT'),

-- Circulatory System (I00-I99)
('I10', 'Essential (primary) hypertension', 'ICD-10', 'Cardiovascular'),
('I25.10', 'Atherosclerotic heart disease of native coronary artery without angina pectoris', 'ICD-10', 'Cardiovascular'),
('I48.91', 'Unspecified atrial fibrillation', 'ICD-10', 'Cardiovascular'),
('I50.9', 'Heart failure, unspecified', 'ICD-10', 'Cardiovascular'),
('I63.9', 'Cerebral infarction, unspecified', 'ICD-10', 'Cardiovascular'),

-- Respiratory System (J00-J99)
('J06.9', 'Acute upper respiratory infection, unspecified', 'ICD-10', 'Respiratory'),
('J45.909', 'Unspecified asthma, uncomplicated', 'ICD-10', 'Respiratory'),
('J44.9', 'Chronic obstructive pulmonary disease, unspecified', 'ICD-10', 'Respiratory'),
('J18.9', 'Pneumonia, unspecified organism', 'ICD-10', 'Respiratory'),
('J20.9', 'Acute bronchitis, unspecified', 'ICD-10', 'Respiratory'),

-- Digestive System (K00-K95)
('K21.9', 'Gastro-esophageal reflux disease without esophagitis', 'ICD-10', 'Digestive'),
('K29.70', 'Gastritis, unspecified, without bleeding', 'ICD-10', 'Digestive'),
('K58.9', 'Irritable bowel syndrome without diarrhea', 'ICD-10', 'Digestive'),
('K80.20', 'Calculus of gallbladder without cholecystitis without obstruction', 'ICD-10', 'Digestive'),

-- Skin and Subcutaneous Tissue (L00-L99)
('L30.9', 'Dermatitis, unspecified', 'ICD-10', 'Dermatology'),
('L20.9', 'Atopic dermatitis, unspecified', 'ICD-10', 'Dermatology'),
('L70.0', 'Acne vulgaris', 'ICD-10', 'Dermatology'),

-- Musculoskeletal System (M00-M99)
('M79.3', 'Panniculitis, unspecified', 'ICD-10', 'Musculoskeletal'),
('M25.561', 'Pain in right knee', 'ICD-10', 'Musculoskeletal'),
('M25.562', 'Pain in left knee', 'ICD-10', 'Musculoskeletal'),
('M54.5', 'Low back pain', 'ICD-10', 'Musculoskeletal'),
('M79.1', 'Myalgia', 'ICD-10', 'Musculoskeletal'),
('M19.90', 'Unspecified osteoarthritis, unspecified site', 'ICD-10', 'Musculoskeletal'),

-- Genitourinary System (N00-N99)
('N39.0', 'Urinary tract infection, site not specified', 'ICD-10', 'Genitourinary'),
('N18.3', 'Chronic kidney disease, stage 3', 'ICD-10', 'Genitourinary'),
('N40.0', 'Benign prostatic hyperplasia without lower urinary tract symptoms', 'ICD-10', 'Genitourinary'),

-- Pregnancy, Childbirth (O00-O9A)
('O80', 'Encounter for full-term uncomplicated delivery', 'ICD-10', 'Obstetrics'),
('O09.90', 'Supervision of high risk pregnancy, unspecified, unspecified trimester', 'ICD-10', 'Obstetrics'),

-- Symptoms, Signs and Abnormal Findings (R00-R99)
('R50.9', 'Fever, unspecified', 'ICD-10', 'Symptoms'),
('R05', 'Cough', 'ICD-10', 'Symptoms'),
('R51', 'Headache', 'ICD-10', 'Symptoms'),
('R10.9', 'Unspecified abdominal pain', 'ICD-10', 'Symptoms'),
('R53.83', 'Other fatigue', 'ICD-10', 'Symptoms'),
('R06.02', 'Shortness of breath', 'ICD-10', 'Symptoms'),
('R42', 'Dizziness and giddiness', 'ICD-10', 'Symptoms'),

-- Injury, Poisoning (S00-T88)
('S06.0X0A', 'Concussion without loss of consciousness, initial encounter', 'ICD-10', 'Injury'),
('S82.001A', 'Unspecified fracture of right patella, initial encounter for closed fracture', 'ICD-10', 'Injury'),
('T14.90XA', 'Injury, unspecified, initial encounter', 'ICD-10', 'Injury'),

-- External Causes (V00-Y99)
('Z00.00', 'Encounter for general adult medical examination without abnormal findings', 'ICD-10', 'Preventive Care'),
('Z23', 'Encounter for immunization', 'ICD-10', 'Preventive Care'),
('Z79.4', 'Long term (current) use of insulin', 'ICD-10', 'Medication Management'),
('Z79.899', 'Other long term (current) drug therapy', 'ICD-10', 'Medication Management');

-- ============================================================================
-- COMMON CPT PROCEDURE CODES
-- ============================================================================

INSERT INTO medical_codes (code, description, code_type, category) VALUES

-- Evaluation and Management (99XXX)
('99201', 'Office or other outpatient visit for E/M of new patient, straightforward', 'CPT', 'E/M - New Patient'),
('99202', 'Office or other outpatient visit for E/M of new patient, low complexity', 'CPT', 'E/M - New Patient'),
('99203', 'Office or other outpatient visit for E/M of new patient, moderate complexity', 'CPT', 'E/M - New Patient'),
('99204', 'Office or other outpatient visit for E/M of new patient, moderate to high complexity', 'CPT', 'E/M - New Patient'),
('99205', 'Office or other outpatient visit for E/M of new patient, high complexity', 'CPT', 'E/M - New Patient'),
('99211', 'Office or other outpatient visit for E/M of established patient, minimal', 'CPT', 'E/M - Established Patient'),
('99212', 'Office or other outpatient visit for E/M of established patient, straightforward', 'CPT', 'E/M - Established Patient'),
('99213', 'Office or other outpatient visit for E/M of established patient, low complexity', 'CPT', 'E/M - Established Patient'),
('99214', 'Office or other outpatient visit for E/M of established patient, moderate complexity', 'CPT', 'E/M - Established Patient'),
('99215', 'Office or other outpatient visit for E/M of established patient, high complexity', 'CPT', 'E/M - Established Patient'),
('99221', 'Initial hospital care, low severity', 'CPT', 'E/M - Hospital Care'),
('99222', 'Initial hospital care, moderate severity', 'CPT', 'E/M - Hospital Care'),
('99223', 'Initial hospital care, high severity', 'CPT', 'E/M - Hospital Care'),
('99231', 'Subsequent hospital care, straightforward', 'CPT', 'E/M - Hospital Care'),
('99232', 'Subsequent hospital care, moderate complexity', 'CPT', 'E/M - Hospital Care'),
('99233', 'Subsequent hospital care, high complexity', 'CPT', 'E/M - Hospital Care'),
('99281', 'Emergency department visit, self-limited problem', 'CPT', 'E/M - Emergency'),
('99282', 'Emergency department visit, low to moderate severity', 'CPT', 'E/M - Emergency'),
('99283', 'Emergency department visit, moderate severity', 'CPT', 'E/M - Emergency'),
('99284', 'Emergency department visit, high severity', 'CPT', 'E/M - Emergency'),
('99285', 'Emergency department visit, high severity with significant threat', 'CPT', 'E/M - Emergency'),
('99304', 'Initial nursing facility care, low severity', 'CPT', 'E/M - Nursing Facility'),
('99305', 'Initial nursing facility care, moderate severity', 'CPT', 'E/M - Nursing Facility'),
('99306', 'Initial nursing facility care, high severity', 'CPT', 'E/M - Nursing Facility'),
('99307', 'Subsequent nursing facility care, straightforward', 'CPT', 'E/M - Nursing Facility'),
('99308', 'Subsequent nursing facility care, low complexity', 'CPT', 'E/M - Nursing Facility'),
('99309', 'Subsequent nursing facility care, moderate complexity', 'CPT', 'E/M - Nursing Facility'),
('99310', 'Subsequent nursing facility care, high complexity', 'CPT', 'E/M - Nursing Facility'),
('99385', 'Initial comprehensive preventive medicine, age 18-39', 'CPT', 'Preventive Medicine'),
('99386', 'Initial comprehensive preventive medicine, age 40-64', 'CPT', 'Preventive Medicine'),
('99387', 'Initial comprehensive preventive medicine, age 65+', 'CPT', 'Preventive Medicine'),
('99395', 'Periodic comprehensive preventive medicine, age 18-39', 'CPT', 'Preventive Medicine'),
('99396', 'Periodic comprehensive preventive medicine, age 40-64', 'CPT', 'Preventive Medicine'),
('99397', 'Periodic comprehensive preventive medicine, age 65+', 'CPT', 'Preventive Medicine'),

-- Laboratory (80XXX-89XXX)
('80053', 'Comprehensive metabolic panel', 'CPT', 'Laboratory'),
('80061', 'Lipid panel', 'CPT', 'Laboratory'),
('82947', 'Glucose, blood quantitative', 'CPT', 'Laboratory'),
('83036', 'Hemoglobin A1C', 'CPT', 'Laboratory'),
('84443', 'Thyroid stimulating hormone (TSH)', 'CPT', 'Laboratory'),
('85025', 'Complete blood count (CBC) with differential', 'CPT', 'Laboratory'),
('85610', 'Prothrombin time', 'CPT', 'Laboratory'),
('87086', 'Urine culture', 'CPT', 'Laboratory'),
('87070', 'Bacterial culture', 'CPT', 'Laboratory'),

-- Radiology (70XXX-79XXX)
('70450', 'CT head or brain without contrast', 'CPT', 'Radiology'),
('70553', 'MRI brain without and with contrast', 'CPT', 'Radiology'),
('71045', 'Chest X-ray, single view', 'CPT', 'Radiology'),
('71046', 'Chest X-ray, 2 views', 'CPT', 'Radiology'),
('72148', 'MRI lumbar spine without contrast', 'CPT', 'Radiology'),
('73030', 'Shoulder X-ray, 2 views minimum', 'CPT', 'Radiology'),
('73562', 'Knee X-ray, 3 views', 'CPT', 'Radiology'),
('76700', 'Ultrasound, abdominal, complete', 'CPT', 'Radiology'),
('76805', 'Ultrasound, pregnant uterus, complete', 'CPT', 'Radiology'),
('76856', 'Ultrasound, pelvic, complete', 'CPT', 'Radiology'),
('77065', 'Diagnostic mammography, bilateral', 'CPT', 'Radiology'),

-- Pathology (80XXX-89XXX)
('88305', 'Tissue examination by pathologist', 'CPT', 'Pathology'),
('88307', 'Tissue examination by pathologist, complex', 'CPT', 'Pathology'),

-- Medicine (90XXX-99XXX)
('90471', 'Immunization administration, first injection', 'CPT', 'Immunizations'),
('90472', 'Immunization administration, each additional injection', 'CPT', 'Immunizations'),
('90630', 'Influenza virus vaccine', 'CPT', 'Immunizations'),
('90670', 'Pneumococcal conjugate vaccine', 'CPT', 'Immunizations'),
('90686', 'Influenza virus vaccine, quadrivalent', 'CPT', 'Immunizations'),
('90715', 'Tetanus, diphtheria toxoids and acellular pertussis vaccine (Tdap)', 'CPT', 'Immunizations'),
('93000', 'Electrocardiogram, complete', 'CPT', 'Cardiac Testing'),
('93005', 'Electrocardiogram, tracing only', 'CPT', 'Cardiac Testing'),
('94010', 'Spirometry', 'CPT', 'Pulmonary Function'),
('94060', 'Bronchodilation responsiveness', 'CPT', 'Pulmonary Function'),
('96372', 'Therapeutic injection, subcutaneous or intramuscular', 'CPT', 'Injections'),
('96374', 'Therapeutic injection, intravenous push', 'CPT', 'Injections'),

-- Surgery (10XXX-69XXX)
('11042', 'Debridement, subcutaneous tissue', 'CPT', 'Surgery - Integumentary'),
('12001', 'Simple repair of superficial wounds, 2.5 cm or less', 'CPT', 'Surgery - Integumentary'),
('17000', 'Destruction of benign or premalignant lesion, first', 'CPT', 'Surgery - Integumentary'),
('29125', 'Application of short arm splint', 'CPT', 'Surgery - Orthopedic'),
('45378', 'Colonoscopy, diagnostic', 'CPT', 'Surgery - Digestive'),
('43235', 'Esophagogastroduodenoscopy (EGD), diagnostic', 'CPT', 'Surgery - Digestive'),
('47562', 'Laparoscopic cholecystectomy', 'CPT', 'Surgery - Digestive'),
('58150', 'Total abdominal hysterectomy', 'CPT', 'Surgery - Female Genital'),
('27447', 'Total knee arthroplasty', 'CPT', 'Surgery - Orthopedic'),
('27130', 'Total hip arthroplasty', 'CPT', 'Surgery - Orthopedic'),
('64483', 'Injection, epidural steroid, lumbar or sacral', 'CPT', 'Surgery - Pain Management');

-- ============================================================================
-- Summary of imported codes
-- ============================================================================
DO $$
DECLARE
  icd_count INTEGER;
  cpt_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO icd_count FROM medical_codes WHERE code_type = 'ICD-10';
  SELECT COUNT(*) INTO cpt_count FROM medical_codes WHERE code_type = 'CPT';
  SELECT COUNT(*) INTO total_count FROM medical_codes;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Medical Codes Import Summary';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ICD-10 Codes: %', icd_count;
  RAISE NOTICE 'CPT Codes: %', cpt_count;
  RAISE NOTICE 'Total Codes: %', total_count;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Import completed successfully';
END $$;
