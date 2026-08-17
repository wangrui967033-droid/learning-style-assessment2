import test from "node:test";
import assert from "node:assert/strict";
import { buildTaskCard, LEVELS, SUBJECTS, subjectMechanismExample } from "../src/domain/learning-task-cards.js";
import { SPECIFIC_MODES } from "../src/domain/learning-modes.js";

const visual = Object.freeze({ kind: "clear", primary: "V", supporting: null, candidates: ["V"] });
const scores = Object.freeze({ image_association: 2, structure_mapping: 1, spatial_relationship: 0 });

test("every report subject and level has an executable task card", () => {
  for (const subject of SUBJECTS) {
    for (const learningLevel of LEVELS) {
      const task = buildTaskCard({ subject, learningLevel, classification: visual, specificScores: scores });
      assert.ok(task.materials.length >= 5, `${subject}/${learningLevel}/materials`);
      for (const field of ["task", "completionCheck", "firstStep", "secondStep"]) assert.ok(task[field].length >= 8, `${subject}/${learningLevel}/${field}`);
      assert.ok(task.quantity.length >= 3, `${subject}/${learningLevel}/quantity`);
      assert.ok([20, 25, 30].includes(task.minutes));
      assert.deepEqual(task.startChoices, []);
    }
  }
  assert.throws(() => buildTaskCard({ subject: "技术", learningLevel: "基础巩固", classification: visual }), /报告学科/);
  assert.throws(() => buildTaskCard({ subject: "英语", learningLevel: "随便看看", classification: visual }), /学习阶段/);
});

test("the same English card changes its entry, not its workload, by learning mode", () => {
  const cards = ["V", "A", "R", "K"].map((primary) => buildTaskCard({
    subject: "英语", learningLevel: "基础巩固", classification: { kind: "clear", primary, supporting: null, candidates: [primary] }, specificScores: {}
  }));
  assert.equal(new Set(cards.map(({ materials }) => materials)).size, 1);
  assert.equal(new Set(cards.map(({ completionCheck }) => completionCheck)).size, 1);
  assert.equal(new Set(cards.map(({ firstStep }) => firstStep)).size, 4);
  assert.match(cards[0].firstStep, /关键关系/);
  assert.match(cards[1].firstStep, /听|说/);
});

test("a reliable specific way decides how a task card starts", () => {
  const shared = {
    subject: "数学",
    learningLevel: "稳定提升",
    classification: visual,
    specificOpportunities: { image_association: 4, structure_mapping: 4, spatial_relationship: 4 }
  };
  const seePicture = buildTaskCard({ ...shared, specificRates: { image_association: 0.75, structure_mapping: 0.5, spatial_relationship: 0.25 } });
  const seeRelation = buildTaskCard({ ...shared, specificRates: { image_association: 0.5, structure_mapping: 0.75, spatial_relationship: 0.25 } });
  assert.equal(seePicture.primarySpecific, "image_association");
  assert.match(seePicture.firstStep, /先用“看成图”开始/);
  assert.equal(seeRelation.primarySpecific, "structure_mapping");
  assert.match(seeRelation.firstStep, /先用“理关系”开始/);
  assert.notEqual(seePicture.firstStep, seeRelation.firstStep);
});

test("when two ways have the same rate, the task card follows the one selected more often", () => {
  const card = buildTaskCard({
    subject: "物理",
    learningLevel: "稳定提升",
    classification: visual,
    specificRates: { image_association: 1, structure_mapping: 1, spatial_relationship: 0.5 },
    specificOpportunities: { image_association: 6, structure_mapping: 8, spatial_relationship: 6 },
    specificScores: { image_association: 6, structure_mapping: 8, spatial_relationship: 3 }
  });
  assert.equal(card.primarySpecific, "structure_mapping");
  assert.match(card.firstStep, /先用“理关系”开始/);
});

test("a supporting mode adds a light follow-up and parallel results show honest choices", () => {
  const paired = buildTaskCard({ subject: "历史", learningLevel: "稳定提升", classification: { kind: "primary_supporting", primary: "V", supporting: "R", candidates: ["V", "R"] }, specificScores: { structure_mapping: 2 } });
  assert.equal(paired.supportingMode, "R");
  assert.match(paired.secondStep, /关键词|结论/);
  const parallel = buildTaskCard({ subject: "地理", learningLevel: "冲刺提高", classification: { kind: "parallel", primary: null, supporting: null, candidates: ["V", "A", "R"] }, specificScores: {} });
  assert.equal(parallel.startChoices.length, 0);
  assert.equal(parallel.primarySpecific, null);
  assert.doesNotMatch(JSON.stringify(parallel), /主要模式|辅助模式/);
});

test("task cards keep the approved practical details and no seven-day or warning copy", () => {
  const english = buildTaskCard({ subject: "英语", learningLevel: "基础巩固", classification: visual, specificScores: scores });
  assert.match(JSON.stringify(english), /8个单词|4个短例句/);
  assert.match(english.completionCheck, /6个及以上/);
  const history = buildTaskCard({ subject: "历史", learningLevel: "稳定提升", classification: visual, specificScores: scores });
  assert.match(JSON.stringify(history), /2道题/);
  for (const subject of SUBJECTS) for (const specificMode of Object.keys(SPECIFIC_MODES)) {
    assert.ok(subjectMechanismExample(subject, specificMode).length >= 12);
    assert.match(subjectMechanismExample(subject, specificMode), /^例如/);
  }
  assert.match(subjectMechanismExample("历史", "spatial_relationship"), /时间线/);
  assert.match(subjectMechanismExample("英语", "spoken_explanation"), /短语|句子/);
  assert.doesNotMatch(subjectMechanismExample("英语", "contextual_immersion"), /主语/);
  assert.doesNotMatch(subjectMechanismExample("日语", "contextual_immersion"), /人物/);
  assert.doesNotMatch(JSON.stringify(english), /7天|每天|风险|短板|提高效率|多看图|多听讲/);
});
