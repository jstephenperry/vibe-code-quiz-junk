/* Golf Club Length Scanner — camera + on-device pose detection.
 *
 * Loads the MediaPipe Tasks Vision pose model from a CDN, reads the user's
 * wrist-to-floor proportion from the live camera, scales it to inches using
 * their entered height, and maps that to a recommended club length.
 *
 * All vision processing happens on-device; no frames leave the browser.
 *
 * The MediaPipe bundle is imported LAZILY (when a scan starts), never at the
 * top level: if the CDN is blocked or unreachable, the rest of the app must
 * keep working and show a useful error instead of dying before any event
 * handlers attach.
 */
import {
  heightToInches,
  estimateWristToFloor,
  clampWristToFloor,
  wristToFloorToDelta,
  buildClubTable,
  formatDelta,
  formatLength,
  deltaExplanation,
  confidenceLabel,
  WTF_MIN,
  WTF_MAX,
} from "./fitting.js";

/* ---- MediaPipe pose landmark indices we care about ---- */
const LM = {
  nose: 0,
  lShoulder: 11, rShoulder: 12,
  lWrist: 15, rWrist: 16,
  lHip: 23, rHip: 24,
  lKnee: 25, rKnee: 26,
  lAnkle: 27, rAnkle: 28,
  lHeel: 29, rHeel: 30,
  lFoot: 31, rFoot: 32,
};

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const VISION_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20";
const WASM_URL = `${VISION_CDN}/wasm`;

/* Lazily import the MediaPipe Tasks Vision module, caching the promise so the
 * download happens once. Failures are retryable (the cache is cleared). */
let visionModulePromise = null;
function loadVisionModule() {
  if (!visionModulePromise) {
    visionModulePromise = import(`${VISION_CDN}/vision_bundle.mjs`).catch((err) => {
      visionModulePromise = null;
      throw err;
    });
  }
  return visionModulePromise;
}

/* ---- DOM ---- */
const $ = (id) => document.getElementById(id);
const screens = {
  setup: $("setup-screen"),
  scan: $("scan-screen"),
  results: $("results-screen"),
};
const video = $("video");
const overlay = $("overlay");
const stage = document.querySelector(".stage");
const statusEl = $("scan-status");
const countdownEl = $("countdown");
const captureBtn = $("capture-btn");

/* ---- App state ---- */
const state = {
  unit: "ft",
  heightInches: null,
  facingMode: "user",
  stream: null,
  mp: null, // lazily loaded MediaPipe tasks-vision module
  poseLandmarker: null,
  rafId: null,
  lastVideoTime: -1,
  samples: [], // rolling buffer of { wtf, visAvg }
  ready: false,
  counting: false,
  drawingUtils: null,
};

const SAMPLE_WINDOW = 14;
const STABILITY_THRESHOLD = 0.8; // inches std-dev to count as "stable"

/* ====================================================================== */
/* Screen helpers                                                          */
/* ====================================================================== */
function show(name) {
  for (const [key, el] of Object.entries(screens)) {
    el.classList.toggle("hidden", key !== name);
  }
}

function setError(el, msg) {
  if (!msg) {
    el.classList.add("hidden");
    el.textContent = "";
  } else {
    el.classList.remove("hidden");
    el.textContent = msg;
  }
}

/* ====================================================================== */
/* Setup screen                                                           */
/* ====================================================================== */
function initSetup() {
  document.querySelectorAll(".unit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.unit = btn.dataset.unit;
      document.querySelectorAll(".unit-btn").forEach((b) =>
        b.classList.toggle("is-active", b === btn)
      );
      $("height-ft").classList.toggle("hidden", state.unit !== "ft");
      $("height-cm").classList.toggle("hidden", state.unit !== "cm");
      setError($("setup-error"), "");
    });
  });

  $("start-scan-btn").addEventListener("click", () => {
    const h = readHeight();
    if (h == null) {
      setError($("setup-error"), "Please enter a valid height first.");
      return;
    }
    state.heightInches = h;
    startScan();
  });

  $("show-manual-btn").addEventListener("click", () => {
    $("manual-panel").classList.toggle("hidden");
  });

  $("manual-submit-btn").addEventListener("click", () => {
    const h = readHeight();
    if (h == null) {
      setError($("setup-error"), "Please enter a valid height first.");
      return;
    }
    state.heightInches = h;
    const raw = Number($("manual-wtf").value);
    if (!Number.isFinite(raw) || raw < WTF_MIN || raw > WTF_MAX) {
      setError($("setup-error"), `Enter a wrist-to-floor between ${WTF_MIN} and ${WTF_MAX} inches.`);
      return;
    }
    setError($("setup-error"), "");
    finish(clampWristToFloor(raw), 1); // manual entry = full confidence in the input
  });
}

