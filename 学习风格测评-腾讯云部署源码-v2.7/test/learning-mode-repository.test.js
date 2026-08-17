import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { createRepository } from "../src/db/repository.js";

test("repository stores learning level and versioned staged result without breaking report retrieval", () => {
  const database = new Database(":memory:");
  const repository = createRepository(database, {
    allowedAnswers: [{ questionId: "P01", answerType: "choice", optionIds: ["P01-O1|P01-O2"] }]
  });
  const session = repository.createSession({
    grade: "高三",
    specialtyDirection: "美术设计",
    foreignLanguage: "英语",
    targetSubject: "数学",
    learningLevel: "基础巩固",
    assessmentVersion: "learning-mode-v1",
    questionBankVersion: "learning-mode-bank-v1",
    scoringVersion: "learning-mode-score-v1"
  });
  const report = { overview: { targetSubject: "数学" } };
  repository.submitAssessment({
    sessionId: session.id,
    expectedAnswerCount: 1,
    answers: [{
      questionId: "P01",
      answerType: "choice",
      sectionCode: "primary",
      optionId: "P01-O1|P01-O2"
    }],
    durationSeconds: 300,
    resultType: "primary_supporting",
    primaryPreference: "V",
    secondaryPreference: "K",
    preferenceScores: { V: 20, A: 10, R: 8, K: 10 },
    assessmentPayload: { primaryResult: { primary: "V", supporting: "K" } },
    report
  });

  const row = database.prepare(`
    SELECT learning_level, question_bank_version, scoring_version, assessment_payload_json
    FROM assessment_sessions WHERE id = ?
  `).get(session.id);
  assert.equal(row.learning_level, "基础巩固");
  assert.equal(row.question_bank_version, "learning-mode-bank-v1");
  assert.equal(row.scoring_version, "learning-mode-score-v1");
  assert.deepEqual(JSON.parse(row.assessment_payload_json), { primaryResult: { primary: "V", supporting: "K" } });
  assert.deepEqual(repository.getReport(session.id), report);
  database.close();
});

test("repository stores a multiselect set in one row and restores selected option ids for export", () => {
  const database = new Database(":memory:");
  const repository = createRepository(database, {
    allowedAnswers: [{ questionId: "Q01", answerType: "choice", optionIds: ["Q01-A", "Q01-B", "SKIP"] }]
  });
  const session = repository.createSession({
    targetSubject: "数学",
    assessmentVersion: "scenario-learning-mode-v2"
  });
  repository.submitAssessment({
    sessionId: session.id,
    expectedAnswerCount: 1,
    answers: [{
      questionId: "Q01",
      answerType: "choice",
      sectionCode: "scenario",
      optionIds: ["Q01-A", "Q01-B"],
      optionId: "Q01-A",
      preferenceCode: "V,A",
      subdimensionCode: "structure_mapping,interactive_clarification"
    }],
    report: { formatVersion: "scenario-report-v3" }
  });

  const stored = database.prepare("SELECT option_id, preference_code, subdimension_code FROM assessment_answers").get();
  assert.deepEqual(stored, {
    option_id: '["Q01-A","Q01-B"]',
    preference_code: "V,A",
    subdimension_code: "structure_mapping,interactive_clarification"
  });
  assert.deepEqual(repository.listExportRows()[0].selectedOptionIds, ["Q01-A", "Q01-B"]);
  database.close();
});

test("repository exports legacy scalar choices and rejects invalid multiselect sets", () => {
  const database = new Database(":memory:");
  const repository = createRepository(database, {
    allowedAnswers: [{ questionId: "Q01", answerType: "choice", optionIds: ["Q01-A", "Q01-B", "SKIP"] }]
  });
  const createInput = { targetSubject: "数学", assessmentVersion: "scenario-learning-mode-v2" };
  const legacy = repository.createSession(createInput);
  repository.submitAssessment({
    sessionId: legacy.id,
    expectedAnswerCount: 1,
    answers: [{ questionId: "Q01", answerType: "choice", sectionCode: "scenario", optionId: "Q01-A" }],
    report: { formatVersion: "legacy" }
  });
  assert.deepEqual(repository.listExportRows()[0].selectedOptionIds, ["Q01-A"]);

  for (const optionIds of [[], ["Q01-A", "Q01-A"], ["Q01-Z"]]) {
    const session = repository.createSession(createInput);
    assert.throws(() => repository.submitAssessment({
      sessionId: session.id,
      expectedAnswerCount: 1,
      answers: [{ questionId: "Q01", answerType: "choice", sectionCode: "scenario", optionIds, optionId: optionIds[0] }],
      report: { formatVersion: "scenario-report-v3" }
    }));
  }
  database.close();
});

test("repository can create a session in the existing v2.7 database schema", () => {
  const database = new Database(":memory:");
  database.exec(`
    CREATE TABLE assessment_sessions (
      id TEXT PRIMARY KEY,
      anonymous_code TEXT NOT NULL UNIQUE,
      report_access_token TEXT NOT NULL,
      student_name TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      privacy_consented_at TEXT NOT NULL,
      grade TEXT,
      score_band TEXT,
      specialty_direction TEXT,
      foreign_language TEXT,
      exam_subjects_json TEXT,
      target_subject TEXT NOT NULL,
      learning_focus TEXT NOT NULL,
      learning_task TEXT NOT NULL,
      assessment_version TEXT NOT NULL,
      started_at TEXT NOT NULL,
      submitted_at TEXT,
      retry_timestamps_json TEXT NOT NULL DEFAULT '[]',
      duration_seconds INTEGER,
      dynamic_pair TEXT,
      dynamic_result TEXT,
      result_type TEXT,
      primary_preference TEXT,
      secondary_preference TEXT,
      preference_scores_json TEXT,
      science_scores_json TEXT,
      report_json TEXT
    );
  `);
  const repository = createRepository(database, {
    allowedAnswers: [{ questionId: "P01", answerType: "choice", optionIds: ["V>K"] }]
  });
  const session = repository.createSession({
    studentName: "王小明",
    contact: "wx-001",
    grade: "高三",
    specialtyDirection: "美术设计",
    foreignLanguage: null,
    targetSubject: "语文",
    learningLevel: "稳定提升",
    assessmentVersion: "learning-mode-v1",
    questionBankVersion: "learning-mode-bank-v1",
    scoringVersion: "learning-mode-score-v1"
  });
  const row = database.prepare(`
    SELECT student_name, contact, phone_number, report_access_token, privacy_consented_at,
      learning_focus, learning_task, foreign_language
    FROM assessment_sessions WHERE id = ?
  `).get(session.id);
  assert.equal(row.student_name, "王小明");
  assert.equal(row.contact, "wx-001");
  assert.equal(row.phone_number, "wx-001");
  assert.ok(row.report_access_token.length >= 16);
  assert.ok(!Number.isNaN(Date.parse(row.privacy_consented_at)));
  assert.equal(row.learning_focus, "practice");
  assert.equal(row.learning_task, "本周学习任务");
  assert.equal(row.foreign_language, null);
  database.close();
});
