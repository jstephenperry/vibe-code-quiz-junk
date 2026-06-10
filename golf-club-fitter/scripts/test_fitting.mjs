/* Unit tests for the pure fitting logic. Run with: node --test scripts/ */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ANTHRO_NOSE_FACTOR,
  heightToInches,
  estimateWristToFloor,
  clampWristToFloor,
  wristToFloorToDelta,
  buildClubTable,
  formatDelta,
  formatLength,
  confidenceLabel,
  WTF_MIN,
  WTF_MAX,
} from "../fitting.js";

test("heightToInches handles both units", () => {
  assert.equal(heightToInches({ unit: "ft", feet: 5, inches: 10 }), 70);
  assert.equal(Math.round(heightToInches({ unit: "cm", cm: 177.8 })), 70);
  assert.equal(heightToInches({ unit: "ft", feet: 0, inches: 0 }), null);
  assert.equal(heightToInches({ unit: "cm", cm: "abc" }), null);
});

test("wristToFloorToDelta maps the chart boundaries correctly", () => {
  assert.equal(wristToFloorToDelta(28), -1.0);
  assert.equal(wristToFloorToDelta(29), -0.5); // boundary is exclusive of max below
  assert.equal(wristToFloorToDelta(31.9), -0.5);
  assert.equal(wristToFloorToDelta(33), -0.25);
  assert.equal(wristToFloorToDelta(35), 0.0); // typical ~5'10"
  assert.equal(wristToFloorToDelta(37), 0.25);
  assert.equal(wristToFloorToDelta(39), 0.5);
  assert.equal(wristToFloorToDelta(41), 1.0);
  assert.equal(wristToFloorToDelta(43), 1.5);
});

test("estimateWristToFloor is plausible for a 5'10\" reference pose", () => {
  // Normalized Y: nose high in frame, floor near bottom, wrist ~mid-thigh.
  // For a 70" person, expect wrist-to-floor in the low 30s of inches.
  // Wrist hangs at ~mid/upper thigh: roughly halfway between nose and floor.
  const wtf = estimateWristToFloor({
    noseY: 0.12,
    wristY: 0.55,
    floorY: 0.97,
    heightInches: 70,
  });
  assert.ok(wtf > 28 && wtf < 38, `expected ~32 in, got ${wtf}`);
});

test("estimateWristToFloor uses the anthropometric ruler consistently", () => {
  // If wrist sits exactly at the floor, wrist-to-floor must be 0.
  assert.equal(
    estimateWristToFloor({ noseY: 0.1, wristY: 0.9, floorY: 0.9, heightInches: 70 }),
    0
  );
  // If wrist sits at the nose, span equals nose->floor = 0.93 * height.
  const full = estimateWristToFloor({
    noseY: 0.1,
    wristY: 0.1,
    floorY: 0.9,
    heightInches: 70,
  });
  assert.ok(Math.abs(full - ANTHRO_NOSE_FACTOR * 70) < 1e-9);
});

test("estimateWristToFloor rejects degenerate / bad input", () => {
  assert.equal(estimateWristToFloor({ noseY: 0.9, wristY: 0.5, floorY: 0.5, heightInches: 70 }), null);
  assert.equal(estimateWristToFloor({ noseY: NaN, wristY: 0.5, floorY: 0.9, heightInches: 70 }), null);
});

test("clampWristToFloor keeps values in human range", () => {
  assert.equal(clampWristToFloor(10), WTF_MIN);
  assert.equal(clampWristToFloor(100), WTF_MAX);
  assert.equal(clampWristToFloor(34), 34);
  assert.equal(clampWristToFloor(NaN), null);
});

test("buildClubTable applies delta to clubs but not the putter", () => {
  const table = buildClubTable(0.5);
  const sevenIron = table.find((c) => c.id === "7i");
  const putter = table.find((c) => c.id === "putter");
  assert.equal(sevenIron.adjusted, 37.5);
  assert.equal(sevenIron.applied, true);
  assert.equal(putter.adjusted, 34.0); // unchanged
  assert.equal(putter.applied, false);
});

test("buildClubTable with zero delta returns standard lengths", () => {
  const table = buildClubTable(0);
  for (const c of table) assert.equal(c.adjusted, c.standard);
});

test("formatDelta produces friendly labels", () => {
  assert.equal(formatDelta(0), "Standard");
  assert.equal(formatDelta(0.5), "+1/2″");
  assert.equal(formatDelta(-0.25), "−1/4″");
  assert.equal(formatDelta(1), "+1″");
});

test("formatLength trims and adds unit", () => {
  assert.equal(formatLength(37.5), "37.5″");
  assert.equal(formatLength(38), "38″");
  assert.equal(formatLength(NaN), "—");
});

test("confidenceLabel buckets scores", () => {
  assert.equal(confidenceLabel(0.9), "High");
  assert.equal(confidenceLabel(0.6), "Medium");
  assert.equal(confidenceLabel(0.2), "Low");
});
