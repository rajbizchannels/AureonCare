# Video harness

Everything needed to produce the AureonCare training videos: a script per video,
a mocked API so no backend or database is involved, and a recorder that emits
YouTube-ready files.

```
harness.js    the recorder: mock API, branded overlay, caption/chapter capture, encode
voice.js      narration: synthesis, mastering, and the mix onto the picture
fixtures.js   the synthetic clinic — patients, appointments, claims, sessions
brand/        the AureonCare logo used by the bumper, captions, cards and thumbnails
record.js     CLI: record one video or all of them
probe.js      development helper: dump the selectors on any screen
scripts/      one file per video
```

## Branding

Every video opens on a logo bumper and closes on a branded outro card. In
between, the logo sits at the left of the caption bar, so a frame grabbed from
anywhere in the video is recognisably AureonCare.

The palette is sampled from the logo itself rather than invented: amber
`#f0b000` for emphasis and the step badge, teal `#00b0a0` for rules, the caption
border and the chapter kickers, on a near-black `#041016`. Change `BRAND` at the
top of `harness.js` and every surface follows — bumper, captions, cards and
thumbnails.

The recording starts at the bumper: the app's cold-start frames are trimmed off
in the encode, and the caption, chapter and narration timings are shifted to
match.

## Narration

Captions and narration are the same text, so the spoken line, the burned-in
caption and the `.srt` cannot drift apart. Each line is synthesised *before* its
caption is shown and the caption is then held for at least the length of its
audio — sync comes from the recording rather than from aligning afterwards.
Clips are mixed at their caption timestamps and mastered to -16 LUFS, which is
what YouTube normalises to.

| `VOICE_ENGINE` | What it does |
| --- | --- |
| `espeak` (default) | Offline espeak-ng through an mbrola voice. Always available, and audibly synthetic |
| `files` | Pre-recorded audio from `narration/<slug>/<NN>.wav`, numbered in speaking order |
| `none` | Silent track |

**The default voice is a placeholder.** It is clear and correctly timed, but it
sounds like a speech synthesiser and should not be what a customer hears. To
replace it, record or buy the lines, drop them in `narration/<slug>/00.wav`,
`01.wav`, … and re-run with `VOICE_ENGINE=files`. The picture does not need to
be re-recorded, and mastering, mixing and subtitles are unchanged. The exact
lines are in each video's `.srt`, in order.

Other knobs: `VOICE_NAME` (default `mb-us2`), `VOICE_RATE` (default 160 wpm),
`VOICE_CACHE`.

## Recording

```bash
# once
npm --prefix frontend install
npm i -g playwright ffmpeg-static

# terminal 1 — the app under test
cd frontend && HOST=localhost PORT=3000 BROWSER=none npm start

# terminal 2
NODE_PATH=$(npm root -g) node docs/demo/video-harness/record.js v03   # one
NODE_PATH=$(npm root -g) node docs/demo/video-harness/record.js all   # the wave
```

Output lands in `docs/demo/video-library/wave1/`, five files per video:

| File | What to do with it |
| --- | --- |
| `<slug>.mp4` | 1920×1080, 30fps, H.264 high, faststart, narrated AAC track — upload as-is |
| `<slug>.srt` | Upload as the English subtitle track. Do not settle for auto-captions |
| `<slug>.chapters.txt` | Paste into the description; the first entry is always 0:00 |
| `<slug>.metadata.md` | Title, description, tags and the upload checklist |
| `<slug>.thumbnail.png` | 1280×720 custom thumbnail |

`ffmpeg-static` is required for the mp4: Playwright's bundled ffmpeg can only
write VP8, so without a real ffmpeg you would be left with a `.webm`.

## Writing a new video script

A script is a module with metadata plus `run(d, page)`:

```js
module.exports = {
  id: 'V09', slug: 'v09-…', title: '…', thumbHeadline: '…',
  moduleLabel: 'Billing ▸ Pre-Authorizations', audience: 'Billing',
  intro: '…', journey: '…', youtubeTitle: '…', description: '…',
  tags: [...], recap: ['…', '…', '…'],
  async run(d, page) { … },
};
```

The harness supplies the title card, the recap card, the watermark and the
encode. `d` is the director:

| Call | Effect |
| --- | --- |
| `d.chapter('Booking the visit')` | Marks a YouTube chapter boundary |
| `d.step('Step 2 — New Appointment')` | Sets the step badge in the corner |
| `d.say(html, ms)` | Caption at the bottom; also the narration line and a subtitle |
| `d.card({...})` | Full-screen branded card (kicker, heading, sub, body, bullets) |
| `d.bumper()` | Logo bumper; the harness plays one at the top of every video |
| `d.click(locator)` | Moves the on-screen cursor, then clicks |
| `d.type(locator, text)` | Types at a readable speed |
| `d.fill(locator, value)` | Sets a value directly — use for date, time and number inputs |
| `d.select(locator, {label})` | Picks from a `<select>` |
| `d.nav('Billing', 'Claims')` | Workspace then module; tolerates single-destination groups |
| `d.scrollBy(px)` | Slow, readable scroll |

Two flags on the spec change how the session starts:

- `showsLogin: true` — start at the sign-in screen (only V01 does).
- `sessionUser: {...}` — record as somebody else. V08 uses a patient account so
  the portal video is genuinely the patient's view rather than a staff preview.

### Finding selectors

Do not guess them. `probe.js` boots the app with the same mocks and prints every
visible button, input and select:

```bash
NODE_PATH=$(npm root -g) node docs/demo/video-harness/probe.js "Billing" "Claims" "New Claim"
```

Labels come from the translation files, so they are not always what the
navigation config suggests — the Patients module renders as "Electronic Health
Records", for instance.

## How the mock works

`context.route('**/api/**')` answers every request from an in-memory store
seeded from `fixtures.js`. Named handlers cover login, search, code lookup,
telehealth and claim submission; everything else falls through to generic REST
(`GET /x`, `POST /x`, `GET/PUT/DELETE /x/:id`), so a journey that creates a
record really does see it appear in the list afterwards.

The app clears its session on every page load unless the load is the return leg
of an OAuth round trip, so the harness sets that marker alongside the seeded
session — otherwise every video would start at the login screen.

## Conventions

- 1920×1080 with narration; the captions carry the same words for sound-off viewing.
- Every frame carries the "demo environment · synthetic data" watermark.
- Personas match `../DEMO_SCENARIOS.md`: Sarah Williams is the patient,
  Dr. Anderson the provider.
- Target 60–120 seconds. If a journey overruns, split it rather than speed it up.
