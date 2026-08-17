import test from "node:test";
import assert from "node:assert/strict";
import { getScenarioQuestions } from "../src/domain/learning-mode-bank.js";
import { scoreScenarioAnswers } from "../src/domain/learning-mode-scoring.js";

const questions = getScenarioQuestions();

function optionIdFor(question, mode) {
  return question.options.find((option) => option.mode === mode).id;
}

function answersForSelections(selections) {
  return questions.map((question, index) => {
    const modes = selections[index];
    if (!modes || modes.length === 0) throw new Error("每题至少需要一种选择");
    return { questionId: question.id, optionIds: modes.map((mode) => optionIdFor(question, mode)) };
  });
}

test("each question accepts multiple choices and counts every selected primary and specific mode", () => {
  const answers = questions.map((question, index) => index === 0
    ? { questionId: question.id, optionIds: [optionIdFor(question, "V"), optionIdFor(question, "A")] }
    : { questionId: question.id, optionIds: [optionIdFor(question, "V")] });

  const result = scoreScenarioAnswers(answers, questions);

  assert.equal(result.answeredCount, 20);
  assert.deepEqual(result.scores, { V: 20, A: 1, R: 0, K: 0 });
  assert.deepEqual(result.rates, { V: 1, A: 0.05, R: 0, K: 0 });
  assert.equal(Object.values(result.specificScores).reduce((sum, score) => sum + score, 0), 21);
  assert.equal(result.specificOpportunities.structure_mapping, 8);
  assert.equal(result.specificRates.structure_mapping, result.specificScores.structure_mapping / 8);
  assert.equal(result.totalSelectedOptions, 21);
  assert.equal(result.averageSelectionsPerAnsweredQuestion, 1.05);
  assert.equal(result.skipRate, 0);
  assert.deepEqual(result.classification, { kind: "clear", primary: "V", supporting: null, candidates: ["V"] });
});

test("skipped answer shapes are rejected", () => {
  assert.throws(() => scoreScenarioAnswers(questions.map(({ id }) => ({ questionId: id, skipped: true })), questions), /不支持跳过题目/);
});

test("specific rates use opportunities in answered questions rather than all bank questions", () => {
  const answers = questions.map((question, index) => index === 1
    ? { questionId: question.id, optionIds: [optionIdFor(question, "V")] }
    : { questionId: question.id, optionIds: [optionIdFor(question, "A")] });

  const result = scoreScenarioAnswers(answers, questions);

  assert.equal(result.specificScores.image_association, 1);
  assert.equal(result.specificOpportunities.image_association, 6);
  assert.equal(result.specificRates.image_association, 1 / 6);
  assert.equal(result.specificRates.image_association, result.specificScores.image_association / result.specificOpportunities.image_association);
});

test("rejects invalid multiselect answer shapes", () => {
  const valid = answersForSelections(questions.map(() => ["V"]));

  assert.throws(() => scoreScenarioAnswers(valid.slice(1), questions), /需要完成20道基础题/);
  assert.throws(() => scoreScenarioAnswers([{ ...valid[0], optionIds: [] }, ...valid.slice(1)], questions), /请至少选择一项/);
  assert.throws(() => scoreScenarioAnswers([{ ...valid[0], optionIds: [valid[0].optionIds[0], valid[0].optionIds[0]] }, ...valid.slice(1)], questions), /同一选项不能重复选择/);
  assert.throws(() => scoreScenarioAnswers([{ ...valid[0], skipped: true }, ...valid.slice(1)], questions), /不支持跳过题目/);
  assert.throws(() => scoreScenarioAnswers([{ ...valid[0], optionIds: ["invalid"] }, ...valid.slice(1)], questions), /选项无效/);
  assert.throws(() => scoreScenarioAnswers([valid[0], valid[0], ...valid.slice(2)], questions), /基础题题目无效或重复/);
});

test("classifies normalized mode rates by answered-count threshold and ten-point band", () => {
  const cases = [
    {
      name: "all twenty V selections are clear",
      selections: questions.map(() => ["V"]),
      expected: { kind: "clear", primary: "V", supporting: null, candidates: ["V"] }
    },
    {
      name: "V at eighty percent and A at seventy-five percent are primary-supporting",
      selections: questions.map((_, index) => {
        if (index < 15) return ["V", "A"];
        if (index === 15) return ["V"];
        return ["R"];
      }),
      expected: { kind: "primary_supporting", primary: "V", supporting: "A", candidates: ["V", "A"] }
    },
    {
      name: "tied V and A rates remain parallel",
      selections: questions.map((_, index) => index < 16 ? ["V", "A"] : ["R"]),
      expected: { kind: "parallel", primary: null, supporting: null, candidates: ["V", "A"] }
    },
    {
      name: "three modes within ten points remain parallel",
      selections: questions.map((_, index) => {
        if (index < 14) return ["V", "A", "R"];
        if (index === 14) return ["V", "A"];
        if (index === 15) return ["V"];
        return ["K"];
      }),
      expected: { kind: "parallel", primary: null, supporting: null, candidates: ["V", "A", "R"] }
    },
  ];

  for (const scenario of cases) {
    const result = scoreScenarioAnswers(answersForSelections(scenario.selections), questions);
    assert.deepEqual(result.classification, scenario.expected, scenario.name);
  }
});
