# AureonCare Executive Demo - Screen Recording Guide

**Purpose:** Step-by-step guide for recording the AureonCare demo screen actions

**Duration:** Plan for 15-20 minutes of recording (will be edited down to 11-12 minutes of screen time)

---

## Pre-Recording Setup

### Step 1: Prepare AureonCare Environment

**Backend:**
```bash
cd /home/user/AureonCare/backend
npm start
```
- Ensure backend is running on `localhost:3000`
- Check terminal for "Server running on port 3000"

**Frontend:**
```bash
cd /home/user/AureonCare/frontend
npm start
```
- Ensure frontend opens at `localhost:3001`
- Wait for "Compiled successfully!"

### Step 2: Load Demo Data

```bash
psql -U aureoncare_app -d aureoncare_demo -f backend/db/demo_data.sql
```

Verify Sarah Williams exists:
```bash
psql -U aureoncare_app -d aureoncare_demo -c "SELECT * FROM patients WHERE mrn = 'MRN-2025-001';"
```

### Step 3: Login to AureonCare

1. Open browser: `http://localhost:3001`
2. Login with:
   - **Email:** `dr.anderson@aureoncare.com`
   - **Password:** `Demo123!`
3. Wait for dashboard to load completely

### Step 4: Browser Preparation

**Browser Settings:**
- [ ] Set zoom to 100% (Ctrl+0 / Cmd+0)
- [ ] Full screen mode (F11) - **OR keep browser chrome visible for more realistic feel**
- [ ] Hide bookmarks bar (Ctrl+Shift+B / Cmd+Shift+B)
- [ ] Close all other tabs
- [ ] Position browser window to fill 1920x1080 screen
- [ ] Clear any notifications

**Close Unnecessary Apps:**
- [ ] Email clients
- [ ] Messaging apps (Slack, Teams, etc.)
- [ ] Any background apps that might show notifications

**Enable Do Not Disturb:**
- Windows: Settings → System → Focus Assist → Priority only
- Mac: Control Center → Do Not Disturb
- Linux: Settings → Notifications → Do Not Disturb

### Step 5: OBS Studio Setup (If Using)

**Scene Setup:**
1. Create scene: "AureonCare Demo"
2. Add source: "Window Capture" → Select browser window
3. Fit to screen (1920x1080)

**Recording Settings:**
- Format: MP4
- Encoder: Hardware (if available) or x264
- Quality: High Quality, Medium File Size
- FPS: 30

**Test Recording:**
- Record 10 seconds
- Stop and review
- Check for lag or frame drops

---

## Recording Workflow

### Recording Method

**Option A: Record with Voiceover (Live)**
- Narrate while performing actions
- More natural but harder to edit
- Requires good microphone and quiet environment

**Option B: Record Screen Only (Recommended)**
- Record mouse movements and clicks only (no audio)
- Add voiceover in post-production
- Easier to edit and fix mistakes

**Recommended:** Option B (Record screen only, add voiceover later)

---

## Scene-by-Scene Recording Instructions

### SCENE 1 & 2: Title Cards (No Recording Needed)

These will be created as graphics in video editing software.

Skip to Scene 3.

---

### SCENE 3: Patient Search (1:20 - 2:10 in final video)

**Starting Point:** AureonCare dashboard (after login)

**Actions:**
1. Navigate to "Practice Management" module
   - **Click:** "Practice Management" in left sidebar
   - **Wait:** 1 second for page to load

2. Search for patient
   - **Click:** Search input field
   - **Type slowly:** "Williams" (one letter every 0.3 seconds)
   - **Wait:** 0.5 seconds for search results to appear

3. View search results
   - **Hover:** Over "Sarah Williams" result
   - **Pause:** 1 second (let viewer see details: MRN, DOB, insurance)

4. Open patient profile
   - **Click:** "Sarah Williams" result
   - **Wait:** 1 second for patient profile to open

**Recording Notes:**
- Move mouse smoothly, not erratically
- Type at a pace that's visible on screen
- Pause briefly to let information be readable
- If you make a mistake, pause 3 seconds, undo, and retry

