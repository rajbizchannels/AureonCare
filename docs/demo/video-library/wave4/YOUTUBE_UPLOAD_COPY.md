# Wave 4 — YouTube upload copy

Paste-ready text for each video, split by the field it goes into in YouTube
Studio. Everything in a fenced block is **copy verbatim** — no editing, no
internal notes mixed in.

The per-video `.metadata.md` files are the production record and contain notes
that must *not* be published (which `.srt` to attach, which narration engine
rendered the track). This file is the publishing view: only what a viewer should
see. Where the two disagree, this file wins for the description box.

Timestamps below match the `en-US-Neural2-D` renders in this folder. Re-cutting
any video changes its chapter times, so regenerate this file rather than editing
timestamps by hand.

---

## The playlist

Create this first — the per-video uploads all get added to it.

### Playlist title `52 chars`

```
AureonCare — Administration and Back Office (Wave 4)
```

### Playlist description

```
The setup and back-office work behind a running clinic. Nine short videos for the one or two people per practice who own configuration, access, money and compliance — the jobs that are done rarely, matter enormously, and are hardest to remember six months later.

This wave assumes you already know your way around AureonCare. Watch the Getting Started series first if you do not.

Where to start for your role:
• Admin setting up a new clinic — 1, 2, 3, 4, in that order
• Operations — 5
• Finance — 6
• Compliance and IT — 7, 8, 9

The series:
1. Configure Your Clinic — the settings every other screen inherits (2:30)
2. Add Users and Control What They Can See — the two gates that hide a module (2:29)
3. Connect a Video Provider — one clinic account, every provider (2:14)
4. Connect Pharmacy, Lab and Payment Partners — configure, then enable (2:50)
5. Inventory from Item to Purchase Order to Receipt — the reorder level earns its keep (3:02)
6. Close the Books — how clinical activity reaches the ledger (3:22)
7. Audit Logs — the answer to “who viewed this record” (2:08)
8. Backup, Restore and Archive — two problems, two tools (2:54)
9. FHIR Resources and Tracking — where to look when a partner says they never got it (2:45)

Every video has chapters in its description and a proper English subtitle track, so you can skim to the step you need or follow along with sound off.

These are recorded in a demo environment using synthetic data. Every patient, clinician, claim and record is invented. No real patient information appears anywhere in this series.
```

Runtime across all nine is 24:14.

### Playlist settings

| Field | Value |
| --- | --- |
| Visibility | Unlisted until all nine videos are up, then Public |
| Ordering | Manual, in the numbered order above — not "date added" |
| Playlist thumbnail | Video 1's thumbnail (YouTube uses the first video by default) |

---

## Settings identical for all nine

| YouTube field | Value |
| --- | --- |
| Category | Science & Technology |
| Playlist | AureonCare — Administration and Back Office (Wave 4) |
| Video language | English |
| Audience | No, it's not made for kids |
| Age restriction | None |
| Paid promotion | No |
| Altered content (synthetic media) | No — screen recording of real software, synthesised narration only |
| Visibility | Unlisted until all nine are up, then Public together |
| Comments | On, hold potentially inappropriate for review |
| End screen | Link to the next video in the playlist |

**Subtitles:** upload each video's `.srt` as the English track. Do not accept
auto-captions — they mangle the administrative vocabulary (NPI, FHIR, RBAC,
Surescripts, reconciliation, reorder level) and the SRT is already exact and
correctly timed.

---

## V24 — Configure Your Clinic

**File:** `v24-configure-your-clinic.mp4` · 2:30

### Title `70 chars`

```
AureonCare: Configure Your Clinic (Settings, Hours, Appointment Rules)
```

### Description

```
Clinic configuration in AureonCare. Sets clinic identity, address, tax ID, NPI and currency; then working hours per day; then the appointment rules — default duration, slot interval, how far ahead patients can book and the cancellation deadline. These three screens sit upstream of everything the calendar and the booking page do.

Part of the AureonCare training series.

Chapters:
0:00 Introduction
0:12 Who the clinic is
0:50 When the clinic is open
1:23 How appointments behave
2:16 Recap

This video uses a demo environment with synthetic data. No real patient information appears in it.
```

### Tags `196 chars`

