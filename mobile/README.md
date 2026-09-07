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
(Encounter, Orders, Revenue cycle) are the scope doc's tablet-first list: work
that needs multi-select pickers and side-by-side context, which is exactly what
does not fit on a phone.

## What is built, and what is not

Working end to end against a live backend:

- Sign-in (both audiences, one email box), role-derived shells, sign out
- Server configuration — normalise, https enforcement, reachability probe,
  sign-out on change
- Secure messaging — thread list, conversation, send, read receipts, camera
  attachment with its filing destination shown before sending
- The clinician review queue — accept/reject a patient upload into the chart

Routed and honest about being unbuilt (`src/screens/Placeholder.tsx` names the
endpoints each will call): patient Home, Visits, Records and More; clinician
Schedule, Patients and More; the three tablet-only surfaces.

Not started: push notifications, biometric unlock, social sign-in UI (the
`signInSocial` plumbing exists; the provider SDK handshake does not), telehealth
join.

## Configuration

`app.json` → `expo.extra` carries `defaultServerUrl` (`app.aureoncare.tech`)
and empty client-id slots for Google and Microsoft. The server URL is
overridable in-app; the client ids are build-time.
