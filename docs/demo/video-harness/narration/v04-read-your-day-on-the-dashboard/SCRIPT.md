# Recording sheet — v04-read-your-day-on-the-dashboard

10 lines. Record each one as its own file in this folder, named
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
| `00.wav` | 7.4s | Read your day on the dashboard, Home, Dashboard, What each tile counts, and how to jump from a number to the work behind it. |
| `01.wav` | 4.2s | Home, Dashboard is where the day starts: the practice at a glance. |
| `02.wav` | 8.5s | Each tile counts something live, today’s appointments, active patients, open tasks, revenue this month. |
| `03.wav` | 6.2s | These are not a report you run. They are the current state, and they move as the day does. |
| `04.wav` | 8.6s | Every card on the dashboard opens the module behind it, one click, no navigation. |
| `05.wav` | 13.3s | You land in the module itself, ready to work rather than to read. |
| `06.wav` | 6.7s | Quick Actions starts the jobs you do most, a patient, an appointment, a claim, without hunting for the module. |
| `07.wav` | 5.0s | That is the habit: read the tiles at the start of the day, then click the one that needs you. |
| `08.wav` | 11.3s | What you just did |
| `09.wav` | 9.0s | Health | Efficiency | Growth, More in the Getting Started series, the next video is linked on screen. |

When every line is recorded:

```bash
VOICE_ENGINE=files NODE_PATH=$(npm root -g) \
  node docs/demo/video-harness/record.js v04
```
