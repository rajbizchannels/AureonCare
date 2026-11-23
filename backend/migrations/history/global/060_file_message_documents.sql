-- Migration 060: File documents sent in secure messages
--
-- A document attached to a message is clinical content, not chat ephemera, so
-- it has to reach the chart. Where it lands depends on who sent it and what
-- they meant by it:
--
--   patient → practice      Patient Records, marked pending review
--   staff → patient, "share"    Patient Records, visible to the patient
--   staff → patient, "complete" Forms Requested, as an action item
--
-- The bytes are NOT copied. They stay in message_attachments, where they are
-- already AES-256-GCM encrypted, and these tables reference them. Copying to
-- /uploads (the path the older upload routes use) would put decrypted PHI on
-- a disk the container does not durably own, and leave two copies to keep in
-- step when a message is withdrawn.

-- ─────────────────────────────────────────
-- PATIENT RECORDS
-- ─────────────────────────────────────────
ALTER TABLE medical_records
  -- 'manual' for anything created through the existing upload routes.
  ADD COLUMN IF NOT EXISTS source VARCHAR(30) DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,

  -- Only set for patient-supplied documents. A record the practice authored is
  -- verified by definition; one the patient uploaded is not, and must never be
  -- presented to a clinician as though it were clinic-authored.
  ADD COLUMN IF NOT EXISTS review_status VARCHAR(20)
    CHECK (review_status IS NULL OR review_status IN ('pending_review', 'accepted', 'rejected')),
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS reviewer_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_medical_records_source_message ON medical_records(source_message_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_review_status
  ON medical_records(review_status) WHERE review_status = 'pending_review';

-- ─────────────────────────────────────────
-- FORMS REQUESTED
-- ─────────────────────────────────────────
-- form_submissions was built around form_templates: template_id drives the
-- fields rendered in the portal and form_data holds the answers. A document
-- sent for signature has neither. Rather than invent a synthetic template per
-- document, a submission may now stand on a document instead — template_id is
-- already nullable, so the row shape does not change, only what fills it.
ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS source VARCHAR(30) DEFAULT 'template'
    CHECK (source IN ('template', 'secure_message')),
  ADD COLUMN IF NOT EXISTS source_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_attachment_id UUID REFERENCES message_attachments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_name VARCHAR(255),
  -- What the patient has to do with it. Acknowledgement is the default because
  -- it is the weaker claim: asserting a signature was captured when it was not
  -- is a far worse failure than asking for one that was not needed.
  ADD COLUMN IF NOT EXISTS document_action VARCHAR(20) DEFAULT 'acknowledge'
    CHECK (document_action IS NULL OR document_action IN ('acknowledge', 'sign'));

CREATE INDEX IF NOT EXISTS idx_form_submissions_source_message ON form_submissions(source_message_id);

-- A submission must rest on something the portal can actually render: either a
-- template, or a document. Enforced here rather than in the routes so a future
-- caller cannot create a row that renders as an empty card.
ALTER TABLE form_submissions
  DROP CONSTRAINT IF EXISTS form_submissions_has_subject;
ALTER TABLE form_submissions
  ADD CONSTRAINT form_submissions_has_subject
  CHECK (template_id IS NOT NULL OR document_attachment_id IS NOT NULL);
