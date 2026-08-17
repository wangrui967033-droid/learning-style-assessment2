import { MODE_ORDER, SPECIFIC_MODES } from "./learning-modes.js";

function requireAnswerSlots(answers, questions, label) {
  if (!Array.isArray(answers) || answers.length !== questions.length) throw new Error(`需要完成${questions.length}道${label}`);
  const byId = new Map(questions.map((question) => [question.id, question]));
  const seen = new Set();
  return answers.map((answer) => {
    const question = byId.get(answer?.questionId);
    if (!question || seen.has(answer.questionId)) throw new Error(`${label}题目无效或重复`);
    seen.add(answer.questionId);
    return { answer, question };
  });
}

function selectedOptions(answer, question) {
  if (answer?.skipped !== undefined) throw new Error("不支持跳过题目");
  if (!Array.isArray(answer?.optionIds) || answer.optionIds.length === 0) throw new Error("请至少选择一项");
  const ids = [...new Set(answer.optionIds)];
  if (ids.length !== answer.optionIds.length) throw new Error("同一选项不能重复选择");
  const byId = new Map(question.options.map((option) => [option.id, option]));
  return ids.map((id) => {
    const option = byId.get(id);
    if (!option) throw new Error("选项无效");
    return option;
  });
}

function mapRates(scores, denominators) {
  return Object.fromEntries(Object.entries(scores).map(([id, score]) => {
    const denominator = typeof denominators === "number" ? denominators : denominators[id];
    return [id, denominator === 0 ? 0 : score / denominator];
  }));
}

function rankedRows(scores, rates) {
  return MODE_ORDER.map((mode) => ({ mode, score: scores[mode], rate: rates[mode] }))
    .sort((left, right) => right.rate - left.rate || right.score - left.score || MODE_ORDER.indexOf(left.mode) - MODE_ORDER.indexOf(right.mode));
}

function parallel(candidates) {
  return Object.freeze({ kind: "parallel", primary: null, supporting: null, candidates: Object.freeze(candidates) });
}

function clear(primary) {
  return Object.freeze({ kind: "clear", primary, supporting: null, candidates: Object.freeze([primary]) });
}

function primarySupporting(primary, supporting) {
  return Object.freeze({ kind: "primary_supporting", primary, supporting, candidates: Object.freeze([primary, supporting]) });
}

export function classifyLearningModes({ answeredCount, ranked } = {}) {
  if (!Number.isInteger(answeredCount) || !Array.isArray(ranked) || ranked.length !== MODE_ORDER.length) throw new TypeError("学习模式结果无效");
  if (answeredCount < 10) return parallel([...MODE_ORDER]);
  const close = ranked.filter((row) => ranked[0].rate - row.rate <= 0.1 + Number.EPSILON);
  if (close.length === 1) return clear(close[0].mode);
  if (close.length === 2 && close[0].rate > close[1].rate) return primarySupporting(close[0].mode, close[1].mode);
  return parallel(close.map(({ mode }) => mode));
}

export function scoreScenarioAnswers(answers, questions) {
  const pairs = requireAnswerSlots(answers, questions, "基础题");
  const scores = Object.fromEntries(MODE_ORDER.map((mode) => [mode, 0]));
  const specificScores = Object.fromEntries(Object.keys(SPECIFIC_MODES).map((id) => [id, 0]));
  const specificOpportunities = Object.fromEntries(Object.keys(SPECIFIC_MODES).map((id) => [id, 0]));
  const answeredCount = questions.length;

  for (const { answer, question } of pairs) {
    const selected = selectedOptions(answer, question);
    for (const option of question.options) specificOpportunities[option.specificMode] += 1;
    for (const option of selected) {
      scores[option.mode] += 1;
      specificScores[option.specificMode] += 1;
    }
  }

  const rates = mapRates(scores, answeredCount);
  const specificRates = mapRates(specificScores, specificOpportunities);
  const totalSelectedOptions = Object.values(scores).reduce((sum, count) => sum + count, 0);
  const averageSelectionsPerAnsweredQuestion = answeredCount === 0 ? 0 : totalSelectedOptions / answeredCount;
  const skipRate = 0;
  const ranked = rankedRows(scores, rates);
  const classification = classifyLearningModes({ answeredCount, ranked });

  return Object.freeze({
    answeredCount,
    skippedQuestionIds: Object.freeze([]),
    scores: Object.freeze(scores),
    rates: Object.freeze(rates),
    specificScores: Object.freeze(specificScores),
    specificOpportunities: Object.freeze(specificOpportunities),
    specificRates: Object.freeze(specificRates),
    totalSelectedOptions,
    averageSelectionsPerAnsweredQuestion,
    skipRate,
    ranked: Object.freeze(ranked.map(Object.freeze)),
    classification
  });
}
