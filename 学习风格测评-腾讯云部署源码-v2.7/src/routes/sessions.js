import { createHash, randomInt } from "node:crypto";
import { Router } from "express";
import { getCalibrationQuestions, getCoreQuestions, getScienceQuestions } from "../domain/question-bank.js";
import { scoreAssessment } from "../domain/scoring.js";
import { evaluateConfirmation, needsConfirmation, selectConfirmationPair } from "../domain/confirmation.js";
import { classifyProfile } from "../domain/classification.js";
import { buildReport } from "../domain/report-builder.js";
import { fullScoreForSubject, scoreLevelFor, validateTargetSubjectScore } from "../domain/score-levels.js";
import { selectTaskUnit } from "../domain/zhejiang-task-bank.js";
import { ConflictError, NotFoundError, ValidationError } from "../lib/http-errors.js";
import { maskPhone, publicReportView } from "./report-view.js";

const GRADES = new Set(["高一", "高二", "高三", "高复"]);
const SCORE_BANDS = new Set(["350以下", "350至400", "400至450", "450至500", "500至550", "550至600", "600以上"]);
const SPECIALTY_DIRECTIONS = new Set(["美术设计", "音乐", "舞蹈", "播音表演", "书法", "体育", "其他"]);
const FOREIGN_LANGUAGES = new Set(["英语", "日语", "其他"]);
const SUBJECTS = new Set(["语文", "数学", "英语", "日语", "物理", "化学", "生物", "历史", "政治", "地理", "技术"]);
const LEARNING_FOCUSES = new Set(["learning", "memory", "practice", "improve"]);
const BASIC_FIELDS = new Set([
  "studentName", "phoneNumber", "privacyConsentedAt",
  "grade", "scoreBand", "specialtyDirection", "foreignLanguage", "targetSubject", "targetSubjectScore", "learningFocus"
]);
const PHONE_PATTERN = /^1[3-9]\d{9}$/;
const PROCESS_ORDER = ["learning", "memory", "practice", "improve"];
const PREFERENCE_SCALE = Object.freeze([
  Object.freeze({ value: 1, label: "完全不像我" }),
  Object.freeze({ value: 2, label: "不太像我" }),
  Object.freeze({ value: 3, label: "有一点像我" }),
  Object.freeze({ value: 4, label: "比较像我" }),
  Object.freeze({ value: 5, label: "非常像我" })
]);
const STRATEGY_SCALE = Object.freeze([
  Object.freeze({ value: 1, label: "完全不像我" }),
  Object.freeze({ value: 2, label: "不太像我" }),
  Object.freeze({ value: 3, label: "有一点像我" }),
  Object.freeze({ value: 4, label: "比较像我" }),
  Object.freeze({ value: 5, label: "非常像我" })
]);

const FIXED_QUESTIONS = Object.freeze([...getCoreQuestions(), ...getScienceQuestions()]);

function requireAllowed(set, value, label) {
  if (!set.has(value)) throw new ValidationError(`${label} is invalid`);
  return value;
}

function requireStudentName(value) {
  const name = String(value ?? "").trim();
  if (name.length < 2 || name.length > 30) throw new ValidationError("student name is invalid");
  return name;
}

function requirePhone(value) {
  const phone = String(value ?? "").trim();
  if (!PHONE_PATTERN.test(phone)) throw new ValidationError("phone number is invalid");
  return phone;
}

function requirePrivacyConsent(value) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new ValidationError("privacy consent is invalid");
  }
  return value;
}

function matchedTaskFor(targetSubject, learningFocus, value) {
  try {
    const targetSubjectScore = validateTargetSubjectScore(targetSubject, value);
    const targetSubjectFullScore = fullScoreForSubject(targetSubject);
    const scoreLevel = scoreLevelFor(targetSubject, targetSubjectScore);
    const taskUnit = selectTaskUnit({
      subject: targetSubject,
      learningFocus,
      score: targetSubjectScore
    });
    return { targetSubjectScore, targetSubjectFullScore, scoreLevel, taskUnit };
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : "target subject score is invalid");
  }
}

