# AureonCare Mobile

Native companion app for patients and clinicians, built against the same
backend and the same authorisation model as `frontend/`. Scope and rationale
live in [`../MOBILE_APP_SCOPE.md`](../MOBILE_APP_SCOPE.md); the screen designs
are the published design canvas.

## Why React Native

The scope commits to things a webview wrapper cannot do well — Keychain /
Keystore credential storage, biometric unlock, APNs/FCM, camera capture into a
message, deep links into the Zoom/Teams/Meet apps — and to a *subset* UI with
five tabs rather than the whole web app. So this is a real native app on both
platforms (RN renders `UIView` and `android.view`, not HTML), sharing the API
and the design tokens with the web client rather than sharing its DOM.

## Running it

```bash
npm install
npm start          # Expo dev server
npm run ios        # or: npm run android
npm run typecheck
npm test
```

Several dependencies (`expo-secure-store`, `expo-local-authentication`,
`expo-image-picker`) contain native code, so a **development build** is needed
— Expo Go will not load them:

```bash
npx expo prebuild        # generates ios/ and android/ (both are gitignored)
npm run ios              # or: npm run android
```

All commands run from `mobile/`, never from the repository root — the root is
the backend, and it has no Expo project in it.

### Android prerequisites

`npm run android` shells out to the Android SDK. It is not bundled with Expo or
Node, so a machine without it fails with *"Failed to resolve the Android SDK
path"* and then *"'adb' is not recognized"*.

Install **Android Studio**, then in *Settings → Languages & Frameworks → Android
SDK* tick the SDK Platform for API 35 and, under *SDK Tools*, **Android SDK
Platform-Tools** (that is what `adb` comes from) and **Android Emulator**. The
SDK path shown at the top of that screen is the value the environment needs.

Windows (PowerShell, once — reopen the terminal afterwards):

```powershell
setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"
setx PATH "$env:PATH;$env:LOCALAPPDATA\Android\Sdk\platform-tools"
```

macOS / Linux (`~/.zshrc` or `~/.bashrc`):

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"   # Linux: $HOME/Android/Sdk
export PATH="$PATH:$ANDROID_HOME/platform-tools"
```

`adb devices` should then print a device list. Start an emulator from Android
Studio's Device Manager, or plug in a phone with USB debugging on, before
`npm run android`.

There is one way round installing the SDK at all: build the development client
in the cloud with `npx eas build --platform android --profile development`,
install the resulting APK on the phone once, then `npm start` and scan the QR
code. Only the *build* needs the SDK; the dev server does not.

### Pointing it at a backend

Start the API from the repo root (`npm install && npm run dev`); it listens on
port 3000. Then set the server on the app's sign-in screen — "Change server" —
because a simulator cannot reach your machine by the name you use:

| Running on | Server URL |
|---|---|
| iOS simulator | `http://localhost:3000` |
| Android emulator | `http://10.0.2.2:3000` |
| Physical device | `http://<your-LAN-IP>:3000` |

Plain `http` is refused for public hosts but allowed for these, which is why
local development works without weakening the rule for real deployments.

The probe that validates the address hits `/health` — the backend mounts it at
the root, not under `/api` like everything else — and falls back to
`/api/health` for a proxy that only forwards `/api/*`.

## How it is put together

| Path | What it does |
|---|---|
| `src/theme/tokens.ts` | Colours, type scale, spacing — the literal Tailwind values the web app uses, so the two clients cannot drift |
| `src/lib/device.ts` | Device class and breakpoints; drives every responsive decision |
| `src/lib/url.ts` | Server-address rules (pure, unit tested) |
| `src/lib/permissions.ts` | The role → capability matrix, ported from the web app (pure, unit tested) |
| `src/lib/chart.ts` | Merges the clinical streams into one timeline (pure, unit tested) |
| `src/lib/camps.ts` | Camp rules — registration gates, station pressure, board summary (pure, unit tested) |
| `src/lib/server.ts` | Server persistence and the reachability probe |
| `src/lib/storage.ts` | Keychain/Keystore for credentials, AsyncStorage for preferences |
| `src/lib/api.ts` | Typed client for the endpoints this app uses |
| `src/context/SessionContext.tsx` | Who is signed in, against which server, with which credential |
| `src/components/SplitView.tsx` | Master–detail that is one pane on a phone and two on a tablet |
| `src/navigation/RootNavigator.tsx` | The tab catalogue, the four shells, and the capability filter over both |
| `metro.config.js` | Pins the bundler to `mobile/` so it does not adopt the backend above it as a workspace root |