```
AureonCare, clinic settings, practice setup, medical practice software, clinic configuration, working hours, appointment settings, practice management software, healthcare admin, clinic onboarding
```

### Thumbnail

`v24-configure-your-clinic.thumbnail.png`

---

## V25 — Add Users and Control What They Can See

**File:** `v25-add-users-and-control-access.mp4` · 2:29

### Title `51 chars`

```
AureonCare: Add Users and Control What They Can See
```

### Description

```
User and role administration in AureonCare. Adds a user, assigns a role, then walks the Roles & Permissions matrix — including the fine-grained Accounts and Inventory permissions — and explains the two independent gates that answer "why can't I see this module": your subscription plan, and the role.

Part of the AureonCare training series.

Chapters:
0:00 Introduction
0:13 The people
1:01 What each role can do
1:39 The other gate
2:15 Recap

This video uses a demo environment with synthetic data. No real patient information appears in it.
```

### Tags `205 chars`

```
AureonCare, user management, role based access control, RBAC healthcare, clinic staff permissions, practice management software, HIPAA access control, user roles, healthcare software admin, least privilege
```

### Thumbnail

`v25-add-users-and-control-access.thumbnail.png`

---

## V26 — Connect a Video Provider

**File:** `v26-connect-a-video-provider.mp4` · 2:14

### Title `51 chars`

```
AureonCare: Connect a Video Provider for Telehealth
```

### Description

```
Telehealth setup in AureonCare. Connects a clinic video-conferencing account — Google Meet, Zoom, Webex or Microsoft Teams — tests the connection, enables it, and shows where it then takes effect: the join link on every telehealth appointment.

Part of the AureonCare training series.

Chapters:
0:00 Introduction
0:13 Where video is set up
0:34 Connecting an account
1:07 Turning it on
1:57 Recap

This video uses a demo environment with synthetic data. No real patient information appears in it.
```

### Tags `206 chars`

```
AureonCare, telehealth setup, google meet integration, zoom for healthcare, video visits, telemedicine software, practice management software, virtual care setup, HIPAA telehealth, clinic video conferencing
```

### Thumbnail

`v26-connect-a-video-provider.thumbnail.png`

---

## V27 — Connect Pharmacy, Lab and Payment Partners

**File:** `v27-connect-pharmacy-lab-payment-partners.mp4` · 2:50

### Title `58 chars`

```
AureonCare: Connect Surescripts, Labcorp, Optum and Stripe
```

### Description

```
Partner integrations in AureonCare. Configures Surescripts for ePrescribing with client credentials and a sandbox base URL, then enables it — and covers Labcorp for lab orders, Optum for claims and Stripe for payments, including what sandbox mode really means and where each integration shows up in daily work.

Part of the AureonCare training series.

Chapters:
0:00 Introduction
0:16 What can be connected
0:42 Configuring one
1:28 Enabling, and where it lands
2:29 Recap

This video uses a demo environment with synthetic data. No real patient information appears in it.
```

### Tags `206 chars`

```
AureonCare, healthcare integrations, surescripts, eprescribing setup, labcorp integration, stripe healthcare payments, claims clearinghouse, practice management software, clinic software setup, sandbox mode
```

### Thumbnail

`v27-connect-pharmacy-lab-payment-partners.thumbnail.png`

---

## V28 — Inventory from Item to Purchase Order to Receipt

**File:** `v28-stock-item-to-purchase-order-to-receipt.mp4` · 3:02

### Title `60 chars`

```
AureonCare: Inventory from Item to Purchase Order to Receipt
```

### Description

```
Inventory management in AureonCare. Creates an item with a category, supplier and reorder level, records a stock movement, then approves a purchase order and receives it — with the stock level updating on receipt. Explains why the reorder level is the setting that makes low-stock alerts worth having.

Part of the AureonCare training series.

Chapters:
0:00 Introduction
0:13 What is on the shelf
0:31 Adding an item
1:18 Stock going out
1:48 Ordering more
2:46 Recap

This video uses a demo environment with synthetic data. No real patient information appears in it.
```

### Tags `218 chars`

```
AureonCare, medical inventory management, clinic stock control, purchase orders, reorder level, inventory software healthcare, practice management software, stock movements, medical supplies tracking, vaccine inventory
```

