# Marketing cuts — YouTube upload copy

**Generated file — do not edit by hand.** Regenerate with:

```
node docs/demo/video-harness/youtube-upload.js copy
```

Everything in a fenced block is **copy verbatim** into YouTube Studio.
Titles, descriptions and tags come from the specs in
`../../video-harness/scripts/marketing/`; chapter lists come from the
`.chapters.txt` the recorder wrote beside each video, so they always match the
cut that is actually in this folder.

A chapter list is only included where the video has three or more chapters
starting at 0:00 — below that YouTube ignores it and it is noise in the
description.

`youtube-upload.js` does all of this over the API, including thumbnails,
subtitles and the playlist. This file is the manual path.

---

## The playlist

### Playlist title `24 chars`

```
AureonCare — See It Work
```

### Playlist description

```
Short films showing AureonCare doing the job, with nothing staged and no slides. Each one follows a single piece of work end to end in the real product.

Try it: https://app.aureoncare.tech
```

---

## M1 — m01-one-patient-booking-to-paid `01:59`

### Title `63 chars`

```
One patient, booking to bank deposit — AureonCare in 90 seconds
```

### Description

```
One patient crosses the whole practice: a telehealth visit booked at the front desk, seen over video, documented in the chart, billed as a claim, and settled when the payment posts.

No cuts between modules and no switching systems — the continuity is the point.

0:00 Booked
0:30 Seen on video
0:48 Documented
1:04 Claimed
1:30 Paid

Try it: https://app.aureoncare.tech
```

### Tags

```
AureonCare, practice management software, medical billing software, telehealth software, EHR demo, clinic software, revenue cycle management, healthcare software demo, patient scheduling, medical practice software
```

### Thumbnail and subtitles

Upload `m01-one-patient-booking-to-paid.thumbnail.png` and `m01-one-patient-booking-to-paid.srt`.

---

## M2 — m02-friday-cancellation `01:02`

### Title `70 chars`

```
Friday 4:07pm, your 3:30 cancels — AureonCare front desk in 60 seconds
```

### Description

```
A late Friday cancellation, handled from the front desk: the appointment is cancelled, the waitlist notifies the next patient who wanted that slot, and their intake paperwork goes out on its own.

No phone tree, no re-typing, no empty hour.

0:00 The cancellation
0:21 The queue
0:43 The paperwork

Try it: https://app.aureoncare.tech
```

### Tags

```
AureonCare, medical practice management, patient waitlist, appointment cancellation, front desk software, clinic scheduling software, reduce empty appointments, patient intake software, healthcare scheduling, practice manager
```

### Thumbnail and subtitles

Upload `m02-friday-cancellation.thumbnail.png` and `m02-friday-cancellation.srt`.

---

## M3 — m03-chart-it-and-go `01:25`

### Title `72 chars`

```
Note, prescription, lab order — one record, clock on screen | AureonCare
```

### Description

```
A clinician documents a visit, writes a prescription and orders a lab panel without leaving the patient record. The elapsed-time clock runs on screen for the whole clip — nothing is cut away, and no step happens off camera.

Diagnoses, prescriptions and lab orders are tabs of the same chart, so an order placed here files its result back to the same record.

0:00 The chart
0:14 The note
0:42 The order

Try it: https://app.aureoncare.tech
```

### Tags

```
AureonCare, EHR software, electronic health records, e-prescribing, lab orders, clinical documentation, physician workflow, charting software, reduce documentation burden, medical software demo
```

### Thumbnail and subtitles

Upload `m03-chart-it-and-go.thumbnail.png` and `m03-chart-it-and-go.srt`.

---

## M4 — m04-who-opened-that-chart `01:23`

### Title `66 chars`

```
"Who opened that chart?" — answering it in two clicks | AureonCare
```

### Description

```
The question a compliance lead gets asked after an incident, answered on screen: the audit trail logs views as well as changes, filters down to the entry that matters, and shows who did what, when, and from where.

Then the part that decides whether the answer is trustworthy — the role matrix that made the access possible, and a FHIR R4 export proving the record can leave in a format any other system reads.

0:00 The trail
0:39 Why they could
0:52 And it can leave

Try it: https://app.aureoncare.tech
```

### Tags

```
AureonCare, healthcare compliance, audit trail, HIPAA audit log, role based access control, FHIR R4, interoperability, clinical governance, medical records access, healthcare IT
```

### Thumbnail and subtitles

Upload `m04-who-opened-that-chart.thumbnail.png` and `m04-who-opened-that-chart.srt`.

---

## M5 — m05-cant-collect-what-you-cant-see `01:04`

### Title `69 chars`

```
Every denial, with its reason code and what it costs you | AureonCare
```

### Description

```
Denials are where practice revenue quietly leaks. This shows the queue that makes each one visible — reason code, category, amount, priority and appeal deadline — recording a new denial against the claim it belongs to, and the receivable that stays on the books until it is settled.

Synthetic data throughout; no real patient information appears.

0:00 The queue
0:13 Nothing gets lost
0:41 On the books

Try it: https://app.aureoncare.tech
```

### Tags

```
AureonCare, medical billing, claim denials, denial management, revenue cycle management, accounts receivable, practice revenue, healthcare finance, billing software, RCM software
```

### Thumbnail and subtitles

Upload `m05-cant-collect-what-you-cant-see.thumbnail.png` and `m05-cant-collect-what-you-cant-see.srt`.

---

## M6 — m06-where-does-tuesday-go `00:25`

### Title `43 chars`

```
Where does Tuesday keep going? | AureonCare
```

### Description

