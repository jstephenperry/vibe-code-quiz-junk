/* Pure, framework-free golf club length fitting logic.
 *
 * Everything here is a side-effect-free function so it can be unit tested in
 * Node (see scripts/test_fitting.mjs) and reused by the browser app (app.js).
 * All lengths are in inches. This is an APPROXIMATE / "close enough" fitting,
 * not a substitute for a real club fitting.
 */

/* Adult anthropometric ratio: nose (nostril) height is roughly 93% of standing
 * stature. We measure nose -> floor from the pose because the very top of the
 * head is poorly tracked, then convert that span to inches using the user's
 * entered height. */
export const ANTHRO_NOSE_FACTOR = 0.93;

/* Plausible human wrist-to-floor range (inches). Used to clamp / sanity-check. */
export const WTF_MIN = 24;
export const WTF_MAX = 46;

/* Wrist-to-floor (inches) -> iron length delta from standard (inches).
 * Based on commonly published static fitting charts (height/wrist-to-floor).
 * Boundaries are inclusive of the lower value, exclusive of `max`. */
const WTF_CHART = [
  { max: 29.0, delta: -1.0 },
  { max: 32.0, delta: -0.5 },
  { max: 34.0, delta: -0.25 },
  { max: 37.0, delta: 0.0 },
  { max: 38.5, delta: 0.25 },
  { max: 40.0, delta: 0.5 },
  { max: 41.5, delta: 1.0 },
  { max: Infinity, delta: 1.5 },
];

/* Men's standard steel-shaft lengths (inches). `adjust:false` means the fitting
 * delta is not applied (putter length is its own fitting). */
export const STANDARD_CLUBS = [
  { id: "driver", name: "Driver", group: "Woods", length: 45.5 },
  { id: "3w", name: "3 Wood", group: "Woods", length: 43.0 },
  { id: "5w", name: "5 Wood", group: "Woods", length: 42.0 },
  { id: "hybrid", name: "Hybrid (4H)", group: "Hybrid", length: 40.0 },
  { id: "4i", name: "4 Iron", group: "Irons", length: 38.5 },
  { id: "5i", name: "5 Iron", group: "Irons", length: 38.0 },
  { id: "6i", name: "6 Iron", group: "Irons", length: 37.5 },
  { id: "7i", name: "7 Iron", group: "Irons", length: 37.0 },
  { id: "8i", name: "8 Iron", group: "Irons", length: 36.5 },
  { id: "9i", name: "9 Iron", group: "Irons", length: 36.0 },
  { id: "pw", name: "Pitching Wedge", group: "Wedges", length: 35.75 },
  { id: "gw", name: "Gap Wedge", group: "Wedges", length: 35.5 },
  { id: "sw", name: "Sand Wedge", group: "Wedges", length: 35.5 },
  { id: "lw", name: "Lob Wedge", group: "Wedges", length: 35.25 },
  { id: "putter", name: "Putter", group: "Putter", length: 34.0, adjust: false },
];

/* Convert a height value + unit into inches. */
export function heightToInches({ unit, feet, inches, cm }) {
  if (unit === "cm") {
    const v = Number(cm);
    return Number.isFinite(v) && v > 0 ? v / 2.54 : null;
  }
  const ft = Number(feet) || 0;
  const inch = Number(inches) || 0;
  const total = ft * 12 + inch;
  return total > 0 ? total : null;
}

/* Estimate wrist-to-floor (inches) from vertical pose positions.
 *
 * Inputs are normalized image Y coordinates (0 = top of frame, 1 = bottom), so
 * a LARGER y means LOWER in the world. We use the nose->floor span as a body
 * "ruler" and scale it to real inches via the user's height. The result is the
 * raw (unclamped) estimate, or null if the geometry is degenerate. */
export function estimateWristToFloor({ noseY, wristY, floorY, heightInches }) {
  if (![noseY, wristY, floorY, heightInches].every(Number.isFinite)) return null;
  const noseToFloorSpan = floorY - noseY; // normalized, should be positive
  const wristToFloorSpan = floorY - wristY;
  if (noseToFloorSpan <= 0 || heightInches <= 0) return null;
  const ratio = wristToFloorSpan / noseToFloorSpan; // = WTF / noseToFloor
  const noseToFloorInches = ANTHRO_NOSE_FACTOR * heightInches;
  return ratio * noseToFloorInches;
}

/* Clamp a wrist-to-floor estimate to the plausible human range. */
export function clampWristToFloor(wtf) {
  if (!Number.isFinite(wtf)) return null;
  return Math.min(WTF_MAX, Math.max(WTF_MIN, wtf));
}

/* Wrist-to-floor (inches) -> iron length delta from standard (inches). */
export function wristToFloorToDelta(wtf) {
  if (!Number.isFinite(wtf)) return 0;
  for (const row of WTF_CHART) {
    if (wtf < row.max) return row.delta;
  }
  return 0;
}

/* Format an inch delta as a signed, human label, e.g. +0.5 -> "+1/2\"". */
export function formatDelta(delta) {
  if (delta === 0) return "Standard";
  const sign = delta > 0 ? "+" : "−"; // minus sign
  const abs = Math.abs(delta);
  const fractions = {
    0.25: "1/4",
    0.5: "1/2",
    0.75: "3/4",
    1: "1",
    1.25: "1¼",
    1.5: "1½",
  };
  const frac = fractions[abs] || String(abs);
  return `${sign}${frac}″`;
}

/* Format a length in inches, trimming trailing zeros: 37.5 -> "37.5\"". */
export function formatLength(inches) {
  if (!Number.isFinite(inches)) return "—";
  const rounded = Math.round(inches * 100) / 100;
  return `${rounded}″`;
}

/* Build the per-club table for a given fitting delta. Returns objects with the
 * standard length, the adjusted (recommended) length, and whether the delta was
 * applied to that club. */
export function buildClubTable(delta, clubs = STANDARD_CLUBS) {
  return clubs.map((c) => {
    const apply = c.adjust !== false;
    const adjusted = apply ? c.length + delta : c.length;
    return {
      id: c.id,
      name: c.name,
      group: c.group,
      standard: c.length,
      adjusted,
      applied: apply,
    };
  });
}

/* A short plain-language explanation for a delta. */
export function deltaExplanation(delta) {
  if (delta === 0) {
    return "Standard length clubs should fit you well — no length change needed.";
  }
  const dir = delta > 0 ? "longer" : "shorter";
  const abs = formatDelta(delta).replace(/^[+−]/, "");
  return `Consider clubs about ${abs} ${dir} than standard.`;
}

/* Bucket a 0..1 confidence score into a label. */
export function confidenceLabel(score) {
  if (!Number.isFinite(score)) return "Unknown";
  if (score >= 0.75) return "High";
  if (score >= 0.5) return "Medium";
  return "Low";
}
