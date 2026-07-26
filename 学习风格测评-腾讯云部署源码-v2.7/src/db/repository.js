import { randomInt, randomUUID } from "node:crypto";
import { ConflictError, NotFoundError, ValidationError } from "../lib/http-errors.js";
import { generateOpaqueToken } from "../lib/security.js";
import { fullScoreForSubject, scoreLevelFor, validateTargetSubjectScore } from "../domain/score-levels.js";
import { selectTaskUnit } from "../domain/zhejiang-task-bank.js";
import { initializeDatabase } from "./database.js";

const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const PHONE_PATTERN = /^1[3-9]\d{9}$/;
const SCORE_LEVEL_IDS = new Set(["foundation", "core", "integrated", "advanced"]);
const TASK_UNIT_ID_PATTERN = /^[a-z]+-(learning|memory|practice|improve)-(foundation|core|integrated|advanced)$/;

function now() {
  return new Date().toISOString();
}

function anonymousCode(date = new Date()) {
  const day = date.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  return `LSA-${day}-${suffix}`;
}

function json(value) {
  return value === undefined ? null : JSON.stringify(value);
}

function fromJson(value) {
  return value === null ? null : JSON.parse(value);
}

function nullable(value) {
  return value === undefined ? null : value;
}

function requireString(value, name) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${name} is required`);
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

function requireLearningTask(value) {
  const task = String(value ?? "").trim();
  if (task.length < 2 || task.length > 40) throw new ValidationError("learning task is invalid");
  return task;
}

function requireMatchedTask(input, targetSubject) {
  const targetSubjectScore = validateTargetSubjectScore(targetSubject, input?.targetSubjectScore);
  const targetSubjectFullScore = input?.targetSubjectFullScore;
  const expectedFullScore = fullScoreForSubject(targetSubject);
  if (targetSubjectFullScore !== expectedFullScore) {
    throw new ValidationError("target subject full score is invalid");
  }

  const scoreLevel = requireString(input?.scoreLevel, "scoreLevel");
  if (!SCORE_LEVEL_IDS.has(scoreLevel) || scoreLevelFor(targetSubject, targetSubjectScore).id !== scoreLevel) {
    throw new ValidationError("score level is invalid");
  }

  const taskUnitId = requireString(input?.taskUnitId, "taskUnitId");
  const selectedTask = selectTaskUnit({
    subject: targetSubject,
    learningFocus: input?.learningFocus,
    score: targetSubjectScore
  });
  if (
    !TASK_UNIT_ID_PATTERN.test(taskUnitId) ||
    !taskUnitId.endsWith(`-${scoreLevel}`) ||
    selectedTask.id !== taskUnitId
  ) {
    throw new ValidationError("task unit id is invalid");
  }

  return { targetSubjectScore, targetSubjectFullScore, scoreLevel, taskUnitId };
}

function createAllowedAnswerMap(definitions) {
  if (!Array.isArray(definitions)) throw new TypeError("allowedAnswers must be configured by the server");

  const allowedAnswers = new Map();
  for (const definition of definitions) {
    const questionId = requireString(definition?.questionId, "allowed questionId");
    const answerType = requireString(definition?.answerType, `answerType for ${questionId}`);
    if (answerType !== "scale" && answerType !== "choice") {
      throw new TypeError(`unknown answer type for ${questionId}`);
    }
    if (allowedAnswers.has(questionId)) throw new Error(`duplicate allowed question: ${questionId}`);

    let optionIds = null;
    if (answerType === "choice") {
      if (!Array.isArray(definition.optionIds) || definition.optionIds.length === 0) {
        throw new TypeError(`optionIds are required for choice question ${questionId}`);
      }
      optionIds = new Set(definition.optionIds.map((optionId) => requireString(optionId, `optionId for ${questionId}`)));
    }
    allowedAnswers.set(questionId, { answerType, optionIds });
  }
  return allowedAnswers;
}

function validateAnswer(answer, allowedAnswers) {
  const questionId = requireString(answer?.questionId, "questionId");
  const definition = allowedAnswers.get(questionId);
  if (!definition) throw new Error(`unknown question: ${questionId}`);

  const answerType = requireString(answer?.answerType, "answerType");
  if (answerType !== definition.answerType) {
    throw new Error(`answer type does not match configured definition: ${questionId}`);
  }
  if (answerType === "choice" && !definition.optionIds.has(answer?.optionId)) {
    throw new Error(`invalid option for ${questionId}: ${answer?.optionId ?? "<missing>"}`);
  }
}

export function createRepository(database, { allowedAnswers: definitions } = {}) {
  initializeDatabase(database);
  const allowedAnswers = createAllowedAnswerMap(definitions);

  const selectSession = database.prepare("SELECT * FROM assessment_sessions WHERE id = ?");
  const selectReport = database.prepare("SELECT report_json FROM assessment_sessions WHERE id = ? AND submitted_at IS NOT NULL");
  const selectSessionByAccessToken = database.prepare("SELECT * FROM assessment_sessions WHERE report_access_token = ?");
  const selectReportByAccessToken = database.prepare(`
    SELECT report_json FROM assessment_sessions
    WHERE report_access_token = ? AND submitted_at IS NOT NULL
  `);
  const selectPublicReportByAccessToken = database.prepare(`
    SELECT report_json, student_name, phone_number FROM assessment_sessions
    WHERE report_access_token = ? AND submitted_at IS NOT NULL
  `);
  const insertSession = database.prepare(`
    INSERT INTO assessment_sessions (
      id, anonymous_code, report_access_token, student_name, phone_number, privacy_consented_at,
      grade, score_band, specialty_direction, foreign_language,
      exam_subjects_json, target_subject, learning_focus, learning_task,
      target_subject_score, target_subject_full_score, score_level, task_unit_id,
      assessment_version, started_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAnswer = database.prepare(`
    INSERT INTO assessment_answers (
      session_id, question_id, answer_type, section_code, option_id, preference_code,
      subdimension_code, process_code, scenario_type, is_reverse, response_value,
      scored_value, scenario_weight, response_time_ms, answered_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const completeSession = database.prepare(`
    UPDATE assessment_sessions
    SET submitted_at = ?, duration_seconds = ?, dynamic_pair = ?, dynamic_result = ?,
      result_type = ?, primary_preference = ?, secondary_preference = ?,
      preference_scores_json = ?, science_scores_json = ?, report_json = ?
    WHERE id = ? AND submitted_at IS NULL
  `);
  const appendRetryTimestamp = database.prepare(`
    UPDATE assessment_sessions
    SET retry_timestamps_json = json_insert(retry_timestamps_json, '$[#]', ?)
    WHERE id = ? AND submitted_at IS NOT NULL
  `);
  const savePreparedState = database.prepare(`
    UPDATE assessment_sessions
    SET prepared_duration_seconds = ?, prepared_answers_hash = ?
    WHERE id = ? AND submitted_at IS NULL
  `);
  const insertFeedback = database.prepare(`
    INSERT INTO assessment_feedback (
      session_id, fit_rating, self_identified_preference, helpful_section,
      confusing_text, comment, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      fit_rating = excluded.fit_rating,
      self_identified_preference = excluded.self_identified_preference,
      helpful_section = excluded.helpful_section,
      confusing_text = excluded.confusing_text,
      comment = excluded.comment,
      created_at = excluded.created_at
  `);

  function getReport(sessionId) {
    const row = selectReport.get(sessionId);
    return row ? fromJson(row.report_json) : null;
  }

  function getReportByAccessToken(reportAccessToken) {
    const row = selectReportByAccessToken.get(reportAccessToken);
    return row ? fromJson(row.report_json) : null;
  }

  function getPublicReportByAccessToken(reportAccessToken) {
    const row = selectPublicReportByAccessToken.get(reportAccessToken);
    return row ? {
      report: fromJson(row.report_json),
      studentName: row.student_name,
      phoneNumber: row.phone_number
    } : null;
  }

  function createSession(input) {
    const targetSubject = requireString(input?.targetSubject, "targetSubject");
    const payload = {
      studentName: requireStudentName(input?.studentName),
      phoneNumber: requirePhone(input?.phoneNumber),
      privacyConsentedAt: requirePrivacyConsent(input?.privacyConsentedAt),
      grade: nullable(input?.grade),
      scoreBand: nullable(input?.scoreBand),
      specialtyDirection: nullable(input?.specialtyDirection),
      foreignLanguage: nullable(input?.foreignLanguage),
      examSubjects: input?.examSubjects ?? null,
      targetSubject,
      learningFocus: requireString(input?.learningFocus, "learningFocus"),
      learningTask: requireLearningTask(input?.learningTask),
      ...requireMatchedTask(input, targetSubject),
      assessmentVersion: requireString(input?.assessmentVersion, "assessmentVersion"),
      startedAt: input?.startedAt ?? now()
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const session = {
        id: randomUUID(),
        anonymousCode: anonymousCode(),
        reportAccessToken: generateOpaqueToken(),
        ...payload
      };
      try {
        insertSession.run(
          session.id,
          session.anonymousCode,
          session.reportAccessToken,
          session.studentName,
          session.phoneNumber,
          session.privacyConsentedAt,
          session.grade,
          session.scoreBand,
          session.specialtyDirection,
          session.foreignLanguage,
          json(session.examSubjects),
          session.targetSubject,
          session.learningFocus,
          session.learningTask,
          session.targetSubjectScore,
          session.targetSubjectFullScore,
          session.scoreLevel,
          session.taskUnitId,
          session.assessmentVersion,
          session.startedAt
        );
        return session;
      } catch (error) {
        if (!/assessment_sessions\.(?:anonymous_code|report_access_token)/.test(String(error.message))) throw error;
      }
    }
    throw new Error("could not generate a unique anonymous code");
  }

  const submit = database.transaction((input) => {
    const sessionId = requireString(input?.sessionId, "sessionId");
    const session = selectSession.get(sessionId);
    if (!session) throw new NotFoundError("assessment session not found");
    if (session.submitted_at !== null) {
      appendRetryTimestamp.run(now(), sessionId);
      return fromJson(session.report_json);
    }

    if (!Number.isInteger(input.expectedAnswerCount) || input.expectedAnswerCount < 1) {
      throw new TypeError("expectedAnswerCount must be a positive integer");
    }
    if (!Array.isArray(input.answers) || input.answers.length !== input.expectedAnswerCount) {
      throw new Error(`expected ${input.expectedAnswerCount} answers`);
    }
    if (!input.report || typeof input.report !== "object" || Array.isArray(input.report)) {
      throw new TypeError("report must be an object");
    }
    for (const answer of input.answers) validateAnswer(answer, allowedAnswers);

    for (const answer of input.answers) {
      insertAnswer.run(
        sessionId,
        requireString(answer?.questionId, "questionId"),
        requireString(answer?.answerType, "answerType"),
        requireString(answer?.sectionCode, "sectionCode"),
        nullable(answer?.optionId),
        nullable(answer?.preferenceCode),
        nullable(answer?.subdimensionCode),
        nullable(answer?.processCode),
        nullable(answer?.scenarioType),
        answer?.isReverse ? 1 : 0,
        nullable(answer?.responseValue),
        nullable(answer?.scoredValue),
        nullable(answer?.scenarioWeight),
        nullable(answer?.responseTimeMs),
        answer?.answeredAt ?? now()
      );
    }

    completeSession.run(
      input.submittedAt ?? now(),
      nullable(input.durationSeconds),
      nullable(input.dynamicPair),
      json(input.dynamicResult),
      nullable(input.resultType),
      nullable(input.primaryPreference),
      nullable(input.secondaryPreference),
      json(input.preferenceScores),
      json(input.scienceScores),
      json(input.report),
      sessionId
    );
    return fromJson(json(input.report));
  });

  function submitAssessment(input) {
    return submit(input);
  }

  function savePreparation(sessionId, input) {
    requireString(sessionId, "sessionId");
    if (!Number.isInteger(input?.durationSeconds) || input.durationSeconds < 0) {
      throw new TypeError("prepared durationSeconds must be a non-negative integer");
    }
    requireString(input?.answersHash, "prepared answersHash");
    const result = savePreparedState.run(input.durationSeconds, input.answersHash, sessionId);
    if (result.changes !== 1) throw new ConflictError("assessment session cannot be prepared");
  }

  function saveFeedbackForSession(session, feedback) {
    if (!session) throw new NotFoundError("assessment session not found");
    if (session.submitted_at === null || session.report_json === null) {
      throw new ConflictError("assessment report has not been submitted");
    }
    if (feedback?.fitRating !== undefined && (!Number.isInteger(feedback.fitRating) || feedback.fitRating < 1 || feedback.fitRating > 5)) {
      throw new ValidationError("fitRating must be an integer from 1 to 5");
    }
    insertFeedback.run(
      session.id,
      nullable(feedback?.fitRating),
      nullable(feedback?.selfIdentifiedPreference),
      nullable(feedback?.helpfulSection),
      nullable(feedback?.confusingText),
      nullable(feedback?.comment),
      feedback?.createdAt ?? now()
    );
    return {
      fitRating: nullable(feedback?.fitRating),
      selfIdentifiedPreference: nullable(feedback?.selfIdentifiedPreference),
      helpfulSection: nullable(feedback?.helpfulSection),
      confusingText: nullable(feedback?.confusingText),
      comment: nullable(feedback?.comment)
    };
  }

  function saveFeedback(sessionId, feedback) {
    return saveFeedbackForSession(selectSession.get(sessionId), feedback);
  }

  function saveFeedbackByAccessToken(reportAccessToken, feedback) {
    return saveFeedbackForSession(selectSessionByAccessToken.get(reportAccessToken), feedback);
  }

  function listExportRows() {
    return database.prepare(`
      SELECT
        s.id AS session_id, s.anonymous_code AS anonymous_code, s.grade, s.score_band,
        s.specialty_direction, s.foreign_language, s.exam_subjects_json, s.target_subject, s.learning_task,
        s.target_subject_score, s.target_subject_full_score, s.score_level, s.task_unit_id,
        s.assessment_version, s.started_at, s.submitted_at, s.duration_seconds,
        s.retry_timestamps_json, s.dynamic_pair, s.dynamic_result, s.result_type, s.primary_preference,
        s.secondary_preference, s.preference_scores_json, s.science_scores_json,
        s.report_json,
        a.question_id, a.answer_type, a.section_code, a.option_id, a.preference_code,
        a.subdimension_code, a.process_code, a.scenario_type, a.is_reverse,
        a.response_value, a.scored_value, a.scenario_weight, a.response_time_ms, a.answered_at,
        f.fit_rating, f.self_identified_preference, f.helpful_section, f.confusing_text, f.comment
      FROM assessment_sessions AS s
      JOIN assessment_answers AS a ON a.session_id = s.id
      LEFT JOIN assessment_feedback AS f ON f.session_id = s.id
      ORDER BY s.started_at, a.question_id
    `).all().map((row) => ({
      sessionId: row.session_id,
      anonymousCode: row.anonymous_code,
      grade: row.grade,
      scoreBand: row.score_band,
      specialtyDirection: row.specialty_direction,
      foreignLanguage: row.foreign_language,
      examSubjectsJson: row.exam_subjects_json,
      targetSubject: row.target_subject,
      learningTask: row.learning_task,
      targetSubjectScore: row.target_subject_score,
      targetSubjectFullScore: row.target_subject_full_score,
      scoreLevel: row.score_level,
      taskUnitId: row.task_unit_id,
      assessmentVersion: row.assessment_version,
      startedAt: row.started_at,
      submittedAt: row.submitted_at,
      retryTimestampsJson: row.retry_timestamps_json,
      durationSeconds: row.duration_seconds,
      dynamicPair: row.dynamic_pair,
      dynamicResultJson: row.dynamic_result,
      resultType: row.result_type,
      primaryPreference: row.primary_preference,
      secondaryPreference: row.secondary_preference,
      preferenceScoresJson: row.preference_scores_json,
      scienceScoresJson: row.science_scores_json,
      reportJson: row.report_json,
      questionId: row.question_id,
      answerType: row.answer_type,
      sectionCode: row.section_code,
      optionId: row.option_id,
      preferenceCode: row.preference_code,
      subdimensionCode: row.subdimension_code,
      processCode: row.process_code,
      scenarioType: row.scenario_type,
      isReverse: Boolean(row.is_reverse),
      responseValue: row.response_value,
      scoredValue: row.scored_value,
      scenarioWeight: row.scenario_weight,
      responseTimeMs: row.response_time_ms,
      answeredAt: row.answered_at,
      fitRating: row.fit_rating,
      selfIdentifiedPreference: row.self_identified_preference,
      helpfulSection: row.helpful_section,
      confusingText: row.confusing_text,
      comment: row.comment
    }));
  }

  function listContactExportRows() {
    return database.prepare(`
      SELECT anonymous_code AS anonymousCode, student_name AS studentName,
        phone_number AS phoneNumber, grade, target_subject AS targetSubject,
        started_at AS startedAt
      FROM assessment_sessions
      ORDER BY started_at, anonymous_code
    `).all();
  }

  return {
    createSession,
    savePreparation,
    submitAssessment,
    getReport,
    getReportByAccessToken,
    getPublicReportByAccessToken,
    saveFeedback,
    saveFeedbackByAccessToken,
    listExportRows,
    listContactExportRows
  };
}
