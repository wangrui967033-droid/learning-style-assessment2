import { createHash } from "node:crypto";
import { Router } from "express";
import { getScenarioQuestions, QUESTION_BANK_VERSION } from "../domain/learning-mode-bank.js";
import { scoreScenarioAnswers } from "../domain/learning-mode-scoring.js";
import { buildReport } from "../domain/report-builder.js";

const GRADES = new Set(["高一", "高二", "高三", "高复"]);
const SPECIALTY_DIRECTIONS = new Set(["美术设计", "音乐", "舞蹈", "播音表演", "书法", "体育", "其他"]);
const FOREIGN_LANGUAGES = new Set(["英语", "日语", "其他"]);
const SUBJECTS = new Set(["语文", "数学", "英语", "日语", "物理", "化学", "生物", "历史", "政治", "地理"]);
const LEARNING_LEVELS = new Set(["基础巩固", "稳定提升", "冲刺提高"]);
const BASIC_FIELDS = new Set(["studentName", "contact", "grade", "specialtyDirection", "foreignLanguage", "targetSubject", "learningLevel"]);
const SCORING_VERSION = "scenario-mode-score-v2";
const SCENARIO_QUESTIONS = getScenarioQuestions();

function requireAllowed(set, value, label) {
  if (!set.has(value)) throw new RangeError(`${label} is invalid`);
  return value;
}

function requireShortText(value, label, maximum) {
  if (typeof value !== "string" || value.trim().length === 0 || value.trim().length > maximum) throw new TypeError(`${label} is invalid`);
  return value.trim();
}

function validateBasicInfo(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new TypeError("body is required");
  if (Object.keys(body).some((key) => !BASIC_FIELDS.has(key))) throw new TypeError("unknown basic information field");
  const foreignLanguage = requireAllowed(FOREIGN_LANGUAGES, body.foreignLanguage, "foreign language");
  const targetSubject = requireAllowed(SUBJECTS, body.targetSubject, "target subject");
  if ((targetSubject === "英语" || targetSubject === "日语") && targetSubject !== foreignLanguage) throw new RangeError("foreign-language target does not match examination language");
  return {
    studentName: requireShortText(body.studentName, "student name", 50),
    contact: requireShortText(body.contact, "contact", 100),
    grade: requireAllowed(GRADES, body.grade, "grade"),
    specialtyDirection: requireAllowed(SPECIALTY_DIRECTIONS, body.specialtyDirection, "specialty direction"),
    foreignLanguage: foreignLanguage === "其他" ? null : foreignLanguage,
    targetSubject,
    learningLevel: requireAllowed(LEARNING_LEVELS, body.learningLevel, "learning level")
  };
}

function token(sessionId, stage, value) {
  return createHash("sha256").update(`${stage}:${sessionId}:${value}`).digest("base64url").slice(0, 12);
}

function publicId(sessionId, stage, internalId, prefix = "Q") {
  return `${prefix}-${token(sessionId, stage, internalId)}`;
}

function publicQuestions(sessionId, stage, questions) {
  return questions.map((question) => ({
    id: publicId(sessionId, stage, question.id),
    prompt: question.prompt,
    multiple: true,
    exampleNote: question.options.some(({ example }) => Boolean(example)) ? "“比如”只是帮助理解。做法不需要一模一样；只要你的思路接近，就可以选。" : "",
    options: question.options.map((option) => ({
      id: publicId(sessionId, stage, `${question.id}:${option.id}`, "O"),
      text: option.text,
      example: option.example ?? "",
      skip: option.skip === true
    }))
  }));
}

function questionMaps(sessionId, stage, questions) {
  return new Map(questions.map((question) => [publicId(sessionId, stage, question.id), {
    question,
    options: new Map(question.options.map((option) => [publicId(sessionId, stage, `${question.id}:${option.id}`, "O"), option]))
  }]));
}

function validateTiming(answer) {
  if (answer.responseTimeMs !== undefined && (!Number.isInteger(answer.responseTimeMs) || answer.responseTimeMs < 0)) throw new TypeError("responseTimeMs is invalid");
  if (answer.answeredAt !== undefined && Number.isNaN(Date.parse(answer.answeredAt))) throw new TypeError("answeredAt is invalid");
}

