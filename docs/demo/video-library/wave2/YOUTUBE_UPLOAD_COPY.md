# Wave 2 — YouTube upload copy

Paste-ready text for each video, split by the field it goes into in YouTube
Studio. Everything in a fenced block is **copy verbatim** — no editing, no
internal notes mixed in.

The per-video `.metadata.md` files are the production record and contain notes
that must *not* be published (which `.srt` to attach, which narration engine
rendered the track). This file is the publishing view: only what a viewer should
see.

Wave 2 assumes Wave 1. These videos say "go to Billing, then Denials" without
stopping to explain the navigation, because
[Wave 1](../wave1/YOUTUBE_UPLOAD_COPY.md) already did.

Timestamps match the `en-US-Neural2-D` renders in this folder.

---

## The playlist

Create this first — the per-video uploads all get added to it.

### Playlist title `43 chars`

```
AureonCare — Revenue and Clinical (Wave 2)
```

### Playlist description

```
The second AureonCare series, for the work that decides whether the clinic gets paid and whether clinicians stay in the system instead of working around it. Eight videos on the revenue cycle beyond a basic claim — pre-authorizations, denials, payment posting and self-pay invoicing — plus prescribing, lab orders, diagnosis coding and the scheduling setup behind most day-to-day complaints.

Watch the Getting Started series first if you are new. These videos give directions in the form "go to Billing, then Denials" and assume you already know your way around.

Unlike Getting Started, this series is not designed to be watched end to end. Take the ones that match your job:
• Billing and revenue cycle — 1, 2, 3, 4
• Clinicians — 5, 6, 7
• Practice managers and admins — 8, then 1 and 3

The series:
1. Get a Pre-Authorization Approved — request approval before the service, and track it to a decision (2:14)
2. Work an Insurance Denial to Resolution — read the reason code, fix the cause, appeal (2:37)
3. Record a Payment and Post It — why an unposted payment makes your receivables lie (2:51)
4. Quote, Invoice and Get Paid — the self-pay path, which the claims videos do not cover (2:18)
5. Prescribe and Send Electronically — dose, frequency, refills and the pharmacy (2:27)
6. Order a Lab Test and File the Result — closing the loop in the chart, not the inbox (2:28)
7. Record a Diagnosis and Code It Correctly — coding quality is what gets claims accepted (2:07)
8. Set Up Appointment Types and Provider Schedules — fix the configuration, fix the complaints (2:39)

Every video has chapters in its description and a proper English subtitle track, so you can skim to the step you need or follow along with sound off.

These are recorded in a demo environment using synthetic data. Every patient, clinician, claim, prescription and lab result is invented. No real patient information appears anywhere in this series.
```

Runtime across all eight is 19:45. The per-video figures are rounded down to the
second, so adding them gives 19:41.

### Playlist settings

| Field | Value |
| --- | --- |
| Visibility | Unlisted until all eight videos are up, then Public |
| Ordering | Manual, in the numbered order above — not "date added" |
| Playlist thumbnail | Video 1's thumbnail (YouTube uses the first video by default) |

---

## Settings identical for all eight

| YouTube field | Value |
| --- | --- |
| Category | Science & Technology |
| Playlist | AureonCare — Revenue and Clinical (Wave 2) |
| Video language | English |
| Audience | No, it's not made for kids |
| Age restriction | None |
| Paid promotion | No |
| Altered content (synthetic media) | No — screen recording of real software, no generated likeness or voice clone |
| Visibility | Unlisted until all eight are up, then Public together |
| Comments | On, hold potentially inappropriate for review |
| End screen | Link to the next video in the playlist |

**Subtitles:** upload each video's `.srt` as the English track. Do not accept
auto-captions — they mangle the clinical and billing vocabulary (ICD-10, CPT,
CO-16, EDI, ERA, BID) and the SRT is already exact and correctly timed.

---

## V09 — Get a pre-authorization approved

**File:** `v09-get-a-pre-authorization-approved.mp4` · 2:14

### Title `44 chars`

```
AureonCare: Get a Pre-Authorization Approved
```

### Description

