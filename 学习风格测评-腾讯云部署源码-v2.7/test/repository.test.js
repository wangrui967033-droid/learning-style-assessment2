import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { openDatabase } from "../src/db/database.js";
import { createRepository } from "../src/db/repository.js";

const ALLOWED_ANSWERS = [
  { questionId: "V01", answerType: "scale" },
  { questionId: "C01", answerType: "choice", optionIds: ["V", "R"] }
];

function createMemoryRepository() {
  const database = new Database(":memory:");
  return { database, repository: createRepository(database, { allowedAnswers: ALLOWED_ANSWERS }) };
}

function createSession(repository) {
  return repository.createSession({
    grade: "高二",
    scoreBand: "400 至 450",
    specialtyDirection: "美术设计",
    foreignLanguage: "英语",
    examSubjects: ["语文", "数学", "英语", "物理"],
    targetSubject: "数学",
    assessmentVersion: "v2"
  });
}

function submission(sessionId, overrides = {}) {
  return {
    sessionId,
    expectedAnswerCount: 2,
    durationSeconds: 486,
    dynamicPair: "V-R",
    dynamicResult: { type: "ordered", primary: "V", secondary: "R" },
    resultType: "single_clear",
    primaryPreference: "V",
    secondaryPreference: "R",
    preferenceScores: { V: 75, A: 50, R: 60, K: 25 },
    scienceScores: { active_recall: 4 },
    report: { targetSubject: "数学", summary: "当前学习入口" },
    answers: [
      {
        questionId: "V01",
        answerType: "scale",
        sectionCode: "core",
        preferenceCode: "V",
        subdimensionCode: "information_location",
        processCode: "learning",
        scenarioType: "academic",
        isReverse: false,
        responseValue: 4,
        scoredValue: 4,
        scenarioWeight: 1,
        responseTimeMs: 3200,
        answeredAt: "2026-07-19T08:00:00.000Z"
      },
      {
        questionId: "C01",
        answerType: "choice",
        sectionCode: "calibration",
        optionId: "V",
        preferenceCode: "V",
        responseTimeMs: 1800,
        answeredAt: "2026-07-19T08:00:03.000Z"
      }
    ],
    ...overrides
  };
}

test("creates an anonymous session without identity fields", () => {
  const { database, repository } = createMemoryRepository();

  try {
    const session = createSession(repository);

    assert.match(session.id, /^[0-9a-f-]{36}$/i);
    assert.match(session.anonymousCode, /^LSA-\d{8}-[A-Z0-9]{6}$/);
    assert.equal(session.targetSubject, "数学");
    assert.equal(Object.hasOwn(session, "name"), false);
    assert.equal(Object.hasOwn(session, "phone"), false);
    assert.equal(Object.hasOwn(session, "school"), false);
    assert.equal(Object.hasOwn(session, "ip"), false);
    assert.deepEqual(
      database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({ name }) => name),
      ["assessment_answers", "assessment_feedback", "assessment_sessions"]
    );
  } finally {
    database.close();
  }
});

test("rejects feedback until the assessment has a submitted report", () => {
  const { database, repository } = createMemoryRepository();

  try {
    const session = createSession(repository);
    assert.throws(
      () => repository.saveFeedback(session.id, { fitRating: 4, comment: "尚未完成" }),
      /submitted|report|completed/i
    );
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM assessment_feedback").get().count, 0);
  } finally {
    database.close();
  }
});

test("rolls back every answer and report when a submission cannot be stored", () => {
  const { database, repository } = createMemoryRepository();

  try {
    const session = createSession(repository);
    const invalidAnswers = [
      submission(session.id).answers[0],
      { ...submission(session.id).answers[0], responseValue: 5 }
    ];

    assert.throws(
      () => repository.submitAssessment(submission(session.id, { answers: invalidAnswers })),
      /unique|duplicate/i
    );
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM assessment_answers").get().count, 0);
    assert.equal(database.prepare("SELECT submitted_at AS submittedAt FROM assessment_sessions WHERE id = ?").get(session.id).submittedAt, null);
    assert.equal(repository.getReport(session.id), null);
  } finally {
    database.close();
  }
});

