# MedFlow Executive Demo - Video Editing Timeline

**Purpose:** Complete guide for assembling the MedFlow demo video in DaVinci Resolve (or similar editor)

**Final Duration:** 13 minutes 30 seconds
**Timeline Resolution:** 1920x1080, 30fps

---

## Overview

This timeline guide shows you how to assemble all your recorded elements into the final video:
- Screen recordings
- Voiceover audio
- Title cards and graphics
- Background music
- Transitions and effects

---

## Project Setup (DaVinci Resolve)

### Step 1: Create New Project

1. Launch DaVinci Resolve
2. Click **New Project**
3. Name: `MedFlow_Executive_Demo_v1`
4. Click **Create**

### Step 2: Set Timeline Settings

1. **File** → **Project Settings**
2. **Master Settings:**
   - Timeline resolution: **1920x1080 HD**
   - Timeline frame rate: **30 fps**
   - Playback frame rate: **30 fps**
3. Click **Save**

### Step 3: Import Media

1. Go to **Media Pool** (top-left)
2. Create bins (folders):
   - Right-click in Media Pool → **Create Bin**
   - Create bins:
     - `Screen Recordings`
     - `Voiceover Audio`
     - `Graphics`
     - `Music`
     - `Sound FX`
     - `Final Exports`

3. Import files:
   - **Right-click each bin** → **Import Media**
   - **Screen Recordings:** Import all .mp4 screen recordings
   - **Voiceover Audio:** Import voiceover .wav or .mp3 file
   - **Graphics:** Import title cards, logos, lower third PNG files
   - **Music:** Import background music tracks
   - **Sound FX:** Import any sound effects (optional)

### Step 4: Create Timeline

1. **Right-click in Media Pool** → **Create New Timeline**
2. **Name:** `MedFlow_Demo_Final`
3. **Settings:**
   - Use Project Settings
   - Resolution: 1920x1080
   - Frame rate: 30 fps
4. Click **Create**

---

## Timeline Structure

### Track Layout (Bottom to Top)

