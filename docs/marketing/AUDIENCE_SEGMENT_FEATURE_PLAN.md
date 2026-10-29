# Audience Segments → Features, Rebranding and Missing Packs

**Source:** the "Audience segments for digital marketing" chat (29 Oct 2026), where five segments were found from the codebase and then validated against competitor product titles, headlines and URL paths. This document turns that research into a product backlog and compares it with what AureonCare ships today.

**Status key:** ✅ Exists · 🟡 Partial · ❌ Missing

---

## 1. The five approved segments

| # | Approved segment name | Region | Main competitors that target it by name |
|---|---|---|---|
| S1 | Owners of cash-pay physiotherapy and rehab clinics | US, UK, EU | WebPT (`/products/cash-based-practices`), Jane (`/physicaltherapy`), ChiroTouch Core, ICON, OptiMantra, Pabau |
| S2 | Billing managers and medical billers at independent US outpatient practices | US | PracticeSuite and CollaborateMD ("for Practices & Billers"), RCM Matter, BillingParadise Denial Manager, athenahealth |
| S3 | Mental health group practices (therapists and psychiatrists) running hybrid in-person and telehealth sessions | US, UK | OmniMD, ICANotes, Sessions Health, Carepatron, TheraNest, SimplePractice |
| S4 | Clinic groups with 3 or more locations moving onto one system | US, UK, EU, India | CAREpitome, Zanda, DSN, AdvancedMD (`/group-practice/multi-site-management`), Exist, Artis |
| S5 | Hospital outreach teams and NGO or CSR program managers running health camps in India | India | Gramosoft, Ezovion, Vaidhya.ai, NanoHealth, Medical365, Healium |

---

## 2. Feature list per segment, compared with AureonCare

### S1 — Cash-pay physio and rehab clinics

| Feature buyers expect | Competitors leading on it | AureonCare today | Evidence in repo |
|---|---|---|---|
| Treatment packages / courses of sessions with sessions-remaining tracking | Jane, OptiMantra, Pabau | ✅ | `offering_packages`, `patient_offering_enrollments.remaining_uses`, `appointments.package_enrollment_id` (migration 018) |
| Promotions and discount codes | Pabau, Fresha | ✅ | `offering_promotions`, `billing_coupons` |
| Memberships with recurring card billing (autopay) | ChiroTouch Core, OptiMantra, Pabau | 🟡 | `package_type` allows `membership`/`subscription`, but payments are one-off Stripe charges; no saved card or renewal |
| Card on file, booking deposits and no-show / late-cancel fees | Jane, Fresha, Pabau | ❌ | "Patient Deposits" ledger account only (migration 053); no booking-time capture |
| Superbills (patient claims back from insurer) | WebPT, Jane, OptiMantra | ❌ | none |
| Home exercise programs sent to the patient portal and mobile app | Physitrack, WebPT, Jane | ❌ | only an appointment type "Home Exercise Review" in the physio pack |
| Scored outcome measures (ODI, NDI, LEFS, PSFS) with progress charts | WebPT, Physitrack | 🟡 | form builder exists; physio pack ships one assessment form and no scored measures |
| Gift vouchers and loyalty | Fresha, Pabau, PatientNow | ❌ | none |
| Reactivation / review campaigns | Jane, Pabau | 🟡 | CRM campaigns and `offering_reviews` exist; no automated "lapsed patient" or review-request trigger |
| Online self-booking, waitlist auto-fill, WhatsApp reminders | All | ✅ | `waitlist.js`, `reminderService.js`, `whatsappService.js` |

### S2 — Billers at independent US practices

| Feature buyers expect | Competitors leading on it | AureonCare today | Evidence in repo |
|---|---|---|---|
| Claims with EDI 837 and ERA 835 posting | CollaborateMD, PracticeSuite | ✅ | `claims.js`, `edi.js`, `utils/edi835Parser`, `payment-postings.js` |
| Prior authorizations queue | athenahealth, BillrMD | ✅ | `preapprovals.js` |
| Denial queue with reason codes and appeal deadlines | BillingParadise, RXNT | ✅ | `denials.js` (`/alerts/deadline`) |
| Denial analysis, claim rejections, payer performance reports | athenahealth | ✅ | `reports.js` `/insurance/*` |
| Real-time eligibility (270/271) | All billing-first vendors | 🟡 | `vendorIntegrations.verifyEligibility` is a placeholder |
| Claim scrubber (pre-submission edits) | PracticeSuite, CollaborateMD | ❌ | none |
| Appeal letter templates generated from a denial | RXNT, Kareo | ❌ | none |
| Patient statements and patient-balance collections | Tebra, AdvancedMD | ❌ | none |
| Biller KPIs: clean-claim rate, first-pass rate, days in A/R, A/R aging by payer | athenahealth ("98.4% clean claim rate") | 🟡 | aging buckets in `/financial/outstanding-payments`; no CCR / first-pass / days-in-A/R |
| Live clearinghouse connection | CollaborateMD (built-in) | 🟡 | Optum adapter stub in `services/vendorIntegrations` |