### The credential model is the part worth reading

A patient can hold either of two credentials — a portal session token, or a
staff-issued JWT against a `users` row whose role is `patient` — and the
server resolves both to the same actor
(`backend/middleware/messagingAuth.js`). So messaging and the other shared
routes take whichever token the device holds, on the same `Authorization:
Bearer` header. Only `/patient-portal/*` is portal-only, which is why
`ApiClient` branches on the credential for records and appointments but not
for messaging.

**Role is never asked.** `POST /api/auth/login` answers with the account, and
`account.role` decides which shell renders. There is no role switch anywhere
in the app.

### One app, four shells

There is a single binary for patients, providers, staff and admins, not four
builds. A role is a property of the *account*, not of the install: people get
promoted, cover a colleague's desk, and are sometimes patients at the practice
they work for. Four binaries would make a promotion an uninstall, and would
multiply App Store review, signing identities and crash dashboards by four for
no gain — the backend already enforces the real boundary.

`src/lib/permissions.ts` is a literal port of
`frontend/src/utils/rolePermissions.js` — the same eight roles, the same
module × action grid — kept as a copy rather than a re-derivation, for the
same reason the colour tokens are: two hand-maintained readings of one rule
set drift, and when they drift a clinician is offered a button the server will
refuse. `tests/permissions.test.mjs` asserts the shape of that grid.

It is not a security boundary. Every route re-checks the role server-side and
reads it from the database, never from the token's claim. What the matrix
decides is what to *offer*.

Two rules shape the tab bar:

1. **A tab appears only if its module is viewable.** A receptionist has no
   `ehr.view`, so Chart and Orders do not exist for them — not greyed out,
   absent. A tab that 403s on arrival is worse than no tab.
2. **A phone never shows more than five.** Everything else lives in More,
   which is a destination rather than an overflow bin. Tablets promote a
   declared handful back up.

| Shell | Roles | Phone tabs | Promoted on a tablet |
|---|---|---|---|
| patient | `patient` | Home · Visits · Records · Messages · More | — |
| clinician | `doctor`, `nurse` | Today · Schedule · Messages · Patients · More | Chart, Orders |
| frontdesk | `receptionist`, `staff`, `billing_manager`, `crm_manager` | Today · Schedule · Messages · Patients · More | Camps, Billing |
| admin | `admin` | Today · Schedule · Messages · Patients · More | Chart, Billing, Practice |

The promotions are declared per shell rather than computed, because *what
deserves a bigger screen* is a judgement about the job: a front desk wants the
camp board and the day's takings, a clinician wants the chart.

**Today is composed, not branched.** The same screen asks four different
questions depending on who opened it — the review queue only when the account
has `ehr.view`, camps only when the plan includes them — and each section is
both capability-gated and empty-gated, so nothing renders a panel to announce
it has nothing to say.

### Responsive behaviour

Width is measured live rather than read from a device flag, because an iPad in
Split View and an Android foldable are both tablet-sized one moment and
phone-sized the next.

| Width | Class | Behaviour |
|---|---|---|
| `< 600dp` | phone | Single pane; list navigates to detail |
| `600–900dp` | tablet | Wider gutters, inline row actions, tablet-only tabs appear |
| `≥ 900dp` | wide | Split view — list and detail side by side, selecting never navigates |

