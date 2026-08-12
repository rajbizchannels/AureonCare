const express = require('express');
const router = express.Router();

const { resolveActor, requireStaffActor } = require('../middleware/messagingAuth');
const { encrypt, decrypt, decryptToBuffer } = require('../utils/messageCrypto');
const { fileAttachment, unfileMessage } = require('../services/messageDocumentFiling');

/**
 * Secure messaging API.
 *
 * Threads carry staff and patients side by side; membership in
 * message_thread_participants is the single authorisation gate for every read
 * and write. Message bodies are encrypted at rest (see utils/messageCrypto.js)
 * and decrypted per request only for callers who pass that gate.
 */

router.use(resolveActor);

// Base64 inflates by ~33% and express.json caps bodies at 10mb, so 5mb of raw
// attachment is the most that reliably fits alongside the message itself.
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_MESSAGE = 5;
const MAX_BODY_CHARS = 20000;

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

/**
 * Write an audit row. Messaging touches PHI, so every read of a thread and
 * every send is recorded.
 *
 * audit_logs.user_id carries a FK to users, so a patient actor is recorded
 * through patient_id instead and the actor kind is kept in metadata.
 */
const recordAudit = async (pool, req, entry) => {
  try {
    const actor = req.actor;
    await pool.query(
      `INSERT INTO audit_logs (
         user_id, user_email, user_name, user_role, ip_address, user_agent,
         action_type, resource_type, resource_name, resource_id,
         action_description, module, patient_id, status, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        actor.kind === 'user' ? actor.id : null,
        actor.email,
        actor.displayName,
        actor.role,
        req.ip,
        req.get('user-agent'),
        entry.actionType,
        'message',
        entry.resourceName,
        entry.resourceId || null,
        entry.description,
        'Messaging',
        entry.patientId || (actor.kind === 'patient' ? actor.id : null),
        'success',
        JSON.stringify({ actorKind: actor.kind, ...(entry.metadata || {}) }),
      ]
    );
  } catch (error) {
    // Never fail the user's request because the audit write failed — but do
    // make the gap loud, since a silent hole in a PHI audit trail is worse
    // than a noisy log.
    console.error('[messages] Audit write failed:', error.message);
  }
};

/** The caller's active participant row for a thread, or null. */
const loadMembership = async (pool, threadId, actor) => {
  const result = await pool.query(
    `SELECT * FROM message_thread_participants
      WHERE thread_id = $1
        AND participant_kind = $2
        AND participant_id = $3
        AND is_active = true`,
    [threadId, actor.kind, actor.id]
  );
  return result.rows[0] || null;
};

/** Participants of a thread, resolved across the users and patients tables. */
const loadParticipants = async (pool, threadId) => {
  const result = await pool.query(
    `SELECT
       p.id, p.participant_kind, p.participant_id, p.participant_role,
       p.last_read_at, p.is_active,
       COALESCE(
         NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''),
         NULLIF(TRIM(CONCAT(pt.first_name, ' ', pt.last_name)), ''),
         u.email, pt.email, 'Unknown'
       ) AS display_name,
       COALESCE(u.email, pt.email)   AS email,
       COALESCE(u.role, 'patient')   AS role,
       u.specialty
     FROM message_thread_participants p
     LEFT JOIN users u    ON p.participant_kind = 'user'    AND u.id  = p.participant_id
     LEFT JOIN patients pt ON p.participant_kind = 'patient' AND pt.id = p.participant_id
     WHERE p.thread_id = $1
     ORDER BY p.participant_kind, display_name`,
    [threadId]
  );
  return result.rows.map((r) => ({
    id: r.id,
    kind: r.participant_kind,
    participantId: r.participant_id,
    role: r.participant_role,
    displayName: r.display_name,
    email: r.email,
    userRole: r.role,
    specialty: r.specialty,
    lastReadAt: r.last_read_at,
    isActive: r.is_active,
  }));
};

/** Shape a raw messages row for the client, decrypting the body. */
const presentMessage = (row) => {
  const body = row.deleted_at
    ? null
    : decrypt({ ciphertext: row.body_ciphertext, iv: row.body_iv, tag: row.body_tag });

  return {
    id: row.id,
    threadId: row.thread_id,
    senderKind: row.sender_kind,
    senderId: row.sender_id,
    senderName: row.sender_name || (row.sender_kind === 'system' ? 'System' : 'Unknown'),
    senderRole: row.sender_role,
    messageType: row.message_type,
    // `null` body with no deleted_at means the ciphertext would not decrypt —
    // surfaced rather than hidden so the gap is visible in the thread.
    body: row.deleted_at ? null : body,
    undecryptable: !row.deleted_at && body === null,
    sentAt: row.sent_at,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
    attachments: (row.attachments || []).filter(Boolean),
    readBy: (row.read_by || []).filter(Boolean),
    filings: (row.filings || []).filter(Boolean),
  };
};

/** Validate that a participant descriptor points at a real user/patient. */
const participantExists = async (pool, kind, id) => {
  const table = kind === 'user' ? 'users' : 'patients';
  const result = await pool.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
  return result.rowCount > 0;
};

const insertMessage = async (client, { threadId, actor, body, messageType = 'message' }) => {
  const enc = encrypt(body);
  const result = await client.query(
    `INSERT INTO messages (
       thread_id, sender_kind, sender_id, message_type,
       body_ciphertext, body_iv, body_tag, key_version
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      threadId,
      messageType === 'system' ? 'system' : actor.kind,
      messageType === 'system' ? null : actor.id,
      messageType,
      enc.ciphertext,
      enc.iv,
      enc.tag,
      enc.keyVersion,
    ]
  );
  return result.rows[0];
};