### S3 — Mental health group practices (hybrid)

| Feature buyers expect | Competitors leading on it | AureonCare today | Evidence in repo |
|---|---|---|---|
| One-click telehealth, no download, link attached to booking | Sessions Health, ICANotes | ✅ | `telehealth.js`, Zoom / Teams / Meet providers |
| Intake and consent before the session, secure messaging | All | ✅ | intake forms with e-signature (migration 039), `messages.js` |
| PHQ-9 and GAD-7 screening | OmniMD, ICANotes | 🟡 | forms exist in `behavioral_health.v1.json`; no auto-score, severity band or trend chart |
| Therapy note formats (DAP, BIRP, GIRP, SOAP) | ICANotes, Therasoft | 🟡 | SOAP only (diagnosis form) |
| Treatment plans with goals, objectives and review dates | ICANotes, TheraNest | ❌ | none |
| Separate psychotherapy notes with stricter access (HIPAA 164.501) | SimplePractice, TherapyNotes | ❌ | none |
| Recurring patient appointment series (weekly therapy) | All | ❌ | recurrence exists only for provider time-off blocks (`scheduling.js`) |
| Group therapy (one session, many clients, attendance per client) | TheraNest, PracticeSuite | 🟡 | "Group Session" appointment type exists, but an appointment holds one patient |
| EPCS (controlled-drug e-prescribing) | OmniMD, PracticeSuite | 🟡 | DEA schedule flags on medications; no EPCS-certified signing |
| 42 CFR Part 2 consent for substance-use records | US SUD providers | ❌ | none |

### S4 — Clinic groups with 3+ locations

| Feature buyers expect | Competitors leading on it | AureonCare today | Evidence in repo |
|---|---|---|---|
| Locations (clinic, camp venue, mobile unit, partner premises) | All | ✅ | `locations.js`, tenant migration 004 |
| Location on appointments, provider availability, hours, stock | AdvancedMD | ✅ | tenant migration 005 |
| Location on patients (home site), invoices, claims, payments | AdvancedMD, Zanda | ❌ | not on those tables → no per-site revenue |
| Site-scoped roles (user sees only sites X and Y) | CAREpitome, Zanda | ❌ | roles are tenant-wide |
| Consolidated dashboard + every report filterable by site | AdvancedMD, Meddbase | ❌ | `reports.js` has no location filter |
| Inter-site stock transfers | Pabau | 🟡 | `transfer` movement type exists, no from/to site pairing |
| Audit trail, 2FA, backup/restore, FHIR R4 | CAREpitome | ✅ | `phiAudit.js`, `userMfa.js`, `backup.js`, `fhir.js` |
| Enterprise SSO (SAML / OIDC) | Enterprise buyers | 🟡 | Google / Microsoft social sign-in only |

### S5 — Health camps in India

| Feature buyers expect | Competitors leading on it | AureonCare today | Evidence in repo |
|---|---|---|---|
| Camp planning with clinic-roster clash checks | — (AureonCare advantage) | ✅ | `services/camps.js` |
| Gate registration with queue tokens, station board | Gramosoft, Vaidhya | ✅ | `camp_registrations.token_no`, `camp_stations` |
| Consent recorded before clinical station | NanoHealth | ✅ | `camp_registrations.consent_given_at` |
| Anonymised sponsor report, funding source (CSR / NGO / government) | Healium | ✅ | `camp-reports.js`, `camps.funding_source` |
| Station outcome: referred / follow-up | Vaidhya | ✅ | `camp_station_visits.outcome` |
| Organisation → Programme → Camp hierarchy with per-programme reports | Gramosoft | ❌ | camps are flat |
| Offline registration with later sync | Gramosoft, Ezovion, Vaidhya | ❌ | none |
| OTP-based digital consent (SMS / WhatsApp) | NanoHealth | ❌ | consent is a staff-recorded form |
| Read-only sponsor portal with live counts | Healium | ❌ | sponsor report is an export only |
| ABHA (Ayushman Bharat Health Account) capture | Indian HMS vendors | ❌ | none |
| Referral closure (camp referral → clinic appointment → outcome) | Vaidhya | 🟡 | outcome recorded; no link to the follow-up appointment |
| Hindi and regional languages at the registration desk | Vaidhya | ❌ | web app has 5 languages (EN, ES, FR, DE, AR) |