**Expected Duration:** ~30-40 seconds of recording

**End Point:** Sarah Williams patient profile is open, showing demographics and insurance

---

### SCENE 4: Appointment Booking (2:10 - 2:50 in final video)

**Starting Point:** Sarah Williams patient profile

**Actions:**
1. Initiate appointment booking
   - **Click:** "Schedule Appointment" button
   - **Wait:** 1 second for appointment form to load

2. Fill appointment details
   - **Click:** "Appointment Type" dropdown
   - **Select:** "Telehealth Consultation"
   - **Pause:** 0.5 seconds

3. Select provider
   - **Click:** "Provider" dropdown
   - **Scroll:** (if needed) to find "Dr. Michael Anderson"
   - **Select:** "Dr. Michael Anderson"
   - **Pause:** 0.5 seconds

4. Select date
   - **Click:** "Date" field
   - **Select:** Date 2 days from today
   - **Pause:** 0.5 seconds

5. Select time
   - **Click:** "Time" dropdown
   - **Select:** "10:00 AM"
   - **Pause:** 0.5 seconds

6. Enable telehealth
   - **Check:** "Telehealth" checkbox (if not already checked)
   - **Pause:** 0.5 seconds

7. Add notes
   - **Click:** "Notes" text field
   - **Type:** "Patient requesting virtual visit"
   - **Pause:** 1 second

8. Confirm booking
   - **Click:** "Book Appointment" button
   - **Wait:** 1-2 seconds for confirmation message
   - **Pause:** 2 seconds (let confirmation be visible)

**Recording Notes:**
- Slow down when filling form fields
- Let each selection be visible before moving to next
- Keep mouse movements deliberate

**Expected Duration:** ~40-50 seconds of recording

**End Point:** Confirmation message showing appointment is booked

---

### SCENE 5: Patient Chart Review (2:50 - 4:00 in final video)

**Starting Point:** Appointment confirmation screen

**Actions:**
1. Navigate to EHR module
   - **Click:** "EHR" in left sidebar
   - **Wait:** 1 second for EHR page to load

2. Search for patient
   - **Click:** Patient search field
   - **Type:** "Sarah Williams"
   - **Click:** Sarah Williams from results
   - **Wait:** 1-2 seconds for patient chart to load

3. Review medical history
   - **Hover/Scroll:** Over "Medical History" section
   - **Pause:** 2 seconds (show diagnoses: Diabetes, Hypertension)

4. Check allergies
   - **Click:** "Allergies" tab (if tabbed interface)
   - **OR Scroll:** To allergies section
   - **Pause:** 2 seconds (show Penicillin allergy highlighted)

5. View medications
   - **Click:** "Medications" tab
   - **OR Scroll:** To medications section
   - **Pause:** 2 seconds (show Metformin prescription)
   - **Hover:** Over Metformin row to show details (refills, dosage)

6. Scroll through patient timeline
   - **Scroll down slowly:** Through patient timeline
   - **Pause:** At key entries (previous encounters, lab results)
   - **Scroll back up** to top

**Recording Notes:**
- Take your time - this is critical patient information
- Make sure text is readable on screen
- Use slow, smooth scrolling (not jumpy)

**Expected Duration:** ~60-70 seconds of recording

**End Point:** Patient chart visible, ready to create new encounter

---

### SCENE 6: SOAP Notes & Diagnosis (4:00 - 4:50 in final video)

**Starting Point:** Sarah Williams' patient chart in EHR

**Actions:**
1. Start new encounter
   - **Click:** "New Encounter" button
   - **Wait:** 1 second for encounter form to load

2. Enter Subjective
   - **Click:** "Subjective" text area
   - **Type:** "Patient reports improved blood sugar control. Complains of occasional dizziness."
   - **Pause:** 1 second

3. Enter Objective
   - **Click:** "Objective" text area
   - **Type:** "BP 135/85, HR 78, Temp 98.6°F, Weight 180 lbs"
   - **Pause:** 1 second

