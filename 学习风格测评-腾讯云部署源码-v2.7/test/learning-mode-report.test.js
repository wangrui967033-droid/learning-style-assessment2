import test from "node:test";
import assert from "node:assert/strict";
import { buildReport, REPORT_FORMAT_VERSION } from "../src/domain/report-builder.js";
import { buildTaskCard } from "../src/domain/learning-task-cards.js";
import * as reportPage from "../public/assets/report.js";

const specificScores = Object.freeze({
  image_association: 4, structure_mapping: 1, spatial_relationship: 2,
  spoken_explanation: 2, sound_cues: 1, interactive_clarification: 0,
  reading_comprehension: 1, note_organization: 2, written_synthesis: 0,
  hands_on_operation: 1, contextual_immersion: 0, process_rehearsal: 1
});

const specificOpportunities = Object.freeze({
  image_association: 6, structure_mapping: 2, spatial_relationship: 5,
  spoken_explanation: 4, sound_cues: 4, interactive_clarification: 3,
  reading_comprehension: 4, note_organization: 5, written_synthesis: 3,
  hands_on_operation: 4, contextual_immersion: 3, process_rehearsal: 5
});

const specificRates = Object.freeze({
  image_association: 4 / 6, structure_mapping: 1 / 2, spatial_relationship: 2 / 5,
  spoken_explanation: 2 / 4, sound_cues: 1 / 4, interactive_clarification: 0,
  reading_comprehension: 1 / 4, note_organization: 2 / 5, written_synthesis: 0,
  hands_on_operation: 1 / 4, contextual_immersion: 0, process_rehearsal: 1 / 5
});

function reportInput(modeResult) {
  return { anonymousCode: "LSA-20260815-ABC123", studentName: "王小明", contact: "13800138000", grade: "高三", targetSubject: "英语", learningLevel: "基础巩固", modeResult };
}

function modeResult({
  answeredCount = 10,
  scores = { V: 8, A: 5, R: 4, K: 3 },
  rates = { V: 0.8, A: 0.5, R: 0.4, K: 0.3 },
  classification = { kind: "clear", primary: "V", supporting: null, candidates: ["V"] },
  specificScores: scoreOverrides = specificScores,
  specificOpportunities: opportunityOverrides = specificOpportunities,
  specificRates: rateOverrides = specificRates
} = {}) {
  return {
    answeredCount,
    scores,
    rates,
    specificScores: scoreOverrides,
    specificOpportunities: opportunityOverrides,
    specificRates: rateOverrides,
    ranked: Object.entries(scores).map(([mode, score]) => ({ mode, score, rate: rates[mode] })),
    classification,
    totalSelectedOptions: Object.values(scores).reduce((sum, count) => sum + count, 0),
    averageSelectionsPerAnsweredQuestion: answeredCount ? Object.values(scores).reduce((sum, count) => sum + count, 0) / answeredCount : 0,
    skipRate: answeredCount ? 0.5 : 1
  };
}

function zeroAnswerResult() {
  const zeroSpecific = Object.fromEntries(Object.keys(specificScores).map((id) => [id, 0]));
  return modeResult({
    answeredCount: 0,
    scores: { V: 0, A: 0, R: 0, K: 0 },
    rates: { V: 0, A: 0, R: 0, K: 0 },
    classification: { kind: "parallel", primary: null, supporting: null, candidates: ["V", "A", "R", "K"] },
    specificScores: zeroSpecific,
    specificOpportunities: zeroSpecific,
    specificRates: zeroSpecific
  });
}

function visibleStrings(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(visibleStrings);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).filter(([key]) => !["code", "id", "scores"].includes(key)).flatMap(([, nested]) => visibleStrings(nested));
}

