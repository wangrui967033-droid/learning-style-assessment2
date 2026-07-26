import { drawRadar, RADAR_AXES } from "./radar.js";

const PREFERENCE_COLORS = Object.freeze({ V: "var(--teal)", A: "var(--coral)", R: "var(--green)", K: "var(--gold)" });
const SECTION_IDS = Object.freeze(["summary", "learningPattern", "strengths", "risks", "subjectPlan", "sevenDayAction"]);
const SUBJECT_PLAN_PROCESSES = new Set(["learning", "memory", "practice", "improve"]);
const CURRENT_SCHEMA_VERSION = "2.7.1";
const LEGACY_SECTION_IDS = Object.freeze(["recognition", "learningPattern", "strength", "risk", "subjectPlan", "actionCard"]);
const LEGACY_MISSING = Object.freeze({
  headline: "历史报告未保存画像结论",
  strategy: "可以先试什么",
  strategyReason: "历史报告未保存策略依据",
  strategyAction: "历史报告未保存具体做法",
  action: "历史报告未保存当前行动"
});
const STRATEGY_LEVEL_SEGMENTS = Object.freeze({
  "当前证据较少": 1,
  "在部分场景出现": 2,
  "表现较明显": 3
});

function collectStrings(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(collectStrings);
  return [];
}

export function reportCopyDomains(report) {
  return {
    learningPattern: collectStrings(report?.learningPattern),
    subjectPlan: collectStrings(report?.subjectPlan),
    sevenDayAction: collectStrings(report?.sevenDayAction)
  };
}

export function findCrossSectionDuplicates(domains) {
  const entries = Object.entries(domains);
  const duplicates = new Set();
  for (let left = 0; left < entries.length; left += 1) {
    for (let right = left + 1; right < entries.length; right += 1) {
      const rightValues = new Set(entries[right][1]);
      for (const value of entries[left][1]) if (value.length >= 8 && rightValues.has(value)) duplicates.add(value);
    }
  }
  return [...duplicates];
}

function element(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`缺少页面元素：${id}`);
  return node;
}

function text(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value ?? "";
  if (className) node.className = className;
  return node;
}

function setText(id, value, fallback = "--") {
  element(id).textContent = value || fallback;
}

function setOptionalText(id, value, fallback = "") {
  const node = document.getElementById(id);
  if (node) node.textContent = value || fallback;
}

function reportIdFromLocation() {
  return new URLSearchParams(window.location.search).get("id");
}

async function requestJson(url, options) {
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    headers: { "content-type": "application/json", ...options?.headers }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "请求失败");
  return payload;
}