function normalizeAnswers(sessionId, stage, answers, questions) {
  if (!Array.isArray(answers) || answers.length !== questions.length) throw new Error(`expected ${questions.length} ${stage} answers`);
  const maps = questionMaps(sessionId, stage, questions);
  const seen = new Set();
  return answers.map((answer) => {
    validateTiming(answer);
    const mapped = maps.get(answer?.questionId);
    if (!mapped || seen.has(answer.questionId)) throw new Error(`unknown ${stage} question`);
    seen.add(answer.questionId);
    if (answer?.skipped !== undefined) throw new Error(`invalid ${stage} answer`);
    if (!Array.isArray(answer?.optionIds) || answer.optionIds.length < 1 || answer.optionIds.length > 4) throw new Error(`invalid ${stage} choice set`);
    if (new Set(answer.optionIds).size !== answer.optionIds.length) throw new Error(`duplicate ${stage} option`);
    const options = answer.optionIds.map((optionId) => mapped.options.get(optionId));
    if (options.some((option) => !option || option.skip)) throw new Error(`unknown ${stage} option`);
    return { ...answer, questionId: mapped.question.id, optionIds: options.map(({ id }) => id) };
  });
}

function validDuration(value) {
  if (!Number.isInteger(value) || value < 0 || value > 86_400) throw new TypeError("durationSeconds is invalid");
  return value;
}

function loadSession(database, sessionId) {
  const row = database.prepare(`SELECT id, anonymous_code, student_name, contact, grade, target_subject, learning_level, submitted_at FROM assessment_sessions WHERE id = ?`).get(sessionId);
  if (!row) throw new Error("assessment session not found");
  return { id: row.id, anonymousCode: row.anonymous_code, studentName: row.student_name, contact: row.contact, grade: row.grade, targetSubject: row.target_subject, learningLevel: row.learning_level, submitted: row.submitted_at !== null };
}

function scenarioEvaluation(sessionId, answers) {
  const normalized = normalizeAnswers(sessionId, "scenario", answers, SCENARIO_QUESTIONS);
  return { answers: normalized, result: scoreScenarioAnswers(normalized, SCENARIO_QUESTIONS) };
}

export function fixedAnswerDefinitions() {
  return SCENARIO_QUESTIONS.map((question) => ({ questionId: question.id, answerType: "choice", optionIds: question.options.map(({ id }) => id) }));
}

function storageAnswers(answers, questions) {
  const byId = new Map(questions.map((question) => [question.id, question]));
  return answers.map((answer) => {
    const question = byId.get(answer.questionId);
    const selected = answer.optionIds.map((id) => question.options.find((option) => option.id === id));
    return {
      questionId: question.id,
      answerType: "choice",
      sectionCode: "scenario",
      optionId: selected[0].id,
      optionIds: selected.map(({ id }) => id),
      preferenceCode: selected.map(({ mode }) => mode).join(","),
      subdimensionCode: selected.map(({ specificMode }) => specificMode).join(","),
      processCode: question.group,
      responseTimeMs: answer.responseTimeMs,
      answeredAt: answer.answeredAt
    };
  });
}

export function createSessionsRouter({ repository, database, assessmentVersion = "scenario-learning-mode-v2" }) {
  const router = Router();
  router.post("/", (request, response) => {
    const basic = validateBasicInfo(request.body);
    const session = repository.createSession({ ...basic, assessmentVersion, questionBankVersion: QUESTION_BANK_VERSION, scoringVersion: SCORING_VERSION });
    return response.status(201).json({ session: { id: session.id, anonymousCode: session.anonymousCode, assessmentVersion: session.assessmentVersion }, estimatedMinutes: "6-8", normalQuestionCount: 20, maximumQuestionCount: 20, items: publicQuestions(session.id, "scenario", SCENARIO_QUESTIONS) });
  });
  router.post("/:id/submit", (request, response) => {
    const session = loadSession(database, request.params.id);
    if (session.submitted) {
      const report = repository.submitAssessment({ sessionId: session.id });
      response.set("Cache-Control", "no-store");
      return response.json({ sessionId: session.id, anonymousCode: session.anonymousCode, report });
    }
    const durationSeconds = validDuration(request.body?.durationSeconds);
    const scenario = scenarioEvaluation(session.id, request.body?.answers);
    const modeResult = scenario.result;
    const report = buildReport({ anonymousCode: session.anonymousCode, studentName: session.studentName, contact: session.contact, grade: session.grade, targetSubject: session.targetSubject, learningLevel: session.learningLevel, modeResult });
    const answers = storageAnswers(scenario.answers, SCENARIO_QUESTIONS);
    const storedReport = repository.submitAssessment({
      sessionId: session.id, expectedAnswerCount: answers.length, durationSeconds,
      resultType: modeResult.classification.kind, primaryPreference: modeResult.classification.primary, secondaryPreference: modeResult.classification.supporting,
      assessmentPayload: { questionBankVersion: QUESTION_BANK_VERSION, scoringVersion: SCORING_VERSION, modeResult }, report, answers
    });
    response.set("Cache-Control", "no-store");
    return response.status(201).json({ sessionId: session.id, anonymousCode: session.anonymousCode, reportUrl: `/report.html?id=${encodeURIComponent(session.id)}`, report: storedReport });
  });
  return router;
}
