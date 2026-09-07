# Google Meet — OAuth verification demo video

Google's OAuth verification review asks for a video that shows, for the OAuth
client being verified: the app's branding, where a user starts the OAuth flow,
the consent screen with the requested scopes, and what the app does with the
data those scopes unlock.

This directory holds the recording and the script that produces it, so the
video can be re-cut whenever the UI changes.

| File | What it is |
| --- | --- |
| `aureoncare-google-meet-demo.mp4` | The recording (1280×720, ~3 min, no audio) |
| `record-google-meet-demo.js` | Playwright script that drives the app and records it |
| `demo-fixtures.js` | Synthetic clinic/patient/appointment data used by the recording |
| `out/` | Scratch output of the last run (git-ignored) |

## What the video shows

1. **Title card** — what AureonCare is and what the walkthrough covers.
2. **Sign-in** as a clinic administrator.
3. **Settings page** — *Settings ▸ Telehealth Setup*: the telehealth providers a
   clinic can connect, the platform setup notes naming the **Google Calendar
   API**, the redirect URI, then **Connect Google Meet Account** which starts
   the OAuth flow. After consent the card shows *Connected*, a **Test
   Connection** call confirms the Calendar API is reachable, and Google Meet is
   switched on as the clinic's provider.
4. **Configuration page** — *Settings ▸ Integrations*: the Google Meet entry with
   the OAuth **client id** and write-only **client secret** issued in Google
   Cloud Console.
5. **Telehealth page** — *Clinical ▸ Telehealth*: creating a visit from an
   appointment, which calls `calendar.events.insert` with a `conferenceData`
   request; the returned Meet link is stored on the visit, shown under Upcoming
   Sessions *via Google Meet*, and opened by **Join**.
6. **Summary card** — the requested scopes and the single purpose they serve.

Scopes covered: `https://www.googleapis.com/auth/calendar` and
`https://www.googleapis.com/auth/calendar.events`
(`backend/services/telehealthProviders/googleMeetService.js`).

## Before submitting to Google — read this

The committed recording runs in **mock mode**: the frontend is served locally
and every `/api` call is answered from `demo-fixtures.js`, so no backend,
database, real patient data or Google account is involved. Two consequences:

- **Google's consent screen is not in the recording.** It is Google's own
  screen and is deliberately not simulated — at that point the video states
  that AureonCare redirects to `accounts.google.com` and names the scopes being
  requested. Google's reviewers normally want to *see* the consent screen with
  the client id visible in the URL bar. Record that segment against a real
  deployment (see live mode below) or capture it separately and append it.
- The clinic, patients and OAuth client id on screen are invented. The video
  carries a permanent "demo environment · synthetic data" watermark so it is
  never mistaken for a recording of live clinical data.

Everything else — the pages, the navigation, the buttons, the state changes —
is the real application UI.

## Re-recording

Mock mode (no backend needed):

```bash
npm --prefix frontend install
npm i -g playwright ffmpeg-static     # ffmpeg-static is only needed for the mp4

# terminal 1
cd frontend && HOST=localhost PORT=3000 BROWSER=none npm start

# terminal 2
NODE_PATH=$(npm root -g) node docs/google-verification/record-google-meet-demo.js
cp docs/google-verification/out/aureoncare-google-meet-demo.mp4 docs/google-verification/
```

Live mode, against a deployment with real Google credentials — the OAuth popup
is recorded too, so Google's consent screen ends up in the video:

```bash
MODE=live \
DEMO_BASE_URL=https://your-deployment.example.com \
DEMO_EMAIL=admin@your-clinic.example \
DEMO_PASSWORD='…' \
NODE_PATH=$(npm root -g) node docs/google-verification/record-google-meet-demo.js
```

In live mode the script pauses at the consent step for up to three minutes so a
human can complete Google's sign-in and grant the scopes; it continues as soon
as the provider card reports *Connected*. Use a test clinic and a test Google
account — the run creates a real calendar event.

Useful overrides: `DEMO_API_URL` (defaults to `http://localhost:3001/api`, must
match `REACT_APP_SVC_URL` for the route mocks to match), `OUT_DIR`,
`FFMPEG_PATH`.

Playwright's bundled ffmpeg can only write VP8/webm, so the mp4 conversion needs
a real ffmpeg — `ffmpeg-static` or a system install. Without one the run still
produces `aureoncare-google-meet-demo.webm`.