// ─────────────────────────────────────────
// Threads
// ─────────────────────────────────────────

/**
 * GET /api/messages/threads
 * Threads the caller participates in, newest activity first.
 *
 * Query: status, threadType, patientId, q (subject search), limit, offset
 */
router.get('/threads', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { status, threadType, patientId, q } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;

    const values = [req.actor.kind, req.actor.id];
    const conditions = ['me.is_active = true'];

    if (status) {
      values.push(status);
      conditions.push(`t.status = $${values.length}`);
    }
    if (threadType) {
      values.push(threadType);
      conditions.push(`t.thread_type = $${values.length}`);
    }
    if (patientId) {
      values.push(patientId);
      conditions.push(`t.patient_id = $${values.length}`);
    }
    if (q) {
      // Subject only. Bodies are encrypted, so there is nothing to match them
      // against without decrypting every row in the table.
      values.push(`%${q}%`);
      conditions.push(`t.subject ILIKE $${values.length}`);
    }

    values.push(limit, offset);

    const result = await pool.query(
      `SELECT
         t.*,
         me.last_read_at,
         me.participant_role,
         COALESCE(
           NULLIF(TRIM(CONCAT(pt.first_name, ' ', pt.last_name)), ''), NULL
         ) AS patient_name,
         pt.mrn AS patient_mrn,
         (
           SELECT COUNT(*) FROM messages m
            WHERE m.thread_id = t.id
              AND m.deleted_at IS NULL
              AND m.message_type = 'message'
              AND (me.last_read_at IS NULL OR m.sent_at > me.last_read_at)
              AND NOT (m.sender_kind = $1 AND m.sender_id = $2)
         ) AS unread_count,
         (
           SELECT json_agg(json_build_object(
             'kind', p2.participant_kind,
             'participantId', p2.participant_id,
             'displayName', COALESCE(
               NULLIF(TRIM(CONCAT(u2.first_name, ' ', u2.last_name)), ''),
               NULLIF(TRIM(CONCAT(pt2.first_name, ' ', pt2.last_name)), ''),
               u2.email, pt2.email, 'Unknown'
             )
           ))
           FROM message_thread_participants p2
           LEFT JOIN users u2     ON p2.participant_kind = 'user'    AND u2.id  = p2.participant_id
           LEFT JOIN patients pt2 ON p2.participant_kind = 'patient' AND pt2.id = p2.participant_id
           WHERE p2.thread_id = t.id AND p2.is_active = true
         ) AS participants
       FROM message_threads t
       JOIN message_thread_participants me
         ON me.thread_id = t.id
        AND me.participant_kind = $1
        AND me.participant_id = $2
       LEFT JOIN patients pt ON pt.id = t.patient_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.last_message_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    res.json(
      result.rows.map((r) => ({
        id: r.id,
        subject: r.subject,
        threadType: r.thread_type,
        patientId: r.patient_id,
        patientName: r.patient_name,
        patientMrn: r.patient_mrn,
        priority: r.priority,
        status: r.status,
        messageCount: r.message_count,
        unreadCount: Number(r.unread_count) || 0,
        lastMessageAt: r.last_message_at,
        lastReadAt: r.last_read_at,
        myRole: r.participant_role,
        participants: r.participants || [],
        createdAt: r.created_at,
      }))
    );
  } catch (error) {
    console.error('Error listing message threads:', error);
    res.status(500).json({ error: 'Failed to load message threads' });
  }
});

/**
 * GET /api/messages/unread-count
 * Single number for the shell's badge.
 */
router.get('/unread-count', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count
         FROM messages m
         JOIN message_thread_participants me
           ON me.thread_id = m.thread_id
          AND me.participant_kind = $1
          AND me.participant_id = $2
          AND me.is_active = true
        WHERE m.deleted_at IS NULL
          AND m.message_type = 'message'
          AND (me.last_read_at IS NULL OR m.sent_at > me.last_read_at)
          AND NOT (m.sender_kind = $1 AND m.sender_id = $2)`,
      [req.actor.kind, req.actor.id]
    );
    res.json({ count: result.rows[0].count });
  } catch (error) {
    console.error('Error counting unread messages:', error);
    res.status(500).json({ error: 'Failed to count unread messages' });
  }
});