```
VIDEO TRACKS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
V5: Call-Out Boxes & Annotations
V4: Lower Thirds & Section Titles
V3: Graphics & Title Cards
V2: Transitions & Effects
V1: Main Screen Recordings
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AUDIO TRACKS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A4: Sound Effects (optional)
A3: Background Music
A2: System Sounds from Screen Recordings (usually muted)
A1: Voiceover (primary audio)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Complete Timeline Assembly

### TIMECODE REFERENCE

```
0:00:00 - Scene 1: Title Card
0:00:20 - Scene 2: Platform Overview
0:01:20 - Scene 3: Patient Search
0:02:10 - Scene 4: Appointment Booking
0:02:50 - Scene 5: Patient Chart Review
0:04:00 - Scene 6: SOAP Notes & Diagnosis
0:04:50 - Scene 7: Telehealth Session
0:06:00 - Scene 8: ePrescribing
0:06:40 - Scene 9: Lab Orders & FHIR Tracking
0:07:30 - Scene 10: Revenue Cycle Management
0:09:00 - Scene 11: Integration & Interoperability
0:10:00 - Scene 12: Reporting & Analytics
0:11:20 - Scene 13: Security & Compliance
0:12:00 - Scene 14: Summary & Value Proposition
0:13:00 - Scene 15: Closing & Call to Action
0:13:30 - End
```

---

## Scene-by-Scene Assembly

### SCENE 1: Title Card (0:00 - 0:20)

**VIDEO (V3 - Graphics Track):**
1. Create title card in **Fusion** or import graphic:
   - **Go to:** Effects Library → Titles → Text
   - **Drag to:** Timeline at 0:00:00
   - **Duration:** 20 seconds (0:00:00 to 0:00:20)
   - **Content:**
     ```
     [MedFlow Logo]

     MedFlow Healthcare Platform

     One Platform. One Patient Record. End-to-End Care.

     Executive Demonstration
     ```
   - **Background:** Solid color gradient (healthcare blue to white)
   - **Font:** Clean sans-serif (Helvetica, Arial), large and bold
   - **Animation:** Fade in (0.5s), hold, fade out (0.5s)

**AUDIO (A1 - Voiceover):**
- **Drag:** Voiceover audio file to timeline at 0:00:00
- **Trim:** To align with Scene 1 narration (0:00:00 to 0:00:20)

**AUDIO (A3 - Background Music):**
- **Drag:** Background music track to timeline at 0:00:00
- **Adjust volume:**
  - **Right-click** on audio clip → **Normalize Audio Levels**
  - **Set to:** -22dB (quiet, ambient)
- **Add fade in:**
  - Click clip, go to **Inspector** → **Volume**
  - Keyframe fade in over first 2 seconds

---

### SCENE 2: Platform Overview (0:20 - 1:20)

**VIDEO (V3 - Graphics Track):**
1. Create or import architecture diagram slide:
   - **Drag:** Platform overview graphic to timeline at 0:00:20
   - **Duration:** 60 seconds (0:00:20 to 0:01:20)
   - **Content:** Architecture diagram (see PRESENTATION_SLIDES_OUTLINE.md)
   - **Animation (optional):**
     - Use **Fusion** to animate modules appearing one by one
     - Or use static slide with simple fade in

**VIDEO (V4 - Lower Thirds):**
- **Add lower third:** "Comprehensive Healthcare Suite"
- **Timing:** 0:00:22 to 0:00:27 (5 seconds)
- **Position:** Bottom left or bottom center

**TRANSITION (Between Scene 1 and 2):**
- **Add:** Cross Dissolve (1 second)
- **Apply to:** End of Scene 1 / Start of Scene 2

**AUDIO (A1 - Voiceover):**
- Continue voiceover from Scene 1 (already on timeline)
- No trimming needed (continuous)

**AUDIO (A3 - Background Music):**
- Continue music (already on timeline)

---

### SCENE 3: Patient Search (1:20 - 2:10)

**VIDEO (V1 - Screen Recording):**
- **Drag:** `03_patient_search.mp4` to timeline at 0:01:20
- **Trim:** Remove buffer at start/end
- **Duration:** Adjust to ~50 seconds

**VIDEO (V4 - Lower Thirds):**
- **Add lower third:** "Patient Scheduling & Registration"
- **Timing:** 0:01:22 to 0:01:27 (5 seconds)
- **Position:** Bottom left

**VIDEO (V5 - Call-Outs):**
- **Call-out 1:** "Auto-Generated MRN" at 0:01:45
  - Use **Text** tool or **Shape + Text**
  - Position: Near MRN field
  - Duration: 2 seconds
  - Animation: Fade in/out

- **Call-out 2:** "Real-Time Eligibility" at 0:01:50
  - Position: Near insurance field
  - Duration: 2 seconds

**TRANSITION:**
- **Add:** Seamless cut OR very short (0.3s) cross dissolve to Scene 4

**AUDIO (A1 - Voiceover):**
- Continue from previous scene
- Voiceover should align with screen actions

**AUDIO (A2 - System Sounds):**
- **Mute** the audio from screen recording (usually not needed)
- OR lower to -30dB if you want subtle click sounds

---

### SCENE 4: Appointment Booking (2:10 - 2:50)

**VIDEO (V1 - Screen Recording):**
- **Drag:** `04_appointment_booking.mp4` to timeline at 0:02:10
- **Trim:** To ~40 seconds
- **Adjust:** Speed if needed (right-click → **Change Clip Speed** → 100-120%)

**VIDEO (V5 - Call-Outs):**
- **Call-out:** "✓ Appointment Confirmed" at 0:02:45
  - Position: Center or near confirmation message
  - Duration: 3 seconds
  - Style: Checkmark icon + text

- **Metric overlay:** "30-Second Registration vs. 5-10 Min Traditional"
  - Timing: 0:02:47 to 0:02:50
  - Position: Bottom right
  - Style: Small text box

**TRANSITION:**
- **Add:** Cross dissolve (1s) to Scene 5 (new module)

---

### SCENE 5: Patient Chart Review (2:50 - 4:00)

**VIDEO (V1 - Screen Recording):**
- **Drag:** `05_patient_chart.mp4` to timeline at 0:02:50
- **Duration:** ~70 seconds

**VIDEO (V4 - Lower Thirds):**
- **Add lower third:** "Electronic Health Record (EHR)"
- **Timing:** 0:02:52 to 0:02:57 (5 seconds)

**VIDEO (V5 - Call-Outs):**
- **Call-out 1:** "⚠️ Safety Alert: Penicillin Allergy" at 0:03:10
  - Position: Near allergy section
  - Duration: 3 seconds
  - Color: Red warning style

- **Call-out 2:** "Active Rx: Metformin 500mg BID" at 0:03:20
  - Position: Near medications
  - Duration: 2 seconds

- **Metric:** "40% Reduction in Documentation Time" at 0:03:55
  - Position: Bottom right
  - Duration: 3 seconds

---

### SCENE 6: SOAP Notes & Diagnosis (4:00 - 4:50)

**VIDEO (V1 - Screen Recording):**
- **Drag:** `06_soap_notes.mp4` to timeline at 0:04:00
- **Duration:** ~50 seconds

**VIDEO (V4 - Lower Thirds):**
- **Add lower third:** "Structured Clinical Documentation"
- **Timing:** 0:04:02 to 0:04:07

**VIDEO (V5 - Call-Outs):**
- **Call-out:** "ICD-10 Coding Assistance" at 0:04:35
  - Position: Near diagnosis search
  - Duration: 3 seconds

- **Call-out:** "Auto Charge Capture → Billing" at 0:04:45
  - Position: Bottom right
  - Duration: 3 seconds

**TRANSITION:**
- **Add:** Cross dissolve (1s) to Scene 7 (new module)

---

### SCENE 7: Telehealth Session (4:50 - 6:00)

**VIDEO (V1 - Screen Recording):**
- **Drag:** `07_telehealth.mp4` to timeline at 0:04:50
- **Duration:** ~70 seconds

**VIDEO (V4 - Lower Thirds):**
- **Add lower third:** "Telehealth - Fully Integrated"
- **Timing:** 0:04:52 to 0:04:57

**VIDEO (V5 - Call-Outs):**
- **Call-out 1:** "Multi-Provider Support: Zoom, Google Meet, Webex" at 0:05:10
  - Position: Top right
  - Duration: 3 seconds

- **Call-out 2:** "✓ Real-Time Documentation" at 0:05:30
  - Position: Bottom left
  - Duration: 2 seconds

- **Call-out 3:** "✓ Same Billing as In-Person" at 0:05:35
  - Position: Bottom left
  - Duration: 2 seconds

- **Metric:** "300% Increase in Patient Access" at 0:05:55
  - Position: Bottom right
  - Duration: 3 seconds

---

### SCENE 8: ePrescribing (6:00 - 6:40)

**VIDEO (V1 - Screen Recording):**
- **Drag:** `08_eprescribing.mp4` to timeline at 0:06:00
- **Duration:** ~40 seconds

**VIDEO (V4 - Lower Thirds):**
- **Add lower third:** "ePrescribing via Surescripts"
- **Timing:** 0:06:02 to 0:06:07

**VIDEO (V5 - Call-Outs):**
- **Call-out:** "✓ Sent to CVS Pharmacy" at 0:06:30
  - Position: Near confirmation message
  - Duration: 3 seconds

- **Call-out:** "Reaches 95% of US Pharmacies" at 0:06:35
  - Position: Bottom center
  - Duration: 3 seconds

**GRAPHICS (V2 - Animation):**
- **Optional:** Add animation showing prescription flow:
  - MedFlow → Surescripts → Pharmacy
  - Use simple arrow graphics
  - Timing: 0:06:32 to 0:06:36 (4 seconds)

---

### SCENE 9: Lab Orders & FHIR Tracking (6:40 - 7:30)

**VIDEO (V1 - Screen Recording):**
- **Drag:** `09_lab_orders.mp4` to timeline at 0:06:40
- **Duration:** ~50 seconds

**VIDEO (V4 - Lower Thirds):**
- **Add lower third:** "Lab Orders & FHIR Tracking"
- **Timing:** 0:06:42 to 0:06:47

**VIDEO (V5 - Call-Outs):**
- **Call-out 1:** "FHIR ServiceRequest → Labcorp" at 0:07:00
  - Position: Near order submission
  - Duration: 3 seconds

- **Call-out 2:** "Tracking #: LAB-123456" at 0:07:05
  - Position: Near tracking number
  - Duration: 3 seconds

**GRAPHICS (V3 - Timeline Animation):**
- **Optional:** Add visual timeline showing order progression:
  - Order Created → Sent → Acknowledged → Processing
  - Timing: 0:07:15 to 0:07:25 (10 seconds)
  - Use simple arrow or progress bar

**TRANSITION:**
- **Add:** Cross dissolve (1s) to Scene 10 (new module)

---

### SCENE 10: Revenue Cycle Management (7:30 - 9:00)

**VIDEO (V1 - Screen Recording):**
- **Drag:** `10_rcm.mp4` to timeline at 0:07:30
- **Duration:** ~90 seconds

**VIDEO (V4 - Lower Thirds):**
- **Add lower third:** "Revenue Cycle Management (RCM)"
- **Timing:** 0:07:32 to 0:07:37

**VIDEO (V5 - Call-Outs):**
- **Call-out 1:** "4.2% Denial Rate vs. 8-12% Industry Avg" at 0:07:50
  - Position: Near denial rate metric
  - Duration: 4 seconds
  - Color: Green (positive metric)

- **Call-out 2:** "✓ Automatic Charge Capture" at 0:08:05
  - Position: Top right
  - Duration: 3 seconds

- **Call-out 3:** "Zero Duplicate Entry" at 0:08:30
  - Position: Bottom right
  - Duration: 3 seconds

**GRAPHICS (V2 - Metric Animation):**
- **Animated metric:** "$245,890 Month-to-Date Revenue"
  - Use count-up effect (0 → $245,890)
  - Timing: 0:08:45 to 0:08:50 (5 seconds)
  - Position: Center or top center

---

### SCENE 11: Integration & Interoperability (9:00 - 10:00)

**VIDEO (V1 - Screen Recording):**
- **Drag:** `11_integration.mp4` to timeline at 0:09:00
- **Duration:** ~60 seconds

**VIDEO (V4 - Lower Thirds):**
- **Add lower third:** "Interoperability by Design"
- **Timing:** 0:09:02 to 0:09:07

**VIDEO (V5 - Call-Outs):**
- **Call-out:** "FHIR R4 Compliant" at 0:09:30
  - Position: Top center
  - Duration: 3 seconds

**GRAPHICS (V3 - Vendor Logos):**
- **Show vendor logos** (if not in screen recording):
  - Labcorp, Surescripts, Optum, Zoom logos
  - Timing: 0:09:10 to 0:09:20 (10 seconds)
  - Layout: 2x2 grid or horizontal row
  - Animation: Fade in one by one

**GRAPHICS (V2 - Data Flow Animation):**
- **Diagram:** MedFlow ↔ External Systems
  - Show bidirectional arrows
  - Timing: 0:09:35 to 0:09:45 (10 seconds)

---

### SCENE 12: Reporting & Analytics (10:00 - 11:20)

**VIDEO (V1 - Screen Recording):**
- **Drag:** `12_analytics.mp4` to timeline at 0:10:00
- **Duration:** ~80 seconds

**VIDEO (V4 - Lower Thirds):**
- **Add lower third:** "Real-Time Insights & Analytics"
- **Timing:** 0:10:02 to 0:10:07

**VIDEO (V5 - Call-Outs):**
- **Call-out 1:** "3.5% No-Show Rate vs. 10-15% Industry Avg" at 0:10:35
  - Position: Near no-show metric
  - Duration: 4 seconds

- **Call-out 2:** "4.2% Denial Rate vs. 8-12% Industry Avg" at 0:10:50
  - Position: Near denial rate
  - Duration: 4 seconds

- **Call-out 3:** "Real-Time (Not Monthly Reports)" at 0:11:10
  - Position: Bottom right
  - Duration: 5 seconds

**GRAPHICS (V3 - Chart Highlights):**
- **Optional:** If charts in recording are not clear, overlay cleaner versions
- **Highlight** specific metrics with colored boxes or arrows

---

### SCENE 13: Security & Compliance (11:20 - 12:00)

**VIDEO (V1 - Screen Recording OR V3 - Static Graphic):**

**Option A: Screen Recording**
- **Drag:** `13_security.mp4` to timeline at 0:11:20
- **Duration:** ~40 seconds

**Option B: Static Graphic Slide**
- **Create/Import:** Security architecture diagram
- **Duration:** 40 seconds (0:11:20 to 0:12:00)
- **Content:** Security layers diagram (see PRESENTATION_SLIDES_OUTLINE.md)

**VIDEO (V4 - Lower Thirds):**
- **Add lower third:** "Enterprise-Grade Security"
- **Timing:** 0:11:22 to 0:11:27

**GRAPHICS (V5 - Compliance Badges):**
- **Add:** HIPAA and GDPR compliance badges
- **Timing:** 0:11:50 to 0:11:58 (8 seconds)
- **Position:** Bottom corners
- **Style:** Official-looking badges with checkmarks

**GRAPHICS (V3 - Security Icons):**
- **Animate in:** Lock (encryption), Shield (RBAC), Log (audit) icons
- **Timing:** Sync with voiceover mentions
- **Duration:** 2-3 seconds each

**TRANSITION:**
- **Add:** Cross dissolve (1s) to Scene 14

---

### SCENE 14: Summary & Value Proposition (12:00 - 13:00)

**VIDEO (V3 - Graphics Track):**
- **Create/Import:** Summary slide
- **Duration:** 60 seconds (0:12:00 to 0:13:00)
- **Content:**
  ```
  Why MedFlow?

  ONE PATIENT,        END-TO-END         BETTER
  ONE RECORD          WORKFLOWS          OUTCOMES

  [Three-column layout with bullet points]

  ROI Snapshot:
  ⏱️ 30s registration vs. 5-10 min
  📉 3.5% no-shows vs. 10-15%
  💰 4.2% denials vs. 8-12%
  🔗 Zero duplicate entry
  📊 Real-time reporting
  ```

**GRAPHICS (V5 - Animated Metrics):**
- **Animate metrics** appearing one by one:
  - Metric 1 appears at 0:12:30
  - Metric 2 appears at 0:12:35
  - Metric 3 appears at 0:12:40
  - Metric 4 appears at 0:12:45
  - Metric 5 appears at 0:12:50
- **Animation:** Slide in from left or fade in

**GRAPHICS (V3 - MedFlow Logo):**
- **Add:** MedFlow logo reappears
- **Timing:** 0:12:55 (fades in)
- **Position:** Center or top center

**TRANSITION:**
- **Add:** Fade to black (0.5s) then fade to Scene 15

---

### SCENE 15: Closing & Call to Action (13:00 - 13:30)

**VIDEO (V3 - Graphics Track):**
- **Create/Import:** End screen
- **Duration:** 30 seconds (0:13:00 to 0:13:30)
- **Content:**
  ```
  [MedFlow Logo]

  One Platform. One Patient Record. End-to-End Care.

  Learn More
  www.medflow.com

  Contact Sales
  sales@medflow.com
  1-800-MEDFLOW

  [QR Code for Demo Booking]
  ```

**GRAPHICS (V4 - Animated Text):**
- **Contact information** fades in sequentially:
  - Website at 0:13:05
  - Email at 0:13:10
  - Phone at 0:13:15
  - QR code at 0:13:20

**AUDIO (A3 - Background Music):**
- **Music swells** slightly at 0:13:15
- **Fade out** from 0:13:25 to 0:13:30

**TRANSITION:**
- **Add:** Fade to black (1s) at 0:13:30

---

## Audio Mixing

### Voiceover (A1 Track)

1. **Select all voiceover clips** on A1 track
2. **Normalize audio:**
   - Go to **Fairlight** tab
   - Right-click clips → **Normalize Audio Levels**
   - Set peak to **-6dB**

3. **Apply compression:**
   - Select clips → **Effects Library** → **Compressor**
   - Settings: Ratio 3:1, Threshold -20dB, Attack 10ms, Release 100ms

4. **Apply EQ:**
   - **Effects Library** → **Parametric EQ**
   - Boost 2-5kHz by +3dB (clarity for voice)
   - Cut below 80Hz (remove rumble)

5. **Apply De-Esser (if needed):**
   - **Effects Library** → **De-Esser**
   - Reduce harsh "S" sounds

### Background Music (A3 Track)

1. **Adjust volume:**
   - Select music clip
   - Set volume to **-22dB** (quiet, ambient)

2. **Duck music under voiceover:**
   - **Option A (Manual):** Add keyframes to lower volume when voiceover is active
   - **Option B (Auto):** Use sidechain compression:
     - Right-click music clip → **Add Compressor**
     - Set sidechain input to A1 (voiceover)
     - Music will automatically duck when voice is present

3. **Add fade in/out:**
   - **Fade in:** 0:00:00 to 0:00:02 (2 seconds)
   - **Fade out:** 0:13:25 to 0:13:30 (5 seconds)

### System Sounds (A2 Track - if using)

1. **Mute or lower volume** to -30dB
2. **Only use** if you want subtle click/keyboard sounds for realism

---

## Color Grading (Optional but Recommended)

### Go to Color Tab

1. Click **Color** tab at bottom

### Apply Basic Color Correction to All Screen Recordings

For each screen recording clip:

1. **Balance exposure:**
   - Adjust **Lift, Gamma, Gain** wheels
   - Ensure whites are not blown out, blacks are not crushed

2. **Increase saturation slightly:**
   - **Saturation** slider: +5 to +10
   - Makes UI colors more vibrant

3. **Ensure consistency:**
   - All clips should have similar color/brightness
   - Use **Shot Match** tool to match clips if needed

### Apply LUT (Optional)

1. **Download free LUT:**
   - Search "Corporate LUT free download"
   - Or use built-in "Rec.709 A" LUT

2. **Apply LUT:**
   - Right-click clip in Color tab → **LUTs** → Select LUT

---

## Final Review & Adjustments

### Playback Review

1. **Play timeline from start to finish** (0:00:00 to 0:13:30)
2. **Watch for:**
   - Audio sync issues (voiceover matches actions)
   - Awkward cuts or transitions
   - Graphics appearing at wrong times
   - Volume inconsistencies
   - Color mismatches between clips

### Fine-Tuning

**Timing Adjustments:**
- Use **Trim Edit Mode** (keyboard: T) to fine-tune clip boundaries
- Use **Ripple Edit** to adjust without creating gaps

**Audio Sync:**
- If voiceover is out of sync, use **Slip Tool** (keyboard: Y) to shift audio slightly

**Graphics Timing:**
- Adjust in/out points of lower thirds and call-outs to match narration

### Get Feedback

1. **Export a draft** (see Export Settings below)
2. **Watch on different device** (TV, tablet, phone)
3. **Get colleague feedback**
4. **Make final adjustments**

---

## Export Settings

### Go to Deliver Tab

1. Click **Deliver** tab at bottom
2. Select **YouTube** preset (or create custom)

### Video Settings

- **Format:** MP4
- **Codec:** H.264
- **Resolution:** 1920x1080
- **Frame Rate:** 30 fps
- **Quality:**
  - **Best:** 15-20 Mbps bitrate (~1.5GB file size)
  - **Good:** 10-12 Mbps bitrate (~1GB file size)
- **Profile:** High
- **Encoding:** Single Pass

### Audio Settings

- **Codec:** AAC
- **Bitrate:** 256 kbps
- **Sample Rate:** 48kHz
- **Channels:** Stereo

### File Naming

- **Filename:** `MedFlow_Executive_Demo_v1_FINAL.mp4`
- **Location:** `/demo_recordings/final/`

### Render

1. Click **Add to Render Queue**
2. Click **Render All**
3. **Wait** for rendering to complete (may take 10-30 minutes)

### Test Final Video

1. **Play the exported video** from start to finish
2. **Check:**
   - Video plays without glitches
   - Audio is in sync
   - Quality is acceptable
   - File size is reasonable (500MB-2GB)
3. **Test on different devices** (computer, tablet, phone)
4. **Test on different players** (VLC, QuickTime, Windows Media Player)

---

## Additional Export Versions (Optional)

### Version 2: High Quality (For Archive)

- **Codec:** H.264
- **Bitrate:** 25 Mbps
- **File size:** ~2.5GB
- **Use for:** Master archive copy

### Version 3: Low Quality (For Email)

- **Resolution:** 1280x720
- **Bitrate:** 5 Mbps
- **File size:** ~500MB
- **Use for:** Email attachment (if needed)

### Version 4: Silent Version (No Audio)

- **Remove:** Voiceover and music tracks
- **Keep:** Only captions/subtitles
- **Use for:** Social media auto-play

---

## Captions/Subtitles (Highly Recommended)

### Add Subtitles in DaVinci Resolve

1. **Go to Edit tab**
2. **Right-click timeline** → **Subtitles** → **Create Subtitle Track**

### Import or Create Subtitles

**Option A: Auto-Generate (Requires Studio Version)**
- Use built-in transcription feature

**Option B: Import SRT File**
- Create .srt file from voiceover script
- **Subtitles** → **Import Subtitle File**

**Option C: Manual Entry**
- Click **Add Subtitle** for each line
- Type text and set timing

### Style Subtitles

- **Font:** Clean sans-serif (Arial, Helvetica)
- **Size:** Large enough to read (36-42pt)
- **Color:** White text
- **Background:** Black box with 50-70% opacity
- **Position:** Bottom center

### Export with Subtitles

- **Enable "Burn Subtitles"** in Deliver settings (subtitles baked into video)
- **OR Export .srt file separately** for YouTube upload

---

## Timeline Checklist

Before final export, check:

- [ ] All scenes are present (1-15)
- [ ] Total duration is 13:30 (±10 seconds acceptable)
- [ ] Voiceover is in sync with screen actions
- [ ] Background music is at appropriate volume (-22dB)
- [ ] All lower thirds appear and disappear correctly
- [ ] All call-outs appear at right moments
- [ ] Transitions are smooth
- [ ] Color is consistent across all clips
- [ ] No gaps or black frames in timeline
- [ ] Audio levels are normalized
- [ ] Title card and end screen are present
- [ ] All graphics/logos are high resolution (not pixelated)
- [ ] Captions/subtitles are accurate (if using)

---

## Backup & Archive

After final export:

1. **Save project:**
   - **File** → **Save Project As** → `MedFlow_Demo_v1_FINAL.drp`

2. **Archive media:**
   - Create folder: `/demo_archive/`
   - Copy all source files:
     - Screen recordings
     - Voiceover audio
     - Graphics
     - Music
     - Final exported video
     - DaVinci Resolve project file

3. **Create README.txt:**
   ```
   MedFlow Executive Demo Video Archive
   Date: [Date]
   Version: 1.0 FINAL

   Contents:
   - /screen_recordings/ - Original screen captures
   - /voiceover/ - Audio narration files
   - /graphics/ - Title cards, logos, lower thirds
   - /music/ - Background music tracks
   - /final/ - Exported final video
   - MedFlow_Demo_v1_FINAL.drp - DaVinci Resolve project
   ```

4. **Backup to cloud:**
   - Upload to Google Drive, Dropbox, or OneDrive
   - Keep local backup on external hard drive

---

## Troubleshooting

### Issue: Video and Audio Out of Sync

**Solution:**
- Use **Slip Tool** (Y) to shift audio slightly
- Check frame rate matches (30fps throughout)
- Re-render timeline in Edit tab

### Issue: Graphics Look Pixelated

**Solution:**
- Ensure graphics are at least 1920x1080 resolution
- Import high-quality PNG files
- Recreate graphics in Fusion at timeline resolution

### Issue: Music Too Loud

**Solution:**
- Lower music track to -25dB or -28dB
- Apply sidechain compression to duck under voiceover

### Issue: Rendering Takes Too Long

**Solution:**
- Close other applications
- Use hardware encoding (if available)
- Render in sections if needed

### Issue: Export File Too Large

**Solution:**
- Lower bitrate to 8-10 Mbps
- Use H.265 codec (smaller file, slower encoding)
- Reduce resolution to 720p (not recommended for demos)

---

## Video Distribution

### Upload to YouTube

1. **Go to:** https://www.youtube.com/upload
2. **Upload:** `MedFlow_Executive_Demo_v1_FINAL.mp4`
3. **Title:** "MedFlow Healthcare Platform - Executive Demo"
4. **Description:**
   ```
   Complete demonstration of MedFlow Healthcare Platform for executive management, clinicians, operations, and IT teams.

   Timestamps:
   0:00 - Introduction
   0:20 - Platform Overview
   1:20 - Patient Scheduling
   2:50 - Electronic Health Record
   4:50 - Telehealth
   6:00 - ePrescribing
   6:40 - Lab Orders & FHIR Tracking
   7:30 - Revenue Cycle Management
   9:00 - Integration & Interoperability
   10:00 - Reporting & Analytics
   11:20 - Security & Compliance
   12:00 - Summary

   Learn more: www.medflow.com
   Contact: sales@medflow.com
   ```
5. **Visibility:** Unlisted (for controlled sharing)
6. **Thumbnail:** Upload custom thumbnail with MedFlow logo
7. **Tags:** healthcare, EHR, telehealth, RCM, FHIR, medical software

### Share Link

- **YouTube:** https://youtu.be/[VIDEO_ID]
- **Vimeo:** https://vimeo.com/[VIDEO_ID]
- **Self-hosted:** Embed on www.medflow.com/demo

---

**Congratulations! Your MedFlow executive demo video is complete! 🎉**

---

**End of Video Editing Timeline**