export function numericScore(value) {
  const parsed = typeof value === "symbol" ? Number.NaN : Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function string(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function formatScore(value) {
  return Number.isInteger(value) ? String(value) : String(value);
}

function formatStrategyLabel(strategy) {
  const formal = string(strategy?.label);
  const plain = string(strategy?.studentLabel);
  if (!formal) return plain;
  return plain && plain !== formal ? `${formal}：${plain}` : formal;
}

function entryHeadlineExplanation(headline) {
  const textValue = string(headline);
  if (textValue.includes("双重入口")) {
    const labels = textValue.replace("双重入口", "").trim();
    return `${labels}是你本次作答中较常出现的学习入口。面对新内容时，可以先从其中一种开始，再用另一种方式检查自己是否理解。`;
  }
  if (textValue.includes("主入口")) {
    const labels = textValue.replace("主入口", "").replace("辅助入口", "和").trim();
    return `${labels}是你本次作答中较常出现的学习入口。你可以先用主要入口找到切入点，再用辅助入口把内容说清、写清或做出来。`;
  }
  if (textValue.includes("主要入口")) {
    const label = textValue.replace("主要入口", "").trim();
    return `${label}是你本次作答中较常出现的学习入口。面对新内容时，可以先用这种方式找到切入点，再通过练习确认自己是否掌握。`;
  }
  if (textValue.includes("多通道")) {
    return "几种学习入口在本次作答中比较接近，没有明显集中在一种方式上。你可以根据任务选择顺手的方式开始，再用独立完成来检查效果。";
  }
  return "这表示你本次作答中更常从这种方式开始学习，不是固定标签。";
}

function normalizeScoreContext(value) {
  const source = record(value);
  const score = Number(source.score);
  const fullScore = Number(source.fullScore);
  const available = Number.isFinite(score) && Number.isFinite(fullScore) && fullScore > 0;
  return {
    score: available ? score : null,
    fullScore: available ? fullScore : null,
    studentLabel: string(source.studentLabel),
    available
  };
}

function firstRecord(...values) {
  return values.find((value) => (
    value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0
  )) ?? {};
}

function hasOwnRecord(source, key) {
  return Object.hasOwn(source, key) && source[key] && typeof source[key] === "object" && !Array.isArray(source[key]);
}

function hasString(source, key) {
  return typeof source[key] === "string" && source[key].trim().length > 0;
}

function hasNonEmptyStrings(value) {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.trim().length > 0);
}

function hasInsightItems(value) {
  return Array.isArray(value) && value.length > 0 && value.every((item) => (
    (typeof item === "string" && item.trim().length > 0)
    || (item && typeof item === "object" && !Array.isArray(item) && hasStrings(item, ["title", "text"]))
  ));
}

function hasStrings(source, keys) {
  return keys.every((key) => hasString(source, key));
}

function incompleteReport() {
  throw new TypeError("报告数据不完整");
}

function validateVersionedReport(report) {
  if (report.schemaVersion !== CURRENT_SCHEMA_VERSION) incompleteReport();

  const overview = hasOwnRecord(report, "overview") ? report.overview : incompleteReport();
  for (const key of ["title", "englishTitle", "studentName", "grade", "targetSubject", "learningFocus", "assessmentDate", "profileHeadline"]) {
    if (!hasString(overview, key)) incompleteReport();
  }
  if (!hasOwnRecord(overview, "priorityStrategy") || !hasStrings(overview.priorityStrategy, ["id", "label", "definition", "studentLabel"])) {
    incompleteReport();
  }
  if (!hasOwnRecord(overview, "firstAction") || !hasStrings(overview.firstAction, ["subject", "action"])) {
    incompleteReport();
  }
  if (!Array.isArray(overview.radar) || overview.radar.length !== RADAR_AXES.length) incompleteReport();
  overview.radar.forEach((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) incompleteReport();
    if (entry.code !== RADAR_AXES[index].code || !hasString(entry, "label") || !Number.isFinite(entry.score)) incompleteReport();
  });

  if (!Array.isArray(report.sections) || report.sections.length !== SECTION_IDS.length) incompleteReport();
  if (report.sections.some((section, index) => section?.id !== SECTION_IDS[index])) incompleteReport();

  for (const key of ["oneSentence", "learningPattern", "strengths", "risks", "subjectPlan", "sevenDayAction"]) {
    if (!hasOwnRecord(report, key) || !hasString(report[key], "title")) incompleteReport();
  }
  if (!hasString(report.oneSentence, "text")) incompleteReport();

  if (!Array.isArray(report.learningPattern.entries) || report.learningPattern.entries.length === 0) incompleteReport();
  for (const entry of report.learningPattern.entries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) incompleteReport();
    if (!hasStrings(entry, ["code", "label", "role", "definition"])) incompleteReport();
    if (!Array.isArray(entry.mechanisms) || entry.mechanisms.length === 0) incompleteReport();
    for (const mechanism of entry.mechanisms) {
      if (!mechanism || typeof mechanism !== "object" || Array.isArray(mechanism)) incompleteReport();
      if (!hasStrings(mechanism, ["label", "level", "definition"]) || !hasNonEmptyStrings(mechanism.typicalBehaviors)) incompleteReport();
    }
  }
  if (!Array.isArray(report.learningPattern.allEntries) || report.learningPattern.allEntries.length !== RADAR_AXES.length) incompleteReport();
  report.learningPattern.allEntries.forEach((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) incompleteReport();
    if (entry.code !== RADAR_AXES[index].code
      || !Number.isFinite(entry.score)
      || !hasStrings(entry, ["label", "role", "definition", "interpretation"])) incompleteReport();
    if (!Array.isArray(entry.mechanisms) || entry.mechanisms.length !== 4) incompleteReport();
    entry.mechanisms.forEach((mechanism) => {
      if (!mechanism || typeof mechanism !== "object" || Array.isArray(mechanism)) incompleteReport();
      if (!hasStrings(mechanism, ["label", "level", "definition"]) || !hasNonEmptyStrings(mechanism.typicalBehaviors)) incompleteReport();
    });
  });
  if (!hasInsightItems(report.strengths.items) || !hasNonEmptyStrings(report.risks.items)) incompleteReport();

  if (!hasOwnRecord(report.risks, "priorityStrategy")) incompleteReport();
  for (const key of ["id", "label", "definition", "studentLabel", "level", "reason", "action"]) {
    if (!hasString(report.risks.priorityStrategy, key)) incompleteReport();
  }
  if (overview.priorityStrategy.id !== report.risks.priorityStrategy.id
    || overview.priorityStrategy.label !== report.risks.priorityStrategy.label) incompleteReport();

  if (!hasOwnRecord(report.subjectPlan, "priorityStrategy")) incompleteReport();
  for (const key of ["id", "label", "action"]) {
    if (!hasString(report.subjectPlan.priorityStrategy, key)) incompleteReport();
  }
  if (report.subjectPlan.priorityStrategy.id !== report.risks.priorityStrategy.id
    || report.subjectPlan.priorityStrategy.label !== report.risks.priorityStrategy.label
    || report.subjectPlan.priorityStrategy.action !== report.risks.priorityStrategy.action) incompleteReport();
  if (!hasOwnRecord(report.subjectPlan, "strategyPractice")
    || !hasStrings(report.subjectPlan.strategyPractice, ["label", "action"])) incompleteReport();
  if (!hasStrings(report.subjectPlan, ["subject", "executionGuide", "example"]) || report.subjectPlan.subject !== overview.targetSubject) incompleteReport();
  if (!hasOwnRecord(report.subjectPlan, "focus") || !hasStrings(report.subjectPlan.focus, ["code", "label"])) incompleteReport();
  if (!SUBJECT_PLAN_PROCESSES.has(report.subjectPlan.focus.code) || report.subjectPlan.focus.label !== overview.learningFocus) incompleteReport();
  if (!Array.isArray(report.subjectPlan.scenes) || report.subjectPlan.scenes.length !== 1) incompleteReport();
  report.subjectPlan.scenes.forEach((scene) => {
    if (!scene || typeof scene !== "object" || Array.isArray(scene)) incompleteReport();
    if (scene.process !== report.subjectPlan.focus.code) incompleteReport();
    if (!hasStrings(scene, ["label", "material", "action", "evidence", "successCriterion"])) incompleteReport();
  });
  const expectedFirstAction = hasString(report.subjectPlan, "firstAction")
    ? report.subjectPlan.firstAction
    : report.subjectPlan.scenes[0].action;
  if (overview.firstAction.subject !== report.subjectPlan.subject
    || overview.firstAction.action !== expectedFirstAction) incompleteReport();

  const usesStages = Array.isArray(report.sevenDayAction.stages);
  if (usesStages) {
    if (!hasStrings(report.learningPattern, ["connection"])) incompleteReport();
    if (!hasStrings(report.risks, ["headline", "explanation"])) incompleteReport();
    if (!hasStrings(report.risks.priorityStrategy, ["whyFirst", "thisWeek", "successCriterion"])) incompleteReport();
    if (!hasStrings(report.subjectPlan, ["whyFirst", "firstAction", "support", "successCriterion"])) incompleteReport();
    if (!hasNonEmptyStrings(report.subjectPlan.steps) || report.subjectPlan.steps.length !== 3) incompleteReport();
    if (report.sevenDayAction.stages.length !== 3) incompleteReport();
    const stageIds = ["baseline", "trial", "retest"];
    report.sevenDayAction.stages.forEach((stage, index) => {
      if (!stage || typeof stage !== "object" || Array.isArray(stage) || stage.id !== stageIds[index]) incompleteReport();
      if (!hasStrings(stage, ["title", "action", "evidence", "support", "successCriterion"])) incompleteReport();
    });
  } else {
    if (!Array.isArray(report.sevenDayAction.days) || report.sevenDayAction.days.length !== 7) incompleteReport();
    report.sevenDayAction.days.forEach((day, index) => {
      if (!day || typeof day !== "object" || Array.isArray(day) || day.day !== index + 1) incompleteReport();
      if (!hasStrings(day, ["title", "action", "evidence", "support", "successCriterion"])) incompleteReport();
    });
  }
}

