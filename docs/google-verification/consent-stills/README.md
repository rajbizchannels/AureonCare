# Consent-flow screenshots

Drop the captures of Google's real OAuth screens here. The recorder plays every
`.png`/`.jpg` in this folder **in filename order**, full-frame and letterboxed,
at the point in the walkthrough where the administrator clicks *Connect Google
Meet Account*. Nothing is drawn over them.

Number them in flow order:

| File | Screen | Must show |
| --- | --- | --- |
| `01-choose-account.png` | *Choose an account to continue to AureonCare* | the address bar, including `client_id=` |
| `02-unverified-warning.png` | *Google hasn't verified this app* | **Advanced** expanded, so *Go to AureonCare (unsafe)* is visible |
| `03-consent-scopes.png` | *AureonCare wants access to your Google Account* | **every requested scope listed and readable** |

## The one that gets submissions rejected

Google's review asks for the scopes "fully expanded and readable". On the
consent screen Google collapses them behind a summary line — *"AureonCare
already has some access. See the **2 services** that AureonCare has some access
to"*, or a **Show all services** control on a first-time grant.

A screenshot of that collapsed state does not satisfy the requirement. Click
through it and capture the expanded list, so both scopes are visible as text:

```
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/calendar.events
```

Keep the collapsed screen too if you like — put it at `03-` and the expanded one
at `04-`, and both play in order.

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

`STILL_DWELL_MS` is how long each screen holds; default 7000. Give the scope
list the longest hold — a reviewer has to read it.
