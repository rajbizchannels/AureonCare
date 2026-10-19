import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline, countByKind } from '../src/lib/chart.ts';

const empty = { visits: [], diagnoses: [], medications: [], labs: [], documents: [] };

const sources = {
  visits: [
    { id: 'v1', start_time: '2026-03-01T09:00:00Z', reason: 'Follow-up', status: 'completed',
      provider: { id: 'u1', first_name: 'Ada', last_name: 'Okonkwo' } },
  ],
  diagnoses: [
    { id: 1, diagnosis_name: 'Hypertension', diagnosis_code: 'I10', diagnosed_date: '2026-05-01', status: 'Active', severity: null },
  ],
  medications: [
    { id: 'm1', medication_name: 'Lisinopril', dosage: '10 mg', frequency: 'Once daily',
      prescribed_date: '2026-05-02', status: 'active' },
    // A prescription with no date at all — real, because the column is nullable.
    { id: 'm2', medication_name: 'Legacy import', dosage: null, frequency: null,
      prescribed_date: null, status: 'active' },
  ],
  labs: [
    { id: 'l1', order_number: 'LAB-9', order_type: 'lab_test', status: 'completed', created_at: '2026-04-10T00:00:00Z' },
  ],
  documents: [
    { id: 'd1', record_type: 'Patient Upload', record_date: '2026-06-01', title: 'rash.jpg',
      description: null, review_status: 'pending_review' },
  ],
};

test('merges every stream into one list', () => {
  const rows = buildTimeline(sources);
  assert.equal(rows.length, 6);
  assert.deepEqual(
    [...new Set(rows.map((r) => r.kind))].sort(),
    ['diagnosis', 'document', 'lab', 'medication', 'visit']
  );
});

test('orders newest first across streams', () => {
  const dated = buildTimeline(sources).filter((r) => r.at !== -Infinity);
  const titles = dated.map((r) => r.title);
  assert.deepEqual(titles, ['rash.jpg', 'Lisinopril', 'Hypertension', 'LAB-9', 'Follow-up']);
});

test('an undated row sorts last, not to the epoch', () => {
  // new Date(null).getTime() is 0, which would file it as the oldest event in
  // the chart and quietly rewrite the patient's history.
  const rows = buildTimeline(sources);
  assert.equal(rows[rows.length - 1].title, 'Legacy import');
  assert.equal(rows[rows.length - 1].at, -Infinity);
});

test('filtering keeps one kind and preserves order', () => {
  const meds = buildTimeline(sources, 'medication');
  assert.equal(meds.length, 2);
  assert.equal(meds[0].title, 'Lisinopril');
  assert.equal(meds[1].title, 'Legacy import');
});

test('carries the review flag through so the chart can mark it', () => {
  const doc = buildTimeline(sources, 'document')[0];
  assert.equal(doc.flag, 'pending_review');
});

test('falls back rather than rendering an empty title', () => {
  const rows = buildTimeline({
    ...empty,
    visits: [{ id: 'v', start_time: '2026-01-01T00:00:00Z', reason: null, appointment_type: null, status: null, provider: null }],
    labs: [{ id: 'l', order_number: null, order_type: null, status: null, created_at: '2026-01-01T00:00:00Z' }],
  });
  assert.equal(rows.find((r) => r.kind === 'visit').title, 'Appointment');
  assert.equal(rows.find((r) => r.kind === 'visit').detail, 'Care team');
  assert.equal(rows.find((r) => r.kind === 'lab').title, 'Lab order');
});

test('handles an empty chart', () => {
  assert.deepEqual(buildTimeline(empty), []);
});

test('counts are per stream, not per filtered view', () => {
  assert.deepEqual(countByKind(sources), {
    visit: 1, diagnosis: 1, medication: 2, lab: 1, document: 1,
  });
});