test("v3 report stays complete for clear, primary-supporting, parallel, and zero-answer results", () => {
  const cases = [
    modeResult(),
    modeResult({ scores: { V: 8, A: 4, R: 7, K: 3 }, rates: { V: 0.8, A: 0.4, R: 0.7, K: 0.3 }, classification: { kind: "primary_supporting", primary: "V", supporting: "R", candidates: ["V", "R"] } }),
    modeResult({ scores: { V: 7, A: 7, R: 6, K: 3 }, rates: { V: 0.7, A: 0.7, R: 0.6, K: 0.3 }, classification: { kind: "parallel", primary: null, supporting: null, candidates: ["V", "A", "R"] } }),
    zeroAnswerResult()
  ];

  for (const result of cases) {
    const report = buildReport(reportInput(result));
    assert.equal(report.formatVersion, "scenario-report-v3");
    assert.equal(report.conclusion.counts.length, 4);
    assert.equal(report.modeCards.length, 4);
    assert.equal(report.modeCards.flatMap(({ mechanisms }) => mechanisms).length, 12);
    assert.equal(report.taskCard.subject, "英语");
    assert.equal(report.taskCard.learningLevel, "基础巩固");
    assert.equal(report.taskCard.minutes, 20);
    assert.equal(report.taskCard.quantity, "8个单词、4个短例句");
    assert.equal(report.taskCard.materials, "本周课本里的8个单词和4个短例句");
    assert.ok(report.taskCard.firstStep.length >= 8);
    assert.ok(report.taskCard.secondStep.length >= 12);
    assert.equal(report.taskCard.completionCheck, "遮住单词后能独立写出6个及以上，并圈出还不稳的词。");
  }
  assert.equal(REPORT_FORMAT_VERSION, "scenario-report-v3");
});

test("conclusion keeps normalized counts for charts but speaks to the student without score narration", () => {
  const report = buildReport(reportInput(modeResult({
    answeredCount: 20,
    scores: { V: 16, A: 8, R: 14, K: 6 },
    rates: { V: 0.8, A: 0.4, R: 0.7, K: 0.3 },
    classification: { kind: "primary_supporting", primary: "V", supporting: "R", candidates: ["V", "R"] }
  })));

  assert.deepEqual(report.conclusion.counts[0], { code: "V", label: "视觉模式", count: 16, answeredCount: 20, rate: 0.8 });
  assert.match(report.conclusion.summary, /先把内容看清/);
  assert.match(report.conclusion.summary, /记在纸上/);
  assert.doesNotMatch(report.conclusion.summary, /16\/20|80%|14\/20|70%|多1次/);
});

test("twenty V-only answers label every unselected primary-mode card truthfully", () => {
  const vOnlySpecificScores = {
    image_association: 7, structure_mapping: 7, spatial_relationship: 6,
    spoken_explanation: 0, sound_cues: 0, interactive_clarification: 0,
    reading_comprehension: 0, note_organization: 0, written_synthesis: 0,
    hands_on_operation: 0, contextual_immersion: 0, process_rehearsal: 0
  };
  const vOnlySpecificOpportunities = {
    image_association: 7, structure_mapping: 7, spatial_relationship: 6,
    spoken_explanation: 5, sound_cues: 5, interactive_clarification: 5,
    reading_comprehension: 5, note_organization: 5, written_synthesis: 5,
    hands_on_operation: 5, contextual_immersion: 5, process_rehearsal: 5
  };
  const vOnlySpecificRates = Object.fromEntries(Object.keys(vOnlySpecificScores).map((id) => [id, vOnlySpecificScores[id] / vOnlySpecificOpportunities[id]]));
  const report = buildReport(reportInput(modeResult({
    answeredCount: 20,
    scores: { V: 20, A: 0, R: 0, K: 0 },
    rates: { V: 1, A: 0, R: 0, K: 0 },
    classification: { kind: "clear", primary: "V", supporting: null, candidates: ["V"] },
    specificScores: vOnlySpecificScores,
    specificOpportunities: vOnlySpecificOpportunities,
    specificRates: vOnlySpecificRates
  })));

  assert.equal(report.modeCards.find(({ code }) => code === "V").role, "本次主要入口");
  for (const code of ["A", "R", "K"]) assert.equal(report.modeCards.find((card) => card.code === code).role, "本次未选到");
});