function isKnownLegacyStudentReport(report) {
  const hasTopLevelShape = hasOwnRecord(report, "overview")
    && ["oneSentence", "learningPattern", "strengths", "risks", "subjectPlan", "sevenDayAction"]
      .every((key) => hasOwnRecord(report, key));
  const legacySections = record(report.sections);
  const hasNestedSectionsShape = LEGACY_SECTION_IDS.every((key) => hasOwnRecord(legacySections, key));
  const hasHistoricalRootShape = Array.isArray(report.sections)
    && Array.isArray(report.preferenceExplanations)
    && [
      "overview", "judgment", "profile", "scienceEvidence", "strengths", "risks",
      "subjectApplication", "nextStep", "coachSupport"
    ].every((key) => hasOwnRecord(report, key));
  return hasTopLevelShape || hasNestedSectionsShape || hasHistoricalRootShape;
}

function normalizePriority(value) {
  const source = record(value);
  return {
    id: string(source.id),
    label: string(source.label, LEGACY_MISSING.strategy),
    definition: string(source.definition, string(source.action ?? source.actionImplication, LEGACY_MISSING.strategyAction)),
    studentLabel: string(source.studentLabel, string(source.label, LEGACY_MISSING.strategy)),
    level: string(source.level),
    reason: string(source.reason ?? source.explanation, LEGACY_MISSING.strategyReason),
    action: string(source.action ?? source.actionImplication, LEGACY_MISSING.strategyAction),
    whyFirst: string(source.whyFirst ?? source.reason ?? source.explanation, LEGACY_MISSING.strategyReason),
    thisWeek: string(source.thisWeek ?? source.action ?? source.actionImplication, LEGACY_MISSING.strategyAction),
    successCriterion: string(source.successCriterion ?? source.check, "用完成结果判断这个做法是否有效。")
  };
}

function normalizeStrategyProgress(value, priorityStrategy) {
  return array(value).map((rawStrategy) => {
    const strategy = record(rawStrategy);
    return {
      id: string(strategy.id),
      label: string(strategy.label, "学习方法"),
      total: Number.isFinite(Number(strategy.total)) ? Number(strategy.total) : null,
      level: string(strategy.level, "在部分场景出现"),
      isPriority: Boolean(strategy.isPriority) || string(strategy.id) === priorityStrategy.id
    };
  });
}

function normalizeRadar(report, overview) {
  const entries = array(overview.radar).length ? array(overview.radar) : array(report.radar);
  const indices = firstRecord(overview.indices, report.indices, report.preferenceIndices);
  return RADAR_AXES.map(({ code, label }) => {
    const entry = record(entries.find((candidate) => candidate?.code === code));
    const rawScore = Object.hasOwn(entry, "score") ? entry.score : indices[code];
    return {
      code,
      label: string(entry.label, label),
      score: numericScore(rawScore),
      available: rawScore !== undefined && rawScore !== null && rawScore !== ""
    };
  });
}

function normalizeLearningPattern(value) {
  const source = record(value);
  const entries = Array.isArray(value) ? value : source.entries ?? source.preferences ?? source.items;
  const normalizeEntry = (rawEntry) => {
    const entry = record(rawEntry);
    return {
      code: string(entry.code),
      label: string(entry.label, "未命名入口"),
      role: string(entry.role),
      score: numericScore(entry.score),
      definition: string(entry.definition),
      interpretation: string(entry.interpretation),
      mechanisms: array(entry.mechanisms ?? entry.mechanismEvidence).map((rawMechanism) => {
        const mechanism = record(rawMechanism);
        return {
          label: string(mechanism.label, "学习方式"),
          level: string(mechanism.level),
          definition: string(mechanism.definition),
          typicalBehaviors: array(mechanism.typicalBehaviors).filter((item) => typeof item === "string"),
          sceneExample: string(mechanism.sceneExample)
        };
      })
    };
  };
  return {
    title: string(source.title),
    intro: string(source.intro),
    connection: string(source.connection),
    entries: array(entries).map(normalizeEntry),
    allEntries: array(source.allEntries).map(normalizeEntry)
  };
}