test("preserves the first completed submission and appends ISO retry timestamps", () => {
  const { database, repository } = createMemoryRepository();

  try {
    const session = createSession(repository);
    const firstReport = repository.submitAssessment(submission(session.id));
    const secondReport = repository.submitAssessment(submission(session.id, {
      report: { targetSubject: "英语", summary: "must not replace first" },
      answers: [
        { ...submission(session.id).answers[0], responseValue: 1, scoredValue: 1 },
        { ...submission(session.id).answers[1], optionId: "R", preferenceCode: "R" }
      ]
    }));
    const thirdReport = repository.submitAssessment(submission(session.id, {
      report: { targetSubject: "语文", summary: "must not replace first" }
    }));

    assert.deepEqual(secondReport, firstReport);
    assert.deepEqual(thirdReport, firstReport);
    assert.equal(database.prepare("SELECT response_value AS responseValue FROM assessment_answers WHERE session_id = ? AND question_id = ?").get(session.id, "V01").responseValue, 4);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM assessment_answers WHERE session_id = ?").get(session.id).count, 2);
    const retryTimestamps = JSON.parse(database.prepare("SELECT retry_timestamps_json AS retryTimestampsJson FROM assessment_sessions WHERE id = ?").get(session.id).retryTimestampsJson);
    assert.equal(retryTimestamps.length, 2);
    for (const timestamp of retryTimestamps) {
      assert.equal(new Date(timestamp).toISOString(), timestamp);
    }

    const reloadedRepository = createRepository(database, { allowedAnswers: ALLOWED_ANSWERS });
    assert.equal(reloadedRepository.getReport(session.id).targetSubject, "数学");
    assert.deepEqual(reloadedRepository.saveFeedback(session.id, {
      fitRating: 4,
      selfIdentifiedPreference: "视觉",
      helpfulSection: "目标学科应用",
      confusingText: "无",
      comment: "可以执行"
    }), {
      fitRating: 4,
      selfIdentifiedPreference: "视觉",
      helpfulSection: "目标学科应用",
      confusingText: "无",
      comment: "可以执行"
    });

    const exportRows = reloadedRepository.listExportRows();
    assert.equal(exportRows.length, 2);
    assert.deepEqual(exportRows.map(({ questionId, answerType, responseValue, scoredValue, scenarioWeight, optionId }) => ({
      questionId,
      answerType,
      responseValue,
      scoredValue,
      scenarioWeight,
      optionId
    })), [
      { questionId: "C01", answerType: "choice", responseValue: null, scoredValue: null, scenarioWeight: null, optionId: "V" },
      { questionId: "V01", answerType: "scale", responseValue: 4, scoredValue: 4, scenarioWeight: 1, optionId: null }
    ]);
    assert.equal(exportRows[0].anonymousCode, session.anonymousCode);
    assert.equal(exportRows[0].fitRating, 4);
    assert.equal(Object.hasOwn(exportRows[0], "ip"), false);
  } finally {
    database.close();
  }
});

test("rejects an unknown scale question before any submission write", () => {
  const { database, repository } = createMemoryRepository();

  try {
    const session = createSession(repository);
    const answers = [
      { ...submission(session.id).answers[0], questionId: "NOT-IN-BANK" },
      submission(session.id).answers[1]
    ];

    assert.throws(
      () => repository.submitAssessment(submission(session.id, {
        answers,
        allowedAnswers: [{ questionId: "NOT-IN-BANK", answerType: "scale" }]
      })),
      /unknown question/i
    );
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM assessment_answers").get().count, 0);
    assert.equal(database.prepare("SELECT submitted_at AS submittedAt FROM assessment_sessions WHERE id = ?").get(session.id).submittedAt, null);
  } finally {
    database.close();
  }
});

test("rejects a choice option outside the configured question definition", () => {
  const { database, repository } = createMemoryRepository();

  try {
    const session = createSession(repository);
    const answers = [
      submission(session.id).answers[0],
      { ...submission(session.id).answers[1], optionId: "K" }
    ];

    assert.throws(
      () => repository.submitAssessment(submission(session.id, { answers })),
      /invalid option/i
    );
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM assessment_answers").get().count, 0);
    assert.equal(repository.getReport(session.id), null);
  } finally {
    database.close();
  }
});

test("rejects an answer type that differs from the configured definition", () => {
  const { database, repository } = createMemoryRepository();

  try {
    const session = createSession(repository);
    const answers = [
      { ...submission(session.id).answers[0], answerType: "choice", optionId: "V" },
      submission(session.id).answers[1]
    ];

    assert.throws(
      () => repository.submitAssessment(submission(session.id, { answers })),
      /answer type/i
    );
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM assessment_answers").get().count, 0);
    assert.equal(repository.getReport(session.id), null);
  } finally {
    database.close();
  }
});

test("reopens a file database and reloads the stored report", () => {
  const directory = mkdtempSync(join(tmpdir(), "lsa-repository-"));
  const databasePath = join(directory, "assessment.sqlite");
  let database;

  try {
    database = openDatabase(databasePath);
    const repository = createRepository(database, { allowedAnswers: ALLOWED_ANSWERS });
    const session = createSession(repository);
    repository.submitAssessment(submission(session.id));
    database.close();

    database = openDatabase(databasePath);
    const reloadedRepository = createRepository(database, { allowedAnswers: ALLOWED_ANSWERS });
    assert.deepEqual(reloadedRepository.getReport(session.id), {
      targetSubject: "数学",
      summary: "当前学习入口"
    });
  } finally {
    if (database?.open) database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("adds the retry audit field when reopening a pre-fix file database", () => {
  const directory = mkdtempSync(join(tmpdir(), "lsa-repository-migration-"));
  const databasePath = join(directory, "assessment.sqlite");
  let database;

  try {
    database = openDatabase(databasePath);
    database.exec("ALTER TABLE assessment_sessions DROP COLUMN retry_timestamps_json");
    database.close();

    database = openDatabase(databasePath);
    const columns = database.pragma("table_info(assessment_sessions)").map(({ name }) => name);
    assert.equal(columns.includes("retry_timestamps_json"), true);
  } finally {
    if (database?.open) database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("rejects an incomplete answer set before it writes a report", () => {
  const { database, repository } = createMemoryRepository();

  try {
    const session = createSession(repository);
    assert.throws(
      () => repository.submitAssessment(submission(session.id, { answers: [submission(session.id).answers[0]] })),
      /expected 2 answers/i
    );
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM assessment_answers").get().count, 0);
  } finally {
    database.close();
  }
});
