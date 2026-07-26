const PREFERENCE_ORDER = ["V", "A", "R", "K"];

function canonicalPair(preferences) {
  if (!Array.isArray(preferences) || preferences.length !== 2) throw new TypeError("pair must contain two preferences");
  const sorted = [...preferences].sort((left, right) => PREFERENCE_ORDER.indexOf(left) - PREFERENCE_ORDER.indexOf(right));
  if (!sorted.every((preference) => PREFERENCE_ORDER.includes(preference)) || sorted[0] === sorted[1]) {
    throw new TypeError("pair must contain two known preferences");
  }
  return sorted.join("-");
}

function readPair(answer) {
  if (typeof answer?.pair !== "string") throw new TypeError("each confirmation answer must include a pair");
  return canonicalPair(answer.pair.split("-"));
}

function pairFromAnswers(answers) {
  if (answers.some((answer) => answer?.pair !== undefined)) {
    const pair = readPair(answers[0]);
    if (answers.some((answer) => readPair(answer) !== pair)) {
      throw new TypeError("confirmation answers must use the same pair");
    }
    return pair;
  }

  const selections = [...new Set(answers.map((answer) => answer?.selected))];
  if (selections.length !== 2) throw new TypeError("unanimous confirmation answers must include a pair");
  return canonicalPair(selections);
}

export function needsConfirmation(profile) {
  return profile?.type === "dual_candidate";
}

export function selectConfirmationPair(profile) {
  return canonicalPair(profile?.preferences);
}

export function evaluateConfirmation(answers) {
  if (!Array.isArray(answers) || answers.length !== 4) {
    throw new TypeError("confirmation requires exactly four answers");
  }

  const pair = pairFromAnswers(answers);
  const preferences = pair.split("-");
  const tally = Object.fromEntries(preferences.map((preference) => [preference, 0]));
  for (const answer of answers) {
    if (!preferences.includes(answer.selected)) {
      throw new TypeError("selected preference must belong to the confirmation pair");
    }
    tally[answer.selected] += 1;
  }

  const [first, second] = preferences;
  if (tally[first] === tally[second]) {
    return { type: "dual", preferences, tally };
  }

  return tally[first] > tally[second]
    ? { type: "ordered", primary: first, secondary: second, tally }
    : { type: "ordered", primary: second, secondary: first, tally };
}
