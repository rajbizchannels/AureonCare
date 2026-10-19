/**
 * Files documents sent in secure messages into the patient's chart.
 *
 * Routing is decided by who sent the document and, for staff, what they said
 * they meant by it:
 *
 *   patient  → Patient Records, review_status 'pending_review'
 *   staff, disposition 'records'      → Patient Records, visible to the patient
 *   staff, disposition 'form_request' → Forms Requested, as an action item
 *   either,  disposition 'none'       → stays in the conversation only
 *
 * Both destinations are read by patient_id, so a filed row appears in the
 * staff chart (PatientHistoryView) and the portal at the same time without any
 * further plumbing.
 *
 * Bytes are never copied out of message_attachments — see migration 060.
 */

const DISPOSITIONS = ['records', 'form_request', 'none'];

/**
 * What a given sender is allowed to ask for.
 *
 * A patient cannot file into Forms Requested: that list is the practice asking
 * the patient to do something, and letting the patient write to it would let
 * them manufacture their own to-dos and, worse, mark them complete. Anything
 * they send is a record submission pending review.
 */
const resolveDisposition = (actorKind, requested) => {
  if (actorKind === 'patient') {
    return requested === 'none' ? 'none' : 'records';
  }
  if (!requested) return 'records';  // staff default: file it to the chart
  return DISPOSITIONS.includes(requested) ? requested : 'records';
};

/**
 * File one attachment. Runs inside the caller's transaction so a failure here
 * rolls the message back too — a chart reference to a message that does not
 * exist is worse than a rejected send.
 *
 * @returns {{destination: string, id: string|null}} where it landed
 */
const fileAttachment = async (client, {
  attachmentId,
  fileName,
  mimeType,
  actor,
  thread,
  messageId,
  disposition,
  documentAction,
  note,
}) => {
  const target = resolveDisposition(actor.kind, disposition);

  if (target === 'none' || !thread.patient_id) {
    // With no patient on the thread there is no chart to file against — a
    // purely internal care-team conversation, for instance.
    return { destination: 'conversation', id: null };
  }

  if (target === 'form_request') {
    const result = await client.query(
      `INSERT INTO form_submissions (
         patient_id, submitted_by, submitted_by_role, status,
         source, source_message_id, document_attachment_id, document_name, document_action,
         template_name, metadata
       ) VALUES ($1,$2,$3,'draft','secure_message',$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        thread.patient_id,
        actor.id,
        actor.role,
        messageId,
        attachmentId,
        fileName,
        documentAction === 'sign' ? 'sign' : 'acknowledge',
        // template_name is what the portal's existing list rows title
        // themselves from, so the document's name goes there too and the
        // Forms Requested tab needs no special-casing to read.
        fileName,
        JSON.stringify({ threadId: thread.id, threadSubject: thread.subject }),
      ]
    );
    return { destination: 'forms_requested', id: result.rows[0].id };
  }

  // → Patient Records
  const fromPatient = actor.kind === 'patient';
  const attachmentMeta = [{
    source: 'secure_message',
    messageAttachmentId: attachmentId,
    originalName: fileName,
    mimeType: mimeType || 'application/octet-stream',
    uploadedAt: new Date().toISOString(),
    classification: fromPatient ? 'Patient Upload' : 'Clinical Document',
  }];

  const result = await client.query(
    `INSERT INTO medical_records (
       patient_id, provider_id, record_type, record_date, title, description,
       attachments, source, source_message_id, review_status
     ) VALUES ($1,$2,$3,CURRENT_DATE,$4,$5,$6,'secure_message',$7,$8)
     RETURNING id`,
    [
      thread.patient_id,
      // provider_id is a users FK, so a patient-sent document has no provider.
      fromPatient ? null : actor.id,
      fromPatient ? 'Patient Upload' : 'Clinical Document',
      fileName,
      note || `Shared in secure message: ${thread.subject}`,
      JSON.stringify(attachmentMeta),
      messageId,
      // Staff-authored documents are verified by authorship; patient uploads
      // are not, and are held at pending_review until someone confirms them.
      fromPatient ? 'pending_review' : null,
    ]
  );
  return { destination: 'patient_records', id: result.rows[0].id };
};

/**
 * Undo the filings for a withdrawn message.
 *
 * Only untouched filings are removed: a Forms Requested item the patient has
 * not returned, and a record still awaiting review. Once a clinician has
 * accepted a document into the chart, or a patient has completed a request,
 * retention outranks the sender's change of mind and the row stays.
 *
 * Anything that stays still needs its bytes, so this reports which attachments
 * the caller must keep. Withdrawal deletes the rest along with the message
 * body — otherwise the chart would hold a reference to a document nobody can
 * open again.
 *
 * @returns {Promise<string[]>} attachment ids that must NOT be deleted
 */
const unfileMessage = async (client, messageId) => {
  await client.query(
    `DELETE FROM form_submissions
      WHERE source_message_id = $1 AND status = 'draft'`,
    [messageId]
  );
  await client.query(
    `DELETE FROM medical_records
      WHERE source_message_id = $1
        AND (review_status IS NULL OR review_status = 'pending_review')`,
    [messageId]
  );

  // Whatever survived the two deletes above still points at its bytes.
  const survivors = await client.query(
    `SELECT document_attachment_id::text AS id
       FROM form_submissions
      WHERE source_message_id = $1 AND document_attachment_id IS NOT NULL
      UNION
     SELECT att->>'messageAttachmentId' AS id
       FROM medical_records mr
       CROSS JOIN LATERAL jsonb_array_elements(
         CASE WHEN jsonb_typeof(mr.attachments) = 'array' THEN mr.attachments ELSE '[]'::jsonb END
       ) AS att
      WHERE mr.source_message_id = $1
        AND att->>'messageAttachmentId' IS NOT NULL`,
    [messageId]
  );

  return survivors.rows.map((r) => r.id).filter(Boolean);
};

module.exports = { fileAttachment, unfileMessage, resolveDisposition, DISPOSITIONS };