function readHeight() {
  return heightToInches({
    unit: state.unit,
    feet: $("feet").value,
    inches: $("inches").value,
    cm: $("cm").value,
  });
}

/* ====================================================================== */
/* Scan screen — camera + pose                                            */
/* ====================================================================== */
async function startScan() {
  show("scan");
  setError($("scan-error"), "");
  setStatus("Starting camera…");
  captureBtn.disabled = true;

  // Fail fast, with a specific reason, before touching the camera.
  if (!window.isSecureContext) {
    onScanFailure("Camera access needs HTTPS (or localhost). Open this page over https://.");
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    onScanFailure("This browser/tab doesn't expose the camera API (some private/restricted modes block it).");
    return;
  }

  try {
    await startCamera();
  } catch (err) {
    if (err && err.name === "NotAllowedError") {
      onScanFailure(
        "Camera permission was denied. In Safari, tap the “ᴀA” menu in the address bar → Website Settings → Camera → Allow, then retry.",
        err
      );
    } else {
      onScanFailure("Couldn't access the camera.", err);
    }
    return;
  }

  try {
    setStatus("Loading scanner model…");
    if (!state.mp) state.mp = await loadVisionModule();
    if (!state.poseLandmarker) state.poseLandmarker = await createPose();
  } catch (err) {
    onScanFailure(
      "Couldn't load the pose model — a content blocker or network issue may be blocking the CDN.",
      err
    );
    return;
  }

  state.drawingUtils = new state.mp.DrawingUtils(overlay.getContext("2d"));
  state.lastVideoTime = -1;
  loop();
}

function onScanFailure(msg, err) {
  console.error(err);
  stopCamera();
  setStatus("Scan unavailable");
  statusEl.classList.add("is-warn");
  const detail = err ? ` [${err.name || "Error"}${err.message ? `: ${err.message}` : ""}]` : "";
  setError(
    $("scan-error"),
    `${msg} Tap “← Back”, then “Enter wrist-to-floor manually”.${detail}`
  );
}

async function startCamera() {
  stopCamera();
  state.stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: state.facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = state.stream;
  // iOS Safari: must be set as properties too — the HTML attributes alone are
  // not always honoured after srcObject changes, and autoplay of an unmuted or
  // non-inline video is blocked.
  video.muted = true;
  video.playsInline = true;
  stage.classList.toggle("no-mirror", state.facingMode === "environment");
  await video.play();
  await new Promise((res) => {
    if (video.videoWidth) return res();
    video.addEventListener("loadedmetadata", res, { once: true });
  });
  overlay.width = video.videoWidth;
  overlay.height = video.videoHeight;
}

function stopCamera() {
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = null;
  if (state.stream) {
    state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null;
  }
}

async function createPose() {
  const { FilesetResolver, PoseLandmarker } = state.mp;
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  const opts = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  try {
    return await PoseLandmarker.createFromOptions(vision, opts("GPU"));
  } catch (err) {
    console.warn("GPU delegate unavailable, falling back to CPU", err);
    return PoseLandmarker.createFromOptions(vision, opts("CPU"));
  }
}

function loop() {
  state.rafId = requestAnimationFrame(loop);
  if (!state.poseLandmarker || video.readyState < 2) return;

  if (video.currentTime !== state.lastVideoTime) {
    state.lastVideoTime = video.currentTime;
    const result = state.poseLandmarker.detectForVideo(video, performance.now());
    handleResult(result);
  }
}

