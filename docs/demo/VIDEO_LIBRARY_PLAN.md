# AureonCare video library — prioritized plan

A library of short, single-feature videos. Each one runs **1–2 minutes**, covers
**one module feature end to end**, and is written to *teach* the task, not just
show the screen: the viewer should be able to do the job themselves afterwards.

This complements — it does not replace — the existing 13.5-minute executive demo
in `docs/demo/EXECUTIVE_DEMO_SCRIPT.md`. That one sells the platform to buyers;
these train the people who use it.

Production is tracked in **`AureonCare_Video_Library_Tracker.xlsx`** (same folder):
one row per video, with owner, status, the four production stages, dates and a
formula-driven dashboard. This document is the reference; the workbook is the
working copy — edit the workbook, not this file, as work progresses.

**Status: Waves 1 and 2 are produced** — sixteen videos, recorded, branded and
narrated in Google Cloud Text-to-Speech `en-US-Neural2-D`, in
`video-library/wave1/` and `video-library/wave2/` with subtitles, chapters,
thumbnails, per-video upload metadata and a paste-ready `YOUTUBE_UPLOAD_COPY.md`
carrying the playlist copy for each wave. They await SME review, then upload.
Waves 3-4 are still plans.

The `.mp4` and `.thumbnail.png` files are build output and are not tracked in
git — regenerate them with `video-harness/record.js`, or take them from the
distributed downloads.

**The 120-second cap below is not being met.** Wave 1 runs 1:46-2:25 and Wave 2
runs 2:07-2:51. Narration is the reason: spoken at an unhurried pace a caption
takes about twice as long to hear as to read, and the cap was written for silent
screen capture. Either revise it or split the longer journeys — worth deciding
before Wave 3 rather than discovering it again.

The prep task (a shared recorder harness) is done too: `video-harness/` drives
the real UI against a mocked API, so any video can be re-cut by re-running its
script rather than re-recording by hand.

---

## Conventions every video follows

| Aspect | Convention |
| --- | --- |
| Length | 60–120 s. Hard cap 120 s — split rather than overrun |
| Resolution | 1920×1080 at 30fps for YouTube, with a narrated AAC track mastered to -16 LUFS |
| Structure | 5 s title card → 10 s "why this matters" → 60–90 s journey → 10 s recap card |
| Voice | Second person, imperative: "Open Scheduling ▸ Calendar", not "the user can". The caption text is also the narration line, so they can never drift |
| Branding | Logo bumper in, branded outro out, logo in the caption bar throughout; palette sampled from the logo |
| Data | Synthetic only, with the permanent "demo environment · synthetic data" watermark |
| Personas | Reuse `DEMO_SCENARIOS.md`: Sarah Williams (patient), Dr. Anderson (provider), plus a front-desk and an admin persona |
| Recap card | 3 bullets max — the steps, not the benefits |

**Production accelerator (built):** `video-harness/` is the shared recorder —
Playwright driving the real UI, an `/api` mock layer fed from shared fixtures,
caption bar, synthetic cursor, title and recap cards, chapter and subtitle
capture, and a YouTube-ready encode. Each video is one script against it, so a
UI change costs a re-run rather than a re-record. Waves 2-4 should extend it
rather than start over.

**Prioritisation basis:** how many users touch the feature daily, whether it
blocks go-live, whether it protects revenue, and how often it generates support
questions. Wave 1 is what a new clinic needs in week one.

---

## Wave 1 — Day-one adoption (8 videos)

Everything a new clinic must watch before going live. Produce these first, in
this order.

