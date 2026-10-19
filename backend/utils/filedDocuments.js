const { decryptToBuffer } = require('./messageCrypto');

/**
 * Serving documents that were filed into the chart from a secure message.
 *
 * The bytes live in message_attachments, encrypted. The messaging endpoint
 * that serves them authorises on *thread membership*, which is the wrong rule
 * once a document is part of the chart: a clinician opening a patient's record
 * is entitled to the document whether or not they were in the conversation it
 * arrived through. These helpers back the chart-scoped routes that apply
 * record access rules instead.
 */

/** Fetch the encrypted blob for a filed document. */
const loadAttachment = async (pool, attachmentId) => {
  const result = await pool.query(
    `SELECT id, file_name, mime_type, size_bytes,
            content_ciphertext, content_iv, content_tag
       FROM message_attachments
      WHERE id = $1`,
    [attachmentId]
  );
  return result.rows[0] || null;
};

/**
 * Whether a medical_records row actually references this attachment.
 *
 * Guards against someone pairing a record id they may read with an arbitrary
 * attachment id they may not — the record is the authorisation subject, so the
 * attachment has to belong to it.
 */
const recordReferencesAttachment = (record, attachmentId) => {
  const attachments = Array.isArray(record?.attachments) ? record.attachments : [];
  return attachments.some((a) => String(a?.messageAttachmentId) === String(attachmentId));
};

/**
 * Decrypt and stream an attachment.
 * Returns false when the payload will not decrypt, so the caller can answer
 * with its own error rather than a half-written response.
 */
const sendAttachment = (res, attachment) => {
  let payload;
  try {
    payload = decryptToBuffer({
      ciphertext: attachment.content_ciphertext,
      iv: attachment.content_iv,
      tag: attachment.content_tag,
    });
  } catch (error) {
    console.error('[filedDocuments] Decryption failed:', error.message);
    return false;
  }

  res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${String(attachment.file_name).replace(/"/g, '')}"`
  );
  res.send(payload);
  return true;
};

module.exports = { loadAttachment, recordReferencesAttachment, sendAttachment };