600dp is Android's own `sw600dp` tablet threshold. What each shell promotes at
that width is in the table above; all of it comes from the scope doc's
tablet-first list: work a phone cannot hold.

Chart and Patients are not the same view twice. **Patients** answers *who is
this* — allergies, current medications, the last few of everything. **Chart**
answers *what has happened, in order*, merging visits, diagnoses, medications,
labs and documents into one filterable chronology, so a diagnosis, the
prescription that followed it and the lab that checked it read together. They
share the selected patient (`ActivePatientContext`), so choosing someone in
either opens them in both.

### Signing in has two steps now

The practice can require a second factor and can set an idle timeout
(migration 081), and both change what sign-in has to handle.

`POST /api/auth/login` answers `401 { mfaRequired: true }` when the password
was *correct* and a code is needed. That matters for the dual sign-in: the
screen must not fall through to the portal on that 401, because the portal has
no second factor and the person would be told "invalid email or password"
about a password that was right. `ApiError` carries the parsed body so these
refusals stay distinguishable from a plain no.

Enrolment works from the phone too, which the web flow cannot do here — it
shows a QR code to scan, and a phone cannot photograph its own screen. More →
Two-factor shows the base32 key to copy and paste into an authenticator
instead. So a phone is a sufficient device for a practice that mandates 2FA.

An idle sign-out arrives as `401 { sessionTimedOut: true }`. It is carried
through to the sign-in screen and named there, rather than the app silently
reappearing at the login.

## What is built, and what is not

Every screen is routed to a real one — there are no placeholders left. All of
these read live data from the API:

**Patient** — Home (next appointment with a join button, unread nudge, recent
visits), Visits (upcoming/past, join, status), Records (documents with
provenance chips, plus the Forms the practice is waiting on), Messages, More.

**Clinician** — Today (review queue, today's list, open tasks, any camp
running), Schedule (week strip and day agenda, start-visit), Patients (roster,
search, and a summary carrying allergies, medications, diagnoses and
documents), Messages, More.

**Front desk** — the same frame without the clinical half: no Chart, no
Orders, and no review queue on Today. Camps and Revenue cycle come up on a
tablet instead.

**Admin** — all of the above plus Practice: the tenant check, the sites list,
and a read-out of what this account's role actually grants.

**Camps** — the planning work the web app gained, from the side a phone is
right for. A registration desk that takes a name and an age and reads back a
token number; a station board showing queue depth, longest wait and which
station is the bottleneck; an attendee list with the consent action. Planning,
staffing, supplies and the sponsor report stay on the web.

**Everywhere** — Forms (outstanding and completed; acknowledge a document-
backed request), Tasks (the practice list, mark done), Notifications, and
Two-factor.

Deliberate omissions, stated rather than stubbed:

- **Clinical write actions** — prescribing, diagnosis coding, ordering labs —
  are read-only. They are safety-critical and depend on the ICD/CPT and
  result-recipient pickers the web app has; a half-built prescribing form is
  worse than none.
- **Template forms** are listed but filled in on the web. The builder supports
  conditional fields, repeating groups and typed validation; a mobile renderer
  that handled some of that and quietly dropped the rest would produce
  submissions that look complete and are not. Document-backed requests — read
  this, confirm you have — are fully handled here, because those are the ones
  that hold a visit up.
- **Camp planning and promotion to a patient record** need judgement about
  duplicate matches that a phone is a poor place to exercise.
- **The platform operator console** is not here at all. It is for AureonCare
  staff administering tenants, not for a practice.

Not started: push notifications, biometric unlock, the social sign-in handshake
(`signInSocial` plumbing exists; the provider SDK does not), and opening a
downloaded document in a viewer (the fetch is wired; handing bytes to a viewer
needs expo-file-system and Sharing).

## Configuration

`app.json` → `expo.extra` carries `defaultServerUrl` (`app.aureoncare.tech`)
and empty client-id slots for Google and Microsoft. The server URL is
overridable in-app; the client ids are build-time.