| # | Title | Where in app | Primary audience |
| --- | --- | --- | --- |
| 1 | Find your way around AureonCare | App shell, search, help | Everyone |
| 2 | Register a new patient | Patients ▸ Electronic Health Records | Front desk |
| 3 | Book an appointment | Scheduling ▸ Calendar | Front desk |
| 4 | Read your day on the dashboard | Home ▸ Dashboard | Everyone |
| 5 | Document a visit | Patients ▸ Patient History | Clinician |
| 6 | Run a telehealth visit | Clinical ▸ Telehealth | Clinician |
| 7 | Create and submit a claim | Billing ▸ Claims | Billing |
| 8 | What your patients see | Patient Portal (patient's own account) | Front desk, clinician |

**1. Find your way around AureonCare** *(~90 s)*
Sign in → the three-pane shell (workspace rail → module list → content) → switch
workspaces → universal search jumps straight to a patient → open the help drawer
→ the AI assistant answers a "how do I…" question → theme and language switch.
*Teaches:* the navigation model, so every later video can say "go to X ▸ Y" and
be understood.

**2. Register a new patient** *(~90 s)*
Patients ▸ Patient Records → New Patient → demographics, contact, insurance,
emergency contact → save → the new record opens → set patient status → invite to
the portal. *Teaches:* which fields matter downstream (insurance drives claims,
email drives the portal), and that status controls visibility everywhere else.

**3. Book an appointment** *(~2 min)*
Scheduling ▸ Calendar → day / week / month views → pick a slot → New Appointment
→ patient, provider, type, duration, telehealth flag → save → reschedule by
changing the time → cancel with a reason → reminder settings. *Teaches:* the
whole appointment lifecycle in one pass, including the two things people get
wrong — appointment type drives duration, and cancelling ≠ deleting.

**4. Read your day on the dashboard** *(~60 s)*
Home ▸ Dashboard → each metric tile and what it counts → today's appointments
quick view → tasks quick view → revenue quick view → click through from a tile to
the underlying module. *Teaches:* the dashboard is a launchpad, not a report.

**5. Document a visit** *(~2 min)*
Open Sarah Williams' chart → history timeline → new clinical record → chief
complaint and notes → vitals → allergies → save → the entry appears on the
timeline and in the portal. *Teaches:* the chart is the single source of truth,
and what the patient can see once it is saved.

**6. Run a telehealth visit** *(~2 min)*
Clinical ▸ Telehealth → active provider banner → New Session from an upcoming
appointment → attach a pre-session consent form → session created with a join
link → Join → end and return → session shows under Recent with its status.
*Teaches:* the difference between a scheduled session and Instant meeting, and
that pre-session forms land in the patient's portal.

**7. Create and submit a claim** *(~2 min)*
Billing ▸ Claims → New Claim from a completed encounter → payer, codes, charges
→ save as draft → validate → submit to the clearinghouse → status moves to
Submitted → where a rejection would surface. *Teaches:* the claim states and what
each one means for cash.

**8. What your patients see** *(~90 s)*
Patient portal as Sarah: overview → appointments → diagnoses → prescriptions →
records → forms requested → completing a requested form → the submission appears
staff-side. *Teaches:* staff can answer portal questions confidently, and what
publishing to the chart exposes.

---

## Wave 2 — Revenue and clinical throughput (8 videos)

The modules that decide whether the clinic gets paid and whether clinicians stay
in the system rather than working around it.

| # | Title | Where in app | Primary audience |
| --- | --- | --- | --- |
| 9 | Get a pre-authorization approved | Billing ▸ Pre-Authorizations | Billing |
| 10 | Work a denial to resolution | Billing ▸ Denials | Billing |
| 11 | Record a payment and post it | Billing ▸ Payments / Payment Postings | Billing |
| 12 | Quote, invoice, get paid | Billing ▸ Quotes & Invoices | Front desk, billing |
| 13 | Prescribe and send electronically | Patient chart ▸ Prescriptions | Clinician |
| 14 | Order a lab and file the result | Clinical ▸ Laboratories | Clinician |
| 15 | Record a diagnosis | Clinical ▸ Diagnoses *(produced)* | Clinician |
| 16 | Set up appointment types and provider schedules | Scheduling ▸ Setup / Providers | Admin |

**9. Get a pre-authorization approved** *(~2 min)* — new pre-auth against a
payer and service → clinical justification → submit → track Submitted → Approved
/ Denied → link the approval to the appointment and the eventual claim.
*Teaches:* do this before the visit, not after the denial.

**10. Work a denial to resolution** *(~2 min)* — Denials queue → open a denied
claim → denial reason → correct the coding → resubmit → track the appeal.
*Teaches:* the denial reason codes staff actually see, and the resubmit path.

**11. Record a payment and post it** *(~90 s)* — record an insurance payment →
allocate across claim lines → patient responsibility → the balance updates on the
claim and in Receivables. *Teaches:* why unposted payments distort AR.

**12. Quote, invoice, get paid** *(~2 min)* — build a quote from the service
catalogue → convert to invoice → send → take a card payment through Stripe →
receipt → the invoice closes and Accounting reflects it. *Teaches:* the
self-pay path, which the claims videos do not cover.

**13. Prescribe and send electronically** *(~2 min)* — from the chart → new
prescription → drug, dose, refills → interaction and allergy check fires against
Sarah's penicillin allergy → choose the patient's pharmacy → send via Surescripts
→ status → it appears in the portal. *Teaches:* the safety checks are the point;
don't click past them.

**14. Order a lab and file the result** *(~2 min)* — new lab order → panel and
diagnosis → transmit to Labcorp → track status → result returns → review, flag
abnormal, file to the chart → notify the patient. *Teaches:* the ordering loop
closes in the chart, not in email.

**15. Record a diagnosis** *(2:17 — produced, in `video-library/wave2/`)* —
Clinical ▸ Diagnoses → New Diagnosis → patient picker → ICD-10 search →
severity, status, onset → notes → save → how it flows onto claims and the
portal. *Teaches:* diagnosis quality drives claim acceptance. Recorded after
Diagnoses moved out of Patients and the standalone form gained its own patient
picker; the video calls both changes out.

**16. Set up appointment types and provider schedules** *(~2 min)* — appointment
types with durations, colours and telehealth defaults → provider working hours →
time off → the calendar reflects both immediately. *Teaches:* most scheduling
complaints are a configuration problem, fixed here.

---

## Wave 3 — Patient engagement and growth (7 videos)

Features that reduce front-desk load and fill the schedule. High value, but a
clinic can go live without them.

| # | Title | Where in app | Primary audience |
| --- | --- | --- | --- |
| 17 | Let patients book themselves | Public booking page | Admin, front desk |
| 18 | Fill a cancelled slot from the waitlist | Scheduling ▸ Waitlist | Front desk |
| 19 | Collect intake and consent before arrival | Patients ▸ Patient Intake | Front desk |
| 20 | Build a form template and read the submissions | Patients ▸ Form Templates | Admin |
| 21 | Answer a question with a report | Insights ▸ Reports | Manager |
| 22 | Build a custom report and export it | Insights ▸ Custom Report | Manager |
| 23 | Package services and run a promotion | Growth ▸ Service Catalog | Manager |

**17. Let patients book themselves** *(~2 min)* — configure which types are
bookable → share the public link → the patient's three-step flow (Select Type →
Choose Time → Your Info → Confirm) → the booking lands on the clinic calendar and
notifies staff. *Teaches:* what patients can and cannot self-book.