function normalizeInsightItems(value) {
  return array(value).map((rawItem, index) => {
    if (typeof rawItem === "string") return { title: `你已经拥有的学习条件 ${index + 1}`, text: rawItem, example: "" };
    const item = record(rawItem);
    return { title: string(item.title, `学习优势 ${index + 1}`), text: string(item.text), example: string(item.example) };
  }).filter((item) => item.text);
}

function normalizeScenes(value, fallback = {}) {
  const source = record(value);
  const fallbackSource = record(fallback);
  const rawScenes = source.scenes
    ?? source.actions
    ?? (hasOwnRecord(fallbackSource, "priorityAction") ? [fallbackSource.priorityAction] : []);
  return array(rawScenes).map((rawScene) => {
    const scene = record(rawScene);
    return {
      label: string(scene.label, "历史行动"),
      material: string(scene.material ?? scene.scene),
      action: string(scene.action ?? scene.task),
      evidence: string(scene.evidence ?? scene.output ?? scene.independentOutput),
      successCriterion: string(scene.successCriterion ?? scene.check ?? scene.completionCriterion)
    };
  });
}

function normalizeDays(value) {
  const source = record(value);
  return array(source.days ?? source.sevenDayPlan).map((rawDay, index) => {
    const day = record(rawDay);
    return {
      day: Number.isInteger(day.day) ? day.day : index + 1,
      title: string(day.title, `第${index + 1}天`),
      action: string(day.action ?? day.task),
      evidence: string(day.evidence ?? day.output),
      support: string(day.support),
      successCriterion: string(day.successCriterion ?? day.check)
    };
  });
}

function stageFromDay(rawDay, id, title) {
  const day = record(rawDay);
  const periodById = { baseline: "第1天", trial: "第2—5天", retest: "第6—7天" };
  return {
    id,
    period: string(day.period, periodById[id]),
    title: string(day.title, title),
    strategy: string(day.strategy),
    action: string(day.action ?? day.task, LEGACY_MISSING.action),
    evidence: string(day.evidence ?? day.output, "保留一份可以前后比较的学习产出。"),
    support: string(day.support, "老师或教练只提供必要提示，并帮助核对产出。"),
    successCriterion: string(day.successCriterion ?? day.check, "能够比较前后完成结果，判断是否比原来更有效。")
  };
}

function normalizeWeekPlan(value) {
  const source = record(value);
  const rawStages = array(source.stages);
  const days = normalizeDays(source);
  const stages = rawStages.length === 3
    ? rawStages.map((rawStage, index) => stageFromDay(rawStage, ["baseline", "trial", "retest"][index], ["先按平时做一遍", "按新方式试几次", "换一组内容再做一遍"][index]))
    : [
      stageFromDay(days[0], "baseline", "先看原来的状态"),
      stageFromDay(days[1] ?? days[0], "trial", "试用新的学习方式"),
      stageFromDay(days.at(-1), "retest", "先不看提示再试一次")
    ];
  const defaultComparison = [
    { id: "independence", label: "自己开始", question: "不看提示时，能不能自己找到第一步？" },
    { id: "accuracy", label: "准确性", question: "与原来相比，关键错误是否减少？" },
    { id: "explanation", label: "解释能力", question: "能否用自己的话说明为什么这样做？" },
    { id: "transfer", label: "换题应用", question: "条件变化时，能否判断哪些做法需要调整？" }
  ];
  const comparison = array(source.comparison).length === 4
    ? source.comparison.map((rawItem, index) => {
      const item = record(rawItem);
      return {
        id: string(item.id, defaultComparison[index].id),
        label: string(item.label, defaultComparison[index].label),
        question: string(item.question, defaultComparison[index].question)
      };
    })
    : defaultComparison;
  const decisionSource = record(source.decision);
  return {
    title: string(source.title),
    intro: string(source.intro),
    stages,
    comparison,
    decision: {
      options: hasNonEmptyStrings(decisionSource.options) ? decisionSource.options : ["保留", "调整", "更换"],
      nextAction: string(decisionSource.nextAction, "根据前后产出选择保留、调整或更换；下一轮只改变一个步骤。")
    }
  };
}

