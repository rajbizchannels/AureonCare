# Recording sheet — v02-register-a-new-patient

13 lines. Record each one as its own file in this folder, named
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
| `00.wav` | 9.3s | Register a new patient, Patients, Electronic Health Records, Create a patient record properly, so scheduling, billing and the portal all work later. |
| `01.wav` | 5.5s | Patients, Electronic Health Records is the register: every patient the practice knows. |
| `02.wav` | 7.0s | Search accepts a name, an M R N, an email or a phone number. |
| `03.wav` | 10.3s | New Patient opens one form. Required fields are marked; the rest can follow later. |
| `04.wav` | 8.9s | Name, date of birth and gender identify the record. The M R N is generated for you. |
| `05.wav` | 14.4s | The email address is what invites this patient to the portal later, worth getting right at the desk. |
| `06.wav` | 9.6s | Insurance is what claims are built from. A record without it will bill as self-pay. |
| `07.wav` | 7.1s | An emergency contact takes ten seconds now and matters on the worst day. |
| `08.wav` | 7.1s | AureonCare confirms before it writes a new record. |
| `09.wav` | 7.4s | Saved. The patient joins the register immediately, with an M R N assigned. |
| `10.wav` | 3.1s | Searching by surname brings the new record straight back. |
| `11.wav` | 13.3s | What you just did |
| `12.wav` | 9.0s | Health | Efficiency | Growth, More in the Getting Started series, the next video is linked on screen. |

When every line is recorded:

```bash
VOICE_ENGINE=files NODE_PATH=$(npm root -g) \
  node docs/demo/video-harness/record.js v02
```