**18. Fill a cancelled slot from the waitlist** *(~90 s)* — add a patient with
priority and flexibility → a cancellation opens a slot → notify the next patient
→ confirm → the appointment is created and the entry clears. *Teaches:* the
waitlist only works if entries carry real availability windows.

**19. Collect intake and consent before arrival** *(~2 min)* — build an intake
flow from forms → send to the patient → the patient completes it in the portal →
staff review → data lands on the chart → consent form stored with timestamp.
*Teaches:* the difference between intake forms, intake flows and consent forms.

**20. Build a form template and read the submissions** *(~2 min)* — new template
→ field types and required fields → publish → assign to a patient → submissions
tab → open a completed submission → the form audit log. *Teaches:* forms are
versioned and audited; edit deliberately.

**21. Answer a question with a report** *(~90 s)* — Insights ▸ Reports →
operational vs financial vs insurance categories → open No-Show Report → date
range → chart type → read the trend → export to PDF/Excel. *Teaches:* which
report answers which question.

**22. Build a custom report and export it** *(~2 min)* — Custom Report → pick
data source, columns, filters, grouping → preview → save → schedule/export.
*Teaches:* the escape hatch when no standard report fits.

**23. Package services and run a promotion** *(~2 min)* — create a service with
price and duration → bundle into a package → category → promotion with validity
window → it appears in booking and on quotes → catalogue statistics. *Teaches:*
pricing lives in one place and flows everywhere.

---

## Wave 4 — Administration, back office and compliance (9 videos)

