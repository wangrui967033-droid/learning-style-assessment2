import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateCalibration,
  needsCalibration,
  selectCalibrationPair
} from "../src/domain/calibration.js";

test("calibration triggers below 10 but not at 10", () => {
  assert.equal(needsCalibration({ V: 72, R: 63, A: 40, K: 35 }), true);
  assert.equal(needsCalibration({ V: 72, R: 62, A: 40, K: 35 }), false);
});

test("calibration selects the canonical pair after score and tie ordering", () => {
  assert.equal(selectCalibrationPair({ V: 72, R: 66, A: 40, K: 35 }), "V-R");
  assert.equal(selectCalibrationPair({ R: 72, V: 72, A: 40, K: 35 }), "V-R");
});

test("calibration confirms 3:1 and preserves original indices", () => {
  const original = { V: 72, R: 66, A: 40, K: 35 };
  const result = evaluateCalibration([
    { selected: "V" },
    { selected: "V" },
    { selected: "R" },
    { selected: "V" }
  ]);

  assert.deepEqual(original, { V: 72, R: 66, A: 40, K: 35 });
  assert.deepEqual(result, {
    type: "ordered",
    primary: "V",
    secondary: "R",
    tally: { V: 3, R: 1 }
  });
});

test("calibration confirms a unanimous 4:0 ordering", () => {
  const result = evaluateCalibration([
    { selected: "R", pair: "V-R" },
    { selected: "R", pair: "V-R" },
    { selected: "R", pair: "V-R" },
    { selected: "R", pair: "V-R" }
  ]);

  assert.deepEqual(result, {
    type: "ordered",
    primary: "R",
    secondary: "V",
    tally: { V: 0, R: 4 }
  });
});

test("2:2 becomes dual preference", () => {
  const result = evaluateCalibration([
    { selected: "V" },
    { selected: "R" },
    { selected: "R" },
    { selected: "V" }
  ]);

  assert.deepEqual(result, { type: "dual", preferences: ["V", "R"], tally: { V: 2, R: 2 } });
});

test("calibration requires exactly four selections from one canonical pair", () => {
  assert.throws(
    () => evaluateCalibration([{ selected: "V", pair: "V-R" }]),
    /exactly four/i
  );
  assert.throws(
    () => evaluateCalibration([
      { selected: "V", pair: "V-R" },
      { selected: "V", pair: "V-R" },
      { selected: "R", pair: "V-A" },
      { selected: "V", pair: "V-R" }
    ]),
    /same pair/i
  );
  assert.throws(
    () => evaluateCalibration([
      { selected: "V", pair: "V-R" },
      { selected: "V", pair: "V-R" },
      { selected: "A", pair: "V-R" },
      { selected: "V", pair: "V-R" }
    ]),
    /selected preference/i
  );
});
