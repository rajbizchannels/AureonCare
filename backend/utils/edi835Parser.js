/**
 * EDI 835 (Electronic Remittance Advice) Parser
 * Parses X12 835 files to extract payment posting information
 */

/**
 * Parse EDI 835 file content
 * @param {string} fileContent - The raw EDI 835 file content
 * @returns {Object} Parsed payment posting data
 */
function parse835File(fileContent) {
  try {
    // Split into segments (EDI segments are typically separated by ~)
    const segments = fileContent.split('~').map(s => s.trim()).filter(s => s.length > 0);

    const result = {
      interchangeControlNumber: null,
      payerName: null,
      payerIdentification: null,
      paymentMethod: null,
      checkNumber: null,
      checkDate: null,
      totalPaymentAmount: 0,
      claims: []
    };

    let currentClaim = null;
    let currentServiceLine = null;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const elements = segment.split('*');
      const segmentId = elements[0];

      switch (segmentId) {
        case 'ISA': // Interchange Control Header
          result.interchangeControlNumber = elements[13];
          break;

        case 'N1': // Payer Identification
          if (elements[1] === 'PR') { // PR = Payer
            result.payerName = elements[2];
            // Look ahead for NM1 segment with payer details
            const nextSegment = segments[i + 1];
            if (nextSegment && nextSegment.startsWith('N3')) {
              // Address segment (optional)
            }
          }
          break;

        case 'REF': // Reference Identification
          if (elements[1] === '2U') { // Payer Identification
            result.payerIdentification = elements[2];
          }
          break;

        case 'TRN': // Trace Number (Check/EFT Number)
          if (elements[1] === '1') {
            result.checkNumber = elements[2];
          }
          break;

        case 'DTM': // Date/Time Reference
          if (elements[1] === '405') { // Production Date
            result.checkDate = formatEDIDate(elements[2]);
          }
          break;

        case 'BPR': // Financial Information
          // BPR*I*150.00*C*ACH*CCP*01*999999999*DA*123456*1234567890**01*999999999*DA*123456*20231215~
          result.totalPaymentAmount = parseFloat(elements[2]);
          result.paymentMethod = elements[4] === 'ACH' ? 'eft' :
                                 elements[4] === 'CHK' ? 'check' : 'other';
          if (elements[16]) {
            result.checkDate = formatEDIDate(elements[16]);
          }
          break;

        case 'CLP': // Claim Payment Information
          // CLP*CLAIM123*1*100.00*80.00*20.00*12*123456789*11*1~
          currentClaim = {
            claimNumber: elements[1],
            claimStatusCode: elements[2], // 1=Processed as Primary, 2=Processed as Secondary, etc.
            totalChargeAmount: parseFloat(elements[3]),
            paymentAmount: parseFloat(elements[4]),
            patientResponsibilityAmount: parseFloat(elements[5]),
            claimFilingIndicatorCode: elements[6],
            payerClaimControlNumber: elements[7],
            facilityTypeCode: elements[8],
            claimFrequencyCode: elements[9],
            serviceLines: [],
            adjustments: []
          };
          result.claims.push(currentClaim);
          break;

        case 'CAS': // Claim Adjustment
          // CAS*CO*45*15.00~
          if (currentClaim) {
            const adjustmentGroup = {
              groupCode: elements[1], // CO=Contractual Obligation, PR=Patient Responsibility, OA=Other, PI=Payer Initiated
              adjustments: []
            };

            // Parse adjustment reason codes and amounts (comes in pairs)
            for (let j = 2; j < elements.length; j += 3) {
              if (elements[j]) {
                adjustmentGroup.adjustments.push({
                  reasonCode: elements[j],
                  amount: parseFloat(elements[j + 1] || 0),
                  quantity: elements[j + 2] || null
                });
              }
            }
            currentClaim.adjustments.push(adjustmentGroup);
          }
          break;

        case 'NM1': // Patient/Subscriber Name
          if (currentClaim && elements[1] === 'QC') { // QC = Patient
            currentClaim.patientName = `${elements[4] || ''} ${elements[3] || ''}`.trim();
            currentClaim.patientId = elements[9];
          }
          break;

        case 'SVC': // Service Line Information
          // SVC*HC:99213*100.00*80.00*UN*1~
          if (currentClaim) {
            currentServiceLine = {
              procedureCode: elements[1].split(':')[1] || elements[1],
              chargeAmount: parseFloat(elements[2]),
              paymentAmount: parseFloat(elements[3]),
              units: elements[5],
              adjustments: []
            };
            currentClaim.serviceLines.push(currentServiceLine);
          }
          break;

        case 'DTM': // Service Date
          if (currentServiceLine && elements[1] === '472') {
            currentServiceLine.serviceDate = formatEDIDate(elements[2]);
          } else if (currentClaim && elements[1] === '232') {
            currentClaim.serviceDate = formatEDIDate(elements[2]);
          }
          break;

        case 'AMT': // Monetary Amount
          if (currentClaim) {
            if (elements[1] === 'AU') { // Coverage Amount
              currentClaim.allowedAmount = parseFloat(elements[2]);
            } else if (elements[1] === 'D') { // Discount Amount
              currentClaim.discountAmount = parseFloat(elements[2]);
            }
          }
          break;

        case 'PLB': // Provider Level Adjustment
          // Provider-level adjustments (not claim-specific)
          break;

        default:
          // Ignore other segments
          break;
      }
    }

    return result;
  } catch (error) {
    console.error('Error parsing 835 file:', error);
    throw new Error(`Failed to parse EDI 835 file: ${error.message}`);
  }
}