function handleResult(result) {
  const ctx = overlay.getContext("2d");
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  const landmarks = result.landmarks && result.landmarks[0];
  if (!landmarks) {
    state.ready = false;
    state.samples.length = 0;
    captureBtn.disabled = true;
    setStatus("Step into frame so your whole body is visible", "warn");
    return;
  }

  // Draw skeleton.
  state.drawingUtils.drawConnectors(landmarks, state.mp.PoseLandmarker.POSE_CONNECTIONS, {
    color: "rgba(92,197,133,0.9)",
    lineWidth: 3,
  });
  state.drawingUtils.drawLandmarks(landmarks, {
    color: "#1f8a4c",
    fillColor: "#eaf2f8",
    radius: 3,
    lineWidth: 1,
  });

  const check = assessPose(landmarks);
  if (!check.ok) {
    state.ready = false;
    state.samples.length = 0;
    captureBtn.disabled = true;
    cancelCountdown();
    setStatus(check.message, "warn");
    return;
  }

  // Pose is usable — record a sample.
  state.ready = true;
  captureBtn.disabled = false;
  state.samples.push({ wtf: check.wtf, visAvg: check.visAvg });
  if (state.samples.length > SAMPLE_WINDOW) state.samples.shift();

  if (state.samples.length >= SAMPLE_WINDOW) {
    const sd = stdDev(state.samples.map((s) => s.wtf));
    if (sd < STABILITY_THRESHOLD) {
      setStatus("Hold still…", "ready");
      startCountdown();
      return;
    }
  }
  setStatus("Looking good — keep still", "ready");
}

/* Evaluate whether the pose is good enough to measure, and if so compute the
 * wrist-to-floor estimate. Returns { ok, message, wtf, visAvg }. */
function assessPose(lm) {
  // Some MediaPipe builds omit `visibility`; treat "not reported" as visible so
  // the scanner doesn't get permanently stuck waiting for a confidence score.
  const vis = (i) => {
    if (!lm[i]) return 0;
    const v = lm[i].visibility;
    return v == null ? 1 : v;
  };
  const y = (i) => lm[i].y;

  // Key points must be confidently visible.
  const need = [LM.nose, LM.lShoulder, LM.rShoulder, LM.lHip, LM.rHip];
  if (need.some((i) => vis(i) < 0.5)) {
    return { ok: false, message: "Step into frame, facing the camera" };
  }
  const wristVis = Math.max(vis(LM.lWrist), vis(LM.rWrist));
  if (wristVis < 0.5) {
    return { ok: false, message: "Make sure both hands are visible" };
  }

  // Floor reference = lowest confidently-visible foot point.
  const footPts = [LM.lHeel, LM.rHeel, LM.lFoot, LM.rFoot, LM.lAnkle, LM.rAnkle]
    .filter((i) => vis(i) >= 0.5)
    .map((i) => y(i));
  if (!footPts.length) {
    return { ok: false, message: "Step back so your feet are in frame" };
  }
  const floorY = Math.max(...footPts);
  const noseY = y(LM.nose);

  // Whole body must fit with a little margin top and bottom.
  if (noseY < 0.03 || floorY > 0.99 || floorY - noseY < 0.45) {
    return { ok: false, message: "Step back — fit your whole body in frame" };
  }

  const shoulderY = (y(LM.lShoulder) + y(LM.rShoulder)) / 2;
  const hipY = (y(LM.lHip) + y(LM.rHip)) / 2;

  // Standing upright, facing camera (top-to-bottom ordering holds).
  if (!(noseY < shoulderY && shoulderY < hipY && hipY < floorY)) {
    return { ok: false, message: "Stand up straight, facing the camera" };
  }

  // Arms must hang down, not be raised.
  const wristYs = [];
  if (vis(LM.lWrist) >= 0.5) wristYs.push(y(LM.lWrist));
  if (vis(LM.rWrist) >= 0.5) wristYs.push(y(LM.rWrist));
  const wristY = wristYs.reduce((a, b) => a + b, 0) / wristYs.length;
  if (wristY < shoulderY + 0.05) {
    return { ok: false, message: "Relax your arms down at your sides" };
  }

  const wtf = estimateWristToFloor({ noseY, wristY, floorY, heightInches: state.heightInches });
  if (wtf == null) {
    return { ok: false, message: "Adjust your position and hold still" };
  }

  const visAvg = (vis(LM.nose) + vis(LM.lHip) + vis(LM.rHip) + wristVis) / 4;

  return { ok: true, message: "ready", wtf, visAvg };
}

