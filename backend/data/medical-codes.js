// Medical Codes Reference Data
// This file contains sample ICD-10 and CPT codes for diagnosis and procedure coding

const ICD10_CODES = [
  // Common Primary Care Diagnoses
  { code: 'Z00.00', description: 'Encounter for general adult medical examination without abnormal findings' },
  { code: 'Z00.01', description: 'Encounter for general adult medical examination with abnormal findings' },
  { code: 'I10', description: 'Essential (primary) hypertension' },
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications' },
  { code: 'E11.65', description: 'Type 2 diabetes mellitus with hyperglycemia' },
  { code: 'E78.5', description: 'Hyperlipidemia, unspecified' },
  { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified' },
  { code: 'J02.9', description: 'Acute pharyngitis, unspecified' },
  { code: 'J20.9', description: 'Acute bronchitis, unspecified' },
  { code: 'J45.909', description: 'Unspecified asthma, uncomplicated' },
  { code: 'M79.3', description: 'Panniculitis, unspecified' },
  { code: 'M25.561', description: 'Pain in right knee' },
  { code: 'M25.562', description: 'Pain in left knee' },
  { code: 'M54.5', description: 'Low back pain' },
  { code: 'R10.9', description: 'Unspecified abdominal pain' },
  { code: 'R51', description: 'Headache' },
  { code: 'R50.9', description: 'Fever, unspecified' },
  { code: 'R05', description: 'Cough' },
  { code: 'R06.02', description: 'Shortness of breath' },

  // Chronic Conditions
  { code: 'I25.10', description: 'Atherosclerotic heart disease of native coronary artery without angina pectoris' },
  { code: 'I50.9', description: 'Heart failure, unspecified' },
  { code: 'J44.9', description: 'Chronic obstructive pulmonary disease, unspecified' },
  { code: 'N18.3', description: 'Chronic kidney disease, stage 3 (moderate)' },
  { code: 'E66.9', description: 'Obesity, unspecified' },
  { code: 'F41.9', description: 'Anxiety disorder, unspecified' },
  { code: 'F32.9', description: 'Major depressive disorder, single episode, unspecified' },
  { code: 'F33.9', description: 'Major depressive disorder, recurrent, unspecified' },
  { code: 'G43.909', description: 'Migraine, unspecified, not intractable, without status migrainosus' },
  { code: 'K21.9', description: 'Gastro-esophageal reflux disease without esophagitis' },

  // Infections
  { code: 'B34.9', description: 'Viral infection, unspecified' },
  { code: 'A09', description: 'Infectious gastroenteritis and colitis, unspecified' },
  { code: 'N39.0', description: 'Urinary tract infection, site not specified' },
  { code: 'L03.90', description: 'Cellulitis, unspecified' },
  { code: 'J18.9', description: 'Pneumonia, unspecified organism' },
  { code: 'U07.1', description: 'COVID-19' },

  // Preventive Care
  { code: 'Z23', description: 'Encounter for immunization' },
  { code: 'Z12.11', description: 'Encounter for screening for malignant neoplasm of colon' },
  { code: 'Z13.89', description: 'Encounter for screening for other disorder' },
  { code: 'Z79.4', description: 'Long term (current) use of insulin' },
  { code: 'Z79.84', description: 'Long term (current) use of oral hypoglycemic drugs' },

  // Women\'s Health
  { code: 'Z01.419', description: 'Encounter for gynecological examination (general) (routine) without abnormal findings' },
  { code: 'N94.6', description: 'Dysmenorrhea, unspecified' },
  { code: 'Z30.09', description: 'Encounter for other general counseling and advice on contraception' },
  { code: 'Z34.90', description: 'Encounter for supervision of normal pregnancy, unspecified, unspecified trimester' },

  // Pediatrics
  { code: 'Z00.129', description: 'Encounter for routine child health examination without abnormal findings' },
  { code: 'Z00.121', description: 'Encounter for routine child health examination with abnormal findings' },
  { code: 'J03.90', description: 'Acute tonsillitis, unspecified' },
  { code: 'H66.90', description: 'Otitis media, unspecified, unspecified ear' },

  // Mental Health
  { code: 'F43.10', description: 'Post-traumatic stress disorder, unspecified' },
  { code: 'F90.9', description: 'Attention-deficit hyperactivity disorder, unspecified type' },
  { code: 'F10.20', description: 'Alcohol dependence, uncomplicated' },
  { code: 'F17.210', description: 'Nicotine dependence, cigarettes, uncomplicated' },

  // Injuries
  { code: 'S93.40XA', description: 'Sprain of unspecified ligament of ankle, initial encounter' },
  { code: 'S83.6XXA', description: 'Sprain of the superior tibiofibular joint and ligament, unspecified knee, initial encounter' },
  { code: 'T14.90XA', description: 'Injury, unspecified, initial encounter' },

  // Other Common
  { code: 'R73.09', description: 'Other abnormal glucose' },
  { code: 'E55.9', description: 'Vitamin D deficiency, unspecified' },
  { code: 'D64.9', description: 'Anemia, unspecified' },
  { code: 'E03.9', description: 'Hypothyroidism, unspecified' },
  { code: 'L70.0', description: 'Acne vulgaris' },
  { code: 'H52.13', description: 'Myopia, bilateral' },
  { code: 'Z71.3', description: 'Dietary counseling and surveillance' },
];

const CPT_CODES = [
  // Office Visits - New Patient
  { code: '99201', description: 'Office visit, new patient, problem-focused (Retired 2021)' },
  { code: '99202', description: 'Office visit, new patient, straightforward medical decision making, 15-29 min' },
  { code: '99203', description: 'Office visit, new patient, low level medical decision making, 30-44 min' },
  { code: '99204', description: 'Office visit, new patient, moderate level medical decision making, 45-59 min' },
  { code: '99205', description: 'Office visit, new patient, high level medical decision making, 60-74 min' },

  // Office Visits - Established Patient
  { code: '99211', description: 'Office visit, established patient, minimal presenting problem, nurse visit' },
  { code: '99212', description: 'Office visit, established patient, straightforward medical decision making, 10-19 min' },
  { code: '99213', description: 'Office visit, established patient, low level medical decision making, 20-29 min' },
  { code: '99214', description: 'Office visit, established patient, moderate level medical decision making, 30-39 min' },
  { code: '99215', description: 'Office visit, established patient, high level medical decision making, 40-54 min' },

  // Preventive Medicine - New Patient
  { code: '99381', description: 'Initial comprehensive preventive medicine evaluation, infant (younger than 1 year)' },
  { code: '99382', description: 'Initial comprehensive preventive medicine evaluation, age 1-4' },
  { code: '99383', description: 'Initial comprehensive preventive medicine evaluation, age 5-11' },
  { code: '99384', description: 'Initial comprehensive preventive medicine evaluation, age 12-17' },
  { code: '99385', description: 'Initial comprehensive preventive medicine evaluation, age 18-39' },
  { code: '99386', description: 'Initial comprehensive preventive medicine evaluation, age 40-64' },
  { code: '99387', description: 'Initial comprehensive preventive medicine evaluation, age 65 and older' },

  // Preventive Medicine - Established Patient
  { code: '99391', description: 'Periodic comprehensive preventive medicine reevaluation, infant (younger than 1 year)' },
  { code: '99392', description: 'Periodic comprehensive preventive medicine reevaluation, age 1-4' },
  { code: '99393', description: 'Periodic comprehensive preventive medicine reevaluation, age 5-11' },
  { code: '99394', description: 'Periodic comprehensive preventive medicine reevaluation, age 12-17' },
  { code: '99395', description: 'Periodic comprehensive preventive medicine reevaluation, age 18-39' },
  { code: '99396', description: 'Periodic comprehensive preventive medicine reevaluation, age 40-64' },
  { code: '99397', description: 'Periodic comprehensive preventive medicine reevaluation, age 65 and older' },

  // Consultations
  { code: '99241', description: 'Office consultation, problem focused' },
  { code: '99242', description: 'Office consultation, expanded problem focused' },
  { code: '99243', description: 'Office consultation, detailed' },
  { code: '99244', description: 'Office consultation, comprehensive, moderate complexity' },
  { code: '99245', description: 'Office consultation, comprehensive, high complexity' },

  // Hospital Visits
  { code: '99221', description: 'Initial hospital care, straightforward or low level medical decision making' },
  { code: '99222', description: 'Initial hospital care, moderate level medical decision making' },
  { code: '99223', description: 'Initial hospital care, high level medical decision making' },
  { code: '99231', description: 'Subsequent hospital care, straightforward or low level medical decision making' },
  { code: '99232', description: 'Subsequent hospital care, moderate level medical decision making' },
  { code: '99233', description: 'Subsequent hospital care, high level medical decision making' },

  // Emergency Department
  { code: '99281', description: 'Emergency department visit, straightforward medical decision making' },
  { code: '99282', description: 'Emergency department visit, low level medical decision making' },
  { code: '99283', description: 'Emergency department visit, moderate level medical decision making' },
  { code: '99284', description: 'Emergency department visit, high level medical decision making' },
  { code: '99285', description: 'Emergency department visit, highly complex medical decision making' },

  // Telehealth
  { code: '99441', description: 'Telephone evaluation and management service, 5-10 min' },
  { code: '99442', description: 'Telephone evaluation and management service, 11-20 min' },
  { code: '99443', description: 'Telephone evaluation and management service, 21-30 min' },

  // Vaccinations
  { code: '90460', description: 'Immunization administration, first component' },
  { code: '90461', description: 'Immunization administration, each additional component' },
  { code: '90471', description: 'Immunization administration, percutaneous, subcutaneous, or intramuscular, first injection' },
  { code: '90472', description: 'Immunization administration, each additional injection' },
  { code: '90686', description: 'Influenza virus vaccine, quadrivalent, split virus' },
  { code: '90688', description: 'Influenza virus vaccine, quadrivalent, recombinant' },
  { code: '90670', description: 'Pneumococcal conjugate vaccine, 13 valent' },
  { code: '90732', description: 'Pneumococcal polysaccharide vaccine, 23-valent' },
  { code: '91300', description: 'COVID-19 vaccine, mRNA-based' },
  { code: '0001A', description: 'COVID-19 vaccine administration, first dose' },
  { code: '0002A', description: 'COVID-19 vaccine administration, second dose' },
  { code: '90707', description: 'Measles, mumps and rubella virus vaccine (MMR)' },
  { code: '90714', description: 'Tetanus and diphtheria toxoids (Td)' },
  { code: '90715', description: 'Tetanus, diphtheria toxoids and acellular pertussis vaccine (Tdap)' },

  // Laboratory
  { code: '80053', description: 'Comprehensive metabolic panel' },
  { code: '80061', description: 'Lipid panel' },
  { code: '83036', description: 'Hemoglobin A1C' },
  { code: '85025', description: 'Complete blood count (CBC) with automated differential' },
  { code: '84443', description: 'Thyroid stimulating hormone (TSH)' },
  { code: '82947', description: 'Glucose, quantitative' },
  { code: '81001', description: 'Urinalysis, automated' },
  { code: '87880', description: 'Strep test, rapid' },
  { code: '87426', description: 'Influenza virus antigen detection, rapid' },
  { code: '87635', description: 'SARS-CoV-2 (COVID-19) amplified probe technique' },

  // Radiology
  { code: '71045', description: 'Chest X-ray, single view' },
  { code: '71046', description: 'Chest X-ray, 2 views' },
  { code: '73560', description: 'Knee X-ray, 1 or 2 views' },
  { code: '73562', description: 'Knee X-ray, 3 views' },
  { code: '72040', description: 'Cervical spine X-ray, 2 or 3 views' },
  { code: '72100', description: 'Lumbar spine X-ray, 2 or 3 views' },

  // Procedures
  { code: '12001', description: 'Simple repair of superficial wounds, 2.5 cm or less' },
  { code: '11055', description: 'Paring or cutting of benign hyperkeratotic lesion, single lesion' },
  { code: '11056', description: 'Paring or cutting, 2 to 4 lesions' },
  { code: '11200', description: 'Removal of skin tags, up to and including 15 lesions' },
  { code: '17000', description: 'Destruction of premalignant lesions, first lesion' },
  { code: '17110', description: 'Destruction of benign lesions other than skin tags or cutaneous vascular lesions, up to 14 lesions' },
  { code: '29125', description: 'Application of short arm splint (forearm to hand)' },
  { code: '29505', description: 'Application of long leg splint (thigh to ankle)' },
  { code: '69210', description: 'Removal of impacted earwax, unilateral' },

  // EKG
  { code: '93000', description: 'Electrocardiogram, complete' },
  { code: '93005', description: 'Electrocardiogram, tracing only' },

  // Spirometry
  { code: '94010', description: 'Spirometry, complete' },
  { code: '94060', description: 'Bronchodilation responsiveness, spirometry' },

  // Counseling
  { code: '99406', description: 'Smoking and tobacco use cessation counseling, 3-10 min' },
  { code: '99407', description: 'Smoking and tobacco use cessation counseling, greater than 10 min' },
  { code: '97802', description: 'Medical nutrition therapy, initial assessment, 15 min' },
  { code: '97803', description: 'Medical nutrition therapy, re-assessment, 15 min' },

  // Mental Health
  { code: '90791', description: 'Psychiatric diagnostic evaluation' },
  { code: '90792', description: 'Psychiatric diagnostic evaluation with medical services' },
  { code: '90832', description: 'Psychotherapy, 30 min' },
  { code: '90834', description: 'Psychotherapy, 45 min' },
  { code: '90837', description: 'Psychotherapy, 60 min' },
];

// Helper function to search codes
function searchCodes(query, type = 'all') {
  const searchTerm = query.toLowerCase().trim();

  if (!searchTerm) return [];

  let results = [];

  if (type === 'all' || type === 'icd') {
    const icdResults = ICD10_CODES.filter(item =>
      item.code.toLowerCase().includes(searchTerm) ||
      item.description.toLowerCase().includes(searchTerm)
    ).map(item => ({ ...item, type: 'ICD-10' }));
    results = [...results, ...icdResults];
  }

  if (type === 'all' || type === 'cpt') {
    const cptResults = CPT_CODES.filter(item =>
      item.code.toLowerCase().includes(searchTerm) ||
      item.description.toLowerCase().includes(searchTerm)
    ).map(item => ({ ...item, type: 'CPT' }));
    results = [...results, ...cptResults];
  }

  // Limit results to 50 for performance
  return results.slice(0, 50);
}

module.exports = {
  ICD10_CODES,
  CPT_CODES,
  searchCodes
};