```
The gap between what you booked and what you saw, in the report that shows it: no-show rate over ninety days, late cancellations alongside, and the detail behind the number.

Synthetic data; no real patient information appears.

Try it: https://app.aureoncare.tech
```

### Tags

```
AureonCare, no show rate, medical practice, patient no shows, practice management, clinic reports, healthcare analytics
```

### Thumbnail and subtitles

Upload `m06-where-does-tuesday-go.thumbnail.png` and `m06-where-does-tuesday-go.srt`.

---

## M7 — m07-one-click-to-video `00:22`

### Title `47 chars`

```
Nobody pasted this link | AureonCare telehealth
```

### Description

```
A telehealth session built from a booked appointment: the patient, provider and time come with it, and the meeting link attaches itself to the visit instead of being generated elsewhere and copied back in.

Synthetic data; no real patient information appears.

Try it: https://app.aureoncare.tech
```

### Tags

```
AureonCare, telehealth, virtual visit, Google Meet, telemedicine software, video consultation, clinic software
```

### Thumbnail and subtitles

Upload `m07-one-click-to-video.thumbnail.png` and `m07-one-click-to-video.srt`.

---

## M8 — m08-prior-auth-without-the-fax `00:27`

### Title `47 chars`

```
Prior auth without the fax machine | AureonCare
```

### Description

```
A prior authorization raised against the patient and payer, carrying its diagnosis and procedure codes, submitted to the clearinghouse, and tracked on a queue with a status.

Synthetic data; no real patient information appears.

Try it: https://app.aureoncare.tech
```

### Tags

```
AureonCare, prior authorization, pre-authorization, medical billing, revenue cycle management, clearinghouse, practice management
```

### Thumbnail and subtitles

Upload `m08-prior-auth-without-the-fax.thumbnail.png` and `m08-prior-auth-without-the-fax.srt`.

---

## M9 — m09-have-you-ever-put-one-back `00:20`

### Title `45 chars`

```
Have you ever put a backup back? | AureonCare
```

### Description

```
Taking backups is easy. Restoring one is the part nobody rehearses. A real backup file is handed to the restore and the product confirms what came back.

Timing is not shown: this runs against a demo API, so any duration on screen would say more about the demo than about your data.

Synthetic data; no real patient information appears.

Try it: https://app.aureoncare.tech
```

### Tags

```
AureonCare, backup and restore, disaster recovery, healthcare IT, practice management, data protection, business continuity
```

### Thumbnail and subtitles

Upload `m09-have-you-ever-put-one-back.thumbnail.png` and `m09-have-you-ever-put-one-back.srt`.

---

## M10 — m10-two-hundred-people-in-a-field `01:31`

### Title `62 chars`

```
Running a medical camp without losing the records | AureonCare
```

### Description

```
Outreach camps are run on paper almost everywhere: a table at the gate, a register, and a box of forms that someone types up weeks later — if at all. This follows one camp through the four parts of the module, in the order the day happens.

Planning that knows a camp takes clinicians away from the clinic, and says which appointments clash before anyone is rostered. A registration desk that issues a queue token and creates a real record at the gate. A live station board showing where the queue is building. And a sponsor report that is counts only — no names, no dates of birth, with small groups combined so a single case cannot identify anyone.

0:00 The camp
0:18 Who is on duty
0:33 The gate
0:50 The queue
1:01 What it was worth

Try it: https://app.aureoncare.tech
```

### Tags

```
AureonCare, medical camp, health camp software, outreach clinic, community health, screening camp, queue management, health camp report, patient registration, healthcare IT
```

### Thumbnail and subtitles

Upload `m10-two-hundred-people-in-a-field.thumbnail.png` and `m10-two-hundred-people-in-a-field.srt`.

---

## M11 — m11-which-site-was-that `00:44`

### Title `67 chars`

```
Running more than one site without running two systems | AureonCare
```

### Description

```
The moment a practice opens a second site, every number needs a qualifier: which site, whose patients, which room. Most systems answer that with a free-text address field and hope.

Locations makes a site a real thing the rest of the product can point at — clinics, camp venues, mobile units and partner premises, all the same kind of object. One is primary, and anything not assigned to a site belongs to it. Deactivating a site takes it out of every picker without rewriting the history that already references it.

Try it: https://app.aureoncare.tech
```

### Tags

```
AureonCare, multi site practice, clinic management, healthcare operations, practice management software, multi location, medical practice, healthcare IT
```

### Thumbnail and subtitles

Upload `m11-which-site-was-that.thumbnail.png` and `m11-which-site-was-that.srt`.

---

## M12 — m12-it-will-not-overwrite-what-you-changed `00:55`

### Title `61 chars`

```
Specialty setup that never overwrites your edits | AureonCare
```

### Description

```
Every practice management system starts the same way: generic. Every module switched on, no services, and a week of typing before it resembles the practice using it.

The specialty wizard asks what this practice actually does and creates the services, appointment types and forms to match. The part worth watching is the preview: nothing is written until the final step, and anything the practice has already edited is listed and then left exactly as it is. A later pack update will not quietly restore its own version over yours.

0:00 Generic by default
0:11 What this practice does
0:22 Before anything is written

Try it: https://app.aureoncare.tech
```

### Tags

```
AureonCare, practice setup, EHR onboarding, specialty configuration, clinic software setup, healthcare implementation, practice management, healthcare IT
```

### Thumbnail and subtitles

Upload `m12-it-will-not-overwrite-what-you-changed.thumbnail.png` and `m12-it-will-not-overwrite-what-you-changed.srt`.