### Cross-cutting gap found during the review

- **Search:** `backend/routes/search.js` doesn't index camps or locations, so neither S4 nor S5 users can find them from global search.

---

## 3. Rebranding of existing features

Use the competitors' own wording so landing pages and ads match what buyers search for. These are label, menu, help-text and landing-page changes; module IDs stay the same.

| Current name in app | New name | Segment | Why |
|---|---|---|---|
| Healthcare Offerings / Offering Management | **Services, Packages & Memberships** | S1 | Jane and OptiMantra sell "packages and memberships" |
| Patient package enrollment | **Treatment Plans & Session Packs** | S1 | matches cash-pay physio wording |
| CRM + Campaigns | **Patient Growth** (CRM & Campaigns) | S1 | outcome-based name |
| RCM | **Revenue Cycle — for Practices & Billers** | S2 | exact phrase used by two competitors |
| Pre-approvals | **Prior Authorizations** | S2 | the US search term ("prior authorization software") |
| Denials | **Denial Manager** | S2 | BillingParadise / RXNT wording |
| Payment Postings / EDI | **ERA & Payment Posting** | S2 | biller vocabulary |
| Behavioral Health pack | **Mental Health Group Practice** pack | S3 | "for Therapists & Psychiatrists" wording |
| Telehealth | **Hybrid Care & Teletherapy** (subtitle "one click, no download") | S3 | Sessions Health message |
| Locations | **Multi-Location Management** | S4 | CAREpitome, Zanda, AdvancedMD |
| Enterprise plan | **Enterprise — for clinic groups with 3+ locations** | S4 | "third site" is where central control becomes essential |
| Medical Camps | **Health Camp Management** (keep "medical camp" and "screening camp" in help and SEO text) | S5 | all three phrases are used by competitors |
| Camp sponsor report | **CSR Impact Report** | S5 | Healium, Gramosoft |

---

## 4. Missing specialty packs

39 pack files covering 36 specialties exist today. Packs below are missing and map directly to a validated segment.

| New pack | Segment | Competitor evidence | Contents to ship |
|---|---|---|---|
| `chiropractic` | S1 | ChiroTouch Core, ICON ("for Cash Practice") | adjustment visit types, SOAP + spinal exam form, care-plan packages, x-ray consumables |
| `aesthetics_medspa` | S1 | Pabau, Zenoti, PatientNow, AestheticsPro | injectables, laser, peels; before/after photo consent; membership templates; product retail stock |
| `occupational_therapy` | S1 | Jane | assessment, ADL goals, hand therapy, splint inventory |
| `speech_language_therapy` | S1 | Jane | assessment, session packs, paediatric intake |
| `osteopathy` | S1 (UK/EU) | Jane, Pabau (UK) | assessment, treatment, packages |
| `counselling_psychology` | S3 | SimplePractice, ICANotes, Simply.Coach | non-prescriber therapy: DAP/BIRP notes, treatment plan, PHQ-9/GAD-7/CORE-10, couples & family |
| `addiction_medicine` | S3 | US SUD vendors | 42 CFR Part 2 consent, AUDIT / DAST forms, MAT visits |
| `child_adolescent_mental_health` | S3 | ICANotes | parent-consent intake, SDQ / Vanderbilt forms |
| Camp templates: `ncd_screening_camp`, `eye_camp`, `dental_camp`, `maternal_child_camp` | S5 | Gramosoft, NanoHealth, Vaidhya | station lists, screening forms (BP, glucose, BMI, visual acuity, oral cancer), referral rules |

**Upgrades to existing packs (new version, never overwrites clinic edits — the wizard already supports this):**
- `physiotherapy.v2`: ODI / NDI / LEFS / PSFS forms, session-pack and membership templates, superbill settings.
- `behavioral_health.v2` and `psychiatry.v2`: scored PHQ-9 / GAD-7, DAP and BIRP note templates, treatment plan, C-SSRS risk form, recurring weekly therapy appointment type.
- `dermatology.v2`: optional cosmetic services section that points to `aesthetics_medspa`.