test("low-answer parallel result explains the limited evidence without inventing a new result kind", () => {
  const report = buildReport(reportInput(zeroAnswerResult()));
  assert.equal(report.conclusion.kind, "parallel");
  assert.equal(report.conclusion.title, "多通道学习入口");
  assert.match(report.conclusion.summary, /线索还不够/);
  assert.match(report.conclusion.summary, /不急着替你定一种模式/);
  assert.equal(report.taskCard.primarySpecific, null);
  assert.doesNotMatch(report.taskCard.firstStep, /先用“/);
});

test("specific mechanism status uses selected opportunities and only reliable same-mode rates can be more common", () => {
  const report = buildReport(reportInput(modeResult()));
  const visual = report.modeCards.find(({ code }) => code === "V");
  const byId = Object.fromEntries(visual.mechanisms.map((mechanism) => [mechanism.id, mechanism]));

  assert.equal(byId.image_association.status, "这次选得更多");
  assert.equal(byId.structure_mapping.status, "这次也选到过");
  assert.equal(byId.spatial_relationship.status, "这次也选到过");
  assert.deepEqual(
    { selected: byId.image_association.selected, opportunities: byId.image_association.opportunities, rate: byId.image_association.rate },
    { selected: 4, opportunities: 6, rate: 4 / 6 }
  );
});

test("report orders learning modes and their ways by this student's use rate", () => {
  const report = buildReport(reportInput(modeResult({
    scores: { V: 2, A: 8, R: 5, K: 6 },
    rates: { V: 0.2, A: 0.8, R: 0.5, K: 0.6 },
    classification: { kind: "clear", primary: "A", supporting: null, candidates: ["A"] },
    specificScores: { ...specificScores, spoken_explanation: 3, sound_cues: 4, interactive_clarification: 1 },
    specificRates: { ...specificRates, spoken_explanation: 0.75, sound_cues: 1, interactive_clarification: 1 / 3 }
  })));
  assert.deepEqual(report.modeCards.map(({ code }) => code), ["A", "K", "R", "V"]);
  assert.deepEqual(report.modeCards[0].mechanisms.map(({ id }) => id), ["sound_cues", "spoken_explanation", "interactive_clarification"]);
});

