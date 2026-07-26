import bank from "./question-bank.json" with { type: "json" };

export function getCoreQuestions() {
  return bank.core;
}

export function getScienceQuestions() {
  return bank.science;
}

export function getReserveQuestions({ includeInactive = false } = {}) {
  return includeInactive ? bank.reserve : bank.reserve.filter((question) => question.active !== false);
}

export function getCalibrationQuestions(pair) {
  return bank.calibration.filter((question) => question.pair === pair);
}