export function normalizeStudentReport(value, publicView = {}) {
  const report = record(value);
  const versioned = Object.hasOwn(report, "schemaVersion");
  if (versioned) validateVersionedReport(report);
  else if (!isKnownLegacyStudentReport(report)) incompleteReport();
  const overviewSource = record(report.overview);
  const legacySections = record(report.sections);
  const oneSentenceSource = firstRecord(
    report.oneSentence,
    report.summary,
    report.judgment,
    legacySections.oneSentence,
    legacySections.summary,
    legacySections.recognition
  );
  const learningPatternSource = firstRecord(report.learningPattern, legacySections.learningPattern);
  const strengthsSource = firstRecord(report.strengths, report.strength, legacySections.strengths, legacySections.strength);
  const risksSource = firstRecord(report.risks, report.risk, legacySections.risks, legacySections.risk);
  const subjectPlanSource = firstRecord(report.subjectPlan, report.subjectApplication, legacySections.subjectPlan);
  const nextStepSource = record(report.nextStep);
  const sevenDaySource = firstRecord(
    report.sevenDayAction,
    report.actionCard,
    nextStepSource,
    legacySections.sevenDayAction,
    legacySections.actionCard
  );
  const scenes = normalizeScenes(subjectPlanSource, nextStepSource);
  const priorityBase = firstRecord(
    risksSource.priorityStrategy,
    subjectPlanSource.priorityStrategy,
    oneSentenceSource.priorityStrategy,
    record(report.scienceEvidence).priorityStrategy,
    overviewSource.priorityScience
  );
  const priorityOverview = record(overviewSource.priorityStrategy);
  const priorityStrategy = normalizePriority({
    ...priorityBase,
    id: string(priorityOverview.id, priorityBase.id),
    label: string(priorityOverview.label, priorityBase.label),
    definition: string(priorityOverview.definition, priorityBase.definition),
    studentLabel: string(priorityOverview.studentLabel, priorityBase.studentLabel)
  });
  const firstActionSource = firstRecord(overviewSource.firstAction, scenes[0]);
  const firstAction = {
    subject: string(firstActionSource.subject, string(subjectPlanSource.subject, string(overviewSource.targetSubject))),
    action: string(firstActionSource.action, LEGACY_MISSING.action)
  };
  const oneSentence = {
    title: string(oneSentenceSource.title),
    text: string(oneSentenceSource.text ?? oneSentenceSource.content, LEGACY_MISSING.headline)
  };
  const learningPattern = normalizeLearningPattern(
    Array.isArray(report.preferenceExplanations) ? report.preferenceExplanations : learningPatternSource
  );
  if (!learningPattern.intro) learningPattern.intro = string(record(report.profile).text);
  const scoreContext = normalizeScoreContext(overviewSource.scoreContext);
  const taskUnitSource = record(subjectPlanSource.taskUnit);
  const planSubject = string(subjectPlanSource.subject, string(overviewSource.targetSubject, string(report.targetSubject)));
  const taskTitle = string(subjectPlanSource.taskTitle, string(taskUnitSource.title, `${planSubject || "目标学科"}学习任务`));
  const sourceSteps = hasNonEmptyStrings(subjectPlanSource.practiceRounds)
    ? subjectPlanSource.practiceRounds
    : hasNonEmptyStrings(subjectPlanSource.steps)
      ? subjectPlanSource.steps
      : [scenes[0]?.material, scenes[0]?.action, scenes[0]?.evidence].filter(Boolean);
  const fallbackSteps = [
    `先独立完成一次${taskTitle}`,
    "对照结果，标出最先卡住的地方",
    "隔开一段时间，再完成一次比较变化"
  ];
  const taskActions = sourceSteps.slice(0, 3);
  while (taskActions.length < 3) taskActions.push(fallbackSteps[taskActions.length]);
  const entryStartSource = record(subjectPlanSource.entryStart);
  const strategyPracticeSource = record(subjectPlanSource.strategyPractice);
  const adapterSource = record(subjectPlanSource.executionAdapter);
  const adapterMechanisms = array(adapterSource.mechanisms)
    .map((mechanism) => string(record(mechanism).label))
    .filter(Boolean);

  return {
    ...(versioned ? { schemaVersion: report.schemaVersion } : {}),
    sections: SECTION_IDS.map((id) => ({ id })),
    overview: {
      title: string(overviewSource.title, "学习方式测评与行动报告"),
      englishTitle: string(overviewSource.englishTitle, "LEARNING ACTION REPORT"),
      studentName: string(overviewSource.studentName, string(report.studentName, string(publicView.studentName))),
      maskedPhone: string(publicView.maskedPhone),
      grade: string(overviewSource.grade, string(report.grade)),
      targetSubject: string(overviewSource.targetSubject, string(subjectPlanSource.subject, string(report.targetSubject))),
      learningFocus: string(overviewSource.learningFocus, string(record(subjectPlanSource.focus).label, "当前重点")),
      scoreContext,
      assessmentDate: string(overviewSource.assessmentDate, string(report.assessmentDate)),
      profileHeadline: string(overviewSource.profileHeadline, oneSentence.text),
      supportPath: string(overviewSource.supportPath, "先找到更容易开始的方式，再用有效方法练习，最后通过真实任务检查是否掌握。"),
      priorityStrategy,
      strategyProgress: normalizeStrategyProgress(overviewSource.strategyProgress, priorityStrategy),
      firstAction,
      radar: normalizeRadar(report, overviewSource)
    },
    oneSentence,
    learningPattern,
    strengths: {
      title: string(strengthsSource.title),
      items: normalizeInsightItems(strengthsSource.items),
      boundary: string(strengthsSource.boundary, "学习入口能帮你开始和理解，但最后还是要自己做一遍、写一遍或说一遍。")
    },
    risks: {
      title: string(risksSource.title),
      items: array(risksSource.items).filter((item) => typeof item === "string"),
      headline: string(risksSource.headline, array(risksSource.items).find((item) => typeof item === "string")),
      explanation: string(risksSource.explanation, "入口能帮助你开始，但真正掌握仍要通过独立输出、检查和修正来验证。"),
      sceneExample: string(risksSource.sceneExample),
      priorityStrategy
    },
    subjectPlan: {
      title: string(subjectPlanSource.title),
      subject: planSubject,
      focus: {
        code: string(record(subjectPlanSource.focus).code),
        label: string(record(subjectPlanSource.focus).label)
      },
      executionGuide: string(subjectPlanSource.executionGuide ?? subjectPlanSource.recommendationLogic ?? subjectPlanSource.context),
      priorityStrategy,
      scenes,
      taskUnit: {
        id: string(taskUnitSource.id),
        examSystemLabel: string(taskUnitSource.examSystemLabel, string(taskUnitSource.examSystem)),
        title: string(taskUnitSource.title),
        taskLabel: string(taskUnitSource.taskLabel),
        sourceGuide: string(taskUnitSource.sourceGuide),
        knowledgeTarget: record(taskUnitSource.knowledgeTarget)
      },
      examSystem: string(subjectPlanSource.examSystem, string(taskUnitSource.examSystemLabel, string(taskUnitSource.examSystem))),
      taskTitle,
      knowledgeTargetLabel: string(subjectPlanSource.knowledgeTargetLabel, string(record(taskUnitSource.knowledgeTarget).studentLabel)),
      problem: string(subjectPlanSource.problem, "这周能不能用新方法完成一项真实学习任务？"),
      whyTask: string(subjectPlanSource.whyTask, "先用更容易开始的方式进入，再收起提示自己完成，看看这次是不是真的学会。"),
      smartGoal: string(subjectPlanSource.smartGoal, `本周目标：围绕${taskTitle}，第1次按平时的方法；第2、4、5天按新方法；第6—7天再试一次。`),
      example: string(subjectPlanSource.example),
      entryStart: {
        label: string(entryStartSource.label, adapterMechanisms.join("＋"), "按当前方式开始"),
        action: string(entryStartSource.action, subjectPlanSource.firstAction, scenes[0]?.action ?? LEGACY_MISSING.action)
      },
      strategyPractice: {
        label: string(strategyPracticeSource.label, formatStrategyLabel(priorityStrategy)),
        action: string(strategyPracticeSource.action, priorityStrategy.action, LEGACY_MISSING.strategyAction)
      },
      taskLabel: string(taskUnitSource.taskLabel, string(subjectPlanSource.material, string(subjectPlanSource.weeklyAction, `完成${taskTitle}`))),
      taskSource: string(subjectPlanSource.sourceGuide, string(taskUnitSource.sourceGuide, "从老师提供的同类练习中选题。")),
      matchExplanation: string(
        subjectPlanSource.matchExplanation,
        `本次按“${string(record(subjectPlanSource.focus).label, string(overviewSource.learningFocus, "当前重点"))}”生成，并结合当前学习入口调整做法。`
      ),
      taskActions,
      whyFirst: string(subjectPlanSource.whyFirst, `当前先围绕${string(subjectPlanSource.subject, "目标学科")}完成一项可检查的任务。`),
      weeklyAction: string(subjectPlanSource.weeklyAction, subjectPlanSource.firstAction, scenes[0]?.action ?? LEGACY_MISSING.action),
      material: string(subjectPlanSource.material, scenes[0]?.material ?? "从本周学习材料中选一项真实任务。"),
      walkthrough: string(subjectPlanSource.walkthrough, `拿到任务后，先${string(subjectPlanSource.firstAction, scenes[0]?.action ?? LEGACY_MISSING.action)}；完成后先不看提示再检查。`),
      firstAction: string(subjectPlanSource.firstAction, scenes[0]?.action ?? LEGACY_MISSING.action),
      auxiliaryCheck: string(subjectPlanSource.auxiliaryCheck, "完成后先不看提示，检查自己能否独立完成。"),
      practiceRounds: taskActions,
      steps: taskActions,
      evidence: string(subjectPlanSource.evidence, scenes[0]?.evidence ?? "保留一份可以检查的学习产出。"),
      support: string(subjectPlanSource.support, "老师或教练只提供必要提示，学生先独立完成再核对。"),
      successCriterion: string(subjectPlanSource.successCriterion, scenes[0]?.successCriterion ?? "用一份可检查产出判断是否有效。")
    },
    sevenDayAction: normalizeWeekPlan(sevenDaySource)
  };
}

