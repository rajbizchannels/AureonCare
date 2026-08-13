# Recording sheet — v08-what-your-patients-see

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
| `00.wav` | 7.6s | What your patients see, Patient Portal, The portal from the patient’s side, so you can answer their questions with confidence. |
| `01.wav` | 4.8s | This is not a staff preview. We are signed in as the patient, the portal is their whole app. |
| `02.wav` | 12.1s | The Overview opens on what is next: their upcoming appointment and anything waiting for them. |
| `03.wav` | 8.8s | Patients see their own history and what is booked, which is most of the calls your desk takes. |
| `04.wav` | 7.8s | Diagnoses shows the problem list in plain terms, with the date each was made. |
| `05.wav` | 8.2s | Prescriptions lists what is active, the dose, and how many refills remain. |
| `06.wav` | 8.5s | Records is the visit notes you save in the chart. Write them knowing the patient will read them. |
| `07.wav` | 9.8s | Forms Requested is where intake and consent forms land. Completed here, they arrive back on the chart. |
| `08.wav` | 15.3s | What you just did |
| `09.wav` | 9.0s | Health | Efficiency | Growth, More in the Getting Started series, the next video is linked on screen. |

When every line is recorded:

```bash
VOICE_ENGINE=files NODE_PATH=$(npm root -g) \
  node docs/demo/video-harness/record.js v08
```
