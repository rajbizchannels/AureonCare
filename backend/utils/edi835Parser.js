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

module.exports = {
  parse835File,
  convertToPaymentPostings,
  validate835File,
  formatEDIDate
};
