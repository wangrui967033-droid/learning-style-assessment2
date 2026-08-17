const PREFERENCE_ORDER = ["V", "A", "R", "K"];
const PROCESS_ORDER = ["learning", "memory", "practice", "improve"];

function readIndex(value) {
  const index = typeof value === "object" && value !== null ? value.index : value;
  if (!Number.isFinite(index)) throw new TypeError("each preference index must be a finite number");
  return index;
}

function preferenceSource(scoreResult) {
  if (scoreResult?.preference && typeof scoreResult.preference === "object") return scoreResult.preference;
  if (scoreResult?.indices && typeof scoreResult.indices === "object") return scoreResult.indices;
  if (scoreResult && typeof scoreResult === "object") return scoreResult;
  throw new TypeError("score result must include preference indices");
}

function readIndices(source) {
  return Object.fromEntries(PREFERENCE_ORDER.map((preference) => [preference, readIndex(source[preference])]));
}

function rank(indices) {
  return PREFERENCE_ORDER.map((preference) => ({ preference, index: indices[preference] }))
    .sort((left, right) => right.index - left.index || PREFERENCE_ORDER.indexOf(left.preference) - PREFERENCE_ORDER.indexOf(right.preference));
}

function scenarioIndices(scoreResult, preference, scenario) {
  const direct = scoreResult?.[`${scenario}Indices`];
  if (direct) return readIndex(direct[preference]);
  return readIndex(scoreResult?.preference?.[preference]?.[scenario]);
}

function confidence(scoreResult) {
  const differences = PREFERENCE_ORDER.map((preference) => Math.abs(
    scenarioIndices(scoreResult, preference, "academic") - scenarioIndices(scoreResult, preference, "life")
  ));
  const meanAbsoluteDifference = differences.reduce((sum, difference) => sum + difference, 0) / differences.length;
  const level = meanAbsoluteDifference <= 10
    ? "stable"
    : meanAbsoluteDifference <= 20
      ? "context_sensitive"
      : "preliminary";
  return { level, meanAbsoluteDifference };
}

function processProfilesFromAnswers(answerDetails) {
  if (!Array.isArray(answerDetails)) return undefined;
  const groups = new Map();
  for (const answer of answerDetails) {
    if (answer?.kind !== "preference" || !PREFERENCE_ORDER.includes(answer.preference) || !answer.process) continue;
    const key = `${answer.process}:${answer.preference}`;
    const current = groups.get(key) ?? { weightedSum: 0, weightSum: 0 };
    current.weightedSum += answer.weightedValue;
    current.weightSum += answer.weight;
    groups.set(key, current);
  }

  const profiles = {};
  for (const process of PROCESS_ORDER) {
    const profile = {};
    for (const preference of PREFERENCE_ORDER) {
      const accumulator = groups.get(`${process}:${preference}`);
      if (!accumulator?.weightSum) continue;
      profile[preference] = Math.round(((accumulator.weightedSum / accumulator.weightSum) - 1) * 25);
    }
    if (Object.keys(profile).length) profiles[process] = profile;
  }
  return profiles;
}

function processProfiles(scoreResult) {
  const explicit = scoreResult?.processProfiles ?? scoreResult?.processPreference ?? scoreResult?.process;
  if (explicit && Object.values(explicit).some((profile) => PREFERENCE_ORDER.some((preference) => preference in profile))) {
    return explicit;
  }
  return processProfilesFromAnswers(scoreResult?.answerDetails) ?? {};
}

function clearProcessWinners(scoreResult) {
  const profiles = processProfiles(scoreResult);
  const processNames = PROCESS_ORDER.filter((process) => process in profiles);
  const winners = [];

  for (const process of processNames) {
    const profile = profiles[process];
    const available = PREFERENCE_ORDER.filter((preference) => profile?.[preference] !== undefined);
    if (available.length < 2) continue;
    const ordered = available.map((preference) => ({ preference, index: readIndex(profile[preference]) }))
      .sort((left, right) => right.index - left.index || PREFERENCE_ORDER.indexOf(left.preference) - PREFERENCE_ORDER.indexOf(right.preference));
    if (ordered[0].index - ordered[1].index >= 12) {
      winners.push({ process, preference: ordered[0].preference });
    }
  }

  return winners;
}

function dualResult(indices, calibrationResult) {
  const preferences = calibrationResult.preferences
    .slice()
    .sort((left, right) => PREFERENCE_ORDER.indexOf(left) - PREFERENCE_ORDER.indexOf(right));
  return { type: "dual", preferences, indices, confidence: calibrationResult.confidence };
}

export function classifyProfile(scoreResult, calibrationResult) {
  const indices = readIndices(preferenceSource(scoreResult));
  const profileConfidence = confidence(scoreResult);
  const ordered = rank(indices);
  const [first, second, third] = ordered;
  const processWinners = clearProcessWinners(scoreResult);

  if (calibrationResult?.type === "ordered") {
    const { primary, secondary } = calibrationResult;
    if (!PREFERENCE_ORDER.includes(primary) || !PREFERENCE_ORDER.includes(secondary) || primary === secondary) {
      throw new TypeError("ordered calibration must include two distinct known preferences");
    }
    return { type: "single_clear", primary, secondary, indices, confidence: profileConfidence };
  }

  if (calibrationResult?.type === "dual") {
    const result = dualResult(indices, calibrationResult);
    return { ...result, confidence: profileConfidence };
  }

  if (processWinners.length >= 2 && new Set(processWinners.map(({ preference }) => preference)).size >= 2) {
    return { type: "context_varying", processWinners, indices, confidence: profileConfidence };
  }

  const highPreferences = ordered.filter(({ index }) => index >= 60).map(({ preference }) => preference);
  if (highPreferences.length >= 3 && first.index - third.index <= 10) {
    return { type: "multi_channel", preferences: highPreferences, indices, confidence: profileConfidence };
  }

  if (first.index >= 60 && second.index >= 60 && first.index - second.index <= 10 && second.index - third.index >= 8) {
    return { type: "dual", preferences: [first.preference, second.preference], indices, confidence: profileConfidence };
  }

  if (first.index >= 65 && first.index - second.index >= 12) {
    return {
      type: "single_clear",
      primary: first.preference,
      secondary: second.preference,
      indices,
      confidence: profileConfidence
    };
  }

  const spread = first.index - ordered.at(-1).index;
  const mean = ordered.reduce((sum, entry) => sum + entry.index, 0) / ordered.length;
  if (first.index < 55 || (spread <= 8 && mean >= 40 && mean <= 60)) {
    return { type: "undifferentiated", indices, confidence: profileConfidence };
  }

  return { type: "undifferentiated", indices, confidence: profileConfidence };
}