function renderOverview(overview) {
  setText("studentName", overview.studentName);
  setText("maskedPhone", overview.maskedPhone);
  setText("grade", overview.grade);
  setText("targetSubject", overview.targetSubject);
  setText("learningFocus", overview.learningFocus);
  setText("assessmentDate", overview.assessmentDate);
  setText("overviewHeadline", overview.profileHeadline, "");
  setOptionalText("overviewEntryExplanation", entryHeadlineExplanation(overview.profileHeadline), "");
  setText("overviewPriorityStrategy", formatStrategyLabel(overview.priorityStrategy), "");
  setText("overviewFirstAction", overview.firstAction.action, "");
  renderStrategyProgress(overview.strategyProgress);
  const scoreCard = element("scoreContextCard");
  scoreCard.hidden = !overview.scoreContext.available;
  if (overview.scoreContext.available) {
    setText("scoreContextLabel", `你填的最近${overview.targetSubject}成绩`, "你填的最近成绩");
    setText("targetSubjectScore", `${formatScore(overview.scoreContext.score)} / ${formatScore(overview.scoreContext.fullScore)}`, "");
    setText("taskLevelLabel", `建议先从${overview.scoreContext.studentLabel.replace(/^先/, "")}开始`, "");
  }

  const scores = Object.fromEntries(overview.radar.map(({ code, score }) => [code, numericScore(score)]));
  const canvas = element("preferenceRadar");
  canvas.setAttribute("aria-description", overview.radar.map(({ label, score, available }) => (
    available ? `${label}${Math.round(numericScore(score))}/100` : `${label}未保存`
  )).join("，"));

  element("preferenceIndices").replaceChildren(...overview.radar.map(({ code, label, score, available }) => {
    const normalizedScore = numericScore(score);
    const row = document.createElement("div");
    row.className = "index-row";
    const track = text("span", "", "index-track");
    const fill = text("span", "", "index-fill");
    fill.style.width = `${normalizedScore}%`;
    fill.style.background = PREFERENCE_COLORS[code] ?? PREFERENCE_COLORS.V;
    track.append(fill);
    row.append(
      text("span", `${label}入口`, "index-label"),
      track,
      text("strong", available ? `${Math.round(normalizedScore)}/100` : "--/100", "index-value")
    );
    return row;
  }));
  return { canvas, scores };
}