4. Enter Assessment
   - **Click:** "Assessment" text area
   - **Type:** "Type 2 Diabetes - improving. Possible medication adjustment needed."
   - **Pause:** 1 second

5. Enter Plan
   - **Click:** "Plan" text area
   - **Type:** "Continue Metformin. Order lipid panel. Follow-up in 3 months."
   - **Pause:** 1 second

6. Add diagnosis
   - **Click:** "Add Diagnosis" button
   - **Wait:** 0.5 seconds for diagnosis search modal

7. Search ICD-10 code
   - **Click:** Diagnosis search field
   - **Type:** "Type 2 Diabetes"
   - **Wait:** 0.5 seconds for autocomplete suggestions

8. Select diagnosis
   - **Click:** "E11.9 - Type 2 Diabetes Mellitus without complications"
   - **Pause:** 1 second (show diagnosis added to encounter)

**Recording Notes:**
- Type at moderate speed (not too fast to read)
- Pause after each section to let it be readable
- Highlight how ICD-10 search works (autocomplete)

**Expected Duration:** ~50-60 seconds of recording

**End Point:** SOAP notes entered, diagnosis added

---

### SCENE 7: Telehealth Session (4:50 - 6:00 in final video)

**Starting Point:** After saving encounter (or continue from encounter screen)

**Actions:**
1. Navigate to Telehealth module
   - **Click:** "Telehealth" in left sidebar
   - **Wait:** 1-2 seconds for telehealth page to load

2. Find upcoming appointment
   - **Scroll:** (if needed) to find Sarah Williams' upcoming appointment
   - **Pause:** 1 second (show appointment details: date, time, provider)

3. Start telehealth session
   - **Click:** "Start Session" button
   - **Wait:** 1 second for session creation dialog

4. Configure session
   - **Select:** Provider dropdown → "Zoom" (or "Mock" if testing)
   - **Pause:** 0.5 seconds
   - **Check:** "Enable Recording" checkbox
   - **Pause:** 0.5 seconds

5. Create session
   - **Click:** "Create Session" button
   - **Wait:** 2-3 seconds for session to be created

6. Show session details
   - **Pause:** 3 seconds (show Zoom meeting link, join link, status "Active")
   - **Optional:** Hover over "Copy Link" button

**Recording Notes:**
- This section showcases integration, so highlight the ease
- Show the generated Zoom link clearly
- If using mock mode, that's fine - still shows the workflow

**Expected Duration:** ~50-60 seconds of recording

**End Point:** Telehealth session created, details visible

---

### SCENE 8: ePrescribing (6:00 - 6:40 in final video)

**Starting Point:** Telehealth session screen OR navigate back to encounter

**Actions:**
1. Access prescription form
   - **Option A:** From encounter screen, click "Add Prescription"
   - **Option B:** From patient chart, click "Prescriptions" → "New Prescription"
   - **Wait:** 1 second for prescription form

2. Search medication
   - **Click:** "Medication" search field
   - **Type:** "Lisinopril"
   - **Wait:** 0.5 seconds for autocomplete

3. Select medication
   - **Click:** "Lisinopril 10mg" from dropdown
   - **Pause:** 0.5 seconds

4. Enter dosage details
   - **Dosage field:** Auto-filled or select "Once daily"
   - **Duration:** Type "90" or select "90 days"
   - **Refills:** Type "3"
   - **Pause:** 1 second

