# Consent-flow screenshots

Drop the captures of Google's real OAuth screens here. The recorder plays every
`.png`/`.jpg` in this folder **in filename order**, full-frame and letterboxed,
at the point in the walkthrough where the administrator clicks *Connect Google
Meet Account*. Nothing is drawn over them.

Number them in flow order. These four are the current set:

| File | Screen | Shows |
| --- | --- | --- |
| `01-choose-account.png` | *Choose an account to continue to AureonCare* | the address bar, including `client_id=` |
| `02-unverified-warning.png` | *Google hasn't verified this app* | **Advanced** expanded, so *Go to AureonCare (unsafe)* is visible |
| `03-consent-summary.png` | *AureonCare wants access to your Google Account* | the consent screen as presented, with **Cancel** / **Continue** |
| `04-consent-scopes-expanded.png` | *AureonCare has this access* | **both scopes expanded and readable** |

The last two are one screen in two states, and the order matters: `03-` is what
Google shows, `04-` is that same screen after opening the collapsed list. Do not
rename `04-` to sort ahead of `03-` — the flow would then run backwards.

## The one that gets submissions rejected

Google's review asks for the scopes "fully expanded and readable". On the
consent screen Google collapses them behind a summary line — *"AureonCare
already has some access. See the **2 services** that AureonCare has some access
to"*, or a **Show all services** control on a first-time grant.

A screenshot of only that collapsed state does not satisfy the requirement.
Click through it and capture the expanded panel, which names both scopes the
connect flow requests (`backend/routes/integrationOAuth.js`):

```
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/meetings.space.created
```

On the expanded panel these read as *"See, edit, share, and permanently delete
all the calendars you can access using Google Calendar"* and *"Create, edit, and
see information about your Google Meet conferences created by the app."*

If the scope list ever changes, re-capture `04-` — a stale screenshot showing
scopes the app no longer requests is worse than none.

## Capturing

Use a normal browser window rather than a headless one: the address bar is part
of the evidence, and only a desktop screen capture includes it. Portrait windows
are fine — the recorder letterboxes rather than crops, so nothing is cut off.

Nothing in this folder is redacted automatically. Blank out any account address
you do not want in the submission before saving the file here.

## Rendering

```bash
STILL_DWELL_MS=8000 NODE_PATH=$(npm root -g) \
  node docs/google-verification/record-google-meet-demo.js
cp docs/google-verification/out/aureoncare-google-meet-demo.mp4 docs/google-verification/
```

`STILL_DWELL_MS` is how long each screen holds; default 7000. Any file with
`scopes` in its name holds 1.6x that, since a reviewer has to read the whole
list rather than glance at it.
