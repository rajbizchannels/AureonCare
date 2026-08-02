# AureonCare video library

Short, single-feature training videos. The catalogue and priorities live in
`../VIDEO_LIBRARY_PLAN.md`; production status lives in
`../AureonCare_Video_Library_Tracker.xlsx`. This folder holds what has actually
been produced.

## Wave 1 — Getting Started (`wave1/`)

Eight videos, one per journey, in watch order. Each is 1920×1080, 30fps, H.264
with a narrated audio track, opens on an AureonCare logo bumper, carries the
logo in the caption bar throughout, and shows a "demo environment · synthetic
data" watermark over the application itself.

| # | Video | Module | Audience |
| --- | --- | --- | --- |
| 1 | Find your way around AureonCare | App shell · search · help | Everyone |
| 2 | Register a new patient | Patients ▸ Electronic Health Records | Front desk |
| 3 | Book an appointment | Scheduling ▸ Calendar | Front desk |
| 4 | Read your day on the dashboard | Home ▸ Dashboard | Everyone |
| 5 | Document a visit | Patients ▸ Patient History | Clinician |
| 6 | Run a telehealth visit | Clinical ▸ Telehealth | Clinician |
| 7 | Create and submit a claim | Billing ▸ Claims | Billing |
| 8 | What your patients see | Patient Portal | Front desk · clinician |

Each video ships with five files:

- `.mp4` — upload as-is, no re-encode needed
- `.srt` — upload as the English subtitle track
- `.chapters.txt` — paste into the description (first entry is 0:00)
- `.metadata.md` — title, description, tags, upload checklist
- `.thumbnail.png` — 1280×720 custom thumbnail

### The `.mp4` and `.thumbnail.png` files are not in this repository

They are build output, roughly 110 MB per render, and carrying them in git meant
a fresh copy of all eight on every re-render. They are distributed as downloads
instead. The text alongside them — `.srt`, `.chapters.txt`, `.metadata.md` and
`YOUTUBE_UPLOAD_COPY.md` — is tracked, because it diffs cleanly and is what you
actually review.

To produce the videos and thumbnails locally, run the recorder (see
[Re-recording](#re-recording) below). Everything needed to regenerate them
byte-for-consistently — scripts, harness, fixtures, brand assets — is in the
repo; `.gitignore` keeps the output itself untracked.

## Wave 2 — Revenue and Clinical (`wave2/`)

Eight more, same format, for the modules that decide whether the clinic gets
paid and whether clinicians stay in the system. These assume Wave 1: they give
directions as "go to Billing, then Denials" without re-teaching the navigation.

| # | Video | Module | Audience |
| --- | --- | --- | --- |
| 9 | Get a pre-authorization approved | Billing ▸ Pre-Authorizations | Billing |
| 10 | Work a denial to resolution | Billing ▸ Denials | Billing |
| 11 | Record a payment and post it | Billing ▸ Payments · Payment Postings | Billing |
| 12 | Quote, invoice, get paid | Billing ▸ Quotes & Invoices | Front desk · billing |
| 13 | Prescribe and send electronically | Patients ▸ Diagnoses ▸ e-Prescribe | Clinician |
| 14 | Order a lab and file the result | Patients ▸ Patient History ▸ Lab Orders | Clinician |
| 15 | Record a diagnosis | Patients ▸ Diagnoses | Clinician |
| 16 | Set up appointment types and provider schedules | Scheduling ▸ Setup · Providers | Admin |

Unlike Wave 1, this series is not meant to be watched end to end — take the ones
that match the job. Upload copy is in
[`wave2/YOUTUBE_UPLOAD_COPY.md`](wave2/YOUTUBE_UPLOAD_COPY.md).

## Uploading

Paste-ready copy — title, description, tags and chapters, split by the field
each goes into in YouTube Studio — is in
[`wave1/YOUTUBE_UPLOAD_COPY.md`](wave1/YOUTUBE_UPLOAD_COPY.md) and
[`wave2/YOUTUBE_UPLOAD_COPY.md`](wave2/YOUTUBE_UPLOAD_COPY.md), each opening
with the playlist title and description. Use those rather than the
`.metadata.md` files for the description box: the metadata files are the
production record and carry notes that should not be published.

1. Create the playlist **AureonCare — Getting Started (Wave 1)** and add the
   videos in the numbered order above. The series is designed to be watched in
   sequence: video 1 teaches the navigation vocabulary the rest assume. The
   playlist title and description are the first section of
   [`wave1/YOUTUBE_UPLOAD_COPY.md`](wave1/YOUTUBE_UPLOAD_COPY.md); set the
   ordering to manual rather than "date added".
2. For each video, copy the blocks from `YOUTUBE_UPLOAD_COPY.md`. Upload the
   `.srt` rather than accepting auto-captions — auto-captions mangle the
   clinical vocabulary and the SRT is already exact.
3. Paste the chapter list into the description. YouTube needs the first chapter
   at 0:00 and each chapter at least 10 seconds long; the generated files
   already satisfy both, so paste them unedited.
4. Set the custom thumbnail, mark **Not made for kids**, and set the language to
   English.
5. Keep them **Unlisted** until all eight are up, then publish together and add
   end screens pointing at the next video in the playlist.

## Re-recording

Every video is script-driven — see `../video-harness/README.md`. When the UI
changes, re-run the affected script rather than editing a video:

```bash
cd frontend && HOST=localhost PORT=3000 BROWSER=none npm start   # terminal 1
NODE_PATH=$(npm root -g) node docs/demo/video-harness/record.js v03   # terminal 2
```

## The narration voice

All eight videos are narrated in **`en-US-Neural2-D`** through Google Cloud
Text-to-Speech — the male US voice from the family Google Maps navigation speaks
with, read at 0.96 rate and a semitone down to match its measured, unhurried
delivery. Each `.metadata.md` records the engine and voice it was rendered with.

This replaces the offline espeak-ng/mbrola track the first cut carried. Google
does not publish which model Maps ships, so this is the same vendor, language
and character rather than a guaranteed identical model; unlike a cloned voice it
is licensed for this use through Google Cloud.

To re-render after a UI or script change, export a key with the Cloud
Text-to-Speech API enabled and run:

```bash
export GOOGLE_TTS_API_KEY=…
VOICE_ENGINE=google NODE_PATH=$(npm root -g) \
  node docs/demo/video-harness/record.js all
```

Clips are cached by voice and text, so a re-run only pays for lines that
changed. Wave 1 is 100 lines, roughly 12,000 characters.

Prefer a human voice instead?

Replacing it does **not** mean re-recording anything. Every line of every video
is already written out as a recording sheet at
`../video-harness/narration/<slug>/SCRIPT.md` — the lines in order, the file
name each belongs in, and how long the matching shot stays on screen. Record
them, drop them in beside the sheet, and re-run with `VOICE_ENGINE=files`.
Timing, mixing, mastering, subtitles and chapters are all unchanged.

Wave 1 is 100 lines, about 14 minutes of speech. Room echo is removed
automatically; `../video-harness/narration/README.md` has the details and a
before/after sample.

## What is not in these videos
- **No real data.** Every patient, clinician, claim and meeting link is
  synthetic, generated from `../video-harness/fixtures.js`.
- **No live backend.** The recordings run against a mocked API, which is what
  makes them reproducible. The UI is the real application throughout.
