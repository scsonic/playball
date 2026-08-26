# Catch Challenge — Claude Edition

A full-screen, non-touch baseball catching game for digital signage. The player controls
everything — menus included — by moving an open palm in front of an RGB camera.

> **Concept prototype.** No real athlete likeness, no tournament branding, no product
> packaging, no claim of sponsor approval. Every such asset is a labelled placeholder that
> can be swapped for licensed files. A "Concept Demo" watermark is on by default.

---

## Run it

```bash
npm install
npm run dev            # → http://localhost:3000/claude/
```

Camera access needs a secure context (`localhost` or HTTPS). Without a camera, choose
**"Demo without camera"** on the first screen and play with the mouse — every screen,
including dwell selection, works identically.

```bash
npm run build          # type-check + production build into dist/
npm run preview        # serve the build
npm test               # 79 unit tests
npm run e2e            # 19 end-to-end tests (Playwright + your installed Chrome)
```

## How to play

1. Stand so your upper body is in frame, raise your **left palm** toward the camera.
2. Move your palm to move the cursor. **Hold it over a button for 2 seconds** to click.
3. The pitcher throws **5 pitches**. Put your open palm where the ball arrives.
4. **Catch 3** to win a (demo) green tea coupon, delivered as a QR code.

### Controls

| Input | Behaviour |
|---|---|
| Open palm | Moves the cursor; the catch zone is only armed while the palm is open |
| Dwell 2 s | Activates the control under the cursor |
| Mouse / touch | Moves the cursor; click or tap activates immediately |
| Arrow keys | Move the cursor; **Enter** / **Space** activates |
| **Ctrl+Alt+D** | Operator panel (tracking, FPS, hitbox, asset status, simulate win/lose) |
| **Ctrl+Alt+R** | Reset the session |
| **Esc** | Close the operator panel |

## Architecture

```
src/
  core/      stateMachine.ts   table-driven FSM: every transition is declared
             store.ts          external store; React subscribes, tracking never re-renders
             ticker.ts         the single requestAnimationFrame loop
  vision/    Camera.ts         camera lifecycle + loss detection (webcam or host)
             ExternalCamera.ts window.CatchChallenge.camera — native host contract
             HandTracker.ts    MediaPipe hand + optional pose, lazy-loaded
             PalmModel.ts      palm centre / width / orientation, open-palm classifier
             Mapper.ts         camera → screen mapping (mirror, active area, clamp)
             Smoother.ts       adaptive smoothing (heavy at rest, light when fast)
             PointerSource.ts  hand · mouse · touch · keyboard → one CursorSample stream
  interaction/ DwellEngine.ts  dwell-to-click with velocity gating and cooldown
             CursorLayer.tsx   menu cursor + dwell ring, drawn on canvas
  game/      Engine.ts         pitch sequencing and rendering, driven by delta time
             Trajectory.ts     pitches in metres + pinhole projection
             CatchDetector.ts  pure collision test
             render/           stadium, pitcher rig, ball, glove, particles, product hero
  coupon/    CouponService.ts  interface + production API contract
             DemoCouponService.ts / HttpCouponService.ts / CouponQr.tsx
  screens/   boot · calibration · attract · HUD · result · coupon · error · admin
  config/    campaign.config.ts · asset-manifest.ts
  i18n/      ja · en · zh-TW
```

Three decisions worth knowing:

- **One rAF loop, no gameplay timers.** Vision, dwell, gameplay and cursor rendering are
  ordered subscribers of one ticker. Nothing in the pitch sequence uses `setTimeout`, which
  is what makes aborting a game a single flag and stops countdowns from getting stuck.
- **One pointer abstraction.** The dwell engine, catch detector and tests never know
  whether a human hand or a mouse is driving; that is why the whole game is testable
  without a webcam and why mouse fallback is seamless rather than a separate mode.
- **Geometry in metres.** Ball, mound, field stripes and the pitcher all use one pinhole
  camera, so perspective is consistent and the game looks correct from a laptop to a 4K wall.

## Configuration

`src/config/campaign.config.ts` holds every tunable value: pitch count, required catches,
timings, dwell duration, smoothing, catch radius, mirroring, inactivity reset, coupon
expiry, locale, feature flags and licensing flags. Difficulty presets (`easy` / `normal` /
`challenge`) adjust pitch speed, catch radius, catch window and trajectory spread.

Environment variables are documented in [`.env.example`](../.env.example).

## Native host camera (`window.CatchChallenge.camera`)

Some shells can reach a camera the browser cannot — a USB/UVC device on Android is the
usual case, where the WebView's `getUserMedia` never sees external cameras. Instead of
having the host patch `getUserMedia`, the game publishes a contract and treats a host
camera as a first-class transport:

```js
window.CatchChallenge.camera.registerHost({ name, requestPermission, restart })
window.CatchChallenge.camera.open({ width, height, label, transport })
window.CatchChallenge.camera.pushFrame(base64Jpeg)   // per frame
window.CatchChallenge.camera.close('unplugged')
window.CatchChallenge.camera.isActive()
window.CatchChallenge.camera.status()
```

Pushed frames are decoded into a canvas that is fed straight to MediaPipe and exposed as a
`MediaStream` for preview surfaces, so nothing downstream can tell a host camera from a
webcam. `Camera.start()` prefers a registered host and calls its `requestPermission()`,
which is what raises Android's USB permission dialog from the game's own Enable Camera
button. If no frames arrive within 9 seconds it falls back to `getUserMedia`. See
[`android/README.md`](../android/README.md) for the reference implementation.

## Privacy

