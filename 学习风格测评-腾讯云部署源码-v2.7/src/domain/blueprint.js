import { PREFERENCE_MODULES } from "./preference-modules.js";

const PREFERENCES = ["V", "A", "R", "K"];
const PROCESSES = ["learning", "memory", "practice", "improve"];
const FORMS = ["core", "reserve"];
const MECHANISMS = PREFERENCE_MODULES.map((module) => module.id);

const SUBDIMENSIONS = Object.fromEntries(
  PREFERENCES.map((preference) => [
    preference,
    PREFERENCE_MODULES.filter((module) => module.preference === preference).map((module) => module.id)
  ])
);
const STRATEGIES = [
  "active_recall",
  "spaced_repetition",
  "deliberate_practice",
  "timely_feedback",
  "metacognition"
];
const CALIBRATION_PAIRS = new Set(["V-A", "V-R", "V-K", "A-R", "A-K", "R-K"]);

function items(bank, name, errors) {
  if (!Array.isArray(bank?.[name])) {
    errors.push(`missing ${name} collection`);
    return [];
  }
  return bank[name];
}

function countBy(items, key, values) {
  return Object.fromEntries(values.map((value) => [value, items.filter((item) => item[key] === value).length]));
}

function requireFields(item, fields, label, errors) {
  for (const field of fields) {
    const value = item[field];
    if (value === undefined || value === null || value === "") errors.push(`${label} missing ${field}`);
  }
}

function validatePreferenceItems(items, form, errors, ids) {
  for (const item of items) {
    const label = `${form} ${item.id ?? "<missing id>"}`;
    requireFields(item, ["id", "kind", "form", "preference", "subdimension", "process", "scenarioType", "direction", "prompt", "scale"], label, errors);
    if (item.kind !== "preference") errors.push(`${label} has invalid kind`);
    if (item.form !== form) errors.push(`${label} has invalid form`);
    if (!PREFERENCES.includes(item.preference)) errors.push(`${label} has unknown preference`);
    if (!SUBDIMENSIONS[item.preference]?.includes(item.subdimension)) errors.push(`${label} has unknown subdimension`);
    if (!PROCESSES.includes(item.process)) errors.push(`${label} has unknown process`);
    if (!["academic", "life"].includes(item.scenarioType)) errors.push(`${label} has unknown scenario type`);
    if (!["positive", "reverse"].includes(item.direction)) errors.push(`${label} has invalid direction`);
    if (!Array.isArray(item.scale) || item.scale.join(",") !== "1,2,3,4,5") errors.push(`${label} has invalid scale`);
    if (item.id) {
      if (ids.has(item.id)) errors.push(`duplicate id ${item.id}`);
      ids.add(item.id);
    }
  }
}

function validateScienceItems(items, errors, ids) {
  for (const item of items) {
    const label = `science ${item.id ?? "<missing id>"}`;
    requireFields(item, ["id", "kind", "strategy", "direction", "prompt", "scale"], label, errors);
    if (item.kind !== "science") errors.push(`${label} has invalid kind`);
    if (!STRATEGIES.includes(item.strategy)) errors.push(`${label} has unknown strategy`);
    if (!["positive", "reverse"].includes(item.direction)) errors.push(`${label} has invalid direction`);
    if (!Array.isArray(item.scale) || item.scale.join(",") !== "1,2,3,4,5") errors.push(`${label} has invalid scale`);
    if (item.id) {
      if (ids.has(item.id)) errors.push(`duplicate id ${item.id}`);
      ids.add(item.id);
    }
  }
}

function validateCalibrationItems(items, errors) {
  for (const item of items) {
    const label = `calibration ${item.pair ?? "<missing pair>"}`;
    requireFields(item, ["pair", "process", "prompt", "options"], label, errors);
    if (!CALIBRATION_PAIRS.has(item.pair)) errors.push(`${label} has unknown pair`);
    if (!PROCESSES.includes(item.process)) errors.push(`${label} has unknown process`);
    if (!Array.isArray(item.options) || item.options.length !== 2) {
      errors.push(`${label} must have two options`);
      continue;
    }
    const expectedPreferences = item.pair?.split("-") ?? [];
    for (const option of item.options) {
      requireFields(option, ["preference", "text"], `${label} option`, errors);
      if (!expectedPreferences.includes(option.preference)) errors.push(`${label} option has invalid preference`);
    }
    if (new Set(item.options.map((option) => option.preference)).size !== 2) errors.push(`${label} repeats option preference`);
  }
}

function addExpectedCountError(errors, label, actual, expected) {
  if (actual !== expected) errors.push(`${label} count is ${actual}, expected ${expected}`);
}

export function validateBlueprint(bank) {
  const errors = [];
  const core = items(bank, "core", errors);
  const science = items(bank, "science", errors);
  const reserve = items(bank, "reserve", errors);
  const calibration = items(bank, "calibration", errors);
  const ids = new Set();
  validatePreferenceItems(core, "core", errors, ids);
  validatePreferenceItems(reserve, "reserve", errors, ids);
  validateScienceItems(science, errors, ids);
  validateCalibrationItems(calibration, errors);

  const counts = {
    core: core.length,
    coreAcademic: core.filter((item) => item.scenarioType === "academic").length,
    coreLife: core.filter((item) => item.scenarioType === "life").length,
    science: science.length,
    reserve: reserve.length,
    calibration: calibration.length
  };
  const preferenceCounts = countBy(core, "preference", PREFERENCES);
  const processCounts = countBy(core, "process", PROCESSES);
  const mechanismCounts = Object.fromEntries(FORMS.map((form) => [
    form,
    countBy(form === "core" ? core : reserve, "subdimension", MECHANISMS)
  ]));
  const reverseCore = core.filter((item) => item.direction === "reverse").length;
  const calibrationProcesses = Object.fromEntries(
    [...new Set(calibration.map((item) => item.pair).filter(Boolean))].map((pair) => [
      pair,
      calibration.filter((item) => item.pair === pair).map((item) => item.process)
    ])
  );

  addExpectedCountError(errors, "core", counts.core, 32);
  addExpectedCountError(errors, "core academic", counts.coreAcademic, 24);
  addExpectedCountError(errors, "core life", counts.coreLife, 8);
  addExpectedCountError(errors, "science", counts.science, 10);
  addExpectedCountError(errors, "reserve", counts.reserve, 32);
  addExpectedCountError(errors, "calibration", counts.calibration, 24);
  for (const preference of PREFERENCES) {
    if (preferenceCounts[preference] !== 8) errors.push(`core preference ${preference} has ${preferenceCounts[preference]} items, expected 8`);
  }
  for (const process of PROCESSES) {
    if (processCounts[process] !== 8) errors.push(`core process ${process} has ${processCounts[process]} items, expected 8`);
  }
  for (const form of FORMS) {
    for (const mechanism of MECHANISMS) {
      if (mechanismCounts[form][mechanism] !== 2) {
        errors.push(`${form} mechanism ${mechanism} has ${mechanismCounts[form][mechanism]} items, expected 2`);
      }
    }
  }
  if (reverseCore !== 8) errors.push(`reverse core count is ${reverseCore}, expected 8`);
  for (const [pair, processes] of Object.entries(calibrationProcesses)) {
    if (processes.length !== 4) errors.push(`calibration ${pair} has ${processes.length} items, expected 4`);
    for (const process of PROCESSES) {
      if (processes.filter((value) => value === process).length !== 1) errors.push(`calibration ${pair} repeats ${process}`);
    }
  }

  return { counts, preferenceCounts, processCounts, mechanismCounts, reverseCore, calibrationProcesses, errors };
}