---

## 5. Implementation plan

Order is by segment priority from the research (S3, S2, S1, then S4; S5 runs as a separate India track). Every new table uses a **UUID primary key** (`id uuid PRIMARY KEY DEFAULT gen_random_uuid()`) and is created under `backend/migrations/tenant/` so new tenants get it.

### Definition of done for every item (applies to all phases)

- **Translations:** every new label in all 5 languages in `frontend/src/config/translations.js` (en, es, fr, de, ar), including the rebranded names.
- **Help content:** a section in `components/help/HelpDrawer.js` and the AI assistant knowledge in `EnhancedAIAssistant.js`; update `USER_MANUAL.md`.
- **Auditing:** every create / update / delete and every PHI read goes through `services/phiAudit.js`.
- **Notifications:** user-facing events go through `services/notificationService.js` (in-app, email, WhatsApp per `notificationPreferences`).
- **Searchability:** new entities added to `backend/routes/search.js` with clickable results.
- **Plan gate:** entries in `frontend/src/config/planFeatures.js` and `services/entitlements.js`.
- **Permissions:** new permission keys seeded for the built-in roles.

### Phase 0 — Rebranding and SEO (1 week, no schema changes)

- Rename labels in `modules.js`, `navigation.js` and all 5 language blocks of `translations.js` per section 3.
- Update help drawer titles and the user manual to the new names.
- Rename the behavioral health pack label (keep code `behavioral_health` so installed packs still match).
- Create landing-page copy per segment in `docs/marketing/` using competitor phrases ("for Practices & Billers", "Multi-Location", "Health Camp Management").
- Add camps and locations to global search (cross-cutting gap).

### Phase 1 — S3 Mental health group practices (3–4 weeks)

- **Recurring appointment series**
  - Table `appointment_series` (`id uuid`, `patient_id`, `provider_id`, `appointment_type_id`, `location_id`, `rrule text`, `starts_on`, `ends_on`, `status`, audit columns); add `series_id uuid` to `appointments`.
  - API: `POST /api/appointments/series`, edit "this / this and following / all", cancel series.
  - Create occurrences 12 weeks ahead with a nightly job; flag clashes instead of double-booking.
  - Notify the patient once for the series; normal reminders per occurrence.
- **Group sessions**
  - Table `appointment_participants` (`id uuid`, `appointment_id`, `patient_id`, `attendance` enum, `note_id`); appointment types get `max_participants`.
  - Telehealth link shared to all participants; separate note per participant.
- **Scored measures (measurement-based care)**
  - Add a `scoring` block to form templates (sum, bands, critical items such as PHQ-9 item 9).
  - Table `measure_results` (`id uuid`, `patient_id`, `form_submission_id`, `measure_code`, `score`, `band`, `taken_at`).
  - Trend chart on the patient chart; notify the provider when a critical item is answered positively.
- **Note templates and treatment plans**
  - DAP, BIRP, GIRP templates in the form library.
  - Tables `treatment_plans` and `treatment_plan_goals` (UUID keys; goal, objective, target date, status, review date); reminders before review dates.
- **Psychotherapy notes**
  - Table `psychotherapy_notes` kept apart from the medical record; readable only by the author plus a new `psychotherapy_notes.read` permission; excluded from FHIR export and portal; every read audited.
- **Packs:** ship `counselling_psychology`, `child_adolescent_mental_health`, `behavioral_health.v2`, `psychiatry.v2`.
- **EPCS:** assess a certified e-prescribing partner (e.g. DoseSpot or Surescripts-connected vendor); until then, do not advertise controlled-drug prescribing to psychiatrists.

### Phase 2 — S2 Billers (4–5 weeks)

- **Claim scrubber**
  - Tables `claim_scrub_rules` (`id uuid`, `payer_id` nullable, `rule_type`, `config jsonb`, `severity`, `active`) and `claim_scrub_results` (`id uuid`, `claim_id`, `rule_id`, `message`, `severity`, `resolved_at`).
  - Built-in rules: missing diagnosis pointer, missing modifier, invalid NPI / taxonomy, timely-filing window, duplicate claim, diagnosis–procedure mismatch.
  - Run on save and before EDI 837 export; block on errors, warn on warnings.