test("02 gives every specific way a subject scene and 03 explains how the selected ways work together", () => {
  const report = buildReport(reportInput(modeResult({
    scores: { V: 8, A: 7, R: 3, K: 2 },
    rates: { V: 0.8, A: 0.7, R: 0.3, K: 0.2 },
    classification: { kind: "primary_supporting", primary: "V", supporting: "A", candidates: ["V", "A"] },
    specificScores: { ...specificScores, structure_mapping: 4, spoken_explanation: 3 },
    specificRates: { ...specificRates, structure_mapping: 0.8, spoken_explanation: 0.75 }
  })));

  const mechanisms = report.modeCards.flatMap(({ mechanisms: items }) => items);
  assert.equal(mechanisms.length, 12);
  assert.ok(mechanisms.every(({ subjectExample }) => /^例如/.test(subjectExample)));
  assert.match(mechanisms.find(({ id }) => id === "spoken_explanation").subjectExample, /短语|句子/);
  assert.match(report.learningPath.title, /英语/);
  assert.match(report.learningPath.title, /视觉模式/);
  assert.match(report.learningPath.copy, /画清、排清/);
  assert.match(report.learningPath.copy, /听一小段/);
  assert.doesNotMatch(report.learningPath.copy, /理关系|听讲解/);
  assert.doesNotMatch(report.learningPath.copy, new RegExp(report.taskCard.firstStep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("03 uses the same reliable specific way as the practical task card", () => {
  const report = buildReport(reportInput(modeResult({
    specificScores: { ...specificScores, image_association: 3, structure_mapping: 6, spatial_relationship: 2 },
    specificOpportunities: { ...specificOpportunities, image_association: 6, structure_mapping: 8, spatial_relationship: 6 },
    specificRates: { ...specificRates, image_association: 0.5, structure_mapping: 0.75, spatial_relationship: 1 / 3 }
  })));
  assert.equal(report.taskCard.primarySpecific, "structure_mapping");
  assert.match(report.learningPath.title, /视觉模式/);
  assert.match(report.learningPath.copy, /画清、排清/);
  assert.doesNotMatch(report.learningPath.copy, /理关系/);
});

test("task card chooses the highest reliable normalized specific rate and falls back when none is reliable", () => {
  const normalizedCard = buildTaskCard({
    subject: "数学",
    learningLevel: "稳定提升",
    classification: { kind: "clear", primary: "V", supporting: null, candidates: ["V"] },
    specificRates: { image_association: 0.75, structure_mapping: 0.8, spatial_relationship: 1 },
    specificOpportunities: { image_association: 4, structure_mapping: 10, spatial_relationship: 2 }
  });
  assert.equal(normalizedCard.primarySpecific, "structure_mapping");
  assert.match(normalizedCard.firstStep, /先用“理关系”开始/);
  assert.match(normalizedCard.heading, /数学.*稳定提升/);
  assert.match(normalizedCard.materials, /变式题/);

  const genericCard = buildTaskCard({
    subject: "数学",
    learningLevel: "稳定提升",
    classification: { kind: "clear", primary: "V", supporting: null, candidates: ["V"] },
    specificRates: { image_association: 1, structure_mapping: 1, spatial_relationship: 1 },
    specificOpportunities: { image_association: 2, structure_mapping: 1, spatial_relationship: 0 }
  });
  assert.equal(genericCard.primarySpecific, null);
  assert.match(genericCard.firstStep, /关键关系.*分别列出/);
});

test("parallel task card starts from the same reliable entry used in 03 and keeps one concrete subject task", () => {
  const report = buildReport(reportInput(modeResult({
    classification: { kind: "parallel", primary: null, supporting: null, candidates: ["V", "A", "R"] },
    specificScores: { image_association: 1, structure_mapping: 4, spatial_relationship: 0, interactive_clarification: 0, spoken_explanation: 0, sound_cues: 0, reading_comprehension: 0, note_organization: 0, written_synthesis: 0, contextual_immersion: 0, process_rehearsal: 0, hands_on_operation: 0 },
    specificOpportunities: { image_association: 4, structure_mapping: 4, spatial_relationship: 4, interactive_clarification: 4, spoken_explanation: 4, sound_cues: 4, reading_comprehension: 4, note_organization: 4, written_synthesis: 4, contextual_immersion: 4, process_rehearsal: 4, hands_on_operation: 4 },
    specificRates: { image_association: 0.25, structure_mapping: 1, spatial_relationship: 0, interactive_clarification: 0, spoken_explanation: 0, sound_cues: 0, reading_comprehension: 0, note_organization: 0, written_synthesis: 0, contextual_immersion: 0, process_rehearsal: 0, hands_on_operation: 0 }
  })));
  assert.equal(report.taskCard.startChoices.length, 0);
  assert.equal(report.taskCard.primarySpecific, "structure_mapping");
  assert.match(report.taskCard.firstStep, /先用“理关系”开始/);
  assert.match(report.learningPath.copy, /画清、排清/);
  assert.match(report.taskCard.firstStep, /记住词义和短语/);
  assert.match(report.taskCard.secondStep, /遮住释义/);
});

test("student report omits response-density statistics", () => {
  const serialized = JSON.stringify(buildReport(reportInput(modeResult())));
  assert.doesNotMatch(serialized, /totalSelectedOptions|averageSelectionsPerAnsweredQuestion|skipRate|density/i);
});

test("report page maps v3 rates to percentages while preserving the v2 count fallback", () => {
  assert.equal(typeof reportPage.chartRowsForReport, "function");
  assert.equal(typeof reportPage.reportRenderKind, "function");
  const counts = [
    { code: "V", label: "视觉模式", count: 16, answeredCount: 20, rate: 0.8 },
    { code: "A", label: "听觉模式", count: 8, answeredCount: 20, rate: 0.4 }
  ];

  assert.deepEqual(reportPage.chartRowsForReport({ formatVersion: "scenario-report-v3", conclusion: { counts } }), [
    { code: "V", label: "视觉模式", value: 80, detail: "80%" },
    { code: "A", label: "听觉模式", value: 40, detail: "40%" }
  ]);
  assert.equal(reportPage.reportRenderKind({ formatVersion: "scenario-report-v3" }), "normalized");
  assert.equal(reportPage.reportRenderKind({ formatVersion: "scenario-report-v2" }), "count");
  assert.deepEqual(reportPage.chartRowsForReport({ formatVersion: "scenario-report-v2", conclusion: { counts: [{ code: "V", label: "视觉模式", count: 8 }] } }), [
    { code: "V", label: "视觉模式", value: 8, detail: "8次" }
  ]);
});

test("report page uses percentage measurements for v3 radar and progress rendering", () => {
  assert.equal(typeof reportPage.chartMeasurementsForReport, "function");
  const presentation = reportPage.chartMeasurementsForReport({
    formatVersion: "scenario-report-v3",
    conclusion: { counts: [{ code: "V", label: "视觉模式", count: 16, answeredCount: 20, rate: 0.8 }] }
  });

  assert.deepEqual(presentation, {
    normalized: true,
    maximum: 100,
    measurements: [{
      code: "V",
      label: "视觉模式",
      value: 80,
      detail: "80%",
      progress: { width: "80%", ariaValueMin: 0, ariaValueMax: 100, ariaValueNow: 80 },
      radar: { value: 80, maximum: 100, fraction: 0.8 }
    }]
  });
});

test("report page keeps v2 radar and progress rendering on the count scale", () => {
  const presentation = reportPage.chartMeasurementsForReport({
    formatVersion: "scenario-report-v2",
    conclusion: { counts: [{ code: "V", label: "视觉模式", count: 8 }] }
  });

  assert.deepEqual(presentation, {
    normalized: false,
    maximum: 20,
    measurements: [{
      code: "V",
      label: "视觉模式",
      value: 8,
      detail: "8次",
      progress: { width: "40%", ariaValueMin: 0, ariaValueMax: 20, ariaValueNow: 8 },
      radar: { value: 8, maximum: 20, fraction: 0.4 }
    }]
  });
});

test("new report copy stays warm direct and free of removed sections", () => {
  const copy = visibleStrings(buildReport(reportInput(modeResult()))).join("\n");
  assert.match(copy, /你/);
  assert.doesNotMatch(copy, /学习风格|内测|NLP|风险|短板|7天|使用倾向|你是.{0,6}型|我们|我看见|不是多加一套方法|不需要多做一套|更重要|不只靠/);
  assert.match(copy, /8个单词|4个短例句/);
});

test("report validates normalized result fields and classifications", () => {
  assert.throws(() => buildReport(reportInput({})), /分数|结果|作答/);
  assert.throws(() => buildReport({ ...reportInput(modeResult()), targetSubject: "技术" }), /学科/);
  assert.throws(() => buildReport(reportInput({ ...modeResult(), rates: undefined })), /比例/);
  assert.throws(() => buildReport(reportInput({ ...modeResult(), classification: { kind: "parallel", primary: "V", supporting: null, candidates: ["V", "A"] } })), /并列/);
});

test("v3 report builder rejects raw v2 scores instead of fabricating normalized evidence", () => {
  assert.throws(() => buildReport(reportInput({
    scores: { V: 8, A: 5, R: 4, K: 3 },
    specificScores,
    classification: { kind: "clear", primary: "V", supporting: null, candidates: ["V"] }
  })), /有效作答/);
});
