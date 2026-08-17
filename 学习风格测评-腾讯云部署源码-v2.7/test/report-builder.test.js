import test from "node:test";
import assert from "node:assert/strict";
import { buildReport } from "../src/domain/report-builder.js";
import { LEVELS, SUBJECTS } from "../src/domain/learning-task-cards.js";

const specificScores = Object.freeze({
  image_association: 2, structure_mapping: 1, spatial_relationship: 0,
  spoken_explanation: 1, sound_cues: 0, interactive_clarification: 0,
  reading_comprehension: 1, note_organization: 2, written_synthesis: 0,
  hands_on_operation: 1, contextual_immersion: 0, process_rehearsal: 0
});
const specificOpportunities = Object.freeze({
  image_association: 4, structure_mapping: 4, spatial_relationship: 3,
  spoken_explanation: 4, sound_cues: 3, interactive_clarification: 3,
  reading_comprehension: 4, note_organization: 4, written_synthesis: 3,
  hands_on_operation: 4, contextual_immersion: 3, process_rehearsal: 3
});
const specificRates = Object.freeze({
  image_association: 0.5, structure_mapping: 0.25, spatial_relationship: 0,
  spoken_explanation: 0.25, sound_cues: 0, interactive_clarification: 0,
  reading_comprehension: 0.25, note_organization: 0.5, written_synthesis: 0,
  hands_on_operation: 0.25, contextual_immersion: 0, process_rehearsal: 0
});

function input(subject, learningLevel, primary = "V", supporting = "R") {
  return {
    anonymousCode: "LSA-20260815-ABC123", studentName: "王小明", contact: "13800138000", grade: "高三", targetSubject: subject, learningLevel,
    modeResult: {
      answeredCount: 20,
      scores: { V: 7, A: 3, R: 6, K: 4 },
      rates: { V: 0.35, A: 0.15, R: 0.3, K: 0.2 },
      specificScores,
      specificOpportunities,
      specificRates,
      ranked: [{ mode: primary, score: 7, rate: 0.35 }, { mode: supporting, score: 6, rate: 0.3 }, { mode: "K", score: 4, rate: 0.2 }, { mode: "A", score: 3, rate: 0.15 }],
      classification: { kind: "primary_supporting", primary, supporting, candidates: [primary, supporting] }
    }
  };
}

test("all ten subjects and three learning levels produce one concrete task card", () => {
  for (const subject of SUBJECTS) {
    for (const learningLevel of LEVELS) {
      const report = buildReport(input(subject, learningLevel));
      assert.equal(report.overview.targetSubject, subject);
      assert.equal(report.overview.learningLevel, learningLevel);
      assert.ok(report.taskCard.materials.length >= 5);
      assert.ok(report.taskCard.firstStep.length >= 8);
      assert.ok(report.taskCard.completionCheck.length >= 8);
      assert.equal(report.modeCards.length, 4);
      assert.doesNotMatch(JSON.stringify(report), /7天|使用倾向|学习风格|试测版本/);
    }
  }
});

test("different learning levels change the chosen subject task without changing report structure", () => {
  const foundation = buildReport(input("英语", "基础巩固"));
  const sprint = buildReport(input("英语", "冲刺提高"));
  assert.notEqual(foundation.taskCard.materials, sprint.taskCard.materials);
  assert.notEqual(foundation.taskCard.minutes, sprint.taskCard.minutes);
  assert.deepEqual(Object.keys(foundation).sort(), Object.keys(sprint).sort());
});
