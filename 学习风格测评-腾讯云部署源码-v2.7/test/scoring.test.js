import test from "node:test";
import assert from "node:assert/strict";
import { scoreAssessment } from "../src/domain/scoring.js";

test("reverse items use 6-X and life items use half weight", () => {
  const questions = [
    { id: "V01", kind: "preference", preference: "V", process: "learning", scenarioType: "academic", direction: "positive" },
    { id: "V02", kind: "preference", preference: "V", process: "memory", scenarioType: "life", direction: "negative" }
  ];

  const result = scoreAssessment({
    questions,
    answers: [{ questionId: "V01", value: 5 }, { questionId: "V02", value: 1 }]
  });

  assert.equal(result.preference.V.weightedMean, 5);
  assert.equal(result.preference.V.index, 100);
  assert.equal(result.preference.V.academic.index, 100);
  assert.equal(result.preference.V.life.index, 100);
  assert.deepEqual(result.answerDetails.map(({ questionId, scoredValue, weight }) => ({ questionId, scoredValue, weight })), [
    { questionId: "V01", scoredValue: 5, weight: 1 },
    { questionId: "V02", scoredValue: 5, weight: 0.5 }
  ]);
});

test("science scores stay separate from preference indices", () => {
  const result = scoreAssessment({
    questions: [
      { id: "LS01", kind: "science", strategy: "retrieval", direction: "positive" },
      { id: "LS02", kind: "science", strategy: "retrieval", direction: "negative" }
    ],
    answers: [{ questionId: "LS01", value: 4 }, { questionId: "LS02", value: 2 }]
  });

  assert.equal(result.science.retrieval, 8);
  assert.deepEqual(result.preference, {});
});

test("four preference indices are independent and do not normalize to a shared total", () => {
  const questions = [
    { id: "V01", kind: "preference", preference: "V", process: "learning", scenarioType: "academic", direction: "positive", subdimension: "new_visual_mechanism" },
    { id: "A01", kind: "preference", preference: "A", process: "memory", scenarioType: "academic", direction: "positive", subdimension: "new_audio_mechanism" },
    { id: "R01", kind: "preference", preference: "R", process: "practice", scenarioType: "academic", direction: "positive", subdimension: "new_reading_mechanism" },
    { id: "K01", kind: "preference", preference: "K", process: "improve", scenarioType: "academic", direction: "positive", subdimension: "new_action_mechanism" }
  ];

  const result = scoreAssessment({
    questions,
    answers: [
      { questionId: "V01", value: 5 },
      { questionId: "A01", value: 4 },
      { questionId: "R01", value: 3 },
      { questionId: "K01", value: 2 }
    ]
  });

  assert.deepEqual(
    Object.fromEntries(["V", "A", "R", "K"].map((preference) => [preference, result.preference[preference].index])),
    { V: 100, A: 75, R: 50, K: 25 }
  );
  assert.equal(Object.values(result.preference).reduce((sum, entry) => sum + entry.index, 0), 250);
  assert.deepEqual(result.preference.V.mechanisms.new_visual_mechanism, {
    state: "partial",
    itemCount: 1,
    highCount: 1,
    lowCount: 0
  });
});

test("mechanism evidence is qualitative rather than a weighted score", () => {
  const mechanisms = [
    ["prominent_mechanism", 4, 5, "prominent"],
    ["task_dependent_mechanism", 4, 2, "task_dependent"],
    ["limited_mechanism", 2, 1, "limited"],
    ["partial_mechanism", 4, 3, "partial"]
  ];
  const questions = mechanisms.flatMap(([subdimension], index) => [
    { id: `V${index * 2 + 1}`, kind: "preference", preference: "V", process: "learning", scenarioType: "academic", direction: "positive", subdimension },
    { id: `V${index * 2 + 2}`, kind: "preference", preference: "V", process: "memory", scenarioType: "academic", direction: "positive", subdimension }
  ]);
  const answers = mechanisms.flatMap(([, first, second], index) => [
    { questionId: `V${index * 2 + 1}`, value: first },
    { questionId: `V${index * 2 + 2}`, value: second }
  ]);

  const result = scoreAssessment({ questions, answers });

  for (const [subdimension, first, second, state] of mechanisms) {
    const evidence = result.preference.V.mechanisms[subdimension];
    assert.deepEqual(evidence, {
      state,
      itemCount: 2,
      highCount: [first, second].filter((value) => value >= 4).length,
      lowCount: [first, second].filter((value) => value <= 2).length
    });
    assert.equal("weightedMean" in evidence, false);
    assert.equal("index" in evidence, false);
    assert.equal("percentage" in evidence, false);
  }
});

test("process profiles aggregate independently and expose all four processes", () => {
  const questions = [
    { id: "V01", kind: "preference", preference: "V", process: "learning", scenarioType: "academic", direction: "positive" },
    { id: "A01", kind: "preference", preference: "A", process: "memory", scenarioType: "academic", direction: "positive" },
    { id: "R01", kind: "preference", preference: "R", process: "practice", scenarioType: "academic", direction: "positive" },
    { id: "K01", kind: "preference", preference: "K", process: "improve", scenarioType: "academic", direction: "positive" }
  ];

  const result = scoreAssessment({
    questions,
    answers: [
      { questionId: "V01", value: 5 },
      { questionId: "A01", value: 4 },
      { questionId: "R01", value: 3 },
      { questionId: "K01", value: 2 }
    ]
  });

  assert.deepEqual(
    Object.fromEntries(Object.entries(result.process).map(([process, entry]) => [process, entry.index])),
    { learning: 100, memory: 75, practice: 50, improve: 25 }
  );
});

test("all five science strategies keep their own reverse-scored totals", () => {
  const strategies = ["retrieval", "spaced_repetition", "deliberate_practice", "timely_feedback", "metacognition"];
  const questions = strategies.flatMap((strategy, index) => [
    { id: `LS${index * 2 + 1}`, kind: "science", strategy, direction: "positive" },
    { id: `LS${index * 2 + 2}`, kind: "science", strategy, direction: "reverse" }
  ]);
  const answers = questions.flatMap((question, index) => [
    { questionId: question.id, value: index % 2 === 0 ? 4 : 2 }
  ]);

  const result = scoreAssessment({ questions, answers });

  assert.deepEqual(result.science, Object.fromEntries(strategies.map((strategy) => [strategy, 8])));
});

test("rejects missing, duplicate, unknown, and out-of-range answers", () => {
  const questions = [
    { id: "V01", kind: "preference", preference: "V", process: "learning", scenarioType: "academic", direction: "positive" },
    { id: "LS01", kind: "science", strategy: "retrieval", direction: "positive" }
  ];

  assert.throws(() => scoreAssessment({ questions, answers: [{ questionId: "V01", value: 3 }] }), /missing answer/i);
  assert.throws(() => scoreAssessment({ questions, answers: [
    { questionId: "V01", value: 3 },
    { questionId: "V01", value: 4 },
    { questionId: "LS01", value: 3 }
  ] }), /duplicate answer/i);
  assert.throws(() => scoreAssessment({ questions, answers: [
    { questionId: "V01", value: 3 },
    { questionId: "LS99", value: 3 }
  ] }), /unknown answer/i);
  assert.throws(() => scoreAssessment({ questions, answers: [
    { questionId: "V01", value: 0 },
    { questionId: "LS01", value: 3 }
  ] }), /out.of.range/i);
});