function validateBasicInfo(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ValidationError("body is required");
  if (Object.keys(body).some((key) => !BASIC_FIELDS.has(key))) throw new ValidationError("unknown basic information field");

  const foreignLanguage = requireAllowed(FOREIGN_LANGUAGES, body.foreignLanguage, "foreign language");
  const targetSubject = requireAllowed(SUBJECTS, body.targetSubject, "target subject");
  if (foreignLanguage !== "其他" && FOREIGN_LANGUAGES.has(targetSubject) && targetSubject !== foreignLanguage) {
    throw new ValidationError("foreign-language target does not match examination language");
  }

  const learningFocus = requireAllowed(LEARNING_FOCUSES, body.learningFocus, "learning focus");
  const matchedTask = matchedTaskFor(targetSubject, learningFocus, body.targetSubjectScore);

  return {
    studentName: requireStudentName(body.studentName),
    phoneNumber: requirePhone(body.phoneNumber),
    privacyConsentedAt: requirePrivacyConsent(body.privacyConsentedAt),
    grade: requireAllowed(GRADES, body.grade, "grade"),
    scoreBand: requireAllowed(SCORE_BANDS, body.scoreBand, "score band"),
    specialtyDirection: requireAllowed(SPECIALTY_DIRECTIONS, body.specialtyDirection, "specialty direction"),
    foreignLanguage,
    targetSubject,
    learningFocus,
    learningTask: matchedTask.taskUnit.taskLabel,
    taskUnitId: matchedTask.taskUnit.id,
    scoreLevel: matchedTask.scoreLevel.id,
    targetSubjectScore: matchedTask.targetSubjectScore,
    targetSubjectFullScore: matchedTask.targetSubjectFullScore
  };
}

function publicFixedId(sessionId, questionId) {
  const token = createHash("sha256").update(`fixed:${sessionId}:${questionId}`).digest("base64url").slice(0, 12);
  return `Q-${token}`;
}

function fixedQuestionMaps(sessionId) {
  const publicToQuestion = new Map();
  const internalToPublic = new Map();
  for (const question of FIXED_QUESTIONS) {
    const publicId = publicFixedId(sessionId, question.id);
    if (publicToQuestion.has(publicId)) throw new Error("opaque question id collision");
    publicToQuestion.set(publicId, question);
    internalToPublic.set(question.id, publicId);
  }
  return { publicToQuestion, internalToPublic };
}

function publicFixedQuestion(sessionId, question, internalToPublic) {
  return {
    id: internalToPublic.get(question.id) ?? publicFixedId(sessionId, question.id),
    prompt: question.prompt
  };
}

