const REVERSE_DIRECTIONS = new Set(["negative", "reverse"]);

function createAccumulator() {
  return { weightedSum: 0, weightSum: 0, scores: [] };
}

function addScore(accumulator, scoredValue, weight) {
  accumulator.weightedSum += scoredValue * weight;
  accumulator.weightSum += weight;
  accumulator.scores.push(scoredValue);
}

function summarize(accumulator, indexFor) {
  const weightedMean = accumulator.weightedSum / accumulator.weightSum;
  return {
    weightedMean,
    index: indexFor ? indexFor(accumulator.weightedSum) : meanIndex(weightedMean)
  };
}

export function evidenceLevel(total) {
  if (total >= 2 && total <= 4) return "当前证据较少";
  if (total >= 5 && total <= 7) return "在部分场景出现";
  if (total >= 8 && total <= 10) return "表现较明显";
  throw new RangeError("two-item evidence total must be between 2 and 10");
}

function preferenceIndex(weightedRaw) {
  return Number((((weightedRaw - 7) / 28) * 100).toFixed(1));
}

function meanIndex(weightedMean) {
  return Math.round((weightedMean - 1) * 25);
}

function addGroupedScore(groups, key, scoredValue, weight) {
  if (key === undefined || key === null || key === "") return;
  if (!groups.has(key)) groups.set(key, createAccumulator());
  addScore(groups.get(key), scoredValue, weight);
}

function summarizeGroups(groups) {
  return Object.fromEntries([...groups.entries()].map(([key, accumulator]) => [key, summarize(accumulator)]));
}

function addMechanismEvidence(groups, key, scoredValue) {
  if (key === undefined || key === null || key === "") return;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(scoredValue);
}

function summarizeMechanismEvidence(groups) {
  return Object.fromEntries([...groups.entries()].map(([key, scores]) => {
    const total = scores.reduce((sum, score) => sum + score, 0);
    return [key, { total, level: evidenceLevel(total), itemCount: scores.length }];
  }));
}

function validateAnswers(questions, answers) {
  if (!Array.isArray(questions) || !Array.isArray(answers)) {
    throw new TypeError("questions and answers must be arrays");
  }

  const questionById = new Map();
  for (const question of questions) {
    if (!question || question.id === undefined || question.id === "") {
      throw new Error("question is missing id");
    }
    if (questionById.has(question.id)) throw new Error(`duplicate question id: ${question.id}`);
    questionById.set(question.id, question);
  }

  const answerById = new Map();
  for (const answer of answers) {
    if (!answer || answer.questionId === undefined || !questionById.has(answer.questionId)) {
      throw new Error(`unknown answer: ${answer?.questionId ?? "<missing questionId>"}`);
    }
    if (answerById.has(answer.questionId)) throw new Error(`duplicate answer: ${answer.questionId}`);
    if (!Number.isInteger(answer.value) || answer.value < 1 || answer.value > 5) {
      throw new Error(`answer out of range: ${answer.questionId}`);
    }
    answerById.set(answer.questionId, answer);
  }

  for (const question of questions) {
    if (!answerById.has(question.id)) throw new Error(`missing answer: ${question.id}`);
  }

  return { questionById, answerById };
}

function scoreQuestion(question, answer) {
  const scoredValue = REVERSE_DIRECTIONS.has(question.direction) ? 6 - answer.value : answer.value;
  const weight = question.scenarioType === "life" ? 0.5 : 1;
  return { scoredValue, weight, weightedValue: scoredValue * weight };
}

export function scoreAssessment({ answers, questions }) {
  const { answerById } = validateAnswers(questions, answers);
  const preferenceGroups = new Map();
  const processGroups = new Map();
  const scienceGroups = new Map();
  const answerDetails = [];

  for (const question of questions) {
    const answer = answerById.get(question.id);
    const { scoredValue, weight, weightedValue } = scoreQuestion(question, answer);
    answerDetails.push({
      questionId: question.id,
      kind: question.kind,
      preference: question.preference,
      process: question.process,
      scenarioType: question.scenarioType,
      strategy: question.strategy,
      direction: question.direction,
      rawValue: answer.value,
      scoredValue,
      weight,
      weightedValue
    });

    if (question.kind === "science") {
      addGroupedScore(scienceGroups, question.strategy, scoredValue, 1);
      continue;
    }

    if (question.kind !== "preference") throw new Error(`unknown question kind: ${question.kind}`);

    if (!preferenceGroups.has(question.preference)) {
      preferenceGroups.set(question.preference, {
        global: createAccumulator(),
        academic: createAccumulator(),
        life: createAccumulator(),
        mechanisms: new Map()
      });
    }
    const preference = preferenceGroups.get(question.preference);
    addScore(preference.global, scoredValue, weight);
    if (question.scenarioType === "academic") addScore(preference.academic, scoredValue, weight);
    if (question.scenarioType === "life") addScore(preference.life, scoredValue, weight);
    addMechanismEvidence(preference.mechanisms, question.subdimension, scoredValue);
    addGroupedScore(processGroups, question.process, scoredValue, weight);
  }

  const preference = Object.fromEntries([...preferenceGroups.entries()].map(([key, groups]) => [key, {
    ...summarize(groups.global, preferenceIndex),
    academic: groups.academic.weightSum ? summarize(groups.academic) : undefined,
    life: groups.life.weightSum ? summarize(groups.life) : undefined,
    mechanisms: summarizeMechanismEvidence(groups.mechanisms)
  }]));
  for (const entry of Object.values(preference)) {
    if (entry.academic === undefined) delete entry.academic;
    if (entry.life === undefined) delete entry.life;
  }

  return {
    preference,
    process: summarizeGroups(processGroups),
    science: Object.fromEntries([...scienceGroups.entries()].map(([strategy, accumulator]) => {
      const scores = accumulator.scores;
      const total = accumulator.weightedSum;
      return [strategy, {
        total,
        level: evidenceLevel(total),
        lowItemCount: scores.filter((score) => score <= 2).length,
        itemCount: scores.length
      }];
    })),
    answerDetails
  };
}
