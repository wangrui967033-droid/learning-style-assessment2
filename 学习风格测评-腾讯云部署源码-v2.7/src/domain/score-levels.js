const RAW_SUBJECTS = ["语文", "数学", "英语", "日语"];
const SELECTIVE_SUBJECTS = ["物理", "化学", "生物", "历史", "政治", "地理", "技术"];

export const SUBJECT_FULL_SCORES = Object.freeze(
  Object.fromEntries([
    ...RAW_SUBJECTS.map((subject) => [subject, 150]),
    ...SELECTIVE_SUBJECTS.map((subject) => [subject, 100])
  ])
);

const RAW_SCORE_LEVEL_LABELS = Object.freeze({
  foundation: "先稳住基础和常规任务",
  core: "先突破常考基础与中档任务",
  integrated: "先提升综合应用与条件变化任务",
  advanced: "先提升稳定性、速度和综合任务"
});

const SELECTIVE_SCORE_LEVEL_LABELS = Object.freeze({
  foundation: "先稳住基础概念和典型情境",
  core: "先突破常考知识和中档任务",
  integrated: "先提升综合材料和条件变化任务",
  advanced: "先提升陌生情境、综合推理和规范表达"
});

const LEVEL_NAMES = Object.freeze({
  foundation: "基础",
  core: "核心",
  integrated: "综合",
  advanced: "进阶"
});

const RAW_THRESHOLDS = Object.freeze([
  ["foundation", 0, 74.9],
  ["core", 75, 95.9],
  ["integrated", 96, 115.9],
  ["advanced", 116, 150]
]);

const SELECTIVE_THRESHOLDS = Object.freeze([
  ["foundation", 0, 59.9],
  ["core", 60, 74.9],
  ["integrated", 75, 84.9],
  ["advanced", 85, 100]
]);

function freezeLevels(thresholds, studentLabels) {
  return Object.freeze(
    thresholds.map(([id, min, max]) =>
      Object.freeze({
        id,
        label: LEVEL_NAMES[id],
        studentLabel: studentLabels[id],
        min,
        max
      })
    )
  );
}

export const SCORE_LEVELS = Object.freeze({
  raw: freezeLevels(RAW_THRESHOLDS, RAW_SCORE_LEVEL_LABELS),
  selective: freezeLevels(SELECTIVE_THRESHOLDS, SELECTIVE_SCORE_LEVEL_LABELS)
});

function assertKnownSubject(subject) {
  if (typeof subject !== "string" || !Object.hasOwn(SUBJECT_FULL_SCORES, subject)) {
    throw new RangeError(`Unknown subject: ${subject}`);
  }
}

export function fullScoreForSubject(subject) {
  assertKnownSubject(subject);
  return SUBJECT_FULL_SCORES[subject];
}

export function validateTargetSubjectScore(subject, value) {
  const fullScore = fullScoreForSubject(subject);
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    Math.round(value * 10) !== value * 10 ||
    value < 0 ||
    value > fullScore
  ) {
    throw new RangeError(`Invalid score for ${subject}: ${value}`);
  }
  return value;
}

export function scoreLevelFor(subject, score) {
  const validScore = validateTargetSubjectScore(subject, score);
  const levels = fullScoreForSubject(subject) === 150 ? SCORE_LEVELS.raw : SCORE_LEVELS.selective;
  return levels.find((level, index) => {
    const nextLevel = levels[index + 1];
    return validScore >= level.min && (!nextLevel || validScore < nextLevel.min);
  });
}
