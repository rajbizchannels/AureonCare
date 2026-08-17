-- Migration 059: Secure messaging
--
-- Threaded messaging between staff members and between a practice and its
-- patients. Message bodies and attachment payloads are stored encrypted with
-- AES-256-GCM (see backend/utils/messageCrypto.js) so a database dump alone
-- never yields readable PHI.
--
-- Participants are polymorphic: a thread can hold `users` rows (staff) and
-- `patients` rows side by side. The two live in different tables and
-- authenticate through different mechanisms — staff by JWT, patients by portal
-- session — so every participant reference carries a `kind` alongside its id
-- rather than a single foreign key. That rules out a DB-level FK on the id, so
-- the routes validate existence on insert and the read queries LEFT JOIN both
-- tables and coalesce.

-- ─────────────────────────────────────────
-- THREADS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  subject VARCHAR(255) NOT NULL,

  -- 'care_team' — staff only, may still be *about* a patient
  -- 'patient'   — the patient is a participant and can read every message
  thread_type VARCHAR(20) NOT NULL DEFAULT 'care_team'
    CHECK (thread_type IN ('care_team', 'patient')),

  -- The patient this thread concerns. Set for both thread types: a care-team
  -- thread about a patient is still chart-relevant and must be findable.
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,

  priority VARCHAR(20) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed')),

  created_by_kind VARCHAR(10) NOT NULL CHECK (created_by_kind IN ('user', 'patient')),
  created_by_id UUID NOT NULL,

  -- Denormalised so the thread list can sort without touching `messages`.
  -- No plaintext preview is cached here — that would defeat body encryption.
  last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  message_count INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_message_threads_patient      ON message_threads(patient_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_last_message ON message_threads(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_threads_status       ON message_threads(status);
CREATE INDEX IF NOT EXISTS idx_message_threads_type         ON message_threads(thread_type);

-- ─────────────────────────────────────────
-- PARTICIPANTS
-- ─────────────────────────────────────────
-- Membership is the authorisation boundary: every read and write checks for an
-- active row here. Removal is a soft delete so an audit still shows who could
-- see the thread at the time a message was sent.
CREATE TABLE IF NOT EXISTS message_thread_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,

  participant_kind VARCHAR(10) NOT NULL CHECK (participant_kind IN ('user', 'patient')),
  participant_id UUID NOT NULL,

  -- 'owner' may close the thread and manage participants; 'member' may not.
  participant_role VARCHAR(20) NOT NULL DEFAULT 'member'
    CHECK (participant_role IN ('owner', 'member')),

  last_read_at TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT true,

  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  removed_at TIMESTAMP,

  UNIQUE (thread_id, participant_kind, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_thread_participants_thread ON message_thread_participants(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_participants_lookup
  ON message_thread_participants(participant_kind, participant_id, is_active);

-- ─────────────────────────────────────────
-- MESSAGES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,

  sender_kind VARCHAR(10) NOT NULL CHECK (sender_kind IN ('user', 'patient', 'system')),
  sender_id UUID,  -- NULL for 'system' notices ("Dr Adeyemi joined the thread")

  message_type VARCHAR(20) NOT NULL DEFAULT 'message'
    CHECK (message_type IN ('message', 'system')),

  -- AES-256-GCM. `body_iv` is a fresh 12-byte nonce per message and `body_tag`
  -- the 16-byte auth tag; both are base64. `key_version` lets a future key
  -- rotation re-encrypt lazily rather than in one migration.
  body_ciphertext TEXT NOT NULL,
  body_iv         VARCHAR(32) NOT NULL,
  body_tag        VARCHAR(32) NOT NULL,
  key_version     SMALLINT NOT NULL DEFAULT 1,

  sent_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  edited_at  TIMESTAMP,

  -- Redaction, not erasure: the row survives so the thread's audit trail stays
  -- intact, but the ciphertext is overwritten and the body reads as withdrawn.
  deleted_at      TIMESTAMP,
  deleted_by_kind VARCHAR(10) CHECK (deleted_by_kind IN ('user', 'patient')),
  deleted_by_id   UUID
);

CREATE INDEX IF NOT EXISTS idx_messages_thread  ON messages(thread_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender  ON messages(sender_kind, sender_id);

-- ─────────────────────────────────────────
-- ATTACHMENTS
-- ─────────────────────────────────────────
-- Payloads live in the row, encrypted, rather than on disk: the deployment
-- targets (Vercel, containers) have no durable local filesystem, and an
-- encrypted blob in Postgres inherits the database's backup and access story.
CREATE TABLE IF NOT EXISTS message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,

  file_name  VARCHAR(255) NOT NULL,
  mime_type  VARCHAR(127),
  size_bytes BIGINT NOT NULL,

  content_ciphertext TEXT NOT NULL,
  content_iv         VARCHAR(32) NOT NULL,
  content_tag        VARCHAR(32) NOT NULL,
  key_version        SMALLINT NOT NULL DEFAULT 1,

  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_message_attachments_message ON message_attachments(message_id);

-- ─────────────────────────────────────────
-- READ RECEIPTS
-- ─────────────────────────────────────────
-- Per-message receipts, separate from participants.last_read_at. The timestamp
-- on the participant row drives unread counts cheaply; these rows answer "who
-- has actually seen this message", which a clinician needs before assuming a
-- result was acknowledged.
CREATE TABLE IF NOT EXISTS message_read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,

  reader_kind VARCHAR(10) NOT NULL CHECK (reader_kind IN ('user', 'patient')),
  reader_id   UUID NOT NULL,
  read_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (message_id, reader_kind, reader_id)
);

CREATE INDEX IF NOT EXISTS idx_message_read_receipts_message ON message_read_receipts(message_id);

-- ─────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────
-- Keeps message_threads.last_message_at / message_count in step with inserts so
-- the list endpoint never has to aggregate over `messages`.
CREATE OR REPLACE FUNCTION touch_message_thread()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE message_threads
     SET last_message_at = NEW.sent_at,
         message_count   = message_count + 1,
         updated_at      = CURRENT_TIMESTAMP
   WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_message_thread ON messages;
CREATE TRIGGER trg_touch_message_thread
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION touch_message_thread();
