import { randomInt, randomUUID } from "node:crypto";
import { initializeDatabase } from "./database.js";

const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

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

function selectedOptionIds(optionId) {
  if (typeof optionId !== "string") return [];
  if (optionId.startsWith("[")) {
    try {
      const parsed = JSON.parse(optionId);
      if (Array.isArray(parsed) && parsed.every((value) => typeof value === "string")) return parsed;
    } catch {}
  }
  return [optionId];
}

function nullable(value) {
  return value === undefined ? null : value;
}

function requireString(value, name) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${name} is required`);
  return value;
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
  if (answerType === "choice") {
    const values = Array.isArray(answer?.optionIds) ? answer.optionIds : [answer?.optionId];
    if (values.length === 0 || new Set(values).size !== values.length) throw new Error(`invalid choice set for ${questionId}`);
    for (const value of values) {
      if (typeof value !== "string" || !definition.optionIds.has(value)) throw new Error(`invalid option for ${questionId}: ${value ?? "<missing>"}`);
    }
  }
}

export function createRepository(database, { allowedAnswers: definitions } = {}) {
  initializeDatabase(database);
  const allowedAnswers = createAllowedAnswerMap(definitions);

  const selectSession = database.prepare("SELECT * FROM assessment_sessions WHERE id = ?");
  const selectReport = database.prepare("SELECT report_json FROM assessment_sessions WHERE id = ? AND submitted_at IS NOT NULL");
  const sessionColumns = new Set(database.pragma("table_info(assessment_sessions)").map(({ name }) => name));
  const sessionInsertFields = [
    ["id", (session) => session.id],
    ["anonymous_code", (session) => session.anonymousCode],
    ["report_access_token", (session) => session.reportAccessToken],
    ["student_name", (session) => session.studentName],
    ["contact", (session) => session.contact],
    ["phone_number", (session) => session.contact],
    ["privacy_consented_at", (session) => session.startedAt],
    ["grade", (session) => session.grade],
    ["score_band", (session) => session.scoreBand],
    ["specialty_direction", (session) => session.specialtyDirection],
    ["foreign_language", (session) => session.foreignLanguage],
    ["exam_subjects_json", (session) => json(session.examSubjects)],
    ["target_subject", (session) => session.targetSubject],
    ["learning_focus", () => "practice"],
    ["learning_task", () => "本周学习任务"],
    ["assessment_version", (session) => session.assessmentVersion],
    ["learning_level", (session) => session.learningLevel],
    ["question_bank_version", (session) => session.questionBankVersion],
    ["scoring_version", (session) => session.scoringVersion],
    ["started_at", (session) => session.startedAt]
  ].filter(([name]) => sessionColumns.has(name));
  const insertSession = database.prepare(`
    INSERT INTO assessment_sessions (${sessionInsertFields.map(([name]) => name).join(", ")})
    VALUES (${sessionInsertFields.map(() => "?").join(", ")})
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
      preference_scores_json = ?, science_scores_json = ?, assessment_payload_json = ?, report_json = ?
    WHERE id = ? AND submitted_at IS NULL
  `);
  const appendRetryTimestamp = database.prepare(`
    UPDATE assessment_sessions
    SET retry_timestamps_json = json_insert(retry_timestamps_json, '$[#]', ?)
    WHERE id = ? AND submitted_at IS NOT NULL
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

  function createSession(input) {
    const payload = {
      studentName: nullable(input?.studentName),
      contact: nullable(input?.contact),
      grade: nullable(input?.grade),
      scoreBand: nullable(input?.scoreBand),
      specialtyDirection: nullable(input?.specialtyDirection),
      foreignLanguage: nullable(input?.foreignLanguage),
      examSubjects: input?.examSubjects ?? null,
      targetSubject: requireString(input?.targetSubject, "targetSubject"),
      assessmentVersion: requireString(input?.assessmentVersion, "assessmentVersion"),
      learningLevel: nullable(input?.learningLevel),
      questionBankVersion: nullable(input?.questionBankVersion),
      scoringVersion: nullable(input?.scoringVersion),
      startedAt: input?.startedAt ?? now()
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const session = { id: randomUUID(), anonymousCode: anonymousCode(), reportAccessToken: randomUUID(), ...payload };
      try {
        insertSession.run(...sessionInsertFields.map(([, value]) => value(session)));
        return session;
      } catch (error) {
        if (!String(error.message).includes("assessment_sessions.anonymous_code")) throw error;
      }
    }
    throw new Error("could not generate a unique anonymous code");
  }

  const submit = database.transaction((input) => {
    const sessionId = requireString(input?.sessionId, "sessionId");
    const session = selectSession.get(sessionId);
    if (!session) throw new Error("assessment session not found");
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
        Array.isArray(answer?.optionIds) ? JSON.stringify(answer.optionIds) : nullable(answer?.optionId),
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
      json(input.assessmentPayload),
      json(input.report),
      sessionId
    );
    return fromJson(json(input.report));
  });

  function submitAssessment(input) {
    return submit(input);
  }

  function saveFeedback(sessionId, feedback) {
    const session = selectSession.get(sessionId);
    if (!session) throw new Error("assessment session not found");
    if (session.submitted_at === null || session.report_json === null) {
      throw new Error("assessment report has not been submitted");
    }
    if (feedback?.fitRating !== undefined && (!Number.isInteger(feedback.fitRating) || feedback.fitRating < 1 || feedback.fitRating > 5)) {
      throw new TypeError("fitRating must be an integer from 1 to 5");
    }
    insertFeedback.run(
      sessionId,
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

  function listExportRows() {
    return database.prepare(`
      SELECT
        s.id AS session_id, s.anonymous_code AS anonymous_code, s.student_name, s.contact, s.grade, s.score_band,
        s.specialty_direction, s.foreign_language, s.exam_subjects_json, s.target_subject,
        s.assessment_version, s.learning_level, s.question_bank_version, s.scoring_version,
        s.started_at, s.submitted_at, s.duration_seconds,
        s.retry_timestamps_json, s.dynamic_pair, s.dynamic_result, s.result_type, s.primary_preference,
        s.secondary_preference, s.preference_scores_json, s.science_scores_json, s.report_json,
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
      studentName: row.student_name,
      contact: row.contact,
      grade: row.grade,
      scoreBand: row.score_band,
      specialtyDirection: row.specialty_direction,
      foreignLanguage: row.foreign_language,
      examSubjectsJson: row.exam_subjects_json,
      targetSubject: row.target_subject,
      assessmentVersion: row.assessment_version,
      learningLevel: row.learning_level,
      questionBankVersion: row.question_bank_version,
      scoringVersion: row.scoring_version,
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
      selectedOptionIds: selectedOptionIds(row.option_id),
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

  return { createSession, submitAssessment, getReport, saveFeedback, listExportRows };
}