```
Requesting and tracking an insurance pre-authorization in AureonCare. Covers the pre-authorization queue and what each status means, building a request with the service description and the ICD-10 and CPT codes that justify it, and following it through to an approval with an authorization number.

Part of the AureonCare video library. Watch the Getting Started series first if you are new to the app.

Chapters:
0:00 Introduction
0:12 The pre-auth queue
0:36 Making the request
0:55 Justifying it
1:29 Tracking the decision
1:59 Recap

This video uses a demo environment with synthetic data. No real patient information appears in it.
```

### Tags `202 chars`

```
AureonCare, pre-authorization, prior authorization, insurance approval, revenue cycle management, medical billing, preauth tutorial, practice management software, healthcare billing, payer authorization
```

---

## V10 — Work a denial to resolution

**File:** `v10-work-a-denial-to-resolution.mp4` · 2:37

### Title `50 chars`

```
AureonCare: Work an Insurance Denial to Resolution
```

### Description

```
Working a denied insurance claim in AureonCare. Covers the denials queue, reading the CARC reason code the payer returned, recording a denial against the original claim, setting category and priority so the queue sorts itself, and tracking the appeal through to resolved.

Part of the AureonCare video library. Watch the Getting Started series first if you are new to the app.

Chapters:
0:00 Introduction
0:13 The denials queue
0:35 Recording the denial
0:51 The reason code
1:36 Resolving it
2:18 Recap

This video uses a demo environment with synthetic data. No real patient information appears in it.
```

### Tags `180 chars`

```
AureonCare, claim denial, denial management, insurance appeal, CARC codes, revenue cycle management, medical billing, denied claim, practice management software, healthcare revenue
```

---

## V11 — Record a payment and post it

**File:** `v11-record-a-payment-and-post-it.mp4` · 2:51

### Title `51 chars`

```
AureonCare: Record a Payment and Post It to a Claim
```

### Description

```
Recording and posting payments in AureonCare. Covers the difference between taking a payment and posting it, allocating an insurance remittance against a claim, the contractual adjustment versus patient responsibility, and why unposted payments make accounts receivable lie to you.

Part of the AureonCare video library. Watch the Getting Started series first if you are new to the app.

Chapters:
0:00 Introduction
0:13 Taking the payment
0:50 Posting it to the claim
1:28 Allocating it
2:32 Recap

This video uses a demo environment with synthetic data. No real patient information appears in it.
```

### Tags `200 chars`

```
AureonCare, payment posting, medical billing, accounts receivable, ERA remittance, revenue cycle management, insurance payment, practice management software, healthcare billing, patient responsibility
```

---

## V12 — Quote, invoice, get paid

**File:** `v12-quote-invoice-get-paid.mp4` · 2:18

### Title `50 chars`

```
AureonCare: Quote, Invoice and Get Paid (Self-Pay)
```

### Description

```
The self-pay billing path in AureonCare, for work no insurer is covering. Covers building a quote from the service catalogue, what to put in front of the patient before they commit, converting an accepted quote into an invoice, and tracking it through to paid.

Part of the AureonCare video library. Watch the Getting Started series first if you are new to the app.

Chapters:
0:00 Introduction
0:14 Why quotes exist
0:42 Building the quote
1:05 Terms and expiry
1:23 Quote to invoice to paid
2:05 Recap

This video uses a demo environment with synthetic data. No real patient information appears in it.
```

### Tags `191 chars`

```
AureonCare, medical invoice, patient quote, self pay billing, healthcare invoicing, practice management software, clinic billing, patient payments, service catalogue, medical practice revenue
```

---

## V13 — Prescribe and send electronically

**File:** `v13-prescribe-and-send-electronically.mp4` · 2:27

### Title `61 chars`

```
AureonCare: Prescribe and Send Electronically (e-Prescribing)
```

### Description

```
Electronic prescribing in AureonCare. Covers writing a prescription against the diagnosis that justifies it, the dose, frequency, quantity and refill fields and what each one controls, checking the chart for allergies and current medications before you send, choosing the patient's pharmacy, and where the prescription shows up afterwards.

Part of the AureonCare video library. Watch the Getting Started series first if you are new to the app.

Chapters:
0:00 Introduction
0:14 Prescribing in context
0:42 Writing the prescription
1:18 Check the chart first
1:44 Sending it
2:14 Recap

This video uses a demo environment with synthetic data. No real patient information appears in it.
```

