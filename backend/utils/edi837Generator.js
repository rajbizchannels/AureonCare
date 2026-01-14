/**
 * EDI 837 (Health Care Claim) Generator
 * Generates X12 837P (Professional) files for claim submission
 */

/**
 * Generate EDI 837 file content from claim data
 * @param {Object} claimData - Claim data with patient, provider, and service information
 * @param {Object} submitterInfo - Information about the submitting entity
 * @returns {string} EDI 837 file content
 */
function generate837File(claimData, submitterInfo) {
  const segments = [];
  const segmentTerminator = '~';
  const elementSeparator = '*';
  const subelementSeparator = ':';

  // Generate control numbers
  const interchangeControlNumber = generateControlNumber(9);
  const groupControlNumber = generateControlNumber(9);
  const transactionSetControlNumber = generateControlNumber(4);
  const claimControlNumber = claimData.claim_number || generateControlNumber(10);

  // Get current date/time
  const now = new Date();
  const currentDate = formatDate(now, 'YYMMDD');
  const currentTime = formatTime(now);
  const currentDateLong = formatDate(now, 'CCYYMMDD');

  // ISA - Interchange Control Header
  segments.push([
    'ISA',
    '00', // Authorization Information Qualifier
    '          ', // Authorization Information (10 spaces)
    '00', // Security Information Qualifier
    '          ', // Security Information (10 spaces)
    'ZZ', // Interchange ID Qualifier (Submitter)
    padRight(submitterInfo.submitterId || 'AUREONCARE', 15),
    'ZZ', // Interchange ID Qualifier (Receiver)
    padRight(submitterInfo.receiverId || 'CLEARHOUSE', 15),
    currentDate, // Interchange Date
    currentTime, // Interchange Time
    'U', // Standards Identifier
    '00401', // Interchange Version ID
    interchangeControlNumber, // Interchange Control Number
    '0', // Acknowledgment Requested
    submitterInfo.testIndicator || 'P', // Test Indicator (P=Production, T=Test)
    subelementSeparator // Subelement Separator
  ].join(elementSeparator));

  // GS - Functional Group Header
  segments.push([
    'GS',
    'HC', // Functional Identifier Code (HC = Health Care Claim)
    submitterInfo.submitterId || 'AUREONCARE', // Application Sender Code
    submitterInfo.receiverId || 'CLEARHOUSE', // Application Receiver Code
    currentDateLong, // Date
    currentTime.substring(0, 4), // Time (HHMM)
    groupControlNumber, // Group Control Number
    'X', // Responsible Agency Code
    '005010X222A1' // Version/Release/Industry Identifier Code (837P 5010)
  ].join(elementSeparator));

  // ST - Transaction Set Header
  segments.push([
    'ST',
    '837', // Transaction Set Identifier Code
    transactionSetControlNumber, // Transaction Set Control Number
    '005010X222A1' // Implementation Convention Reference
  ].join(elementSeparator));

  // BHT - Beginning of Hierarchical Transaction
  segments.push([
    'BHT',
    '0019', // Hierarchical Structure Code (0019 = Information Source, Subscriber, Dependent)
    '00', // Transaction Set Purpose Code (00 = Original)
    claimControlNumber, // Reference Identification
    currentDateLong, // Date
    currentTime, // Time
    'CH' // Transaction Type Code (CH = Chargeable)
  ].join(elementSeparator));

  let hierarchicalIdCounter = 1;

  // 1000A - Submitter Name
  const submitterHL = hierarchicalIdCounter++;
  segments.push(`NM1*41*2*${submitterInfo.organizationName || 'AUREONCARE'}*****46*${submitterInfo.submitterId || 'AUREONCARE'}`);
  segments.push(`PER*IC*${submitterInfo.contactName || 'Billing Contact'}*TE*${submitterInfo.contactPhone || '5555555555'}`);

  // 1000B - Receiver Name
  segments.push(`NM1*40*2*${submitterInfo.receiverName || 'CLEARINGHOUSE'}*****46*${submitterInfo.receiverId || 'CLEARHOUSE'}`);

  // 2000A - Billing Provider Hierarchical Level
  const billingProviderHL = hierarchicalIdCounter++;
  segments.push([
    'HL',
    billingProviderHL, // Hierarchical ID Number
    '', // Hierarchical Parent ID (blank for top level)
    '20', // Hierarchical Level Code (20 = Information Source)
    '1' // Hierarchical Child Code (1 = Additional subordinate HL present)
  ].join(elementSeparator));

  // PRV - Billing Provider Specialty Information
  segments.push(`PRV*BI*PXC*207Q00000X`); // Family Medicine

  // 2010AA - Billing Provider Name
  segments.push([
    'NM1',
    '85', // Entity Identifier Code (85 = Billing Provider)
    claimData.provider?.type === 'organization' ? '2' : '1', // Entity Type (1=Person, 2=Non-Person)
    claimData.provider?.last_name || claimData.provider?.organization_name || 'Provider',
    claimData.provider?.first_name || '',
    claimData.provider?.middle_name || '',
    '', // Name Prefix
    '', // Name Suffix
    'XX', // Identification Code Qualifier (XX = NPI)
    claimData.provider?.npi || '1234567890'
  ].join(elementSeparator));

  // N3 - Billing Provider Address
  segments.push(`N3*${claimData.provider?.address || '123 Main St'}`);

  // N4 - Billing Provider City/State/ZIP
  segments.push([
    'N4',
    claimData.provider?.city || 'City',
    claimData.provider?.state || 'ST',
    claimData.provider?.zip_code || '12345'
  ].join(elementSeparator));

  // REF - Billing Provider Tax ID
  segments.push(`REF*EI*${claimData.provider?.tax_id || '123456789'}`);

  // 2000B - Subscriber Hierarchical Level
  const subscriberHL = hierarchicalIdCounter++;
  segments.push([
    'HL',
    subscriberHL, // Hierarchical ID Number
    billingProviderHL, // Hierarchical Parent ID
    '22', // Hierarchical Level Code (22 = Subscriber)
    '0' // Hierarchical Child Code (0 = No subordinate HL)
  ].join(elementSeparator));

  // SBR - Subscriber Information
  segments.push([
    'SBR',
    'P', // Payer Responsibility Sequence (P = Primary)
    '18', // Individual Relationship Code (18 = Self)
    '', // Reference Identification
    '', // Name
    claimData.patient?.insurance_plan || '', // Insurance Type Code
    '', // Coordination of Benefits
    '', // Yes/No Condition
    '', // Employment Status Code
    claimData.claim_filing_indicator || '12' // Claim Filing Indicator Code (12 = Preferred Provider Organization)
  ].join(elementSeparator));

  // 2010BA - Subscriber Name
  segments.push([
    'NM1',
    'IL', // Entity Identifier Code (IL = Insured/Subscriber)
    '1', // Entity Type (1 = Person)
    claimData.patient?.last_name || 'Doe',
    claimData.patient?.first_name || 'John',
    claimData.patient?.middle_name || '',
    '', // Name Prefix
    '', // Name Suffix
    'MI', // Identification Code Qualifier (MI = Member ID)
    claimData.patient?.insurance_member_id || '123456789'
  ].join(elementSeparator));

  // N3 - Subscriber Address
  segments.push(`N3*${claimData.patient?.address || '456 Oak Ave'}`);

  // N4 - Subscriber City/State/ZIP
  segments.push([
    'N4',
    claimData.patient?.city || 'City',
    claimData.patient?.state || 'ST',
    claimData.patient?.zip_code || '12345'
  ].join(elementSeparator));

  // DMG - Subscriber Demographic Information
  const dob = formatDate(new Date(claimData.patient?.date_of_birth || '1980-01-01'), 'CCYYMMDD');
  const gender = claimData.patient?.gender === 'male' ? 'M' : claimData.patient?.gender === 'female' ? 'F' : 'U';
  segments.push(`DMG*D8*${dob}*${gender}`);

  // 2010BB - Payer Name
  segments.push([
    'NM1',
    'PR', // Entity Identifier Code (PR = Payer)
    '2', // Entity Type (2 = Non-Person)
    claimData.payer || 'Insurance Company',
    '', '', '', '', // Name components
    'PI', // Identification Code Qualifier (PI = Payer ID)
    claimData.payer_id || '12345'
  ].join(elementSeparator));

  // 2300 - Claim Information
  segments.push([
    'CLM',
    claimData.claim_number || claimControlNumber, // Patient Control Number
    claimData.amount || '100.00', // Total Claim Charge Amount
    '', '', // Reserved
    `${claimData.place_of_service || '11'}:B:1`, // Facility Code:Frequency Code:Claim Indicator
    '', // Provider Signature
    'Y', // Assignment/Plan Participation (Y = Assigned)
    'Y', // Benefits Assignment (Y = Yes)
    '', // Release of Information Code
    '' // Patient Signature Source Code
  ].join(elementSeparator));

  // DTP - Date - Service Date
  const serviceDate = formatDate(new Date(claimData.service_date || new Date()), 'CCYYMMDD');
  segments.push(`DTP*472*D8*${serviceDate}`);

  // HI - Health Care Diagnosis Code (ICD-10)
  const diagnosisCodes = claimData.diagnosis_codes || ['Z00.00'];
  const hiSegment = ['HI'];
  diagnosisCodes.forEach((code, index) => {
    const qualifier = index === 0 ? 'ABK' : 'ABF'; // ABK = Principal Diagnosis, ABF = Other Diagnosis
    hiSegment.push(`${qualifier}:${code}`);
  });
  segments.push(hiSegment.join(elementSeparator));

  // 2400 - Service Line
  const procedureCodes = claimData.procedure_codes || ['99213'];
  procedureCodes.forEach((procCode, lineNumber) => {
    const lineCharge = claimData.amount ? (parseFloat(claimData.amount) / procedureCodes.length).toFixed(2) : '50.00';

    // LX - Service Line Number
    segments.push(`LX*${lineNumber + 1}`);

    // SV1 - Professional Service
    segments.push([
      'SV1',
      `HC:${procCode}`, // Composite Medical Procedure
      lineCharge, // Line Item Charge Amount
      'UN', // Unit Basis for Measurement (UN = Unit)
      '1', // Service Unit Count
      claimData.place_of_service || '11', // Place of Service Code
      '', '', // Service Type Code
      '', // Composite Diagnosis Code Pointer
      '1' // Diagnosis Code Pointer (points to first diagnosis)
    ].join(elementSeparator));

    // DTP - Service Date
    segments.push(`DTP*472*D8*${serviceDate}`);
  });

  // SE - Transaction Set Trailer
  const segmentCount = segments.length + 1; // +1 for SE itself
  segments.push([
    'SE',
    segmentCount, // Number of Included Segments
    transactionSetControlNumber // Transaction Set Control Number
  ].join(elementSeparator));

  // GE - Functional Group Trailer
  segments.push([
    'GE',
    '1', // Number of Transaction Sets
    groupControlNumber // Group Control Number
  ].join(elementSeparator));

  // IEA - Interchange Control Trailer
  segments.push([
    'IEA',
    '1', // Number of Functional Groups
    interchangeControlNumber // Interchange Control Number
  ].join(elementSeparator));

  // Join all segments with terminator
  return segments.join(segmentTerminator) + segmentTerminator;
}

