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

## Uploading

1. Create the playlist **AureonCare — Getting Started (Wave 1)** and add the
   videos in the numbered order above. The series is designed to be watched in
   sequence: video 1 teaches the navigation vocabulary the rest assume.
2. For each video, follow the upload table in its `.metadata.md`. Upload the
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

## Wave 2 (`wave2/`)

Being produced out of order, as the underlying screens change.

| # | Video | Module | Audience | Length |
| --- | --- | --- | --- | --- |
| 15 | Record a diagnosis | Clinical ▸ Diagnoses | Clinician | 2:17 |

## Before publishing: the narration voice

The videos are narrated, but by an offline speech synthesiser (espeak-ng with an
mbrola voice). It is clear and correctly timed, but it sounds synthetic, and it
is not what a customer should hear on a public channel.

**The fix is one credential.** Google Cloud Text-to-Speech is reachable from the
build environment and the harness already speaks it: set `GOOGLE_TTS_API_KEY`
and re-run with `VOICE_ENGINE=google`, and all eight are re-rendered in
`en-US-Neural2-D` — the male voice family Google Maps navigation uses. Nothing
else changes: same picture, same timing, same subtitles.

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