function secureShuffle(values) {
  const result = values.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function isFeasibleAfterChoice(queues, selectedPreference) {
  const counts = [...queues.entries()].map(([preference, items]) => (
    items.length - (preference === selectedPreference ? 1 : 0)
  ));
  const remaining = counts.reduce((sum, count) => sum + count, 0);
  return Math.max(...counts) <= Math.ceil(remaining / 2);
}

function orderCoreQuestions() {
  const queues = new Map(["V", "A", "R", "K"].map((preference) => [
    preference,
    secureShuffle(getCoreQuestions().filter((question) => question.preference === preference))
  ]));
  const ordered = [];

  while (ordered.length < getCoreQuestions().length) {
    const previous = ordered.at(-1);
    let candidates = [...queues.entries()].filter(([preference, items]) => (
      items.length > 0
      && preference !== previous?.preference
      && items.some(({ subdimension }) => subdimension !== previous?.subdimension)
    ));
    const feasible = candidates.filter(([preference]) => isFeasibleAfterChoice(queues, preference));
    if (feasible.length > 0) candidates = feasible;
    if (candidates.length === 0) throw new Error("could not create a valid core question order");

    const [, items] = candidates[randomInt(candidates.length)];
    const validItemIndexes = items
      .map((question, index) => question.subdimension !== previous?.subdimension ? index : null)
      .filter((index) => index !== null);
    const itemIndex = validItemIndexes[randomInt(validItemIndexes.length)];
    ordered.push(items.splice(itemIndex, 1)[0]);
  }

  return ordered;
}

function orderPublicItems(sessionId) {
  const { internalToPublic } = fixedQuestionMaps(sessionId);
  return [...orderCoreQuestions(), ...secureShuffle(getScienceQuestions())]
    .map((question) => publicFixedQuestion(sessionId, question, internalToPublic));
}

function loadSession(database, sessionId) {
  const row = database.prepare(`
    SELECT id, anonymous_code, report_access_token, student_name, phone_number, privacy_consented_at,
      grade, score_band, specialty_direction,
      foreign_language, target_subject, assessment_version,
      learning_focus, learning_task,
      target_subject_score, target_subject_full_score, score_level, task_unit_id,
      started_at, submitted_at, prepared_duration_seconds, prepared_answers_hash
    FROM assessment_sessions WHERE id = ?
  `).get(sessionId);
  if (!row) throw new NotFoundError("assessment session not found");
  return {
    id: row.id,
    anonymousCode: row.anonymous_code,
    reportAccessToken: row.report_access_token,
    studentName: row.student_name,
    phoneNumber: row.phone_number,
    privacyConsentedAt: row.privacy_consented_at,
    grade: row.grade,
    scoreBand: row.score_band,
    specialtyDirection: row.specialty_direction,
    foreignLanguage: row.foreign_language,
    targetSubject: row.target_subject,
    learningFocus: row.learning_focus,
    learningTask: row.learning_task,
    targetSubjectScore: row.target_subject_score,
    targetSubjectFullScore: row.target_subject_full_score,
    scoreLevel: row.score_level,
    taskUnitId: row.task_unit_id,
    assessmentVersion: row.assessment_version,
    startedAt: row.started_at,
    preparedDurationSeconds: row.prepared_duration_seconds,
    preparedAnswersHash: row.prepared_answers_hash,
    submitted: row.submitted_at !== null
  };
}

function validateTiming(answer) {
  if (answer.responseTimeMs !== undefined && (!Number.isInteger(answer.responseTimeMs) || answer.responseTimeMs < 0)) {
    throw new ValidationError("responseTimeMs is invalid");
  }
  if (answer.answeredAt !== undefined && Number.isNaN(Date.parse(answer.answeredAt))) {
    throw new ValidationError("answeredAt is invalid");
  }
}

function fixedAnswerSet(answers, sessionId) {
  if (!Array.isArray(answers) || answers.length !== FIXED_QUESTIONS.length) {
    throw new ValidationError(`expected ${FIXED_QUESTIONS.length} fixed answers`);
  }
  const { publicToQuestion } = fixedQuestionMaps(sessionId);
  const normalized = [];
  for (const answer of answers) {
    const question = publicToQuestion.get(answer?.questionId);
    if (!question) throw new ValidationError("unknown fixed answer");
    validateTiming(answer);
    normalized.push({ ...answer, questionId: question.id });
  }
  try {
    scoreAssessment({ questions: FIXED_QUESTIONS, answers: normalized });
  } catch (error) {
    throw new ValidationError(`invalid fixed answers: ${error.message}`);
  }
  return normalized;
}

function fixedAnswersHash(answers) {
  const canonical = answers
    .map(({ questionId, value, responseTimeMs, answeredAt }) => ({ questionId, value, responseTimeMs, answeredAt }))
    .sort((left, right) => left.questionId.localeCompare(right.questionId));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function bitFor(sessionId, pair, itemIndex) {
  const hash = createHash("sha256").update(`${sessionId}:${pair}:${itemIndex}`).digest();
  return hash[0] & 1;
}

function confirmationModel(sessionId, pair) {
  const questions = getCalibrationQuestions(pair)
    .slice()
    .sort((left, right) => PROCESS_ORDER.indexOf(left.process) - PROCESS_ORDER.indexOf(right.process));
  if (questions.length !== 4) throw new Error("calibration bank is incomplete");

  return questions.map((question, index) => {
    const id = `CAL${String(index + 1).padStart(2, "0")}`;
    const options = bitFor(sessionId, pair, index) ? question.options.slice().reverse() : question.options.slice();
    return {
      id,
      prompt: question.prompt,
      process: question.process,
      options: options.map((option, optionIndex) => ({
        id: `${id}-O${optionIndex + 1}`,
        text: option.text,
        preference: option.preference
      }))
    };
  });
}

function publicConfirmationItems(items) {
  return items.map(({ id, prompt, options }) => ({
    id,
    prompt,
    options: options.map(({ id: optionId, text }) => ({ id: optionId, text }))
  }));
}

function splitSubmissionAnswers(answers, sessionId) {
  if (!Array.isArray(answers)) throw new ValidationError("answers must be an array");
  const { publicToQuestion } = fixedQuestionMaps(sessionId);
  return {
    fixed: answers.filter(({ questionId } = {}) => publicToQuestion.has(questionId)),
    confirmation: answers.filter(({ questionId } = {}) => !publicToQuestion.has(questionId))
  };
}

function confirmationSelections(answers, items, pair) {
  if (answers.length !== 4) throw new ValidationError("expected four confirmation answers");
  const byId = new Map(items.map((item) => [item.id, item]));
  const seen = new Set();
  return answers.map((answer) => {
    validateTiming(answer);
    const item = byId.get(answer?.questionId);
    if (!item || seen.has(item.id)) throw new ValidationError("invalid confirmation question");
    seen.add(item.id);
    const option = item.options.find(({ id }) => id === answer.optionId);
    if (!option) throw new ValidationError("invalid confirmation option");
    return { selected: option.preference, pair };
  });
}

function fixedStorageAnswers(inputAnswers, scoreResult) {
  const inputById = new Map(inputAnswers.map((answer) => [answer.questionId, answer]));
  const questionById = new Map(FIXED_QUESTIONS.map((question) => [question.id, question]));
  return scoreResult.answerDetails.map((detail) => {
    const input = inputById.get(detail.questionId);
    const question = questionById.get(detail.questionId);
    return {
      questionId: detail.questionId,
      answerType: "scale",
      sectionCode: question.kind === "science" ? "science" : "core",
      preferenceCode: question.preference,
      subdimensionCode: question.subdimension,
      processCode: question.process,
      scenarioType: question.scenarioType,
      isReverse: question.direction === "reverse" || question.direction === "negative",
      responseValue: detail.rawValue,
      scoredValue: detail.scoredValue,
      scenarioWeight: detail.weight,
      responseTimeMs: input.responseTimeMs,
      answeredAt: input.answeredAt
    };
  });
}

function confirmationStorageAnswers(inputAnswers, items) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  return inputAnswers.map((answer) => {
    const item = itemById.get(answer.questionId);
    const option = item.options.find(({ id }) => id === answer.optionId);
    return {
      questionId: item.id,
      answerType: "choice",
      sectionCode: "confirmation",
      optionId: option.id,
      preferenceCode: option.preference,
      processCode: item.process,
      responseTimeMs: answer.responseTimeMs,
      answeredAt: answer.answeredAt
    };
  });
}

function secondaryPreference(profile) {
  return profile?.secondary ?? null;
}

function primaryPreference(profile) {
  return profile?.primary ?? null;
}

function validDuration(value) {
  if (!Number.isInteger(value) || value < 0 || value > 86_400) throw new ValidationError("durationSeconds is invalid");
  return value;
}

export function fixedAnswerDefinitions() {
  return [
    ...FIXED_QUESTIONS.map(({ id }) => ({ questionId: id, answerType: "scale" })),
    ...Array.from({ length: 4 }, (_, index) => {
      const id = `CAL${String(index + 1).padStart(2, "0")}`;
      return { questionId: id, answerType: "choice", optionIds: [`${id}-O1`, `${id}-O2`] };
    })
  ];
}

export function createSessionsRouter({ repository, database, assessmentVersion = "v2.7.1" }) {
  const router = Router();

  router.post("/", (request, response) => {
    const basic = validateBasicInfo(request.body);
    const session = repository.createSession({ ...basic, assessmentVersion });
    return response.status(201).json({
      session: {
        id: session.id,
        anonymousCode: session.anonymousCode,
        assessmentVersion: session.assessmentVersion
      },
      estimatedMinutes: "8-10",
      ordering: { policy: "preserve", version: 1 },
      items: orderPublicItems(session.id),
      preferenceScale: PREFERENCE_SCALE,
      strategyScale: STRATEGY_SCALE
    });
  });

  router.post("/:id/prepare", (request, response) => {
    loadSession(database, request.params.id);
    const durationSeconds = validDuration(request.body?.durationSeconds);
    const answers = fixedAnswerSet(request.body?.answers, request.params.id);
    repository.savePreparation(request.params.id, {
      durationSeconds,
      answersHash: fixedAnswersHash(answers)
    });
    const scoreResult = scoreAssessment({ questions: FIXED_QUESTIONS, answers });
    const profile = classifyProfile(scoreResult);
    if (!needsConfirmation(profile)) return response.json({ needsConfirmation: false });
    const pair = selectConfirmationPair(profile);
    const items = confirmationModel(request.params.id, pair);
    return response.json({ needsConfirmation: true, items: publicConfirmationItems(items) });
  });

  router.post("/:id/submit", (request, response) => {
    const session = loadSession(database, request.params.id);
    if (session.submitted) {
      const report = repository.submitAssessment({ sessionId: session.id });
      response.set("Cache-Control", "no-store");
      return response.json({
        anonymousCode: session.anonymousCode,
        reportUrl: `/report.html?id=${encodeURIComponent(session.reportAccessToken)}`,
        report: publicReportView(report)
      });
    }

    const durationSeconds = validDuration(request.body?.durationSeconds);
    const { fixed: publicFixed, confirmation } = splitSubmissionAnswers(request.body?.answers, session.id);
    const fixed = fixedAnswerSet(publicFixed, session.id);
    const submittedHash = fixedAnswersHash(fixed);
    if (session.preparedAnswersHash && submittedHash !== session.preparedAnswersHash) {
      throw new ConflictError("fixed answers changed after preparation");
    }
    const scoreResult = scoreAssessment({ questions: FIXED_QUESTIONS, answers: fixed });
    const initialProfile = classifyProfile(scoreResult);
    const confirmationRequired = needsConfirmation(initialProfile);
    let pair = null;
    let items = [];
    let confirmationResult = null;

    if (confirmationRequired) {
      if (request.body.answers.length !== 46) throw new ValidationError("expected 46 answers");
      pair = selectConfirmationPair(initialProfile);
      items = confirmationModel(session.id, pair);
      confirmationResult = evaluateConfirmation(confirmationSelections(confirmation, items, pair));
    } else {
      if (request.body.answers.length !== 42 || confirmation.length !== 0) throw new ValidationError("expected 42 answers");
    }

    const profile = classifyProfile(scoreResult, confirmationResult);
    const submittedAt = new Date().toISOString();
    const taskUnit = selectTaskUnit({
      subject: session.targetSubject,
      learningFocus: session.learningFocus,
      score: session.targetSubjectScore
    });
    const report = buildReport({
      studentName: session.studentName,
      anonymousCode: session.anonymousCode,
      grade: session.grade,
      targetSubject: session.targetSubject,
      learningFocus: session.learningFocus,
      learningTask: taskUnit.taskLabel,
      targetSubjectScore: session.targetSubjectScore,
      targetSubjectFullScore: session.targetSubjectFullScore,
      scoreLevel: taskUnit.scoreLevel,
      taskUnit,
      assessmentDate: submittedAt.slice(0, 10),
      scoreResult,
      profile
    });
    report.maskedPhone = maskPhone(session.phoneNumber);
    const storageAnswers = [
      ...fixedStorageAnswers(fixed, scoreResult),
      ...confirmationStorageAnswers(confirmation, items)
    ];
    const storedReport = repository.submitAssessment({
      sessionId: session.id,
      expectedAnswerCount: confirmationRequired ? 46 : 42,
      submittedAt,
      durationSeconds,
      dynamicPair: pair,
      dynamicResult: confirmationResult,
      resultType: profile.type,
      primaryPreference: primaryPreference(profile),
      secondaryPreference: secondaryPreference(profile),
      preferenceScores: scoreResult.preference,
      scienceScores: scoreResult.science,
      report,
      answers: storageAnswers
    });
    response.set("Cache-Control", "no-store");
    return response.status(201).json({
      anonymousCode: session.anonymousCode,
      reportUrl: `/report.html?id=${encodeURIComponent(session.reportAccessToken)}`,
      report: publicReportView(storedReport)
    });
  });

  return router;
}