function renderStrategyProgress(strategies) {
  const container = element("strategyProgress");
  if (!strategies.length) {
    container.replaceChildren(text("p", "本次未保存学习策略的具体表现。", "strategy-progress-empty"));
    return;
  }
  container.replaceChildren(...strategies.map((strategy) => {
    const row = text("div", "", `strategy-progress-row${strategy.isPriority ? " is-priority" : ""}`);
    const meter = text("span", "", "strategy-meter");
    const segments = STRATEGY_LEVEL_SEGMENTS[strategy.level] ?? 2;
    for (let index = 1; index <= 3; index += 1) {
      const segment = text("i", "", index <= segments ? "is-filled" : "");
      meter.append(segment);
    }
    row.append(
      text("strong", strategy.label),
      meter,
      text("span", strategy.isPriority ? "本周先练" : strategy.level, "strategy-status")
    );
    return row;
  }));
}

function renderLearningPattern(section) {
  setText("learningPatternIntro", section.intro, "");
  setText("learningPatternConnection", section.connection, "");
  const container = element("learningPatternEntries");
  if (!section.entries.length) {
    container.replaceChildren(text("p", "本次没有需要单独命名的主辅入口，可以结合实际学习继续观察。", "empty-report-copy"));
    return;
  }
  container.replaceChildren(...section.entries.map((entry) => {
    const article = document.createElement("article");
    article.className = entry.code ? `preference-card preference-${entry.code.toLowerCase()}` : "preference-card";
    const heading = text("div", "", "card-heading");
    heading.append(text("h3", `${entry.label}入口`), text("span", entry.role, "score-pill"));
    const grid = text("div", "", "mechanism-grid");
    for (const mechanism of entry.mechanisms) {
      const card = text("div", "", "mechanism-card");
      const top = text("div", "", "mechanism-heading");
      top.append(text("strong", mechanism.label), text("span", mechanism.level, "evidence-level"));
      const list = text("ul", "", "compact-list");
      list.append(...mechanism.typicalBehaviors.map((behavior) => text("li", behavior)));
      card.append(top, list);
      if (mechanism.sceneExample) card.append(text("p", mechanism.sceneExample, "mechanism-example"));
      grid.append(card);
    }
    article.append(heading, grid);
    return article;
  }));
}

function renderDimensionDetails(entries) {
  const container = document.getElementById("dimensionDetails");
  if (!container || !entries.length) return;
  container.replaceChildren(...entries.map((entry) => {
    const card = document.createElement("article");
    card.className = `dimension-card preference-${entry.code.toLowerCase()}`;
    const header = text("div", "", "dimension-heading");
    header.append(
      text("h3", `${entry.label}入口`),
      text("span", `${Math.round(numericScore(entry.score))}/100`, "dimension-score")
    );
    card.append(header, text("p", entry.definition, "dimension-definition"), text("p", entry.interpretation, "dimension-interpretation"));
    return card;
  }));
}

function renderMechanismDetails(entries) {
  const container = document.getElementById("mechanismDetailGroups");
  if (!container || !entries.length) return;
  container.replaceChildren(...entries.map((entry) => {
    const group = document.createElement("section");
    group.className = `mechanism-detail-group preference-${entry.code.toLowerCase()}`;
    const heading = text("div", "", "mechanism-detail-heading");
    heading.append(text("h3", `${entry.label}｜${Math.round(numericScore(entry.score))}/100`), text("p", entry.interpretation));
    const list = text("div", "", "mechanism-detail-list");
    list.append(...entry.mechanisms.map((mechanism) => {
      const item = text("article", "", "mechanism-detail-item");
      const top = text("div", "", "mechanism-detail-top");
      const levelClass = {
        "表现较明显": "evidence-high",
        "在部分场景出现": "evidence-medium",
        "当前证据较少": "evidence-low"
      }[mechanism.level] ?? "";
      top.append(text("strong", mechanism.label), text("span", mechanism.level, `evidence-level ${levelClass}`));
      item.append(
        top,
        text("p", mechanism.definition, "mechanism-detail-copy")
      );
      return item;
    }));
    group.append(heading, list);
    return group;
  }));
}

function renderStrengths(section) {
  element("strengthItems").replaceChildren(...section.items.map((item) => {
    const card = text("article", "", "strength-card");
    card.append(text("h3", item.title), text("p", item.text));
    if (item.example) card.append(text("p", item.example, "strength-example"));
    return card;
  }));
  setText("strengthBoundary", section.boundary, "");
}

