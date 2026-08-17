const PREFERENCE_ORDER = ["V", "A", "R", "K"];

function readIndex(value) {
  const index = typeof value === "object" && value !== null ? value.index : value;
  if (!Number.isFinite(index)) throw new TypeError("each preference index must be a finite number");
  return index;
}

function rankIndices(indices) {
  if (!indices || typeof indices !== "object") throw new TypeError("indices must be an object");

  return PREFERENCE_ORDER.map((preference) => ({
    preference,
    index: readIndex(indices[preference])
  })).sort((left, right) => right.index - left.index || PREFERENCE_ORDER.indexOf(left.preference) - PREFERENCE_ORDER.indexOf(right.preference));
}

function canonicalPair(preferences) {
  if (!Array.isArray(preferences) || preferences.length !== 2) throw new TypeError("pair must contain two preferences");
  const sorted = [...preferences].sort((left, right) => PREFERENCE_ORDER.indexOf(left) - PREFERENCE_ORDER.indexOf(right));
  if (!sorted.every((preference) => PREFERENCE_ORDER.includes(preference)) || sorted[0] === sorted[1]) {
    throw new TypeError("pair must contain two known preferences");
  }
  return sorted.join("-");
}

function readPair(answer) {
  if (typeof answer?.pair !== "string") throw new TypeError("each calibration answer must include a pair");
  return canonicalPair(answer.pair.split("-"));
}

function pairFromAnswers(answers) {
  const includesPair = answers.some((answer) => answer?.pair !== undefined);
  if (includesPair) {
    const pair = readPair(answers[0]);
    if (answers.some((answer) => readPair(answer) !== pair)) {
      throw new TypeError("calibration answers must use the same pair");
    }
    return pair;
  }

  const selections = [...new Set(answers.map((answer) => answer?.selected))];
  if (selections.length !== 2) {
    throw new TypeError("unanimous calibration answers must include a pair");
  }
  return canonicalPair(selections);
}

export function needsCalibration(indices) {
  const [first, second] = rankIndices(indices);
  return first.index - second.index < 10;
}

export function selectCalibrationPair(indices) {
  return canonicalPair(rankIndices(indices).slice(0, 2).map(({ preference }) => preference));
}

export function evaluateCalibration(answers) {
  if (!Array.isArray(answers) || answers.length !== 4) {
    throw new TypeError("calibration requires exactly four answers");
  }

  const pair = pairFromAnswers(answers);

  const preferences = pair.split("-");
  const tally = Object.fromEntries(preferences.map((preference) => [preference, 0]));
  for (const answer of answers) {
    if (!preferences.includes(answer.selected)) {
      throw new TypeError("selected preference must belong to the calibration pair");
    }
    tally[answer.selected] += 1;
  }

  const [first, second] = preferences;
  if (tally[first] === tally[second]) {
    return { type: "dual", preferences, tally };
  }

  const primary = tally[first] > tally[second] ? first : second;
  const secondary = primary === first ? second : first;
  return { type: "ordered", primary, secondary, tally };
}
