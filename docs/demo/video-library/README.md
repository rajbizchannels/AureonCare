# AureonCare video library

Short, single-feature training videos. The catalogue and priorities live in
`../VIDEO_LIBRARY_PLAN.md`; production status lives in
`../AureonCare_Video_Library_Tracker.xlsx`. This folder holds what has actually
been produced.

## Wave 1 — Getting Started (`wave1/`)

Eight videos, one per journey, in watch order. Each is 1920×1080, 30fps, H.264,
with a silent audio track, and carries a "demo environment · synthetic data"
watermark in every frame.

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

## What is not in these videos

- **No voiceover.** Captions carry the teaching, and the burned-in text is what
  the `.srt` mirrors. If narration is added later, the silent AAC track is
  already in place, so the audio can be laid over without a re-encode.
- **No real data.** Every patient, clinician, claim and meeting link is
  synthetic, generated from `../video-harness/fixtures.js`.
- **No live backend.** The recordings run against a mocked API, which is what
  makes them reproducible. The UI is the real application throughout.
