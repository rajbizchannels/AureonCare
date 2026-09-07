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
— Expo Go will not load them. `npx expo prebuild` then `npm run ios` /
`npm run android`.

## How it is put together

| Path | What it does |
|---|---|
| `src/theme/tokens.ts` | Colours, type scale, spacing — the literal Tailwind values the web app uses, so the two clients cannot drift |
| `src/lib/device.ts` | Device class and breakpoints; drives every responsive decision |
| `src/lib/url.ts` | Server-address rules (pure, unit tested) |
| `src/lib/server.ts` | Server persistence and the reachability probe |
| `src/lib/storage.ts` | Keychain/Keystore for credentials, AsyncStorage for preferences |
| `src/lib/api.ts` | Typed client for the endpoints this app uses |
| `src/context/SessionContext.tsx` | Who is signed in, against which server, with which credential |
| `src/components/SplitView.tsx` | Master–detail that is one pane on a phone and two on a tablet |
| `src/navigation/RootNavigator.tsx` | Role-derived shells and the tablet-only tabs |

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

### Responsive behaviour

Width is measured live rather than read from a device flag, because an iPad in
Split View and an Android foldable are both tablet-sized one moment and
phone-sized the next.

| Width | Class | Behaviour |
|---|---|---|
| `< 600dp` | phone | Single pane; list navigates to detail |
| `600–900dp` | tablet | Wider gutters, inline row actions, tablet-only tabs appear |
| `≥ 900dp` | wide | Split view — list and detail side by side, selecting never navigates |

600dp is Android's own `sw600dp` tablet threshold. The tablet-only tabs
(Orders, Revenue cycle) come from the scope doc's tablet-first list: table work
that a phone cannot hold. Chart review is *not* among them — `Patients` already
splits into roster-and-summary at that width, so the extra room is spent on
data a phone has no room for at all.

## What is built, and what is not

Every screen is routed to a real one — there are no placeholders left. All of
these read live data from the API:

**Patient** — Home (next appointment with a join button, unread nudge, recent
visits), Visits (upcoming/past, join, status), Records (documents with
provenance chips and attachment fetch), Messages, More.

**Clinician** — Today (the patient-upload review queue, accept/reject),
Schedule (week strip and day agenda, start-visit), Patients (roster, search,
and a summary carrying allergies, medications, diagnoses and documents),
Messages, More.

**Tablet only** — Orders (prescriptions and lab orders) and Revenue cycle
(claims with outstanding/denied totals).

Two deliberate omissions, both stated rather than stubbed:

- **Clinical write actions** — prescribing, diagnosis coding, ordering labs —
  are read-only here. They are safety-critical and depend on the ICD/CPT and
  result-recipient pickers the web app has; a half-built prescribing form is
  worse than none.
- **A separate tablet Chart tab.** `Patients` already opens a split view with
  the summary beside the roster, so a third route to the same data would be
  clutter rather than capability.

Not started: push notifications, biometric unlock, the social sign-in handshake
(`signInSocial` plumbing exists; the provider SDK does not), and opening a
downloaded document in a viewer (the fetch is wired; handing bytes to a viewer
needs expo-file-system and Sharing).

## Configuration

`app.json` → `expo.extra` carries `defaultServerUrl` (`app.aureoncare.tech`)
and empty client-id slots for Google and Microsoft. The server URL is
overridable in-app; the client ids are build-time.