5. Select pharmacy
   - **Pharmacy field:** Should auto-populate with "CVS Pharmacy - Main St"
   - **If not:** Click dropdown and select
   - **Pause:** 1 second (highlight that it's pre-populated)

6. Send prescription
   - **Click:** "Send to Pharmacy" button
   - **Wait:** 2 seconds for confirmation message
   - **Pause:** 2 seconds (show "Prescription sent via Surescripts" message)

**Recording Notes:**
- Emphasize the auto-populated pharmacy (patient preference)
- Show the Surescripts confirmation clearly
- This demonstrates ePrescribing integration

**Expected Duration:** ~40-50 seconds of recording

**End Point:** Prescription sent confirmation visible

---

### SCENE 9: Lab Orders & FHIR Tracking (6:40 - 7:30 in final video)

**Starting Point:** Encounter screen or patient chart

**Actions:**
1. Access lab order form
   - **Click:** "Order Labs" button (from encounter or patient menu)
   - **Wait:** 1 second for lab order form

2. Select test
   - **Click:** "Test" dropdown
   - **Select:** "Lipid Panel"
   - **Pause:** 0.5 seconds

3. Select lab
   - **Click:** "Laboratory" dropdown
   - **Select:** "Labcorp"
   - **Pause:** 0.5 seconds

4. Link diagnosis
   - **Click:** "Diagnosis Code" dropdown or link field
   - **Select:** "E11.9 - Type 2 Diabetes"
   - **Pause:** 0.5 seconds

5. Enter specimen details
   - **Specimen Type:** Select "Blood"
   - **Pause:** 0.5 seconds

6. Submit lab order
   - **Click:** "Submit Order" button
   - **Wait:** 2 seconds for confirmation
   - **Pause:** 2 seconds (show tracking number: LAB-123456)

7. Navigate to FHIR Tracking
   - **Click:** "Integrations" → "FHIR Tracking" (or dedicated tracking link)
   - **Wait:** 1 second for tracking page

8. Show order tracking
   - **Find:** LAB-123456 in tracking list
   - **Click:** Tracking number to expand details
   - **Pause:** 3 seconds (show timeline: Order Created → Sent to Labcorp → Acknowledged)

**Recording Notes:**
- Highlight the automatic tracking number generation
- Show the real-time tracking interface
- This demonstrates FHIR integration

**Expected Duration:** ~50-60 seconds of recording

**End Point:** FHIR tracking timeline visible for lab order

---

### SCENE 10: Revenue Cycle Management (7:30 - 9:00 in final video)

**Starting Point:** From any screen

**Actions:**
1. Navigate to RCM module
   - **Click:** "Revenue Cycle Management" or "RCM" in sidebar
   - **Wait:** 1-2 seconds for RCM dashboard to load

2. Review dashboard metrics
   - **Pause:** 3 seconds (show key metrics: Total Claims, Pending, Approved, Denied, Revenue)
   - **Hover:** Over denial rate (4.2%) to emphasize

3. View claims list
   - **Click:** "Claims" tab
   - **Wait:** 1 second for claims list to load
   - **Scroll:** Through claims list slowly

4. Find auto-generated claim
   - **Find:** Claim for Sarah Williams (service date: today)
   - **Highlight:** By hovering over the row
   - **Pause:** 2 seconds

5. Open claim details
   - **Click:** Sarah Williams' claim
   - **Wait:** 1 second for claim details to load

6. Review claim information
   - **Scroll/Hover:** Over diagnosis codes (E11.9, I10)
   - **Pause:** 1 second
   - **Scroll:** To procedure codes (99214, Modifier 95)
   - **Pause:** 1 second
   - **Show:** Total charge $145, Insurance info

7. Submit claim
   - **Click:** "Submit to Clearinghouse" button
   - **Wait:** 2 seconds for submission confirmation
   - **Pause:** 3 seconds (show "Claim submitted to Optum" message and tracking number)

**Recording Notes:**
- Emphasize the automatic claim generation (no manual entry)
- Show how coding flows from encounter to claim
- Highlight the clearinghouse submission

**Expected Duration:** ~80-90 seconds of recording

**End Point:** Claim submitted confirmation visible

---

### SCENE 11: Integration & Interoperability (9:00 - 10:00 in final video)

**Starting Point:** From any screen

**Actions:**
1. Navigate to Integrations module
   - **Click:** "Integrations" in sidebar (or under Admin/Settings)
   - **Wait:** 1-2 seconds for integration hub to load

2. View vendor integrations
   - **Click:** "Vendor Integrations" tab
   - **Pause:** 3 seconds (show logos/names: Labcorp, Surescripts, Optum, Zoom)
   - **Scroll:** If list is long

3. View FHIR resources
   - **Click:** "FHIR Resources" tab
   - **Wait:** 1 second
   - **Scroll:** Through list of FHIR resource types
   - **Pause:** 2 seconds (show: Patient, MedicationRequest, ServiceRequest, Observation, Condition)

4. View FHIR tracking
   - **Click:** "FHIR Tracking" tab
   - **Wait:** 1 second
   - **Find:** Prescription tracking (RX-123457 for Lisinopril)
   - **Click:** Tracking number to expand
   - **Pause:** 3 seconds (show status: Sent to Surescripts, Filled by CVS)

**Recording Notes:**
- Show the variety of integrations (logos are impactful)
- FHIR compliance is a key selling point - emphasize it
- Real-time tracking demonstrates interoperability

**Expected Duration:** ~50-60 seconds of recording

**End Point:** FHIR tracking details visible

---

### SCENE 12: Reporting & Analytics (10:00 - 11:20 in final video)

**Starting Point:** From any screen

**Actions:**
1. Navigate to Reports module
   - **Click:** "Reports & Analytics" or "Reports" in sidebar
   - **Wait:** 1-2 seconds for reports dashboard to load

2. View clinical metrics
   - **Default tab:** "Clinical Metrics" (or click if not default)
   - **Pause:** 3 seconds (show: Total Patients, Active Rx, Pending Labs, Completed Encounters)
   - **Scroll:** To quality metrics section
   - **Pause:** 2 seconds (show: Diabetic HbA1c %, Hypertension control %)

3. View operational metrics
   - **Click:** "Operations" tab
   - **Wait:** 1 second
   - **Pause:** 3 seconds (show: Appointments, No-show rate 3.5%, Wait time, Provider utilization)

4. View financial metrics
   - **Click:** "Revenue" or "Financial" tab
   - **Wait:** 1 second
   - **Pause:** 3 seconds (show: Revenue MTD $245,890, Claims stats, Denial rate 4.2%)
   - **Scroll:** If there are charts (revenue by payer pie chart)
   - **Pause:** 2 seconds on charts

5. Demonstrate export
   - **Click:** "Export" button
   - **Select:** "Export to Excel" or "Export to PDF"
   - **Wait:** 1-2 seconds for download confirmation (or download dialog)
   - **Pause:** 1 second

**Recording Notes:**
- Dashboards are visually impressive - let metrics be readable
- Highlight key metrics that beat industry averages
- Show variety of reports (clinical, operational, financial)

**Expected Duration:** ~70-80 seconds of recording

**End Point:** Export confirmation or reports dashboard visible

---

### SCENE 13: Security & Compliance (11:20 - 12:00 in final video)

**Starting Point:** From any screen

**Option A: Show User Management Screen (Recommended)**

**Actions:**
1. Navigate to Users & Roles
   - **Click:** "Admin" or "Settings" → "Users & Roles"
   - **Wait:** 1-2 seconds for users page to load

2. View user list
   - **Pause:** 2 seconds (show list of users with roles: Admin, Doctor, Nurse, Receptionist, Patient)
   - **Scroll:** Through user list

3. View role details
   - **Click:** "Roles" tab or a specific role (e.g., "Receptionist")
   - **Wait:** 1 second
   - **Pause:** 3 seconds (show permissions: Can schedule, Can view patients, Cannot view medical records, Cannot access billing)

4. View audit logs (if accessible)
   - **Click:** "Audit Logs" tab
   - **Wait:** 1 second
   - **Pause:** 2 seconds (show recent activity: User, Action, Patient, Timestamp)

**Option B: Use Graphics Slide (Simpler)**

If security screens are not easily accessible in demo mode, this scene can be a static slide created in editing.

**Expected Duration:** ~30-40 seconds of recording

**End Point:** User roles or audit logs visible

---

### SCENE 14 & 15: Summary & Closing (No New Recording)

These will be created as graphics/slides in video editing.

---

## Post-Recording Checklist

After completing all recordings:

- [ ] Watch all recorded segments from start to finish
- [ ] Check for:
  - [ ] Clear, readable text (not blurry)
  - [ ] Smooth mouse movements (not erratic)
  - [ ] No lag or frame drops
  - [ ] Proper loading times (not too fast or slow)
  - [ ] All key information is visible
- [ ] Re-record any problematic sections
- [ ] Label all files clearly:
  - `03_patient_search.mp4`
  - `04_appointment_booking.mp4`
  - `05_patient_chart.mp4`
  - etc.
- [ ] Save files in organized folder: `/demo_recordings/raw/`
- [ ] Backup files to external drive or cloud

---

## Recording Tips & Tricks

### Mouse Movement

**Do:**
- Move slowly and deliberately
- Pause cursor briefly before clicking
- Use straight lines when moving across screen
- Highlight (hover) over important text

**Don't:**
- Make erratic or jumpy movements
- Circle the cursor around
- Click too quickly
- Move the mouse during page loads

### Typing

**Do:**
- Type at ~2-3 characters per second (slower than normal)
- Pause briefly after typing each field
- Use realistic text (not "Test test 123")

**Don't:**
- Type too fast (looks unrealistic in video)
- Make lots of typos and backspaces
- Use Lorem Ipsum or gibberish

### Scrolling

**Do:**
- Scroll smoothly and slowly
- Pause at important information
- Scroll in consistent increments

**Don't:**
- Scroll too fast (makes viewers dizzy)
- Scroll back and forth repeatedly
- Jump to sections (use smooth scroll)

### Timing & Pacing

**Do:**
- Let pages fully load before interacting
- Pause 1-2 seconds on important screens
- Allow time for viewers to read text
- Take breaks every 5-10 minutes

**Don't:**
- Rush through screens
- Click before elements load
- Skip important information

---

## Common Issues & Solutions

### Issue: Text is Blurry

**Solution:**
- Ensure browser zoom is at 100%
- Check screen recording resolution is 1920x1080
- Use high-quality recording settings in OBS

### Issue: Mouse Cursor Not Visible

**Solution:**
- In OBS: Ensure "Capture Cursor" is enabled in Window/Display Capture properties

### Issue: Page Loads Too Slow

**Solution:**
- Restart backend and frontend for fresh instance
- Close unnecessary apps to free up resources
- If still slow, edit out wait time in post-production

### Issue: Made a Mistake During Recording

**Solution:**
- **Option A:** Pause for 3 seconds, undo/go back, retry the action
- **Option B:** Stop recording, reset to that screen, start new recording

### Issue: Notifications Appearing

**Solution:**
- Enable Do Not Disturb mode
- Close all notification-generating apps
- Disable browser notifications

---

## Alternative: Recording with Teleprompter

If you want to record screen AND voiceover simultaneously:

**Setup:**
1. Position second monitor (or tablet) with voiceover script
2. Use teleprompter software (e.g., PromptSmart, CuePrompter)
3. Set scroll speed to match your talking pace
4. Practice before recording

**Benefits:**
- Natural flow with synchronized actions and narration
- Single recording session

**Drawbacks:**
- Harder to edit mistakes
- Requires practice and setup
- Need good microphone setup

---

## Recording Schedule (Example)

**Day 1: Setup & Testing**
- Set up demo environment
- Test recording software
- Practice first 2 scenes
- Record test segments

**Day 2: Main Recording (Scenes 3-9)**
- Record patient search & booking
- Record EHR and SOAP notes
- Record telehealth & ePrescribing
- Record lab orders
- Review and re-record as needed

**Day 3: Main Recording (Scenes 10-13)**
- Record RCM module
- Record integrations
- Record analytics
- Record security screens
- Review all recordings

**Day 4: Re-recording & Polish**
- Re-record any problematic sections
- Ensure all files are properly labeled
- Backup all recordings

**Total Time Estimate:** 8-12 hours over 3-4 days

---

**You're ready to record! Good luck! 🎬**

---

**End of Screen Recording Guide**
