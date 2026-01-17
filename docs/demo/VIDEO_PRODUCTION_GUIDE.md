# AureonCare Executive Demo - Video Production Guide

**Purpose:** This guide provides step-by-step instructions for creating a professional 13.5-minute demo video for AureonCare.

**Target Duration:** 13 minutes 30 seconds
**Format:** MP4 (1920x1080, 30fps)
**Audio:** Professional voiceover with background music
**Style:** Professional, clean, modern healthcare aesthetic

---

## Table of Contents

1. [Pre-Production](#pre-production)
2. [Tools & Software](#tools--software)
3. [Recording Setup](#recording-setup)
4. [Production Workflow](#production-workflow)
5. [Post-Production](#post-production)
6. [Export Settings](#export-settings)
7. [Quality Checklist](#quality-checklist)

---

## Pre-Production

### Step 1: Prepare Your Environment

**AureonCare Setup:**
- [ ] Backend running on `localhost:3000`
- [ ] Frontend running on `localhost:3001`
- [ ] Demo database loaded with Sarah Williams data
- [ ] Logged in as Dr. Anderson (dr.anderson@aureoncare.com)
- [ ] Browser in full-screen mode (F11)
- [ ] Browser zoom at 100%
- [ ] Hide browser bookmarks bar
- [ ] Close unnecessary tabs (only AureonCare open)

**Computer Preparation:**
- [ ] Close all non-essential applications
- [ ] Disable notifications (Do Not Disturb mode)
- [ ] Set display resolution to 1920x1080
- [ ] Clean desktop (hide icons if showing desktop)
- [ ] Ensure 20GB+ free disk space for recording
- [ ] Fully charged (if laptop) or plugged in

### Step 2: Prepare Recording Materials

**Scripts & Guides:**
- [ ] Print voiceover script (or have on second monitor)
- [ ] Print scene-by-scene storyboard
- [ ] Print screen recording guide
- [ ] Have demo scenarios reference available

**Media Assets:**
- [ ] Logo files (PNG with transparency)
- [ ] Intro slide graphics
- [ ] Background music tracks (royalty-free)
- [ ] Transition animations (if using)
- [ ] End screen graphics

---

## Tools & Software

### Screen Recording Software

**Option 1: OBS Studio (Free, Recommended)**
- Download: https://obsproject.com/
- Platform: Windows, Mac, Linux
- Features: Professional-grade, free, highly customizable
- Output: MP4, MKV, FLV

**Option 2: Camtasia (Paid)**
- Download: https://www.techsmith.com/video-editor.html
- Platform: Windows, Mac
- Features: Built-in editing, easy to use
- Price: ~$300 one-time

**Option 3: Loom (Free/Paid)**
- Download: https://www.loom.com/
- Platform: Web-based, desktop apps available
- Features: Quick recording, cloud hosting
- Limitation: 5-minute limit on free plan

**Option 4: ScreenFlow (Mac Only, Paid)**
- Download: https://www.telestream.net/screenflow/
- Platform: Mac
- Features: Professional editing, animation
- Price: ~$170 one-time

**Recommended:** OBS Studio for recording + DaVinci Resolve for editing (both free)

### Video Editing Software

**Option 1: DaVinci Resolve (Free, Professional)**
- Download: https://www.blackmagicdesign.com/products/davinciresolve
- Platform: Windows, Mac, Linux
- Features: Professional color grading, audio editing, effects
- Free version is fully featured

**Option 2: Adobe Premiere Pro (Paid)**
- Download: https://www.adobe.com/products/premiere.html
- Platform: Windows, Mac
- Price: $20.99/month
- Features: Industry-standard, extensive plugin ecosystem

**Option 3: Final Cut Pro (Mac Only, Paid)**
- Download: https://www.apple.com/final-cut-pro/
- Platform: Mac
- Price: $299 one-time
- Features: Optimized for Mac, fast rendering

**Option 4: Camtasia (Paid)**
- Same as recording software above
- Easier learning curve for beginners

**Recommended:** DaVinci Resolve (free and professional)

### Audio Recording Software

**Option 1: Audacity (Free)**
- Download: https://www.audacityteam.org/
- Platform: Windows, Mac, Linux
- Use for: Recording voiceover separately

**Option 2: Adobe Audition (Paid)**
- Part of Adobe Creative Cloud
- Professional audio editing

**Option 3: Built-in Mic (Acceptable)**
- Record voiceover directly in video editor
- Use a quiet room and decent microphone

### Additional Tools

**Graphics & Titles:**
- Canva (free/paid) - for title cards, lower thirds
- PowerPoint/Keynote - for slide graphics
- GIMP (free) - image editing

**Screen Capture (for screenshots):**
- macOS: Command+Shift+4
- Windows: Snipping Tool or Snip & Sketch
- Linux: GNOME Screenshot

**Audio:**
- Royalty-free music: Epidemic Sound, Artlist, YouTube Audio Library
- Sound effects: Freesound.org

---

## Recording Setup

### OBS Studio Setup (Recommended)

**Step 1: Install and Configure OBS**

```bash
# Download from https://obsproject.com/
# Install and launch OBS Studio
```

**Step 2: Create Scene for Screen Recording**

1. Open OBS Studio
2. Click "+" under "Scenes" → Name: "AureonCare Demo"
3. Click "+" under "Sources" → Select "Display Capture" (for full screen)
   - OR "Window Capture" (to capture only browser window)
4. Name: "AureonCare Screen"
5. Select your display or browser window
6. Click OK

**Step 3: Configure Recording Settings**

1. Go to **Settings** → **Output**
   - Output Mode: **Simple**
   - Recording Quality: **High Quality, Medium File Size**
   - Recording Format: **MP4**
   - Encoder: **Hardware (if available)** or **x264**

2. Go to **Settings** → **Video**
   - Base Canvas Resolution: **1920x1080**
   - Output Resolution: **1920x1080**
   - FPS: **30**

3. Go to **Settings** → **Audio**
   - Sample Rate: **48 kHz**
   - Channels: **Stereo**
   - Desktop Audio: **Default** (to capture system sounds if needed)
   - Mic/Auxiliary Audio: **Your Microphone** (if recording voiceover live)

**Step 4: Add Webcam (Optional)**

If you want a "talking head" overlay:
1. Click "+" under "Sources" → **Video Capture Device**
2. Select your webcam
3. Resize and position in corner (recommended: bottom-right)
4. Right-click → **Filters** → Add **Chroma Key** if using green screen

**Step 5: Test Recording**

1. Click **Start Recording**
2. Perform a 30-second test
3. Click **Stop Recording**
4. Go to **File** → **Show Recordings** to find the file
5. Watch the test video to check quality

---

## Production Workflow

### Recording Approach

**Option A: Record in One Take (Recommended for experienced presenters)**
- Record the entire 13.5-minute demo in one continuous take
- Advantages: Natural flow, authentic presentation
- Disadvantages: Requires practice, harder to fix mistakes

**Option B: Record in Segments (Recommended for beginners)**
- Record each section separately (12 segments matching slides)
- Advantages: Easier to fix mistakes, less pressure
- Disadvantages: Requires more editing to stitch together

**Option C: Hybrid Approach (Best of both worlds)**
- Record in 3-5 larger segments
- Segment 1: Intro + Platform Overview (2 min)
- Segment 2: Scheduling + EHR (3.5 min)
- Segment 3: Telehealth (1.5 min)
- Segment 4: Labs + RCM (3 min)
- Segment 5: Integration + Reporting + Closing (4 min)

**Recommended:** Option C (Hybrid) for balance of quality and ease

### Recording Process (Segment-by-Segment)

**For Each Segment:**

1. **Prepare:**
   - Read the script section 2-3 times
   - Set up AureonCare to the starting screen
   - Close unnecessary tabs/windows
   - Take a deep breath

2. **Record:**
   - Click "Start Recording" in OBS
   - Wait 2 seconds (buffer)
   - Perform the demo actions while narrating
   - If you make a mistake:
     - **Option 1:** Pause for 3 seconds, then re-do the last sentence (edit out later)
     - **Option 2:** Stop recording, start over
   - Complete the segment
   - Wait 2 seconds (buffer)
   - Click "Stop Recording"

3. **Review:**
   - Watch the recording immediately
   - Check for:
     - Audio quality (no background noise, clear voice)
     - Video quality (smooth, no lag)
     - Mistakes or awkward pauses
   - If acceptable, move to next segment
   - If not acceptable, re-record

4. **Label:**
   - Rename file: `01_intro_platform_overview.mp4`
   - Save in organized folder: `/demo_recordings/raw/`

### Voiceover Recording (If recording separately)

**Setup:**
1. Use a quiet room
2. Use a decent microphone (Blue Yeti, Audio-Technica AT2020, or similar)
3. Position mic 6-8 inches from mouth
4. Use pop filter to reduce plosives (P, B, T sounds)

**Recording:**
1. Open Audacity
2. Click **Record**
3. Read the voiceover script naturally
4. Speak clearly at a moderate pace (~140-160 words per minute)
5. Pause briefly between sentences
6. Click **Stop** when finished
7. **Export** → **Export as WAV** (high quality) or MP3

**Audio Editing:**
1. Remove background noise: **Effect** → **Noise Reduction**
2. Normalize volume: **Effect** → **Normalize**
3. Add compression: **Effect** → **Compressor**
4. Remove long pauses or mistakes
5. Export final audio file

---

## Post-Production

### Video Editing Workflow (DaVinci Resolve)

**Step 1: Import Media**

1. Launch DaVinci Resolve
2. Create New Project: "AureonCare Executive Demo"
3. Go to **Media Pool** (top-left)
4. Create bins (folders):
   - Raw Recordings
   - Graphics
   - Music
   - SFX
   - Final
5. Import all recordings, graphics, music

**Step 2: Assemble Timeline**

1. Set timeline settings:
   - **Right-click in Media Pool** → **Create New Timeline**
   - Name: "AureonCare Demo Final"
   - Resolution: **1920x1080**
   - Frame rate: **30fps**
2. Drag clips to timeline in order
3. Trim clips:
   - Remove buffer sections (first/last 2 seconds)
   - Remove mistakes or long pauses
   - Use **Blade Tool (B)** to cut, then delete unwanted sections

**Step 3: Add Transitions**

Between segments, add smooth transitions:
1. Go to **Effects Library** → **Video Transitions**
2. Drag **Cross Dissolve** between clips (0.5-1 second duration)
3. For major section changes, use **Dip to Black** (1 second)

**Step 4: Add Titles & Graphics**

**Title Card (0:00-0:05):**
1. Go to **Effects Library** → **Titles** → **Text**
2. Drag to timeline above video track
3. Edit text in **Inspector** panel:
   ```
   AureonCare Healthcare Platform

   One Platform. One Patient Record. End-to-End Care.
   ```
4. Font: Clean sans-serif (e.g., Helvetica, Arial)
5. Size: Large for title, medium for subtitle
6. Position: Center
7. Animation: Fade in (0.5s), hold, fade out (0.5s)

**Lower Thirds (throughout video):**
1. Create lower third for each major section:
   - "Patient Scheduling & Registration"
   - "Clinical Encounter (EHR)"
   - "Telehealth Experience"
   - "Lab Orders & Results"
   - "Revenue Cycle Management"
   - "Clinical Systems Integration"
   - "Reporting & Analytics"
2. Position: Bottom-left or bottom-center
3. Duration: 3-5 seconds at start of each section
4. Style: Simple bar with text

**Call-Out Boxes (highlight specific features):**
- Use **Text** or **Shape** tools to create boxes
- Highlight important metrics:
  - "30-second registration"
  - "3.5% no-show rate"
  - "4.2% denial rate"
- Animate in/out with fade

**Step 5: Add Background Music**

1. Import royalty-free background music
   - Recommended: Soft, instrumental, corporate/tech feel
   - Avoid: Lyrics, loud, distracting
2. Drag music to timeline (audio track below video)
3. Adjust volume:
   - Background music: -20dB to -25dB (quiet, ambient)
   - Voiceover should be primary audio
4. Add fade in/out at start and end

**Suggested Tracks:**
- "Inspiring Corporate" - uplifting, professional
- "Tech Innovation" - modern, clean
- "Healthcare Future" - calming, trustworthy

**Step 6: Color Grading (Optional but Recommended)**

1. Go to **Color** tab
2. For each clip:
   - Adjust **Lift, Gamma, Gain** wheels for balanced exposure
   - Increase **Saturation** slightly (5-10%) for vibrant look
   - Ensure consistent color across all clips
3. Apply **LUT** (Look-Up Table) for professional look:
   - Download free LUTs: https://www.freepresets.com/
   - Apply: **Effects Library** → **LUT** → drag to clip

**Step 7: Audio Mixing**

1. Go to **Fairlight** tab (audio editing)
2. Balance audio levels:
   - Voiceover: Peak at -6dB to -3dB
   - Background music: Peak at -25dB to -20dB
   - Sound effects (if any): Peak at -12dB to -6dB
3. Add audio effects:
   - **EQ** on voiceover (boost 2-5kHz for clarity)
   - **Compressor** on voiceover (smooth volume)
   - **De-esser** to reduce sibilance (S sounds)

**Step 8: Add Captions/Subtitles (Highly Recommended)**

1. Go to **Edit** tab
2. **Subtitles** → **Import Subtitle File** (if you have .srt)
   - OR manually create subtitles:
3. Click **Create Subtitle Track**
4. Add subtitles for all voiceover:
   - Improves accessibility
   - Helps with comprehension
   - Better for social media (auto-play without sound)
5. Style: Clean, readable font, white text with black background

**Step 9: End Screen**

1. Create end screen (last 10-15 seconds):
   ```
   Thank You

   Learn More: www.aureoncare.com
   Contact: sales@aureoncare.com
   Phone: [Your Phone]

   [AureonCare Logo]
   ```
2. Add fade to black at the very end

**Step 10: Final Review**

1. Watch the entire video from start to finish
2. Check for:
   - Audio sync issues
   - Visual glitches
   - Typos in text
   - Awkward transitions
   - Volume consistency
   - Color consistency
3. Get feedback from colleague
4. Make final adjustments

---

## Export Settings

### DaVinci Resolve Export Settings

1. Go to **Deliver** tab
2. Select **YouTube** preset (or custom)
3. Configure settings:

**Video Settings:**
- Format: **MP4**
- Codec: **H.264**
- Resolution: **1920x1080**
- Frame Rate: **30 fps**
- Quality: **Automatic** or **Bitrate 10-15 Mbps** (high quality)
- Profile: **High**
- Encoding: **Single Pass**

**Audio Settings:**
- Codec: **AAC**
- Bitrate: **256 kbps**
- Sample Rate: **48kHz**
- Channels: **Stereo**

**File Naming:**
- Filename: `AureonCare_Executive_Demo_v1.mp4`
- Location: `/demo_recordings/final/`

4. Click **Add to Render Queue**
5. Click **Render All**

**Expected File Size:**
- 13.5 minutes at 1080p, 10 Mbps bitrate ≈ 1 GB

---

## Quality Checklist

### Pre-Export Checklist

**Video Quality:**
- [ ] All clips are 1920x1080 resolution
- [ ] Frame rate is consistent (30fps)
- [ ] No pixelation or blurriness
- [ ] Color is consistent across clips
- [ ] Transitions are smooth
- [ ] No jarring cuts or jumps

**Audio Quality:**
- [ ] Voiceover is clear and audible
- [ ] No background noise or hum
- [ ] Volume is consistent throughout
- [ ] Background music is not distracting
- [ ] Audio and video are in sync
- [ ] No clipping or distortion

**Content:**
- [ ] All 12 sections are included
- [ ] Total duration is 13-14 minutes
- [ ] All key features are demonstrated
- [ ] Sarah Williams patient story is clear
- [ ] Metrics and value propositions are highlighted
- [ ] No typos in titles or captions

**Polish:**
- [ ] Professional title card at start
- [ ] Lower thirds for section headers
- [ ] Call-out boxes for key metrics
- [ ] Smooth transitions between sections
- [ ] End screen with contact information
- [ ] Captions/subtitles included

### Post-Export Checklist

**After exporting:**
- [ ] Play the video file to ensure it plays correctly
- [ ] Check first 30 seconds (common encoding issues here)
- [ ] Check last 30 seconds (ensure end screen is visible)
- [ ] Verify file size is reasonable (should be 500MB-2GB)
- [ ] Test on different devices (computer, tablet, phone)
- [ ] Test on different players (VLC, QuickTime, Windows Media Player)
- [ ] Upload to private YouTube/Vimeo for final review

---

## Alternative: Slide-Based Video (No Screen Recording)

If screen recording AureonCare is not feasible, create a slide-based video:

### Approach

1. **Create Slides** (PowerPoint/Keynote):
   - Use the `PRESENTATION_SLIDES_OUTLINE.md` to build slides
   - Add screenshots from AureonCare (taken manually)
   - Include architecture diagrams and metrics

2. **Record Slide Presentation:**
   - PowerPoint: **Slide Show** → **Record Slide Show**
   - Keynote: **Play** → **Record Slideshow**
   - OBS: Record screen while presenting slides

3. **Add Voiceover:**
   - Record narration while presenting
   - OR record voiceover separately and sync in editing

4. **Edit in Video Editor:**
   - Same process as above
   - Add transitions, music, captions

**Advantages:**
- Easier to control (no live demo glitches)
- More polished and professional
- Can use high-quality graphics

**Disadvantages:**
- Less authentic (not showing real product)
- Less impressive to technical audience

---

## Video Distribution

### Where to Upload

**Option 1: YouTube (Public or Unlisted)**
- Best for: Wide distribution, SEO
- Settings: Upload as "Unlisted" for controlled sharing

**Option 2: Vimeo (Professional)**
- Best for: Professional presentations, no ads
- Paid plans allow password protection

**Option 3: Self-Hosted (Company Website)**
- Best for: Maximum control, branding
- Use video player: Video.js, Plyr

**Option 4: Internal Hosting**
- Best for: Confidential demos
- SharePoint, Google Drive, Dropbox

### Optimization for Each Platform

**YouTube:**
- Title: "AureonCare Healthcare Platform - Executive Demo"
- Description: Include timestamps for each section
- Tags: healthcare, EHR, telehealth, RCM, FHIR, medical software
- Thumbnail: Custom thumbnail with AureonCare logo and "Executive Demo" text

**Vimeo:**
- Enable password protection if confidential
- Add chapters for easy navigation
- Use professional player with company branding

**Self-Hosted:**
- Ensure fast loading (use CDN if possible)
- Provide download option for offline viewing
- Add tracking analytics to measure engagement

---

## Video Variants (Optional)

Consider creating multiple versions:

**1. Full Version (13.5 minutes)**
- Complete demo for serious prospects
- Use for: Sales meetings, executive presentations

**2. Short Version (3-5 minutes)**
- Highlight reel with key features only
- Use for: Website, social media, email campaigns

**3. Feature-Specific Videos (1-2 minutes each)**
- Separate videos for each major feature:
  - Scheduling Demo
  - EHR Demo
  - Telehealth Demo
  - RCM Demo
  - Analytics Demo
- Use for: Targeted marketing, feature-specific sales

**4. Silent Version (with captions only)**
- No voiceover, just text and captions
- Use for: Social media auto-play, international audiences

---

## Professional Tips

### Do's ✅

1. **Use a Script:** Don't improvise—stick to the voiceover script
2. **Practice:** Rehearse 3-5 times before recording
3. **Take Breaks:** Record in segments to maintain energy
4. **Check Audio:** Wear headphones while recording to catch issues
5. **Use Shortcuts:** Learn keyboard shortcuts in your video editor
6. **Save Often:** Save your project frequently (Ctrl+S / Cmd+S)
7. **Backup:** Keep backups of raw recordings and project files

### Don'ts ❌

1. **Don't Rush:** Speak at a natural pace (140-160 words/minute)
2. **Don't Use Low-Quality Audio:** Invest in a decent microphone
3. **Don't Over-Edit:** Keep it natural, don't make it feel robotic
4. **Don't Use Copyrighted Music:** Use royalty-free music only
5. **Don't Skip Captions:** Always include captions for accessibility
6. **Don't Forget to Test:** Test the final video on multiple devices

---

## Timeline Estimate

**Pre-Production:** 2-4 hours
- Environment setup: 1 hour
- Script review and rehearsal: 1-2 hours
- Software setup: 30 minutes
- Asset preparation: 30 minutes

**Production (Recording):** 2-6 hours
- Screen recording (multiple takes): 1-3 hours
- Voiceover recording (if separate): 1-2 hours
- Review and re-recording: 1 hour

**Post-Production:** 4-8 hours
- Import and organize: 30 minutes
- Editing (cutting, arranging): 1-2 hours
- Adding titles and graphics: 1-2 hours
- Color grading: 30 minutes
- Audio mixing: 1 hour
- Captions: 1-2 hours
- Final review and adjustments: 30 minutes
- Export and test: 30 minutes

**Total Time:** 8-18 hours (depending on experience)

**For Beginners:** Budget 15-20 hours
**For Experienced:** Budget 8-12 hours

---

## Support & Resources

### Video Tutorials

**OBS Studio:**
- Official Guide: https://obsproject.com/wiki/
- YouTube: "OBS Studio Tutorial for Beginners"

**DaVinci Resolve:**
- Official Training: https://www.blackmagicdesign.com/products/davinciresolve/training
- YouTube: "DaVinci Resolve 18 - Full Tutorial for Beginners"

**Camtasia:**
- Official Tutorials: https://www.techsmith.com/tutorial-camtasia.html

### Free Resources

**Royalty-Free Music:**
- YouTube Audio Library: https://www.youtube.com/audiolibrary
- Incompetech: https://incompetech.com/music/
- Bensound: https://www.bensound.com/

**Sound Effects:**
- Freesound: https://freesound.org/
- Zapsplat: https://www.zapsplat.com/

**Graphics:**
- Canva: https://www.canva.com/
- Unsplash (stock photos): https://unsplash.com/

---

**Next Step:** Proceed to the Scene-by-Scene Storyboard and Voiceover Script!

---

**End of Video Production Guide**
