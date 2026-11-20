// Turn a PostgreSQL error into an HTTP answer the caller can act on.
//
// THE PROBLEM. Every write handler in the app ended its catch block with a 500 and a
// hardcoded message: "Failed to create patient", "Failed to create claim". A missing
// required field, a duplicate MRN and a genuine server fault were therefore
// indistinguishable — all three told the user the server had broken, when two of them were
// something they could have fixed in the form in front of them. That is also a lie about
// whose fault it is: 5xx means "I failed", 4xx means "that request cannot be satisfied".
//
// WHY CENTRALLY, rather than validating each field in each route. There are hundreds of
// write handlers and the constraints already live in the schema — which is the one place
// that cannot drift from the truth. Re-listing every NOT NULL column in JavaScript creates
// a second source of truth that goes stale the first time a migration adds a column. This
// maps what the database says into the right status and a message naming the field. Routes
// that want friendlier, earlier validation can still add it; this is the floor, not the
// ceiling.
//
// WHAT IS NEVER SENT: err.detail. For a unique or foreign-key violation Postgres puts the
// CONFLICTING ROW VALUES in there — "Key (mrn)=(MRN-00123) already exists", and for other
// tables a patient's name, email or date of birth. Several routes were passing it straight
// to the client, which in a clinical system means leaking patient data through an error
// message. The column and constraint names are enough to act on; the values are not ours
// to hand out.

/** Column name -> something a person would recognise in a form. */
const prettyField = (column) => String(column || '')
  .replace(/_id$/, '')
  .replace(/_/g, ' ')
  .trim();

/**
 * PostgreSQL class 23 is integrity constraint violation; 22 is data exception. Both mean
 * the request cannot be satisfied as sent, which is a 4xx.
 *
 * 23505 (unique) is 409 rather than 400: the request is well formed, it conflicts with
 * what is already stored, and the caller's fix is different — change the value or use the
 * existing record.
 */
const MAPPING = {
  '23502': { status: 400, kind: 'missing_field' },      // not_null_violation
  '23503': { status: 400, kind: 'unknown_reference' },  // foreign_key_violation
  '23505': { status: 409, kind: 'duplicate' },          // unique_violation
  '23514': { status: 400, kind: 'not_allowed' },        // check_violation
  '23P01': { status: 409, kind: 'conflict' },           // exclusion_violation
  '22001': { status: 400, kind: 'too_long' },           // string_data_right_truncation
  '22003': { status: 400, kind: 'out_of_range' },       // numeric_value_out_of_range
  '22007': { status: 400, kind: 'bad_date' },           // invalid_datetime_format
  '22008': { status: 400, kind: 'bad_date' },           // datetime_field_overflow
  '22P02': { status: 400, kind: 'bad_value' },          // invalid_text_representation
  '22P03': { status: 400, kind: 'bad_value' },        // invalid_binary_representation
};

/**
 * Describe a database error for a client, or null when it is not one of the kinds above —
 * in which case the caller should keep its 500, because it genuinely is one.
 *
 * @returns {null|{status:number, body:object}}
 */
function describeDbError(err, fallbackMessage) {
  if (!err || !err.code) return null;
  const mapped = MAPPING[err.code];
  if (!mapped) return null;

  const field = prettyField(err.column);
  const base = fallbackMessage || 'That request could not be completed';
  let message;

  switch (mapped.kind) {
    case 'missing_field':
      message = field
        ? `${base}: ${field} is required.`
        : `${base}: a required field is missing.`;
      break;
    case 'unknown_reference':
      // The column is the local one (e.g. patient_id), which is the useful half: it says
      // WHICH reference did not resolve without naming the row it pointed at.
      message = field
        ? `${base}: the ${field} does not exist, or has been removed.`
        : `${base}: it refers to something that does not exist.`;
      break;
    case 'duplicate':
      message = field
        ? `${base}: that ${field} is already in use.`
        : `${base}: a record with those details already exists.`;
      break;
    case 'not_allowed':
      message = `${base}: one of the values is not allowed here.`;
      break;
    case 'too_long':
      message = field
        ? `${base}: ${field} is too long.`
        : `${base}: one of the values is too long.`;
      break;
    case 'out_of_range':
      message = field ? `${base}: ${field} is out of range.` : `${base}: a number is out of range.`;
      break;
    case 'bad_date':
      message = field ? `${base}: ${field} is not a valid date.` : `${base}: a date is not valid.`;
      break;
    default:
      message = field ? `${base}: ${field} is not valid.` : `${base}: one of the values is not valid.`;
  }

  return {
    status: mapped.status,
    body: {
      error: base,
      message,
      // Enough for a form to highlight the right input, and for a developer reading a log
      // to know which constraint fired. Deliberately NOT err.detail, which carries the
      // row's values.
      field: err.column || undefined,
      constraint: err.constraint || undefined,
      code: err.code,
    },
  };
}

/**
 * Send the right answer for `err`, or return false so the caller can keep its own 500.
 *
 *   } catch (err) {
 *     console.error('Error creating patient:', err);
 *     if (sendDbError(res, err, 'Failed to create patient')) return;
 *     res.status(500).json({ error: 'Failed to create patient' });
 *   }
 *
 * Returning false rather than sending a 500 itself keeps each route's existing wording and
 * shape for the genuine-fault case, so adopting this changes nothing about those.
 */
function sendDbError(res, err, fallbackMessage) {
  const described = describeDbError(err, fallbackMessage);
  if (!described) return false;
  res.status(described.status).json(described.body);
  return true;
}

module.exports = { describeDbError, sendDbError, prettyField, MAPPING };