Lower frequency, higher blast radius. Aimed at one or two people per clinic.

| # | Title | Where in app | Primary audience |
| --- | --- | --- | --- |
| 24 | Configure your clinic | Settings ▸ Practice | Admin |
| 25 | Add users and control what they can see | Settings ▸ Access Control | Admin |
| 26 | Connect a video provider | Settings ▸ Telehealth Setup | Admin |
| 27 | Connect pharmacy, lab and payment partners | Settings ▸ Integrations | Admin |
| 28 | Stock: item to purchase order to receipt | Operations ▸ Inventory | Ops |
| 29 | Close the books | Operations ▸ Accounting | Finance |
| 30 | Prove who touched what | Settings ▸ Audit Logs | Compliance |
| 31 | Back up, restore, archive | Settings ▸ Backup & Restore | Admin/IT |
| 32 | Exchange data over FHIR | Clinical ▸ FHIR Resources / Tracking | IT |

**24. Configure your clinic** *(~2 min)* — clinic identity, address, timezone,
currency → working hours → appointment rules (slot length, buffers, booking
window). *Teaches:* these settings are upstream of scheduling behaviour.

**25. Add users and control what they can see** *(~2 min)* — invite a user →
assign role → roles & permissions matrix → module-level effect of a permission →
multi-role users → subscription plan gating vs role gating. *Teaches:* the two
independent gates (plan and role) that explain "why can't I see this module".

**26. Connect a video provider** *(~90 s)* — Telehealth Setup → connect an
account via OAuth → test connection → enable → it becomes the active provider in
Telehealth. *Note:* the Google Meet cut already exists in
`docs/google-verification/` and can be re-edited for this slot.

**27. Connect pharmacy, lab and payment partners** *(~2 min)* — Integrations →
Surescripts, Labcorp, Optum, Stripe → credentials → sandbox vs live → enable →
where each one shows up in daily work. *Teaches:* an integration must be
configured *before* it can be enabled.

**28. Stock: item to purchase order to receipt** *(~2 min)* — create an item with
category and reorder point → stock levels → low-stock alert → purchase order to a
supplier → receive stock → levels update. *Teaches:* the reorder point is what
makes the alerts useful.

**29. Close the books** *(~2 min)* — chart of accounts → journal entries →
receivables and payables ageing → reconciliation against a statement → generate
statements. *Teaches:* how clinical and billing activity lands in the ledger.

**30. Prove who touched what** *(~90 s)* — Audit Logs → filter by user, patient,
action, date → open an entry and read the detail → export for an audit request.
*Teaches:* the HIPAA answer to "who viewed this record".

**31. Back up, restore, archive** *(~2 min)* — run a backup → what it includes →
restore preview → archive old records → retrieve from archive. *Teaches:* archive
and backup solve different problems.

**32. Exchange data over FHIR** *(~2 min)* — FHIR Resources → browse resource
types → inspect a Patient/Observation resource → FHIR Tracking shows outbound
exchanges and failures → retry a failed exchange. *Teaches:* where to look when a
partner says "we didn't get it".

---

## Backlog — worth making, not yet scheduled

- **Notifications and tasks** — assign a task, get notified, close the loop.
- **Merge duplicate patients** — high support volume, narrow audience.
- **Patient history and health metrics trends** — charting vitals over time.
- **CRM and campaigns** — leads through to a campaign send.
- **Working in another language** — the en/es/fr/de/ar switch, including RTL.
- **Recurring appointments** — currently a beat inside video 3; split out if the
  scheduling videos overrun.

---

## Suggested production order

1. Refactor the Google-Meet recorder into a shared harness (fixtures, captions,
   title cards, mp4 output) — one-time cost, pays back from video 2 onward.
2. Wave 1 videos 1–8, in listed order. Ship as a "new clinic" playlist.
3. Wave 2, front-loading 13 and 14 — the two clinicians ask about most.
4. Wave 3, timed with whatever the clinic is rolling out next.
5. Wave 4 on demand; 30 and 31 before any compliance review.

Re-cut trigger: any change to the app shell, a module's tab layout, or a
journey's step order invalidates the affected video. Keeping every video
script-driven is what makes that survivable.