- **Eligibility 270/271:** finish the vendor adapter; table `eligibility_checks` (`id uuid`, `patient_id`, `payer_id`, `request`, `response jsonb`, `status`, `checked_at`); auto-check 48 hours before appointments; notify front desk on inactive coverage.
- **Appeal letters:** template table `appeal_templates` (UUID key, by denial reason code); "Generate appeal" on a denial produces a PDF and logs the appeal date.
- **Patient statements:** table `patient_statements` (`id uuid`, `patient_id`, `period`, `balance`, `sent_via`, `sent_at`); monthly run; email / WhatsApp / portal with Stripe pay link.
- **Biller KPI dashboard:** clean-claim rate, first-pass resolution, days in A/R, A/R aging by payer, denial rate by reason; new `/financial/kpis` report.
- **Biller workspace:** a "Billing Workbench" role preset with the RCM permissions only.

### Phase 3 — S1 Cash-pay physio and rehab (4 weeks)

- **Saved cards and memberships**
  - Stripe Customer + SetupIntent to save a card; table `patient_payment_methods` (`id uuid`, `patient_id`, `stripe_payment_method_id`, `brand`, `last4`, `is_default`).
  - Table `memberships` (`id uuid`, `patient_id`, `package_id`, `stripe_subscription_id`, `status`, `renews_on`, `sessions_per_cycle`); Stripe webhook updates status and posts to the ledger (auto_payment entry type exists).
  - Notify patient before renewal and on failed payment.
- **Deposits and no-show fees:** booking-time deposit per appointment type (`deposit_amount`, `no_show_fee`), captured to the "Patient Deposits" liability account; fee charged on no-show with staff confirmation.
- **Superbills:** PDF from an invoice with CPT / ICD-10 codes, NPI, tax ID and payment proof; downloadable in the patient portal.
- **Home exercise programs:** tables `exercises` (UUID key, video / image, instructions) and `exercise_programs` + `exercise_program_items`; assigned from the chart, shown in portal and mobile app, adherence ticks recorded.
- **Outcome measures:** ODI, NDI, LEFS, PSFS using the Phase 1 scoring engine.
- **Gift vouchers:** table `gift_vouchers` (`id uuid`, `code`, `amount`, `balance`, `purchaser`, `expires_on`); redeem at invoice.
- **Automated campaigns:** "lapsed patient" (no visit in N days) and "post-course review request" triggers in campaigns.
- **Packs:** `chiropractic`, `aesthetics_medspa`, `occupational_therapy`, `speech_language_therapy`, `osteopathy`, `physiotherapy.v2`.

### Phase 4 — S4 Clinic groups with 3+ locations (3–4 weeks)

- **Location everywhere it drives money:** add `location_id uuid` to `patients` (home site), `billing_invoices`, `claims`, `payments`, `billing_payments`, `medical_records`; backfill to the primary site; add to `REFERENCING_TABLES` in `locations.js`.
- **Site-scoped access:** table `user_location_access` (`id uuid`, `user_id`, `location_id`, `role_id` nullable); middleware adds a site filter to list queries; "all sites" for group admins. Audit every change.
- **Consolidated reporting:** `locationId` filter on every `reports.js` endpoint, plus a group dashboard comparing sites (revenue, utilisation, no-shows, denials).
- **Inter-site stock transfer:** transfer creates paired out / in movements; table `stock_transfers` (`id uuid`, `from_location_id`, `to_location_id`, `status`, `requested_by`, `received_by`); notify the receiving site.
- **Enterprise SSO:** SAML 2.0 / OIDC per tenant, Enterprise plan only.

### Phase 5 — S5 India health camps (4–5 weeks, separate track)

- **Programme hierarchy:** table `camp_programmes` (`id uuid`, `name`, `sponsor_name`, `funding_source`, `budget`, `starts_on`, `ends_on`, `target_beneficiaries`); `programme_id uuid` on `camps`; per-programme CSR Impact Report.
- **Offline registration:** registration screen in the mobile app (or a PWA) storing registrations locally with a client UUID; sync endpoint `POST /api/camps/:id/registrations/sync` that is idempotent on that UUID and assigns tokens server-side on conflict.
- **OTP consent:** send a 6-digit code by SMS / WhatsApp; table `consent_otps` (`id uuid`, `registration_id`, `phone_hash`, `code_hash`, `expires_at`, `verified_at`); store verification evidence on the registration.
- **Sponsor portal:** read-only sponsor user type, scoped to their programmes, showing live anonymised counts only.
- **ABHA:** capture and validate the 14-digit ABHA number on patients; ABDM linking as a later integration.
- **Referral closure:** link a `referred` station outcome to the follow-up clinic appointment and report the closure rate.
- **Camp templates:** `ncd_screening_camp`, `eye_camp`, `dental_camp`, `maternal_child_camp`.
- **Languages:** add Hindi for the camp registration screens and patient-facing SMS (beyond the 5 core languages; decide whether to roll it out app-wide).

