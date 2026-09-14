# Recording sheet — v03-book-an-appointment

16 lines. Record each one as its own file in this folder, named
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
| `00.wav` | 8.1s | Book an appointment, Scheduling, Calendar, Create, find and change an appointment, and understand what the type controls. |
| `01.wav` | 7.3s | Scheduling, Calendar is the practice diary, every provider, every room. |
| `02.wav` | 5.2s | Day view for working the desk hour by hour. |
| `03.wav` | 5.6s | Week view for spotting the gaps worth filling. |
| `04.wav` | 5.9s | Every booking answers four questions: who, what, with whom, and when. |
| `05.wav` | 6.7s | Who. Start typing or pick from the register, the M R N disambiguates namesakes. |
| `06.wav` | 6.6s | What. The appointment type sets the duration for you, change the type, not the clock. |
| `07.wav` | 6.0s | With whom. Only providers who work that day are offered. |
| `08.wav` | 6.7s | When. Pick the slot; the duration follows the type you chose. |
| `09.wav` | 6.6s | A one-line reason is what the clinician reads before the patient walks in. |
| `10.wav` | 8.1s | A confirmation step, so a mis-click never books a patient. |
| `11.wav` | 7.8s | Booked. The slot fills on the calendar and the patient gets their reminder. |
| `12.wav` | 4.6s | The List view is the same diary as a searchable table, where you change or cancel a booking. |
| `13.wav` | 6.4s | Cancelling keeps the record and its reason. Deleting would erase the history, so cancel, do not delete. |
| `14.wav` | 11.8s | What you just did |
| `15.wav` | 9.0s | Health | Efficiency | Growth, More in the Getting Started series, the next video is linked on screen. |

When every line is recorded:

```bash
VOICE_ENGINE=files NODE_PATH=$(npm root -g) \
  node docs/demo/video-harness/record.js v03
```
