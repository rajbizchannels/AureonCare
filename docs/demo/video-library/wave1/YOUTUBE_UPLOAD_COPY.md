# Wave 1 — YouTube upload copy

Paste-ready text for each video, split by the field it goes into in YouTube
Studio. Everything in a fenced block is **copy verbatim** — no editing, no
internal notes mixed in.

The per-video `.metadata.md` files are the production record and contain notes
that must *not* be published (which `.srt` to attach, which narration engine
rendered the track). This file is the publishing view: only what a viewer should
see. Where the two disagree, this file wins for the description box.

Timestamps below match the `en-US-Neural2-D` renders. They are **not** the same
as the earlier espeak cut — the videos changed length — so do not paste chapter
lists from anywhere else.

---

## The playlist

Create this first — the per-video uploads all get added to it.

### Playlist title `37 chars`

```
AureonCare — Getting Started (Wave 1)
```

### Playlist description

```
Everything a new AureonCare user needs in under twenty minutes. Eight short videos, one job each, in the order you will actually meet them: find your way around, register a patient, book them in, read your day, document the visit, run it virtually, bill it, and see what the patient sees.

Watch them in order the first time. Video 1 teaches the navigation vocabulary the rest of the series assumes — later videos give directions in the form "go to Scheduling, then Calendar" without stopping to explain it. After that, treat them as reference and jump to whichever one matches the task in front of you.

Where to start for your role:
• Front desk — 1, 2, 3, then 8
• Clinician — 1, 4, 5, 6
• Billing — 1, 7
• Practice manager / everyone — 1 and 4, then whichever apply

The series:
1. Find Your Way Around — the three-pane layout, universal search, notifications and help (2:21)
2. Register a New Patient — creating the record, and which fields matter downstream (2:25)
3. Book an Appointment — the calendar, appointment types, and what booking sets in motion (2:24)
4. Read Your Day on the Dashboard — what each metric counts, and where to click next (1:46)
5. Document a Visit — the chart timeline, measurements, history, and what the patient then sees (2:19)
6. Run a Telehealth Visit — creating a session from an appointment through to joining the call (2:25)
7. Create and Submit a Claim — the claims queue, ICD-10 and CPT coding, and EDI 837 submission (2:18)
8. What Your Patients See — the portal from the patient's own account (1:52)

Every video has chapters in its description and a proper English subtitle track, so you can skim to the step you need or follow along with sound off.

These are recorded in a demo environment using synthetic data. Every patient, clinician, appointment, claim and meeting link is invented. No real patient information appears anywhere in this series.
```

Runtime across all eight is 17:50.

### Playlist settings

| Field | Value |
| --- | --- |
| Visibility | Unlisted until all eight videos are up, then Public |
| Ordering | Manual, in the numbered order above — not "date added" |
| Playlist thumbnail | Video 1's thumbnail (YouTube uses the first video by default) |

---

## Settings identical for all eight

Set these the same way on every upload:

| YouTube field | Value |
| --- | --- |
| Category | Science & Technology |
| Playlist | AureonCare — Getting Started (Wave 1) |
| Video language | English |
| Audience | No, it's not made for kids |
| Age restriction | None |
| Paid promotion | No |
| Altered content (synthetic media) | No — screen recording of real software, no generated likeness or voice clone |
| Visibility | Unlisted until all eight are up, then Public together |
| Comments | On, hold potentially inappropriate for review |
| End screen | Link to the next video in the playlist |

Upload order matters: add them to the playlist 1 → 8. V01 teaches the navigation
vocabulary ("go to Scheduling, then Calendar") that every later video assumes.

**Subtitles:** upload each video's `.srt` as the English track. Do not accept
auto-captions — they mangle the clinical vocabulary (ICD-10, CPT, EDI 837, HbA1c)
and the SRT is already exact and correctly timed.

---

## V01 — Find your way around AureonCare

**File:** `v01-find-your-way-around-aureoncare.mp4` · 2:21 ·
thumbnail `…thumbnail.png` · subtitles `…srt`