- Camera frames are processed **locally in the browser** by MediaPipe (WASM/GPU).
- Nothing is recorded, uploaded or persisted; there is no face or identity recognition.
- Analytics events are anonymous counters only (see `src/analytics/Analytics.ts`) — no
  video, images, landmarks or personal data. Raw landmark streams are never stored.
- The privacy promise is stated on screen *before* the camera prompt, and an on-device
  indicator stays visible during gameplay.

## Replacing assets

`src/config/asset-manifest.ts` declares every slot with a placeholder path, an optional
licensed path and whether a licence is required. Gameplay code always asks the manifest,
so authorised files can be dropped into `public/assets/**` and enabled with a flag:

```ts
useLicensedAthleteAssets: true   // pitcher clips  → *-licensed.webm
useLicensedBrandAssets: true     // logo + bottle  → *-licensed.*
```

| Slot | File |
|---|---|
| Sponsor logo | `public/assets/brand/ito-en-logo-placeholder.svg` |
| Product bottle | `public/assets/product/tea-bottle-placeholder.webp` |
| Pitcher idle / pitch / celebrate | `public/assets/athlete/pitcher-*-placeholder.webm` |
| Stadium plate | `public/assets/stadium/stadium-background.webp` |
| Audio cues | `public/assets/audio/{stadium-loop,pitch,catch,miss,win}.mp3` |

Every slot is **optional**: with an empty asset folder the stadium, pitcher, bottle and all
sound effects are generated procedurally. The operator panel shows which slots are backed
by real files. Licensed athlete video (alpha WebM preferred) replaces the drawn pitcher rig
without touching gameplay code, because the engine drives animation *phases*, not artwork.

## Coupons

**Demo mode (default).** Codes are generated locally, prefixed `DEMO-`, marked
"NOT REDEEMABLE", expire after 15 minutes and are single-use. The QR URL carries only
`demo`, `score` and an anonymous session id.

**Production.** Set `VITE_API_URL` and `demoMode: false` to switch to `HttpCouponService`:

```
POST /api/game/session        → { sessionId }
POST /api/game/result         → { accepted }
POST /api/coupon/issue        → Coupon
GET  /api/coupon/:code        → Coupon | 404
POST /api/coupon/:code/redeem → { redeemed }
```

The browser client holds no secrets and cannot mint a coupon. The backend must generate
tokens with a CSPRNG, validate the win against the recorded session, enforce single use and
expiry, rate-limit issuance per session/device, cap issuance per campaign day, protect
against replay, and record issue/redemption timestamps. Collect no personal data without
explicit consent.

## Kiosk behaviour

Play Again and Reset never reload the page. The session resets automatically after
30 seconds of inactivity (configurable), returning to attract mode and clearing any coupon.
Camera loss is detected and routed to a recoverable error screen. Timers, animation frames
and MediaPipe resources are cleaned up on teardown; particles are pooled. Text selection,
drag and scrollbars are disabled, full screen is requested from an explicit gesture, and a
screen wake lock is held where the browser supports it. If audio autoplay is blocked the
game runs silently and unlocks on the first selection.

## Decisions made where the brief was open

- **Dwell during a pitch.** UI dwell is locked while a ball is in the air, and re-armed
  between pitches, so the reset control stays reachable without risking a stray click
  mid-catch. Mouse clicks always work for operators.
- **Right-hand players.** The target hand is configurable, and if only the "wrong" hand is
  visible it still drives the cursor rather than leaving the player with a dead screen.
- **Audio without assets.** All cues are synthesised with Web Audio so the prototype has a
  complete soundscape with an empty asset folder; real files take priority when present.
- **`window.__catchChallenge`** exposes the store, engine and pointer source for the e2e
  suite and on-site debugging. It is read-mostly and mirrors what the operator panel
  already offers; remove it in `App.tsx` if a deployment forbids debug hooks.

## Testing

- **Unit (Vitest, 79 tests):** state transitions, win condition, pitch counting, duplicate
  catch prevention, catch collision, responsive catch radius, trajectory geometry and
  sequencing, dwell timing/reset/velocity/cooldown, palm classifier, handedness mirroring,
  coordinate mapping, smoothing, demo coupon rules, coupon-after-loss refusal, and the
  host camera contract.
- **End-to-end (Playwright, 19 tests):** camera-denied fallback, mouse demo mode, dwell
  activation, a full five-pitch game **won by actually catching the ball**, coupon + QR
  display, replay without reload, no coupon after a loss, inactivity auto-reset, language
  switching, layout at 1920×1080, 3840×2160 and 1080×1920, plus the host camera path:
  a fake native host registers, pushes synthetic JPEG frames, and the game runs on them
  with no webcam present.

The e2e suite drives the real UI against a production build using the Chrome already
installed on the machine (`playwright-core`), so no browser download is needed.

## Sponsor demo script (about 3 minutes)

1. **Set up.** Full screen, camera connected, stand 1.5–2 m back. Open with the attract
   screen: "everything you see is controlled without touching anything."
2. **Show the non-touch UI.** Raise your left palm, move the cursor onto **スタート** and let
   the ring fill. Point out that nothing was clicked, tapped or spoken.
3. **Play.** Narrate the countdown, catch the first pitch, deliberately miss one to show the
   soft, non-punishing miss treatment.
4. **Win and reward.** On three catches the crowd reacts, the bottle lights up and the QR
   coupon appears. Scan it with a phone to show the mobile claim URL.
5. **Show the swap story.** Ctrl+Alt+D → asset status: every athlete, logo and product slot
   is a placeholder today and becomes licensed artwork with one flag. Emphasise that no
   likeness or packaging is imitated in the prototype.
6. **Show operations.** Simulate a win, reset the session, and mention the 30-second
   inactivity reset that keeps the booth running unattended all day.
