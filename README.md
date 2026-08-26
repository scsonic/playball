# ITO EN × WBC Interactive Baseball Catching Activation (v2)

Production-quality, full-screen, browser-based interactive Japanese baseball catching game designed for digital-signage displays with connected RGB camera and non-touch hand tracking.

---

## 🌟 Key Features

1. **Non-Touch MediaPipe Vision Tracking**:
   - High-precision **MediaPipe HandLandmarker** detects open left palm.
   - Calculates palm center using centroid of Wrist and MCP joints with exponential smoothing ($\alpha = 0.75$).
   - Real-time geometric open-palm classifier measuring finger extension angles.
   - **Zero-Camera Mouse Simulation Mode** for instant laptop testing.

2. **2.5D Stadium & Pitch Trajectory Engine**:
   - 7 distinct pitch profiles (*Fastball Center, High Left, High Right, Sinker Low Left, Slider Low Right, Curve Left, Curve Right*).
   - Ball depth acceleration ($Z: 1.0 \to 0.0$), dynamic lighting, spherical shading, red seam spin, and grass drop shadows.
   - Forgiving trade-show collision hitbox ($140\text{px}$ catch radius) with 150ms impact freeze, leather glove pop SFX, and spark bursts.

3. **Non-Touch Dwell-to-Click UI**:
   - 2.0-second circular progress dwell selector with SVG ring animation.
   - Velocity-aware pausing ($> 180\text{px/s}$) to prevent accidental clicks while moving.
   - Single-fire locking with 600ms cooldown.

4. **Sponsor Product Hero & QR Coupon System**:
   - 3D/2.5D floating **ITO EN Cold Green Tea Bottle** on a rotating golden pedestal with realistic condensation droplets and light sweeps on catch.
   - Cryptographically random demo coupons with 15-minute expiration timer and mobile-optimized high-contrast QR code.
   - Clean API abstraction ready for production CRM backend integration.

5. **Trade-Show Kiosk & Admin Tools**:
   - 30-second inactivity auto-reset.
   - Fullscreen API and Wake Lock integration.
   - Hidden Admin & CV Debug Console (Shortcut: `` ` `` or `~`) with live camera stream, skeleton landmarks, FPS, hitboxes, and instant win/lose simulation.

---

## 🚀 Quick Start

### 1. Installation
```bash
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in Google Chrome or Microsoft Edge.

### 3. Run Automated Tests
```bash
npm test
```

### 4. Build Production Bundle
```bash
npm run build
```

---

## 🎮 Controls & Shortcuts

| Action | Control |
|---|---|
| **Move Glove / Cursor** | Move Open Left Palm (or Mouse in Demo Mode) |
| **Select UI Buttons** | Hold Cursor still over button for 2 seconds (Dwell) |
| **Catch Baseball** | Position open palm into the ball's arrival path |
| **Open Admin & CV Debug Modal** | Press `` ` `` or `~` key |
| **Reset Game to Attract Mode** | Press `R` or click Reset |
| **Toggle Fullscreen** | Press `F` or click Fullscreen icon |

---

## 🎨 Asset Replacement Guide

All brand, athlete, and stadium assets are strictly modularized in `src/config/asset-manifest.ts`. When authorized WBC / Shohei Ohtani / ITO EN media are supplied, simply drop files into the designated paths:

| Asset Slot | Recommended Format | Description |
|---|---|---|
| `/public/assets/brand/ito-en-logo-licensed.svg` | SVG / PNG | Official ITO EN logo |
| `/public/assets/product/tea-bottle-licensed.webp` | WebP (Transparent) | Licensed Oi Ocha tea bottle |
| `/public/assets/athlete/pitcher-pitch-licensed.webm` | WebM with Alpha / Chroma | Licensed superstar pitching video |
| `/public/assets/athlete/pitcher-celebrate-licensed.webm` | WebM with Alpha / Chroma | Licensed superstar celebration |
| `/public/assets/stadium/stadium-background.webp` | WebP 4K / 1080p | Official WBC tournament stadium |

---

## 🔒 Privacy Architecture

- **100% Local Inference**: All camera frame processing occurs client-side inside the browser via WebAssembly & WebGPU.
- **Zero Video Upload**: No camera frames, video streams, or biometric templates are stored or transmitted.
- **Anonymous Metrics**: Analytics events track only anonymous counters (pitches caught, session IDs, FPS).

---

## 🎤 Sponsor Demonstration Script

> **Presenter Guide for Trade Shows & Client Pitch Meetings:**
>
> 1. **Introduction**: *"Welcome to the ITO EN × WBC Interactive Catching Booth. Notice that players don't touch the screen at all—everything is controlled through natural hand motion."*
> 2. **Interaction**: *"Raise your left hand towards the camera. The system locks onto your palm and highlights the glove indicator."*
> 3. **The Challenge**: *"Our pitcher will throw 5 pitches—fastballs, sliders, and curves. Catch at least 3 to win a complimentary bottle of ITO EN Oi Ocha Green Tea!"*
> 4. **The Catch**: *"Step in, track the trajectory, and snap your hand into position. Notice the realistic leather pop sound, particle sparks, and the light sweep across the tea bottle!"*
> 5. **Reward & Conversion**: *"Upon winning, players scan the dynamic QR code with their smartphone to immediately redeem their tea coupon at the venue or nearby retail partner."*