/**
 * Format EDI date (YYYYMMDD or CCYYMMDD) to ISO date string
 * @param {string} ediDate - EDI format date
 * @returns {string} ISO date string (YYYY-MM-DD)
 */
function formatEDIDate(ediDate) {
  if (!ediDate) return null;

  // Remove any non-numeric characters
  const cleaned = ediDate.replace(/\D/g, '');

  // Handle CCYYMMDD (8 digits) or YYYYMMDD (8 digits)
  if (cleaned.length === 8) {
    const year = cleaned.substring(0, 4);
    const month = cleaned.substring(4, 6);
    const day = cleaned.substring(6, 8);
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * Convert parsed 835 data to payment posting records
 * @param {Object} parsed835 - Parsed 835 data
 * @param {Object} claimMapping - Mapping of claim numbers to claim IDs in the database
 * @returns {Array} Array of payment posting records ready for database insertion
 */
function convertToPaymentPostings(parsed835, claimMapping = {}) {
  const postings = [];

  for (const claim of parsed835.claims) {
    const claimId = claimMapping[claim.claimNumber];

    if (!claimId) {
      console.warn(`Claim ${claim.claimNumber} not found in database, skipping`);
      continue;
    }

    // Calculate adjustment amounts
    const totalAdjustment = claim.adjustments.reduce((sum, group) => {
      return sum + group.adjustments.reduce((groupSum, adj) => groupSum + adj.amount, 0);
    }, 0);

    // Find patient responsibility adjustments
    const patientResponsibility = claim.adjustments
      .filter(group => group.groupCode === 'PR')
      .reduce((sum, group) => {
        return sum + group.adjustments.reduce((groupSum, adj) => groupSum + adj.amount, 0);
      }, 0);

    // Determine adjustment reason and code
    let adjustmentReason = '';
    let adjustmentCode = '';

    if (claim.adjustments.length > 0) {
      const firstAdj = claim.adjustments[0];
      adjustmentCode = firstAdj.groupCode;
      if (firstAdj.adjustments.length > 0) {
        adjustmentReason = `${firstAdj.groupCode}-${firstAdj.adjustments[0].reasonCode}`;
      }
    }

    const posting = {
      claim_id: claimId,
      check_number: parsed835.checkNumber,
      check_date: parsed835.checkDate,
      payment_amount: claim.paymentAmount,
      allowed_amount: claim.allowedAmount || claim.totalChargeAmount,
      deductible_amount: 0, // Would need to parse specific CAS codes to determine
      coinsurance_amount: 0, // Would need to parse specific CAS codes to determine
      copay_amount: 0, // Would need to parse specific CAS codes to determine
      adjustment_amount: totalAdjustment,
      adjustment_reason: adjustmentReason,
      adjustment_code: adjustmentCode,
      posting_date: parsed835.checkDate || new Date().toISOString().split('T')[0],
      status: 'posted',
      payment_method: parsed835.paymentMethod,
      era_number: parsed835.interchangeControlNumber,
      eob_number: claim.payerClaimControlNumber,
      notes: `Auto-imported from EDI 835. Payer: ${parsed835.payerName || 'Unknown'}`,
      payer_name: parsed835.payerName,
      payer_id: parsed835.payerIdentification,
      raw_claim_data: claim // Store original claim data for reference
    };

    postings.push(posting);
  }

  return postings;
}

/**
 * Validate EDI 835 file format
 * @param {string} fileContent - The raw file content
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
function validate835File(fileContent) {
  const errors = [];

  if (!fileContent || fileContent.trim().length === 0) {
    errors.push('File is empty');
    return { valid: false, errors };
  }

  // Check for ISA segment (required)
  if (!fileContent.includes('ISA*')) {
    errors.push('Missing ISA (Interchange Control Header) segment - not a valid EDI file');
  }

  // Check for BPR segment (required in 835)
  if (!fileContent.includes('BPR*')) {
    errors.push('Missing BPR (Financial Information) segment - not a valid 835 file');
  }

  // Check for at least one CLP segment (claim payment)
  if (!fileContent.includes('CLP*')) {
    errors.push('No claim payment information found (missing CLP segments)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generate EDI 835 file from payment posting data
 * @param {Object} paymentData - Payment posting data
 * @param {Object} payerInfo - Payer information
 * @returns {string} EDI 835 file content
 */
function generate835File(paymentData, payerInfo) {
  const segments = [];
  const segmentTerminator = '~';
  const elementSeparator = '*';
  const subelementSeparator = ':';

  // Generate control numbers
  const interchangeControlNumber = String(Math.floor(Math.random() * 1000000000)).padStart(9, '0');
  const groupControlNumber = String(Math.floor(Math.random() * 1000000000)).padStart(9, '0');
  const transactionSetControlNumber = String(Math.floor(Math.random() * 10000)).padStart(4, '0');

  // Get current date/time
  const now = new Date();
  const currentDate = formatEDIDate(now, 'YYMMDD');
  const currentTime = formatEDITime(now);
  const currentDateLong = formatEDIDate(now, 'CCYYMMDD');

  // ISA - Interchange Control Header
  segments.push([
    'ISA',
    '00', '          ', // Authorization
    '00', '          ', // Security
    'ZZ', padRight(payerInfo.payerId || 'PAYER', 15),
    'ZZ', padRight(payerInfo.receiverId || 'RECEIVER', 15),
    currentDate, currentTime,
    'U', '00401',
    interchangeControlNumber,
    '0', 'P', subelementSeparator
  ].join(elementSeparator));

  // GS - Functional Group Header
  segments.push([
    'GS', 'HP', // HP = Health Care Claim Payment/Advice
    payerInfo.payerId || 'PAYER',
    payerInfo.receiverId || 'RECEIVER',
    currentDateLong,
    currentTime.substring(0, 4),
    groupControlNumber,
    'X', '005010X221A1' // 835 version
  ].join(elementSeparator));

  // ST - Transaction Set Header
  segments.push([
    'ST', '835',
    transactionSetControlNumber,
    '005010X221A1'
  ].join(elementSeparator));

  // BPR - Financial Information
  segments.push([
    'BPR',
    'I', // I = Information Reporting
    paymentData.totalAmount || '0.00',
    'C', // C = Credit
    'ACH', // Payment method
    '', '', // Banking info (empty for now)
    '', payerInfo.accountNumber || '',
    '', payerInfo.routingNumber || '',
    'DA', // DA = Demand Deposit Account
    '', payerInfo.receiverAccountNumber || '',
    '', payerInfo.receiverRoutingNumber || '',
    currentDateLong // Effective date
  ].join(elementSeparator));

  // TRN - Reassociation Trace Number
  segments.push([
    'TRN',
    '1', // 1 = Current Transaction Trace Numbers
    paymentData.checkNumber || interchangeControlNumber,
    payerInfo.payerId || '1234567890'
  ].join(elementSeparator));

  // N1 - Payer Identification
  segments.push([
    'N1', 'PR', // PR = Payer
    payerInfo.name || 'Insurance Company'
  ].join(elementSeparator));

  // N3 - Payer Address
  if (payerInfo.address) {
    segments.push(`N3*${payerInfo.address}`);
  }

  // N4 - Payer City/State/ZIP
  if (payerInfo.city || payerInfo.state || payerInfo.zip) {
    segments.push([
      'N4',
      payerInfo.city || '',
      payerInfo.state || '',
      payerInfo.zip || ''
    ].join(elementSeparator));
  }

  // Loop through claims
  (paymentData.claims || []).forEach(claim => {
    // LX - Header Number
    segments.push(`LX*${claim.sequenceNumber || 1}`);

    // CLP - Claim Payment Information
    segments.push([
      'CLP',
      claim.claimNumber || '',
      claim.statusCode || '1', // 1 = Processed as Primary
      claim.chargedAmount || '0.00',
      claim.paidAmount || '0.00',
      claim.patientResponsibility || '0.00',
      claim.filingIndicator || '12', // 12 = PPO
      claim.payerClaimControlNumber || '',
      claim.facilityTypeCode || '11' // 11 = Office
    ].join(elementSeparator));

    // CAS - Claim Adjustment (if any)
    if (claim.adjustments && claim.adjustments.length > 0) {
      claim.adjustments.forEach(adj => {
        segments.push([
          'CAS',
          adj.groupCode || 'CO', // CO = Contractual Obligation
          adj.reasonCode || '45', // 45 = Charge exceeds fee schedule
          adj.amount || '0.00'
        ].join(elementSeparator));
      });
    }

    // NM1 - Patient Name
    if (claim.patientName) {
      segments.push([
        'NM1', 'QC', // QC = Patient
        '1', // 1 = Person
        claim.patientLastName || '',
        claim.patientFirstName || '',
        claim.patientMiddleName || ''
      ].join(elementSeparator));
    }

    // Service lines
    (claim.serviceLines || []).forEach((service, idx) => {
      // SVC - Service Payment Information
      segments.push([
        'SVC',
        `HC:${service.procedureCode || '99213'}`, // HC = Health Care Procedure Coding System
        service.chargedAmount || '0.00',
        service.paidAmount || '0.00',
        '', // Revenue code
        service.units || '1'
      ].join(elementSeparator));

      // DTM - Service Date
      if (service.serviceDate) {
        const svcDate = formatEDIDate(new Date(service.serviceDate), 'CCYYMMDD');
        segments.push(`DTM*472*${svcDate}`);
      }
    });
  });

  // SE - Transaction Set Trailer
  const segmentCount = segments.length + 1;
  segments.push([
    'SE',
    segmentCount,
    transactionSetControlNumber
  ].join(elementSeparator));

  // GE - Functional Group Trailer
  segments.push([
    'GE', '1', groupControlNumber
  ].join(elementSeparator));

  // IEA - Interchange Control Trailer
  segments.push([
    'IEA', '1', interchangeControlNumber
  ].join(elementSeparator));

  return segments.join(segmentTerminator) + segmentTerminator;
}

/**
 * Format time for EDI (HHMM)
 * @param {Date} date - Date to format
 * @returns {string} Formatted time
 */
function formatEDITime(date) {
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

module.exports = {
  parse835File,
  convertToPaymentPostings,
  validate835File,
  formatEDIDate,
  generate835File
};