### Title `48 chars`

```
AureonCare: Find Your Way Around (2-Minute Tour)
```

### Description

```
A two-minute tour of the AureonCare workspace. You will learn the three-pane layout, how to move between modules, how universal search jumps straight to a patient or a claim, and where notifications, help and the AI assistant live.

This is the first video in the AureonCare Getting Started series — watch it before the others, because every later video gives directions in the form "go to Scheduling then Calendar".

Chapters:
0:00 Introduction
0:12 Signing in
0:30 The three-pane layout
1:02 Universal search
1:25 Notifications, help and the assistant
2:08 Recap

This video uses a demo environment with synthetic data. No real patient information appears in it.
```

### Tags `224 chars`

```
AureonCare, practice management software, EHR software, clinic software tutorial, medical practice management, healthcare software training, getting started, patient management system, EHR navigation, medical office software
```

---

## V02 — Register a new patient

**File:** `v02-register-a-new-patient.mp4` · 2:25

### Title `49 chars`

```
AureonCare: Register a New Patient (Step by Step)
```

### Description

```
How to create a patient record in AureonCare, and which fields matter downstream. Insurance details drive claims, the email address drives the patient portal, and the MRN is generated for you.

Part of the AureonCare Getting Started series.

Chapters:
0:00 Introduction
0:14 The patient list
0:31 Creating the record
0:54 Contact and insurance
1:31 Saving and finding the record
2:13 Recap

This video uses a demo environment with synthetic data. No real patient information appears in it.
```

### Tags `206 chars`

```
AureonCare, patient registration, add new patient, EHR tutorial, medical records software, practice management software, patient intake, clinic front desk training, healthcare software, patient demographics
```

---

## V03 — Book an appointment

**File:** `v03-book-an-appointment.mp4` · 2:24

### Title `49 chars`

```
AureonCare: Book an Appointment (Calendar Basics)
```

### Description

```
Booking, finding and changing appointments in AureonCare. Covers the day and week calendar views, what the appointment type controls (duration and whether the visit is virtual), and where a booked visit shows up afterwards.

Part of the AureonCare Getting Started series.

Chapters:
0:00 Introduction
0:13 The calendar
0:36 Booking the visit
1:22 After the booking
2:11 Recap

This video uses a demo environment with synthetic data. No real patient information appears in it.
```

### Tags `235 chars`

```
AureonCare, medical appointment scheduling, clinic calendar software, appointment booking tutorial, practice management software, patient scheduling, healthcare scheduling software, front desk training, EHR scheduling, book appointment
```

---

## V04 — Read your day on the dashboard

**File:** `v04-read-your-day-on-the-dashboard.mp4` · 1:46

### Title `53 chars`

```
AureonCare: Read Your Day on the Dashboard (1 Minute)
```

### Description

```
A one-minute guide to the AureonCare dashboard: what each metric counts, what the quick views are for, and why the dashboard is a launchpad rather than a report.

Part of the AureonCare Getting Started series.

Chapters:
0:00 Introduction
0:12 The tiles
0:40 Click through to the work
1:04 Quick actions
1:35 Recap

This video uses a demo environment with synthetic data. No real patient information appears in it.
```

### Tags `193 chars`

```
AureonCare, medical practice dashboard, clinic dashboard, practice management software, healthcare analytics, EHR dashboard, clinic KPIs, daily huddle, medical office software, practice metrics
```

---

## V05 — Document a visit

**File:** `v05-document-a-visit.mp4` · 2:19

### Title `54 chars`

```
AureonCare: Document a Patient Visit (Clinician Guide)
```

### Description

```
Documenting a visit in AureonCare. Covers the longitudinal chart timeline, the diagnoses and records tabs, recording physical measurements and medical history, and what becomes visible in the patient portal once you save.

Part of the AureonCare Getting Started series.

Chapters:
0:00 Introduction
0:12 Opening the chart
0:33 Reading before you write
1:02 Recording what you found
1:32 Saving, and what the patient sees
2:07 Recap

This video uses a demo environment with synthetic data. No real patient information appears in it.
```

