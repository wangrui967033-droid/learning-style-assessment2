const PREFERENCE_ORDER = ["V", "A", "R", "K"];

export const PROFILE_THRESHOLDS = Object.freeze({
  singleGap: 12,
  dualThirdGap: 8,
  mainAuxiliaryGap: 8,
  balancedSpread: 8
});

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

function singleResult(first, indices) {
  return {
    type: "single_clear",
    primary: first.preference,
    indices
  };
}

function dualCandidate(first, second, indices) {
  return {
    type: "dual_candidate",
    preferences: [first.preference, second.preference],
    indices
  };
}

function orderedDual(first, second, indices) {
  return {
    type: "dual",
    primary: first.preference,
    secondary: second.preference,
    preferences: [first.preference, second.preference],
    indices
  };
}

function multiChannel(ordered, indices, balanced) {
  return {
    type: "multi_channel",
    preferences: ordered.map(({ preference }) => preference),
    balanced,
    indices
  };
}

function applyConfirmation(indices, preferences, confirmationResult) {
  if (confirmationResult.type === "dual") {
    return {
      type: "dual",
      preferences: [...preferences],
      tally: { ...confirmationResult.tally },
      indices
    };
  }
  if (confirmationResult.type === "ordered") {
    return {
      type: "dual",
      preferences: [...preferences],
      suggestedStart: confirmationResult.primary,
      tally: { ...confirmationResult.tally },
      indices
    };
  }
  throw new TypeError("unknown confirmation result");
}

export function classifyProfile(scoreResult, confirmationResult) {
  const indices = readIndices(preferenceSource(scoreResult));
  const ordered = rank(indices);
  const [first, second, third] = ordered;
  const last = ordered.at(-1);

  if (first.index - second.index >= PROFILE_THRESHOLDS.singleGap) {
    return singleResult(first, indices);
  }

  if (second.index - third.index >= PROFILE_THRESHOLDS.dualThirdGap) {
    if (first.index - second.index >= PROFILE_THRESHOLDS.mainAuxiliaryGap) {
      return orderedDual(first, second, indices);
    }
    const candidate = dualCandidate(first, second, indices);
    return confirmationResult
      ? applyConfirmation(indices, candidate.preferences, confirmationResult)
      : candidate;
  }

  return multiChannel(
    ordered,
    indices,
    first.index - last.index < PROFILE_THRESHOLDS.balancedSpread
  );
}