/* ---- Auto-capture countdown ---- */
let countdownTimer = null;
let countdownValue = 0;
function startCountdown() {
  if (state.counting) return;
  state.counting = true;
  countdownValue = 3;
  countdownEl.classList.remove("hidden");
  countdownEl.textContent = countdownValue;
  countdownTimer = setInterval(() => {
    countdownValue -= 1;
    if (countdownValue <= 0) {
      cancelCountdown();
      capture();
    } else {
      countdownEl.textContent = countdownValue;
    }
  }, 700);
}
function cancelCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = null;
  state.counting = false;
  countdownEl.classList.add("hidden");
}

function capture() {
  if (!state.samples.length) return;
  const wtfs = state.samples.map((s) => s.wtf);
  const wtf = clampWristToFloor(median(wtfs));
  const visAvg = mean(state.samples.map((s) => s.visAvg));
  const sd = stdDev(wtfs);
  // Confidence: high landmark visibility + low jitter.
  const stability = Math.max(0, 1 - sd / 2);
  const confidence = clamp01(visAvg * 0.6 + stability * 0.4);
  stopCamera();
  finish(wtf, confidence);
}

function setStatus(msg, kind) {
  statusEl.textContent = msg;
  statusEl.classList.toggle("is-ready", kind === "ready");
  statusEl.classList.toggle("is-warn", kind === "warn");
}

/* ====================================================================== */
/* Results                                                                */
/* ====================================================================== */
function finish(wtf, confidence) {
  const delta = wristToFloorToDelta(wtf);

  $("headline-delta").textContent = formatDelta(delta);
  $("headline-explain").textContent = deltaExplanation(delta);

  $("measure-wtf").textContent = `${Math.round(wtf * 4) / 4}″`;
  $("measure-height").textContent = formatHeight(state.heightInches);
  $("measure-confidence").textContent = confidenceLabel(confidence);

  renderTable(buildClubTable(delta), delta);
  show("results");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderTable(rows, delta) {
  const body = $("club-table-body");
  let lastGroup = null;
  body.innerHTML = rows
    .map((r) => {
      const isNewGroup = r.group !== lastGroup;
      lastGroup = r.group;
      const changed = r.applied && delta !== 0;
      const chip = changed ? `<span class="delta-chip">${formatDelta(delta)}</span>` : "";
      return `
        <tr class="${isNewGroup ? "group-start" : ""}">
          <td>${r.name}</td>
          <td>${formatLength(r.standard)}</td>
          <td class="${changed ? "changed" : ""}">${formatLength(r.adjusted)}${chip}</td>
        </tr>`;
    })
    .join("");
}

function formatHeight(inches) {
  if (!Number.isFinite(inches)) return "—";
  if (state.unit === "cm") return `${Math.round(inches * 2.54)} cm`;
  const ft = Math.floor(inches / 12);
  const inch = Math.round(inches - ft * 12);
  return `${ft}′${inch}″`;
}

/* ====================================================================== */
/* Small math helpers                                                     */
/* ====================================================================== */
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
function stdDev(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
}
function median(a) {
  const s = [...a].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/* ====================================================================== */
/* Wire up                                                                */
/* ====================================================================== */
$("cancel-scan-btn").addEventListener("click", () => {
  cancelCountdown();
  stopCamera();
  setStatus("Starting camera…");
  statusEl.classList.remove("is-warn", "is-ready");
  show("setup");
});

$("flip-cam-btn").addEventListener("click", async () => {
  state.facingMode = state.facingMode === "user" ? "environment" : "user";
  cancelCountdown();
  state.samples.length = 0;
  try {
    await startCamera();
  } catch (err) {
    onScanFailure("Couldn't switch cameras.", err);
  }
});

captureBtn.addEventListener("click", () => {
  if (state.ready) {
    cancelCountdown();
    capture();
  }
});

$("restart-btn").addEventListener("click", () => {
  state.samples.length = 0;
  show("setup");
});

initSetup();
show("setup");
window.__clubScannerBooted = true; // checked by the boot guard in index.html