/**
 * POST /api/messages/threads
 * Create a thread with its participants and opening message.
 *
 * Body: { subject, body, participants: [{kind, id}], patientId?, threadType?, priority? }
 */
router.post('/threads', async (req, res) => {
  const pool = req.app.locals.pool;
  const client = await pool.connect();

  try {
    const { subject, body, participants = [], patientId, priority = 'normal' } = req.body;

    if (!subject || !String(subject).trim()) {
      return res.status(400).json({ error: 'A subject is required' });
    }
    if (!body || !String(body).trim()) {
      return res.status(400).json({ error: 'A message body is required' });
    }
    if (String(body).length > MAX_BODY_CHARS) {
      return res.status(400).json({ error: `Message body exceeds ${MAX_BODY_CHARS} characters` });
    }
    if (!Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ error: 'At least one recipient is required' });
    }

    // Normalise, drop the author (added separately as owner) and de-duplicate.
    const seen = new Set([`${req.actor.kind}:${req.actor.id}`]);
    const recipients = [];
    for (const p of participants) {
      const kind = p.kind === 'patient' ? 'patient' : 'user';
      const id = p.id ?? p.participantId;
      if (!id) continue;
      const key = `${kind}:${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!(await participantExists(pool, kind, id))) {
        return res.status(400).json({ error: `Unknown ${kind} recipient: ${id}` });
      }
      recipients.push({ kind, id });
    }
    if (recipients.length === 0) {
      return res.status(400).json({ error: 'At least one recipient other than yourself is required' });
    }

    // A patient anywhere in the thread makes it patient-facing, which the UI
    // uses to warn staff that the patient reads everything written here.
    const includesPatient =
      req.actor.kind === 'patient' || recipients.some((r) => r.kind === 'patient');
    const threadType = includesPatient ? 'patient' : 'care_team';

    // A patient can only ever open a thread about themselves.
    const resolvedPatientId =
      req.actor.kind === 'patient'
        ? req.actor.id
        : patientId || recipients.find((r) => r.kind === 'patient')?.id || null;

    await client.query('BEGIN');

    const threadResult = await client.query(
      `INSERT INTO message_threads (
         subject, thread_type, patient_id, priority, created_by_kind, created_by_id
       ) VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        String(subject).trim(),
        threadType,
        resolvedPatientId,
        ['low', 'normal', 'high', 'urgent'].includes(priority) ? priority : 'normal',
        req.actor.kind,
        req.actor.id,
      ]
    );
    const thread = threadResult.rows[0];

    const rows = [{ kind: req.actor.kind, id: req.actor.id, role: 'owner' }, ...recipients.map((r) => ({ ...r, role: 'member' }))];
    for (const r of rows) {
      await client.query(
        `INSERT INTO message_thread_participants (
           thread_id, participant_kind, participant_id, participant_role, last_read_at
         ) VALUES ($1,$2,$3,$4,$5)`,
        // The author has read their own opening message by definition.
        [thread.id, r.kind, r.id, r.role, r.role === 'owner' ? new Date() : null]
      );
    }

    const message = await insertMessage(client, { threadId: thread.id, actor: req.actor, body });

    await client.query('COMMIT');

    await recordAudit(pool, req, {
      actionType: 'create',
      resourceName: 'MessageThread',
      resourceId: thread.id,
      description: `Started secure message thread "${thread.subject}"`,
      patientId: resolvedPatientId,
      metadata: { threadType, recipientCount: recipients.length },
    });

    res.status(201).json({
      id: thread.id,
      subject: thread.subject,
      threadType: thread.thread_type,
      patientId: thread.patient_id,
      priority: thread.priority,
      status: thread.status,
      createdAt: thread.created_at,
      participants: await loadParticipants(pool, thread.id),
      firstMessageId: message.id,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error creating message thread:', error);
    if (error.code === '42P01') {
      return res.status(503).json({
        error: 'Messaging tables do not exist. Run migration 059_create_secure_messaging.sql.',
      });
    }
    res.status(500).json({ error: 'Failed to create message thread' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/messages/threads/:threadId
 */
router.get('/threads/:threadId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { threadId } = req.params;

    const membership = await loadMembership(pool, threadId, req.actor);
    if (!membership) {
      return res.status(403).json({ error: 'You are not a participant in this thread' });
    }

    const result = await pool.query(
      `SELECT t.*,
              COALESCE(NULLIF(TRIM(CONCAT(pt.first_name, ' ', pt.last_name)), ''), NULL) AS patient_name,
              pt.mrn AS patient_mrn
         FROM message_threads t
         LEFT JOIN patients pt ON pt.id = t.patient_id
        WHERE t.id = $1`,
      [threadId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const t = result.rows[0];
    res.json({
      id: t.id,
      subject: t.subject,
      threadType: t.thread_type,
      patientId: t.patient_id,
      patientName: t.patient_name,
      patientMrn: t.patient_mrn,
      priority: t.priority,
      status: t.status,
      messageCount: t.message_count,
      lastMessageAt: t.last_message_at,
      createdAt: t.created_at,
      myRole: membership.participant_role,
      participants: await loadParticipants(pool, threadId),
    });
  } catch (error) {
    console.error('Error loading message thread:', error);
    res.status(500).json({ error: 'Failed to load message thread' });
  }
});

/**
 * PATCH /api/messages/threads/:threadId
 * Owners and staff may retitle, re-prioritise, or open/close a thread.
 */
router.patch('/threads/:threadId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { threadId } = req.params;
    const { subject, status, priority } = req.body;

    const membership = await loadMembership(pool, threadId, req.actor);
    if (!membership) {
      return res.status(403).json({ error: 'You are not a participant in this thread' });
    }
    // Patients participate but do not administer threads — closing one would
    // end a clinical conversation the practice is responsible for.
    if (req.actor.kind !== 'user') {
      return res.status(403).json({ error: 'Only practice staff can change thread settings' });
    }

    const updates = [];
    const values = [];
    if (subject !== undefined) {
      values.push(String(subject).trim());
      updates.push(`subject = $${values.length}`);
    }
    if (status !== undefined) {
      if (!['open', 'closed'].includes(status)) {
        return res.status(400).json({ error: 'status must be "open" or "closed"' });
      }
      values.push(status);
      updates.push(`status = $${values.length}`);
    }
    if (priority !== undefined) {
      if (!['low', 'normal', 'high', 'urgent'].includes(priority)) {
        return res.status(400).json({ error: 'Invalid priority' });
      }
      values.push(priority);
      updates.push(`priority = $${values.length}`);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    values.push(threadId);
    const result = await pool.query(
      `UPDATE message_threads
          SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${values.length}
        RETURNING *`,
      values
    );

    await recordAudit(pool, req, {
      actionType: 'update',
      resourceName: 'MessageThread',
      resourceId: threadId,
      description: `Updated message thread settings`,
      patientId: result.rows[0]?.patient_id,
      metadata: { subject, status, priority },
    });

    res.json({ success: true, thread: result.rows[0] });
  } catch (error) {
    console.error('Error updating message thread:', error);
    res.status(500).json({ error: 'Failed to update message thread' });
  }
});

// ─────────────────────────────────────────
// Messages
// ─────────────────────────────────────────

/**
 * GET /api/messages/threads/:threadId/messages
 * Oldest-first page of a thread, bodies decrypted for participants only.
 */
router.get('/threads/:threadId/messages', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { threadId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = parseInt(req.query.offset, 10) || 0;

    const membership = await loadMembership(pool, threadId, req.actor);
    if (!membership) {
      return res.status(403).json({ error: 'You are not a participant in this thread' });
    }

    const result = await pool.query(
      `SELECT
         m.*,
         COALESCE(
           NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''),
           NULLIF(TRIM(CONCAT(pt.first_name, ' ', pt.last_name)), ''),
           u.email, pt.email
         ) AS sender_name,
         COALESCE(u.role, CASE WHEN pt.id IS NOT NULL THEN 'patient' END) AS sender_role,
         (
           SELECT json_agg(json_build_object(
             'id', a.id, 'fileName', a.file_name,
             'mimeType', a.mime_type, 'sizeBytes', a.size_bytes
           ))
           FROM message_attachments a WHERE a.message_id = m.id
         ) AS attachments,
         (
           SELECT json_agg(json_build_object(
             'kind', r.reader_kind, 'readerId', r.reader_id, 'readAt', r.read_at
           ))
           FROM message_read_receipts r WHERE r.message_id = m.id
         ) AS read_by,
         -- Where this message's documents were filed, re-derived rather than
         -- cached, so the note survives a reload and disappears if the filing
         -- is later undone.
         (
           SELECT json_agg(json_build_object('destination', d.destination, 'id', d.id))
           FROM (
             SELECT 'patient_records' AS destination, mr.id::text AS id
               FROM medical_records mr WHERE mr.source_message_id = m.id
             UNION ALL
             SELECT 'forms_requested', fs.id::text
               FROM form_submissions fs WHERE fs.source_message_id = m.id
           ) d
         ) AS filings
       FROM messages m
       LEFT JOIN users u     ON m.sender_kind = 'user'    AND u.id  = m.sender_id
       LEFT JOIN patients pt ON m.sender_kind = 'patient' AND pt.id = m.sender_id
       WHERE m.thread_id = $1
       ORDER BY m.sent_at ASC
       LIMIT $2 OFFSET $3`,
      [threadId, limit, offset]
    );

    await recordAudit(pool, req, {
      actionType: 'view',
      resourceName: 'MessageThread',
      resourceId: threadId,
      description: 'Read secure message thread',
      metadata: { messagesReturned: result.rows.length },
    });

    res.json(result.rows.map(presentMessage));
  } catch (error) {
    console.error('Error loading messages:', error);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

/**
 * POST /api/messages/threads/:threadId/messages
 * Body: { body, attachments?: [{ fileName, mimeType, contentBase64 }] }
 */
router.post('/threads/:threadId/messages', async (req, res) => {
  const pool = req.app.locals.pool;
  const client = await pool.connect();

  try {
    const { threadId } = req.params;
    const { body, attachments = [] } = req.body;

    if (!body || !String(body).trim()) {
      return res.status(400).json({ error: 'A message body is required' });
    }
    if (String(body).length > MAX_BODY_CHARS) {
      return res.status(400).json({ error: `Message body exceeds ${MAX_BODY_CHARS} characters` });
    }
    if (attachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      return res.status(400).json({ error: `At most ${MAX_ATTACHMENTS_PER_MESSAGE} attachments per message` });
    }

    const membership = await loadMembership(pool, threadId, req.actor);
    if (!membership) {
      return res.status(403).json({ error: 'You are not a participant in this thread' });
    }

    const threadResult = await pool.query('SELECT * FROM message_threads WHERE id = $1', [threadId]);
    const thread = threadResult.rows[0];
    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    if (thread.status === 'closed') {
      return res.status(409).json({ error: 'This thread is closed. Reopen it to reply.' });
    }

    await client.query('BEGIN');

    const message = await insertMessage(client, { threadId, actor: req.actor, body });

    // Where each attachment was filed, echoed back so the composer can confirm
    // it in place ("Filed to Patient Records") rather than leaving the sender
    // to go and check.
    const filings = [];

    for (const att of attachments) {
      if (!att?.contentBase64 || !att?.fileName) continue;
      const raw = Buffer.from(att.contentBase64, 'base64');
      if (raw.length === 0) continue;
      if (raw.length > MAX_ATTACHMENT_BYTES) {
        await client.query('ROLLBACK');
        return res.status(413).json({
          error: `Attachment "${att.fileName}" exceeds the ${MAX_ATTACHMENT_BYTES / (1024 * 1024)}MB limit`,
        });
      }
      const enc = encrypt(raw);
      const fileName = String(att.fileName).slice(0, 255);
      const stored = await client.query(
        `INSERT INTO message_attachments (
           message_id, file_name, mime_type, size_bytes,
           content_ciphertext, content_iv, content_tag, key_version
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id`,
        [
          message.id,
          fileName,
          att.mimeType || 'application/octet-stream',
          raw.length,
          enc.ciphertext,
          enc.iv,
          enc.tag,
          enc.keyVersion,
        ]
      );

      // A document sent about a patient belongs in that patient's chart, not
      // only in the conversation. Where exactly depends on the sender and, for
      // staff, on the disposition they chose at send time.
      filings.push(
        await fileAttachment(client, {
          attachmentId: stored.rows[0].id,
          fileName,
          mimeType: att.mimeType,
          actor: req.actor,
          thread,
          messageId: message.id,
          disposition: att.disposition,
          documentAction: att.documentAction,
          note: att.note,
        })
      );
    }

    // Sending is an implicit read of everything before it.
    await client.query(
      `UPDATE message_thread_participants
          SET last_read_at = CURRENT_TIMESTAMP
        WHERE thread_id = $1 AND participant_kind = $2 AND participant_id = $3`,
      [threadId, req.actor.kind, req.actor.id]
    );

    await client.query('COMMIT');

    await recordAudit(pool, req, {
      actionType: 'create',
      resourceName: 'Message',
      resourceId: message.id,
      description: `Sent a secure message in "${thread.subject}"`,
      patientId: thread.patient_id,
      metadata: { threadId, attachmentCount: attachments.length, filings },
    });

    res.status(201).json({
      ...presentMessage({
        ...message,
        sender_name: req.actor.displayName,
        sender_role: req.actor.role,
        attachments: [],
        read_by: [],
      }),
      filings,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/messages/threads/:threadId/read
 * Marks the thread read up to now and records per-message receipts.
 */
router.post('/threads/:threadId/read', async (req, res) => {
  const pool = req.app.locals.pool;
  const client = await pool.connect();

  try {
    const { threadId } = req.params;

    const membership = await loadMembership(pool, threadId, req.actor);
    if (!membership) {
      return res.status(403).json({ error: 'You are not a participant in this thread' });
    }

    await client.query('BEGIN');

    await client.query(
      `UPDATE message_thread_participants
          SET last_read_at = CURRENT_TIMESTAMP
        WHERE thread_id = $1 AND participant_kind = $2 AND participant_id = $3`,
      [threadId, req.actor.kind, req.actor.id]
    );

    // Receipts for everything the caller did not write themselves.
    //
    // $2 and $3 are cast explicitly: each is used both as an inserted value and
    // as a comparison operand, and Postgres otherwise deduces a different type
    // from each context ("inconsistent types deduced for parameter $2").
    await client.query(
      `INSERT INTO message_read_receipts (message_id, reader_kind, reader_id)
       SELECT m.id, $2::varchar, $3::uuid
         FROM messages m
        WHERE m.thread_id = $1
          AND m.deleted_at IS NULL
          AND NOT (m.sender_kind = $2::varchar AND m.sender_id = $3::uuid)
       ON CONFLICT (message_id, reader_kind, reader_id) DO NOTHING`,
      [threadId, req.actor.kind, req.actor.id]
    );

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error marking thread read:', error);
    res.status(500).json({ error: 'Failed to mark thread as read' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/messages/messages/:messageId
 * Redacts a message the caller sent: the row stays for the audit trail, the
 * ciphertext is overwritten so the content is unrecoverable.
 */
router.delete('/messages/:messageId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { messageId } = req.params;

    const existing = await pool.query('SELECT * FROM messages WHERE id = $1', [messageId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    const message = existing.rows[0];

    const isAuthor = message.sender_kind === req.actor.kind && message.sender_id === req.actor.id;
    if (!isAuthor && req.actor.role !== 'admin') {
      return res.status(403).json({ error: 'You can only withdraw your own messages' });
    }
    if (message.deleted_at) {
      return res.json({ success: true, alreadyDeleted: true });
    }

    const tombstone = encrypt('[message withdrawn]');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE messages
            SET deleted_at = CURRENT_TIMESTAMP,
                deleted_by_kind = $1,
                deleted_by_id = $2,
                body_ciphertext = $3,
                body_iv = $4,
                body_tag = $5,
                key_version = $6
          WHERE id = $7`,
        [req.actor.kind, req.actor.id, tombstone.ciphertext, tombstone.iv, tombstone.tag, tombstone.keyVersion, messageId]
      );
      // Drop the filings the withdrawal invalidates, then delete only the
      // attachments nothing still depends on. A document already accepted into
      // the chart keeps its bytes — the sender can withdraw their message, not
      // a clinician's record.
      const retained = await unfileMessage(client, messageId);
      await client.query(
        `DELETE FROM message_attachments
          WHERE message_id = $1
            AND NOT (id = ANY($2::uuid[]))`,
        [messageId, retained]
      );
      await client.query('COMMIT');
    } catch (txError) {
      await client.query('ROLLBACK').catch(() => {});
      throw txError;
    } finally {
      client.release();
    }

    await recordAudit(pool, req, {
      actionType: 'delete',
      resourceName: 'Message',
      resourceId: messageId,
      description: 'Withdrew a secure message',
      metadata: { threadId: message.thread_id, byAdmin: !isAuthor },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error withdrawing message:', error);
    res.status(500).json({ error: 'Failed to withdraw message' });
  }
});

// ─────────────────────────────────────────
// Attachments
// ─────────────────────────────────────────

/**
 * GET /api/messages/attachments/:attachmentId
 * Streams the decrypted payload to a thread participant.
 */
router.get('/attachments/:attachmentId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { attachmentId } = req.params;

    const result = await pool.query(
      `SELECT a.*, m.thread_id
         FROM message_attachments a
         JOIN messages m ON m.id = a.message_id
        WHERE a.id = $1`,
      [attachmentId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    const attachment = result.rows[0];

    const membership = await loadMembership(pool, attachment.thread_id, req.actor);
    if (!membership) {
      return res.status(403).json({ error: 'You are not a participant in this thread' });
    }

    let payload;
    try {
      payload = decryptToBuffer({
        ciphertext: attachment.content_ciphertext,
        iv: attachment.content_iv,
        tag: attachment.content_tag,
      });
    } catch {
      return res.status(500).json({ error: 'Attachment could not be decrypted' });
    }

    await recordAudit(pool, req, {
      actionType: 'view',
      resourceName: 'MessageAttachment',
      resourceId: attachmentId,
      description: `Downloaded attachment "${attachment.file_name}"`,
      metadata: { threadId: attachment.thread_id },
    });

    res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
    // Quote-escape the filename so a comma or quote cannot break the header.
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${String(attachment.file_name).replace(/"/g, '')}"`
    );
    res.send(payload);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).json({ error: 'Failed to download attachment' });
  }
});

// ─────────────────────────────────────────
// Participants
// ─────────────────────────────────────────

/**
 * POST /api/messages/threads/:threadId/participants
 * Body: { kind, id }
 */
router.post('/threads/:threadId/participants', requireStaffActor, async (req, res) => {
  const pool = req.app.locals.pool;
  const client = await pool.connect();

  try {
    const { threadId } = req.params;
    const kind = req.body.kind === 'patient' ? 'patient' : 'user';
    const participantId = req.body.id ?? req.body.participantId;

    if (!participantId) {
      return res.status(400).json({ error: 'A participant id is required' });
    }

    const membership = await loadMembership(pool, threadId, req.actor);
    if (!membership) {
      return res.status(403).json({ error: 'You are not a participant in this thread' });
    }
    if (!(await participantExists(pool, kind, participantId))) {
      return res.status(400).json({ error: `Unknown ${kind}: ${participantId}` });
    }

    const threadResult = await pool.query('SELECT * FROM message_threads WHERE id = $1', [threadId]);
    const thread = threadResult.rows[0];
    if (!thread) return res.status(404).json({ error: 'Thread not found' });

    await client.query('BEGIN');

    // A previously-removed participant is reactivated rather than duplicated.
    await client.query(
      `INSERT INTO message_thread_participants (thread_id, participant_kind, participant_id)
       VALUES ($1,$2,$3)
       ON CONFLICT (thread_id, participant_kind, participant_id)
       DO UPDATE SET is_active = true, removed_at = NULL`,
      [threadId, kind, participantId]
    );

    // Adding a patient turns a staff-only thread patient-facing. Everyone in
    // it needs to know that, so it is recorded as a message in the transcript
    // rather than only in the audit log.
    if (kind === 'patient' && thread.thread_type !== 'patient') {
      await client.query(
        `UPDATE message_threads
            SET thread_type = 'patient',
                patient_id = COALESCE(patient_id, $2),
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $1`,
        [threadId, participantId]
      );
    }

    const names = await loadParticipants(pool, threadId);
    const added = names.find((p) => p.kind === kind && String(p.participantId) === String(participantId));
    await insertMessage(client, {
      threadId,
      actor: req.actor,
      messageType: 'system',
      body: `${req.actor.displayName} added ${added?.displayName || 'a participant'} to the conversation.`,
    });

    await client.query('COMMIT');

    await recordAudit(pool, req, {
      actionType: 'update',
      resourceName: 'MessageThreadParticipant',
      resourceId: threadId,
      description: `Added ${kind} ${added?.displayName || participantId} to a message thread`,
      patientId: thread.patient_id,
      metadata: { kind, participantId },
    });

    res.status(201).json({ success: true, participants: await loadParticipants(pool, threadId) });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error adding thread participant:', error);
    res.status(500).json({ error: 'Failed to add participant' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/messages/threads/:threadId/participants/:participantRowId
 */
router.delete('/threads/:threadId/participants/:participantRowId', requireStaffActor, async (req, res) => {
  const pool = req.app.locals.pool;
  const client = await pool.connect();

  try {
    const { threadId, participantRowId } = req.params;

    const membership = await loadMembership(pool, threadId, req.actor);
    if (!membership) {
      return res.status(403).json({ error: 'You are not a participant in this thread' });
    }

    const target = await pool.query(
      'SELECT * FROM message_thread_participants WHERE id = $1 AND thread_id = $2',
      [participantRowId, threadId]
    );
    if (target.rows.length === 0) {
      return res.status(404).json({ error: 'Participant not found in this thread' });
    }
    if (target.rows[0].participant_role === 'owner') {
      return res.status(409).json({ error: 'The thread owner cannot be removed' });
    }

    await client.query('BEGIN');

    await client.query(
      `UPDATE message_thread_participants
          SET is_active = false, removed_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [participantRowId]
    );

    await insertMessage(client, {
      threadId,
      actor: req.actor,
      messageType: 'system',
      body: `${req.actor.displayName} removed a participant from the conversation.`,
    });

    await client.query('COMMIT');

    await recordAudit(pool, req, {
      actionType: 'update',
      resourceName: 'MessageThreadParticipant',
      resourceId: threadId,
      description: 'Removed a participant from a message thread',
      metadata: { participantRowId },
    });

    res.json({ success: true, participants: await loadParticipants(pool, threadId) });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error removing thread participant:', error);
    res.status(500).json({ error: 'Failed to remove participant' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/messages/recipients?q=
 * Addressable staff and portal-enabled patients, for the compose picker.
 * Staff-only: a patient must not be able to enumerate the practice directory.
 */
router.get('/recipients', requireStaffActor, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const q = req.query.q ? `%${req.query.q}%` : '%';
    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);

    const [staff, patients] = await Promise.all([
      pool.query(
        `SELECT id, first_name, last_name, email, role, specialty
           FROM users
          WHERE status = 'active'
            AND role <> 'patient'
            AND id <> $1
            AND (first_name ILIKE $2 OR last_name ILIKE $2 OR email ILIKE $2)
          ORDER BY first_name, last_name
          LIMIT $3`,
        [req.actor.id, q, limit]
      ),
      pool.query(
        `SELECT id, first_name, last_name, email, mrn
           FROM patients
          WHERE portal_enabled = true
            AND (first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1 OR mrn ILIKE $1)
          ORDER BY first_name, last_name
          LIMIT $2`,
        [q, limit]
      ),
    ]);

    res.json({
      staff: staff.rows.map((u) => ({
        kind: 'user',
        id: u.id,
        displayName: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email,
        email: u.email,
        role: u.role,
        specialty: u.specialty,
      })),
      patients: patients.rows.map((p) => ({
        kind: 'patient',
        id: p.id,
        displayName: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email,
        email: p.email,
        mrn: p.mrn,
      })),
    });
  } catch (error) {
    console.error('Error loading message recipients:', error);
    res.status(500).json({ error: 'Failed to load recipients' });
  }
});

/**
 * GET /api/messages/care-team
 * Who the caller may start a conversation with, when the caller is a patient.
 *
 * Deliberately not the staff directory: a patient must not be able to
 * enumerate the practice. The list is derived from the patient's own record —
 * the providers they have actually been seen by — plus the practice's
 * front-desk staff as a general point of contact. A patient with no visit
 * history still gets the receptionists, so the channel is never a dead end.
 */
router.get('/care-team', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const patientId = req.actor.kind === 'patient' ? req.actor.id : req.query.patientId;

    if (!patientId) {
      return res.status(400).json({ error: 'A patient id is required' });
    }
    // Staff may look up any patient's care team; a patient only ever their own.
    if (req.actor.kind === 'patient' && String(patientId) !== String(req.actor.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      `SELECT DISTINCT u.id, u.first_name, u.last_name, u.email, u.role, u.specialty
         FROM users u
        WHERE u.status = 'active'
          AND (
            u.id IN (SELECT provider_id FROM appointments WHERE patient_id = $1 AND provider_id IS NOT NULL)
            OR u.role IN ('receptionist', 'admin')
          )
        ORDER BY u.first_name, u.last_name
        LIMIT 50`,
      [patientId]
    );

    res.json(
      result.rows.map((u) => ({
        kind: 'user',
        id: u.id,
        displayName: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email,
        email: u.email,
        role: u.role,
        specialty: u.specialty,
      }))
    );
  } catch (error) {
    console.error('Error loading care team:', error);
    res.status(500).json({ error: 'Failed to load your care team' });
  }
});

module.exports = router;