/**
 * Generate a random control number
 * @param {number} length - Length of control number
 * @returns {string} Control number
 */
function generateControlNumber(length) {
  return Math.random().toString().substring(2, 2 + length).padStart(length, '0');
}

/**
 * Format date for EDI
 * @param {Date} date - Date to format
 * @param {string} format - Format (YYMMDD or CCYYMMDD)
 * @returns {string} Formatted date
 */
function formatDate(date, format = 'CCYYMMDD') {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  if (format === 'YYMMDD') {
    return `${String(year).substring(2)}${month}${day}`;
  }
  return `${year}${month}${day}`;
}

/**
 * Format time for EDI (HHMM or HHMMSS)
 * @param {Date} date - Date to format
 * @returns {string} Formatted time
 */
function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}${minutes}`;
}

/**
 * Pad string to the right with spaces
 * @param {string} str - String to pad
 * @param {number} length - Target length
 * @returns {string} Padded string
 */
function padRight(str, length) {
  return str.substring(0, length).padEnd(length, ' ');
}

/**
 * Validate claim data before generating 837
 * @param {Object} claimData - Claim data to validate
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
function validateClaimData(claimData) {
  const errors = [];

  if (!claimData.patient) {
    errors.push('Patient information is required');
  } else {
    if (!claimData.patient.first_name || !claimData.patient.last_name) {
      errors.push('Patient name is required');
    }
    if (!claimData.patient.date_of_birth) {
      errors.push('Patient date of birth is required');
    }
  }

  if (!claimData.provider) {
    errors.push('Provider information is required');
  }

  if (!claimData.amount || parseFloat(claimData.amount) <= 0) {
    errors.push('Claim amount must be greater than 0');
  }

  if (!claimData.service_date) {
    errors.push('Service date is required');
  }

  if (!claimData.diagnosis_codes || claimData.diagnosis_codes.length === 0) {
    errors.push('At least one diagnosis code is required');
  }

  if (!claimData.procedure_codes || claimData.procedure_codes.length === 0) {
    errors.push('At least one procedure code is required');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  generate837File,
  validateClaimData,
  generateControlNumber,
  formatDate,
  formatTime
};
