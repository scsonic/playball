# Catch Challenge — Two Editions

A non-touch, camera-controlled baseball catching activation for large digital signage,
built as a **concept prototype for a sponsor proposal**. The same brief was implemented
twice, independently, and this repository serves both from one landing page.

```
/            → edition select (index.html)
/gemini/     → Gemini edition   (gemini/)
/claude/     → Claude edition   (claude/)
```

| | Gemini edition | Claude edition |
|---|---|---|
| Docs | [gemini/README.md](gemini/README.md) | [claude/README.md](claude/README.md) |
| Vision | MediaPipe Hand Landmarker | MediaPipe Hand + Pose Landmarker |
| Input model | hand tracking with mouse fallback | one unified pointer stream (hand / mouse / touch / keyboard) |
| Rendering | 2.5D canvas | pinhole-camera projection in metres, single rAF ticker |
| Native host camera | — | `window.CatchChallenge.camera` (used by the Android USB build) |
| Tests | 12 unit tests | 79 unit tests + 19 Playwright e2e tests |

Both editions run entirely in the browser. Camera frames are processed on-device and
are never stored or uploaded.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000  → landing page
                     # http://localhost:3000/gemini/
                     # http://localhost:3000/claude/
```

Webcam access requires a secure context: use `localhost` or HTTPS.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server for all three pages |
| `npm run build` | Type-check and build every edition into `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Unit tests (Vitest) for both editions |
| `npm run e2e` | Playwright end-to-end suite for the Claude edition (uses your installed Chrome) |

## Repository layout

```
index.html              edition select landing page
gemini/                 Gemini edition (index.html + src/)
claude/                 Claude edition (index.html + src/ + e2e/)
android/                Android kiosk wrapper (WebView + libuvc USB camera)
public/assets/          shared, swappable brand / product / athlete / audio assets
vite.config.ts          multi-page build for the three entry points
```

## Deployment

`.github/workflows/deploy.yml` builds the repository on every push to `main` and
publishes `dist/` to GitHub Pages, so the landing page and both editions deploy together.
Paths are relative (`base: './'`), so the same build works from a project subpath.

## Licensing note

No real athlete likeness, tournament branding, team marks or product packaging is used.
All artwork is procedural or a clearly-labelled placeholder, and every slot can be swapped
for licensed files through the asset manifest. The prototype is not an official campaign
and carries a "Concept Demo" watermark that can be turned off in configuration.