function renderRisks(section) {
  setText("riskHeadline", section.headline, "");
  setText("riskExplanation", section.explanation, "");
  setText("riskSceneExample", section.sceneExample, "");
  setText("priorityStrategyFormal", formatStrategyLabel(section.priorityStrategy), "");
  setText("priorityStrategyDefinition", section.priorityStrategy.definition, "");
  setText("priorityStrategyWhy", section.priorityStrategy.whyFirst, "");
}

function renderSubjectPlan(section) {
  setText("taskExamSystem", section.focus.label ? `${section.subject}｜${section.focus.label}` : section.subject, "");
  setText("subjectProblem", section.problem, "");
  setText("subjectSmartTarget", section.taskLabel, "");
  setText("subjectSmartMeasure", "照新方式练 3 次", "");
  setText("subjectSmartTime", "本周内；隔一天后再试一次", "");
  setText("subjectTryMethod", `${section.entryStart.label} + ${section.strategyPractice.label}`, "");
  setText("subjectTryMethodAction", `${section.entryStart.action}；${section.strategyPractice.action}`, "");
  setText("subjectTaskExample", section.example, "");
  setText("subjectFirstStep", section.taskActions[0], "");
  setText("subjectPracticeStep", section.taskActions[1], "");
  setText("subjectCheckStep", section.taskActions[2], "");
}

function renderOneWeek(section) {
  setText("sevenDayIntro", section.intro, "");
  element("weekStages").replaceChildren(...section.stages.map((stage, index) => {
    const item = document.createElement("article");
    item.className = "week-stage";
    const heading = text("div", "", "stage-heading");
    heading.append(text("span", stage.period || `阶段 ${index + 1}`, "stage-number"), text("h3", stage.title));
    item.append(heading, text("p", stage.action, "stage-action"));
    return item;
  }));
}

function renderReport(report) {
  const { canvas, scores } = renderOverview(report.overview);
  setText("summaryContent", report.oneSentence.text, "");
  renderDimensionDetails(report.learningPattern.allEntries);
  renderMechanismDetails(report.learningPattern.allEntries);
  renderStrengths(report.strengths);
  renderRisks(report.risks);
  renderSubjectPlan(report.subjectPlan);
  return { canvas, scores };
}

let activeRadar = null;
let radarFrame = 0;
let resizeListenerInstalled = false;

function scheduleRadarDraw() {
  if (!activeRadar) return;
  if (radarFrame && typeof window.cancelAnimationFrame === "function") window.cancelAnimationFrame(radarFrame);
  const draw = () => {
    radarFrame = 0;
    if (activeRadar) drawRadar(activeRadar.canvas, activeRadar.scores);
  };
  if (typeof window.requestAnimationFrame === "function") radarFrame = window.requestAnimationFrame(draw);
  else draw();
}

function activateRadar(canvas, scores) {
  activeRadar = { canvas, scores };
  if (!resizeListenerInstalled) {
    window.addEventListener("resize", scheduleRadarDraw);
    resizeListenerInstalled = true;
  }
  scheduleRadarDraw();
}

export function renderStudentReport(value, publicView = {}) {
  const report = normalizeStudentReport(value, publicView);
  const { canvas, scores } = renderReport(report);
  element("reportError").hidden = true;
  element("reportLoading").hidden = true;
  element("reportDocument").hidden = false;
  activateRadar(canvas, scores);
  return report;
}

function showError(message) {
  element("reportLoading").hidden = true;
  element("reportDocument").hidden = true;
  setText("reportErrorText", message, "请检查报告链接，或稍后再试。");
  element("reportError").hidden = false;
}

export async function loadReport(reportId) {
  element("reportError").hidden = true;
  element("reportDocument").hidden = true;
  element("reportLoading").hidden = false;
  try {
    const payload = await requestJson(`/api/reports/${encodeURIComponent(reportId)}`);
    if (!payload.report?.studentReport || typeof payload.report.studentReport !== "object") throw new Error("报告数据不完整");
    renderStudentReport(payload.report.studentReport, payload.report);
  } catch (error) {
    showError(error.message || "暂时无法读取报告，请稍后再试。");
  }
}

async function submitFeedback(event, reportId) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const fitRating = Number(data.get("fitRating"));
  if (!Number.isInteger(fitRating) || fitRating < 1 || fitRating > 5) {
    setText("feedbackError", "请先选择 1 至 5 的符合程度。", "");
    element("feedbackError").hidden = false;
    return;
  }
  element("submitFeedback").disabled = true;
  try {
    await requestJson(`/api/reports/${encodeURIComponent(reportId)}/feedback`, {
      method: "POST",
      body: JSON.stringify({
        fitRating,
        selfIdentifiedPreference: String(data.get("selfIdentifiedPreference") || "").trim() || null,
        comment: String(data.get("comment") || "").trim() || null
      })
    });
    element("feedbackSuccess").hidden = false;
    form.querySelectorAll("input, select, textarea, button").forEach((control) => { control.disabled = true; });
  } catch (error) {
    setText("feedbackError", error.message || "反馈暂时无法提交，请稍后再试。", "");
    element("feedbackError").hidden = false;
    element("submitFeedback").disabled = false;
  }
}

function boot() {
  const reportId = reportIdFromLocation();
  if (!reportId) return showError("报告链接缺少匿名标识，请从测评完成页重新进入。");
  element("retryReport").addEventListener("click", () => loadReport(reportId));
  element("printReport").addEventListener("click", () => window.print());
  element("feedbackForm").addEventListener("submit", (event) => submitFeedback(event, reportId));
  loadReport(reportId);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
}