### Tags `203 chars`

```
AureonCare, e-prescribing, eprescribe, electronic prescription, medication safety, prescription workflow, clinician training, electronic health records, practice management software, pharmacy integration
```

---

## V14 — Order a lab and file the result

**File:** `v14-order-a-lab-and-file-the-result.mp4` · 2:28

### Title `48 chars`

```
AureonCare: Order a Lab Test and File the Result
```

### Description

```
Ordering laboratory tests and handling results in AureonCare. Covers the Lab Orders tab on the patient chart, building an order with the right CPT panels and the diagnosis that justifies them, routine versus STAT, transmitting to the laboratory, and reviewing an abnormal result so the loop closes in the chart rather than in somebody's inbox.

Part of the AureonCare video library. Watch the Getting Started series first if you are new to the app.

Chapters:
0:00 Introduction
0:13 Ordering from the chart
0:43 Building the order
1:36 Filing the result
2:13 Recap

This video uses a demo environment with synthetic data. No real patient information appears in it.
```

### Tags `189 chars`

```
AureonCare, lab orders, laboratory results, clinical workflow, lab integration, electronic health records, clinician training, practice management software, LabCorp Quest, result management
```

---

## V15 — Record a diagnosis

**File:** `v15-record-a-diagnosis.mp4` · 2:07

### Title `52 chars`

```
AureonCare: Record a Diagnosis and Code It Correctly
```

### Description

```
Recording a diagnosis in AureonCare. Covers the diagnoses list and its filters, searching ICD-10 rather than typing codes from memory, what active, chronic and resolved each mean, severity, and how the coded diagnosis flows onto claims and into the patient portal.

Part of the AureonCare video library. Watch the Getting Started series first if you are new to the app.

Chapters:
0:00 Introduction
0:11 The diagnoses list
0:29 Adding one
0:44 Coding it
1:03 Status and severity
1:53 Recap

This video uses a demo environment with synthetic data. No real patient information appears in it.
```

### Tags `202 chars`

```
AureonCare, ICD-10 coding, medical diagnosis, clinical documentation, EHR charting, diagnosis coding, electronic health records, practice management software, clinician training, medical coding tutorial
```

---

## V16 — Set up appointment types and provider schedules

**File:** `v16-set-up-appointment-types-and-schedules.mp4` · 2:39

### Title `59 chars`

```
AureonCare: Set Up Appointment Types and Provider Schedules
```

### Description

```
Configuring scheduling in AureonCare. Covers appointment types and what the duration, colour and online-booking settings actually control downstream, then provider working hours, clinic hours and time off — the settings behind most day-to-day scheduling complaints.

Part of the AureonCare video library. Watch the Getting Started series first if you are new to the app.

Chapters:
0:00 Introduction
0:16 Appointment types
0:43 Creating a type
1:17 Provider schedules
2:26 Recap

This video uses a demo environment with synthetic data. No real patient information appears in it.
```

### Tags `202 chars`

```
AureonCare, appointment types, provider scheduling, clinic configuration, medical scheduling software, practice management software, working hours, healthcare admin, calendar setup, online booking setup
```

---

## Checks already done

- **Titles** 44–61 chars, inside YouTube's 100 limit.
- **Tags** 180–203 chars each, inside the 500-char budget.
- **Chapters** validated against the actual rendered durations: every list
  starts at 0:00, has at least three entries, and no chapter is shorter than
  YouTube's 10-second minimum, so all eight render as chapters.
- **Files** all 1920×1080, 30fps, H.264 High, faststart, AAC narration
  normalised to −16 LUFS. Upload as-is; no re-encode.

## Known deviation from the plan

`VIDEO_LIBRARY_PLAN.md` sets a 120-second hard cap. These run 2:07–2:51, so all
eight overrun it, as Wave 1's did. The cause is narration: spoken at an
unhurried pace, a caption takes roughly twice as long to hear as to read.
Bringing them under two minutes means cutting content, not speeding up delivery.
Worth a decision before Wave 3 — either revise the cap or split the longer
journeys.
