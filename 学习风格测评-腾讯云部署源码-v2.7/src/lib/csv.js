const COLUMNS = [
  "anonymousCode", "studentName", "contact", "grade", "scoreBand", "specialtyDirection",
  "foreignLanguage", "targetSubject", "learningLevel", "assessmentVersion",
  "questionBankVersion", "scoringVersion",
  "startedAt", "submittedAt", "questionId", "answerType", "sectionCode",
  "rawResponse", "scoredResponse", "direction", "scenarioWeight", "process",
  "subdimension", "scenarioType", "preferenceCode", "responseTimeMs", "answeredAt",
  "VIndex", "AIndex", "RIndex", "KIndex", "academicLifeDifference",
  "dynamicPair", "dynamicResult", "resultType", "primaryPreference",
  "secondaryPreference", "activeRecall", "spacedRepetition", "deliberatePractice",
  "timelyFeedback", "metacognition", "durationSeconds", "fitRating",
  "selfIdentifiedPreference", "helpfulSection", "confusingText", "comment"
];

function parseJson(value, fallback = {}) {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function readIndex(preferences, code) {
  const value = preferences?.[code];
  return typeof value === "object" && value !== null ? value.index : value;
}

function academicLifeDifference(preferences) {
  const differences = ["V", "A", "R", "K"].map((code) => {
    const academic = preferences?.[code]?.academic?.index;
    const life = preferences?.[code]?.life?.index;
    return Number.isFinite(academic) && Number.isFinite(life) ? Math.abs(academic - life) : null;
  });
  return differences.every(Number.isFinite)
    ? differences.reduce((sum, value) => sum + value, 0) / differences.length
    : "";
}

function normalizedRow(row) {
  const preferences = parseJson(row.preferenceScoresJson);
  const science = parseJson(row.scienceScoresJson);
  return {
    anonymousCode: row.anonymousCode,
    studentName: row.studentName,
    contact: row.contact,
    grade: row.grade,
    scoreBand: row.scoreBand,
    specialtyDirection: row.specialtyDirection,
    foreignLanguage: row.foreignLanguage,
    targetSubject: row.targetSubject,
    learningLevel: row.learningLevel,
    assessmentVersion: row.assessmentVersion,
    questionBankVersion: row.questionBankVersion,
    scoringVersion: row.scoringVersion,
    startedAt: row.startedAt,
    submittedAt: row.submittedAt,
    questionId: row.questionId,
    answerType: row.answerType,
    sectionCode: row.sectionCode,
    rawResponse: row.answerType === "choice" ? row.optionId : row.responseValue,
    scoredResponse: row.scoredValue,
    direction: row.answerType === "choice" ? "choice" : row.isReverse ? "reverse" : "positive",
    scenarioWeight: row.scenarioWeight,
    process: row.processCode,
    subdimension: row.subdimensionCode,
    scenarioType: row.scenarioType,
    preferenceCode: row.preferenceCode,
    responseTimeMs: row.responseTimeMs,
    answeredAt: row.answeredAt,
    VIndex: readIndex(preferences, "V"),
    AIndex: readIndex(preferences, "A"),
    RIndex: readIndex(preferences, "R"),
    KIndex: readIndex(preferences, "K"),
    academicLifeDifference: academicLifeDifference(preferences),
    dynamicPair: row.dynamicPair,
    dynamicResult: row.dynamicResultJson,
    resultType: row.resultType,
    primaryPreference: row.primaryPreference,
    secondaryPreference: row.secondaryPreference,
    activeRecall: science.active_recall ?? science.retrieval,
    spacedRepetition: science.spaced_repetition,
    deliberatePractice: science.deliberate_practice,
    timelyFeedback: science.timely_feedback,
    metacognition: science.metacognition,
    durationSeconds: row.durationSeconds,
    fitRating: row.fitRating,
    selfIdentifiedPreference: row.selfIdentifiedPreference,
    helpfulSection: row.helpfulSection,
    confusingText: row.confusingText,
    comment: row.comment
  };
}

function escapeCell(value) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" && /^[\t\r\n ]*[=+\-@]/.test(value)
    ? `'${value}`
    : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildCsv(rows) {
  const lines = [COLUMNS.join(",")];
  for (const source of rows) {
    const row = normalizedRow(source);
    lines.push(COLUMNS.map((column) => escapeCell(row[column])).join(","));
  }
  return `\ufeff${lines.join("\r\n")}\r\n`;
}

export { COLUMNS };
