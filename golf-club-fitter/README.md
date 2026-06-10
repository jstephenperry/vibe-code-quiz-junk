# 📏 Golf Club Length Scanner

A self-contained, browser-only "body scanner" that estimates a **close-enough golf club
length** from your camera. It reads your wrist-to-floor proportion with on-device pose
detection, scales it to inches using your height, and maps that to a length recommendation
for the whole bag.

**No frames leave your device** — the camera feed is processed locally and never uploaded.

## How it works

1. **You enter your height.** Pose detection gives body *proportions*, not absolute size, so
   we need one real-world measurement to set the scale. Height is the easy one.
2. **The camera scans you.** [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe)
   `PoseLandmarker` (loaded from a CDN at runtime) tracks body landmarks live in the browser.
   The app coaches you into a usable pose (whole body in frame, standing straight, arms
   relaxed at your sides) and waits for the reading to stabilise before capturing.
3. **Wrist-to-floor is computed.** Using the vertical positions of your nose, wrists and feet,
   the app measures the *wrist-to-floor ÷ nose-to-floor* ratio, then converts it to inches via
   the anthropometric fact that nose height ≈ 93% of standing height (`fitting.js`).
4. **Length is recommended.** Wrist-to-floor is mapped through a commonly published static
   fitting chart to an iron-length delta from standard (e.g. `+1/2″`), which is then applied
   to standard men's steel lengths to produce a per-club table.

```
wrist-to-floor (in)   iron length vs standard
  < 29                 −1″
  29 – 32              −1/2″
  32 – 34              −1/4″
  34 – 37              Standard
  37 – 38.5            +1/4″
  38.5 – 40            +1/2″
  40 – 41.5            +1″
  > 41.5               +1.5″
```

There's also a **manual entry** fallback (type your wrist-to-floor) for when the camera or
model isn't available.

> ⚠️ This is an **approximation for guidance only**, not a substitute for a real fitting.
> Length also depends on posture, swing dynamics and ball position. The pose-based
> wrist-to-floor is an estimate and will be off by some amount depending on lighting,
> framing and how straight you stand.

## Files

```
index.html        ← screens: setup → scan → results
styles.css        ← styling (matches the hub's golf palette)
app.js            ← ES module: camera, pose detection, coaching, capture (imports fitting.js)
fitting.js        ← pure, testable fitting math (no DOM, no camera)
package.json      ← only there so `node --test` can run the pure logic (static site has no build)
scripts/
  test_fitting.mjs  ← unit tests for fitting.js
```

## Running locally

It's a static site — but the camera needs a **secure context**, so use `localhost`
(allowed) rather than opening the file directly:

```bash
# from the repo root
python3 -m http.server 8000
# then visit http://localhost:8000/golf-club-fitter/
```

Grant camera permission when prompted. The pose model and WASM are fetched from a CDN on
first scan, so the scan step needs network access (the rest works offline).

## Testing the fitting math

```bash
cd golf-club-fitter
node --test scripts/test_fitting.mjs
```
