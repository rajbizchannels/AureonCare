import type { Appointment, Diagnosis, LabOrder, MedicalRecord, Prescription } from './api';

/**
 * Merging the clinical streams into one chronology.
 *
 * Kept free of React and native imports so the ordering rules — which are the
 * part that can silently be wrong — can be unit tested.
 */

export type ChartKind = 'visit' | 'diagnosis' | 'medication' | 'lab' | 'document';

export interface ChartEntry {
  id: string;
  kind: ChartKind;
  /** Epoch ms, or -Infinity when the row carries no usable date. */
  at: number;
  title: string;
  detail: string;
  status?: string | null;
  flag?: 'pending_review';
}

export interface ChartSources {
  visits: Appointment[];
  diagnoses: Diagnosis[];
  medications: Prescription[];
  labs: LabOrder[];
  documents: MedicalRecord[];
}

const name = (first?: string | null, last?: string | null, fallback = 'Care team'): string =>
  [first, last].filter(Boolean).join(' ') || fallback;

/**
 * A missing or unparseable date becomes -Infinity rather than 0. `new
 * Date(null).getTime()` is 0 — the epoch — which would file an undated row as
 * the oldest event in the chart and quietly rewrite the patient's history.
 */
const instant = (value: string | null | undefined): number => {
  if (!value) return -Infinity;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) && ms > 0 ? ms : -Infinity;
};

export const buildTimeline = (
  sources: ChartSources,
  filter: ChartKind | 'all' = 'all'
): ChartEntry[] => {
  const entries: ChartEntry[] = [
    ...sources.visits.map((v) => ({
      id: `visit-${v.id}`,
      kind: 'visit' as const,
      at: instant(v.start_time),
      title: v.reason ?? v.appointment_type ?? 'Appointment',
      detail: name(v.provider?.first_name, v.provider?.last_name),
      status: v.status,
    })),
    ...sources.diagnoses.map((d) => ({
      id: `dx-${d.id}`,
      kind: 'diagnosis' as const,
      at: instant(d.diagnosed_date),
      title: d.diagnosis_name,
      detail: [d.diagnosis_code, d.severity].filter(Boolean).join(' · '),
      status: d.status,
    })),
    ...sources.medications.map((m) => ({
      id: `rx-${m.id}`,
      kind: 'medication' as const,
      at: instant(m.prescribed_date),
      title: m.medication_name ?? m.brand_name ?? m.generic_name ?? 'Medication',
      detail: [m.dosage, m.frequency].filter(Boolean).join(' · '),
      status: m.status,
    })),
    ...sources.labs.map((l) => ({
      id: `lab-${l.id}`,
      kind: 'lab' as const,
      at: instant(l.created_at),
      title: l.order_number ?? 'Lab order',
      detail: l.order_type ?? '',
      status: l.status,
    })),
    ...sources.documents.map((r) => ({
      id: `doc-${r.id}`,
      kind: 'document' as const,
      at: instant(r.record_date),
      title: r.title ?? r.record_type,
      detail: r.description ?? '',
      status: null,
      flag: r.review_status === 'pending_review' ? ('pending_review' as const) : undefined,
    })),
  ];

  return entries
    .filter((e) => filter === 'all' || e.kind === filter)
    // Newest first; undated rows fall to the end rather than the top.
    .sort((a, b) => b.at - a.at);
};

export const countByKind = (sources: ChartSources): Record<ChartKind, number> => ({
  visit: sources.visits.length,
  diagnosis: sources.diagnoses.length,
  medication: sources.medications.length,
  lab: sources.labs.length,
  document: sources.documents.length,
});
