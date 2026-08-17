import test from "node:test";
import assert from "node:assert/strict";
import { classifyProfile } from "../src/domain/classification.js";

function scoreResult(indices, { academic = indices, life = indices, process = {} } = {}) {
  return {
    preference: Object.fromEntries(
      Object.entries(indices).map(([preference, index]) => [preference, {
        index,
        academic: { index: academic[preference] },
        life: { index: life[preference] }
      }])
    ),
    process
  };
}

function processProfile(winner, runnerUp) {
  const indices = { V: 40, A: 40, R: 40, K: 40 };
  indices[winner] = 72;
  indices[runnerUp] = 60;
  return Object.fromEntries(Object.entries(indices).map(([preference, index]) => [preference, { index }]));
}

test("single clear preference uses the inclusive 65 and 12 boundaries", () => {
  const original = scoreResult({ V: 65, A: 53, R: 40, K: 35 });

  const result = classifyProfile(original);

  assert.equal(result.type, "single_clear");
  assert.equal(result.primary, "V");
  assert.equal(result.secondary, "A");
  assert.deepEqual(result.indices, { V: 65, A: 53, R: 40, K: 35 });
  assert.equal(result.confidence.level, "stable");
  assert.deepEqual(original.preference.V, {
    index: 65,
    academic: { index: 65 },
    life: { index: 65 }
  });
});

test("dual combination uses inclusive 60, 10, and 8 boundaries", () => {
  const result = classifyProfile(scoreResult({ V: 70, A: 60, R: 52, K: 35 }));

  assert.equal(result.type, "dual");
  assert.deepEqual(result.preferences, ["V", "A"]);
});

test("multi-channel preference wins when three indices meet its exact boundaries", () => {
  const result = classifyProfile(scoreResult({ V: 70, A: 65, R: 60, K: 35 }));

  assert.equal(result.type, "multi_channel");
  assert.deepEqual(result.preferences, ["V", "A", "R"]);
});

test("context-varying takes precedence when clear process winners differ", () => {
  const result = classifyProfile(scoreResult(
    { V: 70, A: 58, R: 40, K: 35 },
    {
      process: {
        learning: processProfile("V", "A"),
        memory: processProfile("A", "V"),
        practice: processProfile("V", "A"),
        improve: processProfile("V", "A")
      }
    }
  ));

  assert.equal(result.type, "context_varying");
  assert.deepEqual(result.processWinners, [
    { process: "learning", preference: "V" },
    { process: "memory", preference: "A" },
    { process: "practice", preference: "V" },
    { process: "improve", preference: "V" }
  ]);
});

test("context-varying ignores clear winners from unknown process keys", () => {
  const result = classifyProfile(scoreResult(
    { V: 70, A: 58, R: 40, K: 35 },
    {
      process: {
        learning: processProfile("V", "A"),
        unexpected: processProfile("A", "V")
      }
    }
  ));

  assert.equal(result.type, "single_clear");
});

test("calibration 2:2 is a dual override before context and score rules", () => {
  const result = classifyProfile(
    scoreResult({ V: 80, A: 50, R: 40, K: 30 }, {
      process: {
        learning: processProfile("V", "A"),
        memory: processProfile("A", "V")
      }
    }),
    { type: "dual", preferences: ["V", "A"], tally: { V: 2, A: 2 } }
  );

  assert.equal(result.type, "dual");
  assert.deepEqual(result.preferences, ["V", "A"]);
  assert.equal(result.primary, undefined);
});

test("calibration 3:1 or 4:0 overrides raw score and context ordering", () => {
  const result = classifyProfile(
    scoreResult({ V: 64, A: 63, R: 42, K: 35 }, {
      process: {
        learning: processProfile("V", "A"),
        memory: processProfile("A", "V")
      }
    }),
    { type: "ordered", primary: "A", secondary: "V", tally: { V: 1, A: 3 } }
  );

  assert.equal(result.type, "single_clear");
  assert.equal(result.primary, "A");
  assert.equal(result.secondary, "V");
  assert.deepEqual(result.indices, { V: 64, A: 63, R: 42, K: 35 });
});

test("undifferentiated includes low top scores and unmatched boundary cases", () => {
  assert.equal(classifyProfile(scoreResult({ V: 54, A: 52, R: 50, K: 48 })).type, "undifferentiated");
  assert.equal(classifyProfile(scoreResult({ V: 63, A: 55, R: 48, K: 32 })).type, "undifferentiated");
});

test("confidence uses mean academic-life difference bands", () => {
  const contextSensitive = classifyProfile(scoreResult(
    { V: 65, A: 53, R: 40, K: 35 },
    { academic: { V: 76, A: 64, R: 51, K: 46 }, life: { V: 65, A: 53, R: 40, K: 35 } }
  ));
  const preliminary = classifyProfile(scoreResult(
    { V: 65, A: 53, R: 40, K: 35 },
    { academic: { V: 90, A: 78, R: 65, K: 60 }, life: { V: 65, A: 53, R: 40, K: 35 } }
  ));

  assert.deepEqual(contextSensitive.confidence, { level: "context_sensitive", meanAbsoluteDifference: 11 });
  assert.deepEqual(preliminary.confidence, { level: "preliminary", meanAbsoluteDifference: 25 });
});
