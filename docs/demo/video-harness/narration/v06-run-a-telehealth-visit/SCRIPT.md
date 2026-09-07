# Recording sheet — v06-run-a-telehealth-visit

12 lines. Record each one as its own file in this folder, named
exactly as in the first column. WAV is preferred; m4a, mp3, flac and aac also work.

The "fits" column is how long the matching shot stays on screen in the current
cut. Coming in a little under is ideal. Going over is fine too — the recorder
re-times the picture to the audio when the video is re-run, so nothing falls out
of sync; the video simply gets slightly longer.

Read at a steady pace, leave a beat of silence at the top and tail of each take,
and keep the same mic and room across all of them. Room echo is dealt with
automatically — see ../README.md.

| File | Fits | Line |
| --- | --- | --- |
| `00.wav` | 8.1s | Run a telehealth visit, Clinical, Telehealth, Create a virtual visit from an appointment, attach a consent form, and join it. |
| `01.wav` | 5.6s | Clinical, Telehealth. The green banner names the connected platform, here, Google Meet. |
| `02.wav` | 8.3s | Your administrator connects that account once. Clinicians never touch credentials. |
| `03.wav` | 10.2s | A session is built from a booked appointment, so the patient, provider and time are already right. |
| `04.wav` | 9.8s | Attach a consent form and it arrives in the patient’s portal before the call, not during it. |
| `05.wav` | 8.3s | AureonCare confirms what it is about to do, then creates the meeting. |
| `06.wav` | 10.1s | The visit now sits under Upcoming Sessions, tagged with the platform and carrying its join link. |
| `07.wav` | 8.4s | Joining marks the session in progress, so the rest of the team can see you are in it. |
| `08.wav` | 3.7s | The meeting room opens in a new tab: the meeting link |
| `09.wav` | 6.2s | Need a call right now with no booking behind it? Instant creates a room immediately, use it for the unplanned. |
| `10.wav` | 12.6s | What you just did |
| `11.wav` | 9.0s | Health | Efficiency | Growth, More in the Getting Started series, the next video is linked on screen. |

When every line is recorded:

```bash
VOICE_ENGINE=files NODE_PATH=$(npm root -g) \
  node docs/demo/video-harness/record.js v06
```