### Thumbnail

`v28-stock-item-to-purchase-order-to-receipt.thumbnail.png`

---

## V29 — Close the Books

**File:** `v29-close-the-books.mp4` · 3:22

### Title `53 chars`

```
AureonCare: Close the Books — Accounting for a Clinic
```

### Description

```
Month-end accounting in AureonCare. Walks the chart of accounts, posts a journal entry, reads the receivables and payables ageing, completes a reconciliation against a bank statement and sends a patient statement — showing how clinical and billing activity reaches the ledger automatically.

Part of the AureonCare training series.

Chapters:
0:00 Introduction
0:13 Where the money is
0:41 The accounts, and the entries
1:31 Owed to you, owed by you
2:04 Proving it, then sending it
3:07 Recap

This video uses a demo environment with synthetic data. No real patient information appears in it.
```

### Tags `204 chars`

```
AureonCare, medical practice accounting, clinic bookkeeping, chart of accounts, journal entries, accounts receivable, bank reconciliation, practice management software, healthcare finance, month end close
```

### Thumbnail

`v29-close-the-books.thumbnail.png`

---

## V30 — Audit Logs

**File:** `v30-prove-who-touched-what.mp4` · 2:08

### Title `60 chars`

```
AureonCare: Audit Logs — Prove Who Accessed a Patient Record
```

### Description

```
Audit logging in AureonCare. Filters the trail by user, action, module and date, opens a single entry to read exactly what changed, shows what a failed action looks like, and exports the filtered result for an audit request. This is the answer to "who viewed this record".

Part of the AureonCare training series.

Chapters:
0:00 Introduction
0:12 The trail
0:35 Finding the one you need
0:53 Reading one entry
1:19 Handing it over
1:54 Recap

This video uses a demo environment with synthetic data. No real patient information appears in it.
```

### Tags `221 chars`

```
AureonCare, audit logs, HIPAA compliance, patient record access log, healthcare compliance software, access audit trail, practice management software, medical records security, compliance reporting, who accessed my record
```

### Thumbnail

`v30-prove-who-touched-what.thumbnail.png`

---

## V31 — Backup, Restore and Archive

**File:** `v31-back-up-restore-archive.mp4` · 2:54

### Title `49 chars`

```
AureonCare: Backup, Restore and Archive Explained
```

### Description

```
Backup and archiving in AureonCare. Runs a backup to local and cloud storage, explains what restoring actually does, then covers Archive Management — automatic archive rules, creating an archive, browsing what is inside one, and restoring it back — and why archive and backup solve different problems.

Part of the AureonCare training series.

Chapters:
0:00 Introduction
0:12 Backup
1:13 Archive is a different job
2:41 Recap

This video uses a demo environment with synthetic data. No real patient information appears in it.
```

### Tags `199 chars`

```
AureonCare, data backup, clinic data backup, restore from backup, data archiving, healthcare data retention, practice management software, google drive backup, HIPAA data retention, disaster recovery
```

### Thumbnail

`v31-back-up-restore-archive.thumbnail.png`

---

## V32 — FHIR Resources and Tracking

**File:** `v32-exchange-data-over-fhir.mp4` · 2:45

### Title `56 chars`

```
AureonCare: FHIR Resources and Tracking Failed Exchanges
```

### Description

```
Interoperability in AureonCare. Browses FHIR R4 resources by type, syncs a patient and downloads a FHIR bundle, then moves to FHIR Tracking — the worklist of outbound exchanges that failed, with the error, the severity and the suggested fix. This is where to look when a pharmacy or lab says they never received it.

Part of the AureonCare training series.

Chapters:
0:00 Introduction
0:14 What is being shared
0:56 Sending one out
1:18 When it does not land
2:32 Recap

This video uses a demo environment with synthetic data. No real patient information appears in it.
```

### Tags `192 chars`

```
AureonCare, FHIR, HL7 FHIR R4, healthcare interoperability, FHIR resources, health data exchange, practice management software, eprescribing errors, lab order integration, EHR interoperability
```

### Thumbnail

`v32-exchange-data-over-fhir.thumbnail.png`

---
