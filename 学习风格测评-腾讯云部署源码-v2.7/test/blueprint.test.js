import test from "node:test";
import assert from "node:assert/strict";
import bank from "../src/domain/question-bank.json" with { type: "json" };
import {
  getCalibrationQuestions,
  getCoreQuestions,
  getScienceQuestions
} from "../src/domain/question-bank.js";
import { validateBlueprint } from "../src/domain/blueprint.js";
import { PREFERENCE_MODULES } from "../src/domain/preference-modules.js";

const EXPECTED_PREFERENCE_MODULES = [
  ["information_location", "V", "找到重点"],
  ["graphic_construction", "V", "图形理解"],
  ["relationship_organization", "V", "理清关系"],
  ["difference_identification", "V", "比较差异"],
  ["explanation_comprehension", "A", "听讲解"],
  ["sound_cues", "A", "声音线索"],
  ["language_expression", "A", "说出思路"],
  ["interactive_clarification", "A", "一问一答"],
  ["text_comprehension", "R", "读懂文字"],
  ["structure_organization", "R", "结构整理"],
  ["written_expression", "R", "写出思路"],
  ["rule_extraction", "R", "提取规则"],
  ["case_entry", "K", "例子开始"],
  ["hands_on_trial", "K", "动手试试"],
  ["process_rehearsal", "K", "过程演练"],
  ["situational_transfer", "K", "情境应用"]
];

test("fixed bank matches V2.6 blueprint", () => {
  const result = validateBlueprint(bank);
  assert.deepEqual(result.counts, {
    core: 32,
    coreAcademic: 24,
    coreLife: 8,
    science: 10,
    reserve: 32,
    calibration: 24
  });
  assert.deepEqual(result.preferenceCounts, { V: 8, A: 8, R: 8, K: 8 });
  assert.deepEqual(result.processCounts, { learning: 8, memory: 8, practice: 8, improve: 8 });
  assert.equal(result.reverseCore, 8);
  assert.equal(result.errors.length, 0);
});

test("V2.6 uses the exact 16 learning-entry mechanisms with two core and two reserve items each", () => {
  const expected = EXPECTED_PREFERENCE_MODULES.map(([id, preference, label]) => ({ id, preference, label }));
  assert.deepEqual(
    PREFERENCE_MODULES.map(({ id, preference, label }) => ({ id, preference, label })),
    expected
  );

  for (const { id } of expected) {
    assert.equal(bank.core.filter((item) => item.subdimension === id).length, 2, `${id} core count`);
    assert.equal(bank.reserve.filter((item) => item.subdimension === id).length, 2, `${id} reserve count`);
  }
});

test("blueprint validator rejects a 3/1 core mechanism split that preserves aggregate counts", () => {
  const invalid = structuredClone(bank);
  invalid.core.find((item) => item.id === "V03").subdimension = "information_location";

  const result = validateBlueprint(invalid);

  assert.ok(result.errors.includes("core mechanism information_location has 3 items, expected 2"));
  assert.ok(result.errors.includes("core mechanism graphic_construction has 1 items, expected 2"));
});

test("each V2.6 preference module has the four non-empty product interpretation fields", () => {
  for (const module of PREFERENCE_MODULES) {
    assert.ok(module.definition?.trim(), `${module.id} definition`);
    assert.ok(module.typicalBehaviors?.length, `${module.id} typicalBehaviors`);
    assert.ok(module.subjectApplications?.length, `${module.id} subjectApplications`);
    assert.ok(module.coachActions?.length, `${module.id} coachActions`);
  }
});

test("each calibration pair has one learning, memory, practice and improve item", () => {
  const result = validateBlueprint(bank);
  for (const processes of Object.values(result.calibrationProcesses)) {
    assert.deepEqual(processes.sort(), ["improve", "learning", "memory", "practice"]);
  }
});

test("question-bank API exposes fixed and pair-specific questions", () => {
  assert.equal(getCoreQuestions().length, 32);
  assert.equal(getScienceQuestions().length, 10);
  assert.equal(getCalibrationQuestions("V-A").length, 4);
});

test("blueprint validator reports malformed and unbalanced questions", () => {
  const invalid = structuredClone(bank);
  invalid.core[0].id = invalid.core[1].id;
  invalid.core[0].prompt = "";
  invalid.core[0].subdimension = "unknown";
  invalid.core[0].direction = "reverse";
  invalid.core[1].process = "learning";
  invalid.calibration[1].process = "learning";

  const result = validateBlueprint(invalid);

  assert.ok(result.errors.some((error) => error.includes("duplicate id")));
  assert.ok(result.errors.some((error) => error.includes("missing prompt")));
  assert.ok(result.errors.some((error) => error.includes("unknown subdimension")));
  assert.ok(result.errors.some((error) => error.includes("process")));
  assert.ok(result.errors.some((error) => error.includes("reverse core")));
  assert.ok(result.errors.some((error) => error.includes("repeats learning")));
});
