import bank from "./question-bank.json" with { type: "json" };

export function getCoreQuestions() {
  return bank.core;
}

export function getScienceQuestions() {
  return bank.science;
}

export function getCalibrationQuestions(pair) {
  return bank.calibration.filter((question) => question.pair === pair);
}
