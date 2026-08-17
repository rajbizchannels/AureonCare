# Recording sheet — v01-find-your-way-around-aureoncare

14 lines. Record each one as its own file in this folder, named
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
| `00.wav` | 8.2s | Find your way around AureonCare, App shell, search, help, Sign in, learn the three-pane layout, and find anything in two clicks. |
| `01.wav` | 12.0s | Sign in with the email and password your practice administrator issued. |
| `02.wav` | 4.1s | You land on your dashboard. Everything else hangs off the rail on the left. |
| `03.wav` | 10.0s | Pane 1 is the workspace rail: Home, Scheduling, Patients, Clinical, Billing and the rest, with Settings at the bottom. |
| `04.wav` | 8.3s | Pane 2 lists the modules inside the workspace you picked. Pane 3 is the work itself. |
| `05.wav` | 10.7s | Scheduling, Calendar. Directions in these videos always read workspace, module. |
| `06.wav` | 9.3s | Rather than clicking through, search. The magnifier is in the top bar. |
| `07.wav` | 10.0s | One box covers patients, appointments, claims and tasks. Results are grouped by what they are. |
| `08.wav` | 6.2s | Selecting a result takes you straight to that record. |
| `09.wav` | 8.9s | The bell collects what needs you: denied claims, portal messages, posted payments. |
| `10.wav` | 3.6s | Help opens the guides for the module you are standing in. |
| `11.wav` | 9.6s | The whole workspace switches between dark and light to suit your room. |
| `12.wav` | 13.8s | What you just did |
| `13.wav` | 9.0s | Health | Efficiency | Growth, More in the Getting Started series, the next video is linked on screen. |

When every line is recorded:

```bash
VOICE_ENGINE=files NODE_PATH=$(npm root -g) \
  node docs/demo/video-harness/record.js v01
```