### Tags `217 chars`

```
AureonCare, clinical documentation, EHR charting, patient chart tutorial, medical records software, vitals documentation, clinician training, electronic health records, practice management software, SOAP note software
```

---

## V06 — Run a telehealth visit

**File:** `v06-run-a-telehealth-visit.mp4` · 2:25

### Title `52 chars`

```
AureonCare: Run a Telehealth Visit (Start to Finish)
```

### Description

```
Running a virtual visit in AureonCare. Covers the active provider banner, creating a session from a scheduled appointment, attaching a pre-session consent form, the difference between a scheduled session and an instant meeting, and joining the call.

Part of the AureonCare Getting Started series.

Chapters:
0:00 Introduction
0:13 The telehealth module
0:33 Creating the session
1:09 Joining the visit
1:59 Recap

This video uses a demo environment with synthetic data. No real patient information appears in it.
```

### Tags `207 chars`

```
AureonCare, telehealth software, virtual visit, telemedicine tutorial, video consultation, healthcare software, remote patient visit, telehealth workflow, practice management software, Google Meet telehealth
```

---

## V07 — Create and submit a claim

**File:** `v07-create-and-submit-a-claim.mp4` · 2:18

### Title `48 chars`

```
AureonCare: Create and Submit an Insurance Claim
```

### Description

```
Creating and submitting an insurance claim in AureonCare. Covers the claims queue and what each status means, building a claim from a completed visit, searching ICD-10 and CPT codes, and submitting an EDI 837 to the clearinghouse.

Part of the AureonCare Getting Started series.

Chapters:
0:00 Introduction
0:12 The claims queue
0:31 Building the claim
0:50 Coding it
1:19 Submitting it
2:06 Recap

This video uses a demo environment with synthetic data. No real patient information appears in it.
```

### Tags `196 chars`

```
AureonCare, medical billing, insurance claim submission, EDI 837, revenue cycle management, claims processing, medical coding, ICD-10 CPT, practice management software, healthcare billing tutorial
```

---

## V08 — What your patients see

**File:** `v08-what-your-patients-see.mp4` · 1:52

### Title `48 chars`

```
AureonCare: What Your Patients See in the Portal
```

### Description

```
A tour of the AureonCare patient portal from the patient's own account: appointments, diagnoses, prescriptions, records and requested forms. Watch this so you can answer portal questions at the desk, and so you know what publishing to the chart exposes.

Part of the AureonCare Getting Started series.

Chapters:
0:00 Introduction
0:12 The patient's view
0:29 Appointments
1:07 Forms and booking
1:40 Recap

This video uses a demo environment with synthetic data. No real patient information appears in it.
```

### Tags `210 chars`

```
AureonCare, patient portal, patient engagement, healthcare portal tutorial, patient experience, medical records access, practice management software, patient self service, clinic software, online health records
```

---

## Checks already done

You do not need to re-verify these before uploading:

- **Titles** 48–54 chars, inside YouTube's 100 limit and short enough not to
  truncate in search or on mobile.
- **Tags** 193–235 chars each, inside the 500-char total budget.
- **Chapters** validated against the actual rendered durations: every list
  starts at 0:00, has at least three entries, and no chapter is shorter than
  12 seconds — YouTube requires 0:00, three or more, and a 10-second minimum,
  so all eight will render as chapters rather than be silently ignored.
- **Files** all 1920×1080, 30fps, H.264 High, faststart, AAC narration
  normalised to −16 LUFS. Upload as-is; no re-encode.

## What is deliberately not in the description

Two lines that appear inside the `## Description` heading of each
`.metadata.md` are production notes, not viewer copy, and are omitted above:
the instruction to attach the `.srt`, and the record of which narration engine
and voice rendered the track. Pasting a `.metadata.md` description section
verbatim would publish both.