### Rollout

- Ship each phase behind a plan flag; Phase 0 first so marketing can launch while features land.
- Do not run ads with claims that depend on unfinished items: EPCS (S3), live clearinghouse (S2) and offline camps (S5).

---

## 6. Test cases

### Phase 0 — Rebranding
1. Switch the UI to each of EN / ES / FR / DE / AR → every renamed module shows the new name; no raw translation keys appear.
2. Open the help drawer on each renamed module → help uses the new name.
3. Global search "camp" and a location name → results appear and open the record.
4. A tenant with `behavioral_health` already installed → wizard still recognises it after the label change.

### Phase 1 — Mental health
1. Create a weekly series for 10 sessions → 10 appointments with the same `series_id`; one notification to the patient.
2. Edit "this and following" on occurrence 4 → occurrences 1–3 unchanged, 4–10 updated; audit log shows one series edit.
3. Book a series that clashes with provider time off → clashing dates flagged, nothing double-booked.
4. Group session with `max_participants = 6` → 7th add is refused; each participant gets their own note.
5. PHQ-9 total 21 → band "Severe"; item 9 > 0 → provider notified immediately.
6. Patient with 3 PHQ-9 results → trend chart shows 3 points in date order.
7. Psychotherapy note by provider A → provider B (no permission) gets 403; the read attempt is audited; note absent from FHIR export and portal.
8. Treatment plan review date in 7 days → reminder sent to the provider.

### Phase 2 — Billers
1. Claim with no diagnosis pointer → scrubber error; EDI 837 export blocked.
2. Claim past the payer's timely-filing limit → warning shown; export allowed.
3. Eligibility response "inactive" for tomorrow's patient → front desk notified.
4. Denial with code CO-50 → "Generate appeal" fills the matching template; appeal date logged and audited.
5. Monthly statement run → patients with a balance > 0 get one statement each; pay link marks the invoice paid via Stripe webhook.
6. KPI report: 100 claims, 92 accepted first time → clean-claim rate shows 92%.

### Phase 3 — Cash-pay physio
1. Save a card in the portal → only brand and last 4 stored; no full card number in the database.
2. Monthly membership with 4 sessions → renewal resets sessions; a ledger auto_payment entry is posted.
3. Failed renewal (Stripe test card 4000 0000 0000 0341) → membership `past_due`; patient and clinic notified.
4. Booking with a £20 deposit → deposit posted to account 2200; applied to the invoice after the visit.
5. No-show with fee configured → fee charged only after staff confirmation; action audited.
6. Superbill PDF contains CPT, ICD-10, NPI, tax ID, amounts paid.
7. Assign a 5-exercise program → visible in portal and mobile app; ticks recorded with dates.
8. Gift voucher of 100 used for an 80 invoice → balance 20; reuse after expiry refused.

### Phase 4 — Multi-location
1. User limited to Site A lists patients → sees Site A records only; direct URL to a Site B patient returns 403 and is audited.
2. Group admin opens the revenue report filtered to Site B → only Site B invoices counted; totals of all sites equal the unfiltered report.
3. Transfer 10 units from A to B → A −10 on dispatch, B +10 only after receipt; B notified.
4. Delete a location with linked invoices → refused with "linked invoices" in the message.
5. Migration backfill → every existing invoice / claim / patient has the primary site's `location_id`.

### Phase 5 — Health camps
1. Register 20 patients offline, reconnect → 20 records synced with unique tokens; re-sending the same batch creates no duplicates.
2. Wrong OTP 3 times → consent not recorded; clinical station entry blocked.
3. Correct OTP → `verified_at` set; patient can enter the clinical station.
4. Sponsor user opens the portal → sees only their programmes' counts; no names, phone numbers or MRNs.
5. Invalid ABHA number (wrong length / checksum) → rejected with a clear message.
6. Referred patient books a clinic appointment → referral closure rate for the camp goes up.
7. Programme with 3 camps → CSR Impact Report totals equal the sum of the 3 camp reports.
