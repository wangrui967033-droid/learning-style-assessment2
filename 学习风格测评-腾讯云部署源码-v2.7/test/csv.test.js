import test from "node:test";
import assert from "node:assert/strict";
import { buildCsv } from "../src/lib/csv.js";

function row(overrides = {}) {
  return {
    anonymousCode: "LSA-20260719-ABC123",
    studentName: "王小明",
    contact: "13800138000",
    sessionId: "session-1",
    questionId: "Q1",
    answerType: "scale",
    responseValue: 4,
    scoredValue: 4,
    isReverse: false,
    preferenceScoresJson: JSON.stringify({
      V: { index: 75, academic: { index: 75 }, life: { index: 75 } },
      A: { index: 50, academic: { index: 50 }, life: { index: 50 } },
      R: { index: 60, academic: { index: 60 }, life: { index: 60 } },
      K: { index: 25, academic: { index: 25 }, life: { index: 25 } }
    }),
    scienceScoresJson: JSON.stringify({
      active_recall: 4,
      spaced_repetition: 6,
      deliberate_practice: 7,
      timely_feedback: 8,
      metacognition: 5
    }),
    ...overrides
  };
}

test("CSV neutralizes formula-leading and whitespace-leading formula text before escaping", () => {
  const csv = buildCsv([
    row({ comment: "=2+2" }),
    row({ comment: "+SUM(1,2)" }),
    row({ comment: "-10+20" }),
    row({ comment: "@IMPORTXML(A1)" }),
    row({ comment: "  =HYPERLINK(A1)" }),
    row({ comment: "\t+cmd" }),
    row({ comment: "普通反馈" })
  ]);

  assert.match(csv, /,'=2\+2\r\n/);
  assert.match(csv, /,"'\+SUM\(1,2\)"\r\n/);
  assert.match(csv, /,'-10\+20\r\n/);
  assert.match(csv, /,'@IMPORTXML\(A1\)\r\n/);
  assert.match(csv, /,'  =HYPERLINK\(A1\)\r\n/);
  assert.match(csv, /,'\t\+cmd\r\n/);
  assert.match(csv, /,普通反馈\r\n/);
  assert.doesNotMatch(csv, /(?:^|,)=(?:2\+2)|(?:^|,)\+SUM|(?:^|,)-10|(?:^|,)@IMPORTXML/m);
});

test("CSV marks calibration choices explicitly instead of calling them positive", () => {
  const csv = buildCsv([row({
    questionId: "CAL01",
    answerType: "choice",
    optionId: "CAL01-O2",
    responseValue: null,
    scoredValue: null,
    isReverse: false
  })]);
  const [header, values] = csv.slice(1).trim().split("\r\n").map((line) => line.split(","));
  const record = Object.fromEntries(header.map((column, index) => [column, values[index]]));

  assert.equal(record.rawResponse, "CAL01-O2");
  assert.equal(record.direction, "choice");
});

test("CSV uses the anonymous code and never exports the report access id", () => {
  const csv = buildCsv([row({
    learningLevel: "稳定提升",
    questionBankVersion: "learning-mode-bank-v1",
    scoringVersion: "learning-mode-score-v1"
  })]);
  const header = csv.slice(1).split("\r\n", 1)[0].split(",");

  assert.ok(header.includes("anonymousCode"));
  assert.ok(header.includes("studentName"));
  assert.ok(header.includes("contact"));
  assert.ok(header.includes("learningLevel"));
  assert.ok(header.includes("questionBankVersion"));
  assert.ok(header.includes("scoringVersion"));
  assert.equal(header.includes("sessionId"), false);
  assert.doesNotMatch(csv, /session-1/);
  assert.match(csv, /稳定提升/);
  assert.match(csv, /learning-mode-bank-v1/);
  assert.match(csv, /learning-mode-score-v1/);
});
