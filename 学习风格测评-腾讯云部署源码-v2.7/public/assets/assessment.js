export const DRAFT_KEY = "lsa:v2:draft";
const CACHE_KEY = "lsa:v2:cache";
const DRAFT_VERSION = 3;
const FIXED_COUNT = 42;
const FIXED_PAGE_SIZE = 2;
const PREFERENCE_COUNT = 32;
const CALIBRATION_COUNT = 4;
const CALIBRATION_PAGE_SIZE = 4;
const PHONE_PATTERN = /^1[3-9]\d{9}$/;
const SHARED_TARGET_SUBJECTS = Object.freeze(["语文", "数学", "物理", "化学", "生物", "历史", "政治", "地理", "技术"]);
const RAW_TARGET_SUBJECTS = new Set(["语文", "数学", "英语", "日语"]);
const FOREIGN_LANGUAGE_OPTIONS = new Set(["英语", "日语", "其他"]);
export const PREFERENCE_SCALE = Object.freeze([
  Object.freeze({ value: 1, label: "完全不像我" }),
  Object.freeze({ value: 2, label: "不太像我" }),
  Object.freeze({ value: 3, label: "有一点像我" }),
  Object.freeze({ value: 4, label: "比较像我" }),
  Object.freeze({ value: 5, label: "非常像我" })
]);
export const STRATEGY_SCALE = Object.freeze([
  Object.freeze({ value: 1, label: "完全不像我" }),
  Object.freeze({ value: 2, label: "不太像我" }),
  Object.freeze({ value: 3, label: "有一点像我" }),
  Object.freeze({ value: 4, label: "比较像我" }),
  Object.freeze({ value: 5, label: "非常像我" })
]);

export function paginateItems(items, pageSize) {
  if (!Array.isArray(items) || !Number.isInteger(pageSize) || pageSize < 2 || pageSize > 4) {
    throw new TypeError("分页参数无效");
  }
  if (items.length % pageSize !== 0) throw new RangeError("题目无法形成完整分页");
  const pages = [];
  for (let index = 0; index < items.length; index += pageSize) pages.push(items.slice(index, index + pageSize));
  return pages;
}

export function orderFixedItems(items) {
  if (!Array.isArray(items)) throw new TypeError("题目数据无效");
  return items.slice();
}

export function fixedPartHeading(pageIndex) {
  if (pageIndex === 0) return "第一部分 · 学习风格";
  if (pageIndex === PREFERENCE_COUNT / FIXED_PAGE_SIZE) return "第二部分 · 学习策略";
  return "";
}

export function fixedPartGuidance(pageIndex) {
  if (pageIndex === 0) return "请按平时最常出现的学习情况作答。";
  if (pageIndex === PREFERENCE_COUNT / FIXED_PAGE_SIZE) {
    return "下面只回想这些情况在之前学习时发生得多不多，没有正确答案。";
  }
  return "";
}

export function scaleForFixedIndex(index, preferenceScale = PREFERENCE_SCALE, strategyScale = STRATEGY_SCALE) {
  if (!Number.isInteger(index) || index < 0 || index >= FIXED_COUNT) throw new RangeError("题目序号无效");
  return index < PREFERENCE_COUNT ? preferenceScale : strategyScale;
}

export function targetSubjectsForLanguage(language) {
  if (!FOREIGN_LANGUAGE_OPTIONS.has(language)) throw new RangeError("外语科目无效");
  const sharedSubjects = ["语文", "数学", ...SHARED_TARGET_SUBJECTS.slice(2)];
  return language === "其他" ? ["语文", "数学", "英语", "日语", ...SHARED_TARGET_SUBJECTS.slice(2)] : ["语文", "数学", language, ...SHARED_TARGET_SUBJECTS.slice(2)];
}

export function fullScoreForTargetSubject(subject) {
  if (RAW_TARGET_SUBJECTS.has(subject)) return 150;
  if (SHARED_TARGET_SUBJECTS.slice(2).includes(subject)) return 100;
  throw new RangeError("目标学科无效");
}

export function questionGroupAccessibility(displayIndex) {
  if (!Number.isInteger(displayIndex) || displayIndex < 1) throw new RangeError("题目序号无效");
  const promptId = `question-prompt-${displayIndex}`;
  return { promptId, role: "radiogroup", labelledBy: promptId };
}

export function makeDraft({ sessionId, currentPage, answers, startedAt, itemOrder }) {
  return {
    version: DRAFT_VERSION,
    sessionId,
    currentPage,
    answers: Array.isArray(answers) ? answers : [],
    startedAt,
    itemOrder: Array.isArray(itemOrder) ? itemOrder : []
  };
}

function initialState() {
  return {
    sessionId: null,
    anonymousCode: null,
    currentPage: 0,
    answers: [],
    startedAt: null,
    itemOrder: [],
    fixedItems: [],
    calibrationItems: [],
    preferenceScale: PREFERENCE_SCALE,
    strategyScale: STRATEGY_SCALE,
    stage: "fixed",
    renderedAt: Date.now(),
    creatingSession: null,
    submitting: false
  };
}

let state = initialState();
let elements = null;

function byId(id) {
  return document.getElementById(id);
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function cacheState() {
  return {
    version: DRAFT_VERSION,
    anonymousCode: state.anonymousCode,
    fixedItems: state.fixedItems,
    calibrationItems: state.calibrationItems,
    preferenceScale: state.preferenceScale,
    strategyScale: state.strategyScale,
    stage: state.stage
  };
}

function persistDraft() {
  if (!state.sessionId) return;
  const draft = makeDraft({
    sessionId: state.sessionId,
    currentPage: state.currentPage,
    answers: state.answers,
    startedAt: state.startedAt,
    itemOrder: state.itemOrder
  });
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  localStorage.setItem(CACHE_KEY, JSON.stringify(cacheState()));
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
  localStorage.removeItem(CACHE_KEY);
}

function recoverDraft() {
  const draft = safeParse(localStorage.getItem(DRAFT_KEY));
  const cache = safeParse(localStorage.getItem(CACHE_KEY));
  if (!draft || !cache || draft.version !== DRAFT_VERSION || cache.version !== DRAFT_VERSION) return false;
  if (typeof draft.sessionId !== "string" || !Array.isArray(draft.answers) || !Array.isArray(cache.fixedItems)) return false;
  const itemById = new Map(cache.fixedItems.map((item) => [item.id, item]));
  const ordered = draft.itemOrder.map((id) => itemById.get(id)).filter(Boolean);
  if (ordered.length !== FIXED_COUNT) return false;

  state = {
    ...initialState(),
    sessionId: draft.sessionId,
    anonymousCode: cache.anonymousCode ?? null,
    currentPage: Number.isInteger(draft.currentPage) ? draft.currentPage : 0,
    answers: draft.answers,
    startedAt: draft.startedAt,
    itemOrder: draft.itemOrder,
    fixedItems: ordered,
    calibrationItems: Array.isArray(cache.calibrationItems) ? cache.calibrationItems : [],
    preferenceScale: Array.isArray(cache.preferenceScale) && cache.preferenceScale.length === 5
      ? cache.preferenceScale
      : PREFERENCE_SCALE,
    strategyScale: Array.isArray(cache.strategyScale) && cache.strategyScale.length === 5
      ? cache.strategyScale
      : STRATEGY_SCALE,
    stage: cache.stage === "calibration" ? "calibration" : "fixed"
  };
  return true;
}

function showView(target) {
  for (const view of [elements.startView, elements.basicView, elements.assessmentView, elements.submitErrorView]) {
    const active = view === target;
    view.hidden = !active;
    view.classList.toggle("is-active", active);
  }
  window.scrollTo({ top: 0, behavior: "auto" });
}

function setLoading(active, text = "正在准备测评...") {
  elements.loadingText.textContent = text;
  elements.loadingOverlay.hidden = !active;
}

async function requestJson(url, options) {
  const response = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...options?.headers }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "请求失败");
  return payload;
}

export function sessionPayload(form) {
  const targetSubjectScore = form.targetSubjectScore.value === "" ? null : Number(form.targetSubjectScore.value);
  return {
    studentName: form.studentName.value.trim(),
    phoneNumber: form.phoneNumber.value.trim(),
    privacyConsentedAt: new Date().toISOString(),
    grade: form.grade.value,
    scoreBand: form.scoreBand.value,
    specialtyDirection: form.specialtyDirection.value,
    foreignLanguage: form.foreignLanguage.value,
    targetSubject: form.targetSubject.value,
    targetSubjectScore,
    learningFocus: form.learningFocus.value,
  };
}

export function validateSessionPayload(info) {
  if (info.studentName.length < 2 || info.studentName.length > 30) return "请填写 2 至 30 个字符的姓名。";
  if (!PHONE_PATTERN.test(info.phoneNumber)) return "请填写 11 位有效手机号。";
  if (!info.grade || !info.scoreBand || !info.specialtyDirection || !info.foreignLanguage || !info.targetSubject) {
    return "请完成全部单选信息，并选择一门目标学科。";
  }
  const fullScore = fullScoreForTargetSubject(info.targetSubject);
  if (
    typeof info.targetSubjectScore !== "number" ||
    !Number.isFinite(info.targetSubjectScore) ||
    Math.round(info.targetSubjectScore * 10) !== info.targetSubjectScore * 10 ||
    info.targetSubjectScore < 0 ||
    info.targetSubjectScore > fullScore
  ) {
    return `请填写 0 至 ${fullScore} 分的目标学科成绩，最多保留一位小数。`;
  }
  if (!["learning", "memory", "practice", "improve"].includes(info.learningFocus)) {
    return "请选择当前改善环节。";
  }
  return "";
}

export async function runSessionCreation({ state: lockState, button, setBusy, task }) {
  if (lockState.creatingSession) return false;
  const owner = {};
  lockState.creatingSession = owner;
  button.disabled = true;
  setBusy(true);
  try {
    await task(owner);
    return true;
  } finally {
    if (lockState.creatingSession === owner) {
      lockState.creatingSession = null;
      button.disabled = false;
      setBusy(false);
    }
  }
}

function updateTargetSubjects() {
  const language = elements.basicForm.querySelector('input[name="foreignLanguage"]:checked')?.value;
  const previous = elements.targetSubject.value;
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = language ? "请选择一门目标学科" : "请先选择外语科目";
  elements.targetSubject.replaceChildren(placeholder);
  if (!language) {
    updateTargetSubjectScoreLimit();
    return;
  }
  const subjects = targetSubjectsForLanguage(language);
  for (const subject of subjects) {
    const option = document.createElement("option");
    option.value = subject;
    option.textContent = subject;
    elements.targetSubject.append(option);
  }
  elements.targetSubject.value = subjects.includes(previous) ? previous : "";
  updateTargetSubjectScoreLimit();
}

function updateTargetSubjectScoreLimit() {
  const subject = elements.targetSubject.value;
  if (!subject) {
    elements.targetSubjectScore.value = "";
    elements.targetSubjectScore.removeAttribute("max");
    elements.targetSubjectScoreHelp.textContent = "请先选择目标学科。";
    elements.targetSubjectScoreUnit.textContent = "/ -- 分";
    return;
  }

  const fullScore = fullScoreForTargetSubject(subject);
  elements.targetSubjectScore.max = String(fullScore);
  elements.targetSubjectScoreHelp.textContent = `填写最近一次较完整的阶段考试或模拟考试成绩，满分${fullScore}分。`;
  elements.targetSubjectScoreUnit.textContent = `/ ${fullScore} 分`;
  if (elements.targetSubjectScore.value !== "" && Number(elements.targetSubjectScore.value) > fullScore) {
    elements.targetSubjectScore.value = "";
  }
}

function answerFor(questionId) {
  return state.answers.find((answer) => answer.questionId === questionId);
}

function saveAnswer(answer) {
  state.answers = state.answers.filter(({ questionId }) => questionId !== answer.questionId);
  state.answers.push(answer);
  persistDraft();
  updateProgress();
}

function createScaleOption(item, scaleItem, questionIndex) {
  const label = document.createElement("label");
  label.className = "scale-option";
  const input = document.createElement("input");
  input.type = "radio";
  input.name = `response-${questionIndex}`;
  input.value = String(scaleItem.value);
  input.checked = answerFor(item.id)?.value === scaleItem.value;
  const display = document.createElement("span");
  const number = document.createElement("strong");
  number.textContent = String(scaleItem.value);
  const text = document.createElement("span");
  text.textContent = scaleItem.label;
  display.append(number, text);
  input.addEventListener("change", () => {
    saveAnswer({
      questionId: item.id,
      value: scaleItem.value,
      responseTimeMs: Math.max(0, Date.now() - state.renderedAt),
      answeredAt: new Date().toISOString()
    });
    elements.pageError.hidden = true;
  });
  label.append(input, display);
  return label;
}

function createBinaryOption(item, option, questionIndex) {
  const label = document.createElement("label");
  label.className = "binary-option";
  const input = document.createElement("input");
  input.type = "radio";
  input.name = `response-${questionIndex}`;
  input.checked = answerFor(item.id)?.optionId === option.id;
  const display = document.createElement("span");
  display.textContent = option.text;
  input.addEventListener("change", () => {
    saveAnswer({
      questionId: item.id,
      optionId: option.id,
      responseTimeMs: Math.max(0, Date.now() - state.renderedAt),
      answeredAt: new Date().toISOString()
    });
    elements.pageError.hidden = true;
  });
  label.append(input, display);
  return label;
}

function createQuestionCard(item, displayIndex) {
  const accessibility = questionGroupAccessibility(displayIndex);
  const article = document.createElement("article");
  article.className = "question-card";
  const index = document.createElement("p");
  index.className = "question-index";
  index.textContent = `Q${displayIndex}`;
  const prompt = document.createElement("p");
  prompt.className = "question-prompt";
  prompt.id = accessibility.promptId;
  prompt.textContent = item.prompt;
  const options = document.createElement("div");
  options.setAttribute("role", accessibility.role);
  options.setAttribute("aria-labelledby", accessibility.labelledBy);

  if (state.stage === "calibration") {
    options.className = "binary-list";
    item.options.forEach((option) => options.append(createBinaryOption(item, option, displayIndex)));
  } else {
    options.className = "scale-list";
    const scale = scaleForFixedIndex(displayIndex - 1, state.preferenceScale, state.strategyScale);
    scale.forEach((scaleItem) => options.append(createScaleOption(item, scaleItem, displayIndex)));
  }
  article.append(index, prompt, options);
  return article;
}

function currentPages() {
  return state.stage === "calibration"
    ? paginateItems(state.calibrationItems, CALIBRATION_PAGE_SIZE)
    : paginateItems(state.fixedItems, FIXED_PAGE_SIZE);
}

function currentPageItems() {
  return currentPages()[state.currentPage] ?? [];
}

function updateProgress() {
  const calibration = state.stage === "calibration";
  const total = calibration ? FIXED_COUNT + CALIBRATION_COUNT : FIXED_COUNT;
  const completed = state.answers.length;
  elements.completionText.textContent = `已完成 ${completed} / ${total}`;
  elements.progressBar.setAttribute("aria-valuemax", String(total));
  elements.progressBar.setAttribute("aria-valuenow", String(completed));
  elements.progressFill.style.width = `${Math.min(100, (completed / total) * 100)}%`;
}

function renderPage() {
  const pages = currentPages();
  state.currentPage = Math.max(0, Math.min(state.currentPage, pages.length - 1));
  const page = pages[state.currentPage];
  elements.questionList.replaceChildren();
  const partHeading = state.stage === "fixed" ? fixedPartHeading(state.currentPage) : "";
  if (partHeading) {
    const heading = document.createElement("h2");
    heading.className = "assessment-part-heading";
    heading.textContent = partHeading;
    elements.questionList.append(heading);
    const guidance = fixedPartGuidance(state.currentPage);
    if (guidance) {
      const description = document.createElement("p");
      description.className = "assessment-part-guidance";
      description.textContent = guidance;
      elements.questionList.append(description);
    }
  }
  const offset = state.stage === "calibration" ? FIXED_COUNT : state.currentPage * FIXED_PAGE_SIZE;
  page.forEach((item, index) => elements.questionList.append(createQuestionCard(item, offset + state.currentPage * (state.stage === "calibration" ? CALIBRATION_PAGE_SIZE : 0) + index + 1)));
  elements.previousButton.disabled = state.currentPage === 0;
  elements.nextButton.textContent = state.currentPage === pages.length - 1 ? (state.stage === "calibration" ? "生成报告" : "完成作答") : "下一页";
  elements.pageError.hidden = true;
  state.renderedAt = Date.now();
  persistDraft();
  updateProgress();
}

function pageComplete() {
  return currentPageItems().every((item) => Boolean(answerFor(item.id)));
}

function durationSeconds() {
  const start = Date.parse(state.startedAt);
  if (!Number.isFinite(start)) return 0;
  return Math.min(86_400, Math.max(0, Math.round((Date.now() - start) / 1000)));
}

async function finalSubmit() {
  if (state.submitting) return;
  state.submitting = true;
  setLoading(true, "正在生成测评报告...");
  try {
    const payload = await requestJson(`/api/sessions/${encodeURIComponent(state.sessionId)}/submit`, {
      method: "POST",
      body: JSON.stringify({ answers: state.answers, durationSeconds: durationSeconds() })
    });
    clearDraft();
    if (typeof payload.reportUrl !== "string" || !payload.reportUrl.startsWith("/report.html?id=")) {
      throw new Error("报告地址无效");
    }
    window.location.assign(payload.reportUrl);
  } catch {
    persistDraft();
    showView(elements.submitErrorView);
  } finally {
    state.submitting = false;
    setLoading(false);
  }
}

async function prepareResult() {
  if (state.submitting) return;
  state.submitting = true;
  setLoading(true, "正在准备下一步...");
  try {
    const payload = await requestJson(`/api/sessions/${encodeURIComponent(state.sessionId)}/prepare`, {
      method: "POST",
      body: JSON.stringify({ answers: state.answers, durationSeconds: durationSeconds() })
    });
    if (!payload.needsConfirmation) {
      state.submitting = false;
      setLoading(false);
      await finalSubmit();
      return;
    }
    if (!Array.isArray(payload.items) || payload.items.length !== CALIBRATION_COUNT) throw new Error("确认题数据无效");
    state.calibrationItems = payload.items;
    state.stage = "calibration";
    state.currentPage = 0;
    persistDraft();
    showView(elements.assessmentView);
    renderPage();
  } catch {
    persistDraft();
    showView(elements.submitErrorView);
  } finally {
    state.submitting = false;
    setLoading(false);
  }
}

async function advancePage() {
  if (!pageComplete()) {
    elements.pageError.hidden = false;
    elements.pageError.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const pages = currentPages();
  if (state.currentPage < pages.length - 1) {
    state.currentPage += 1;
    renderPage();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  if (state.stage === "fixed") await prepareResult();
  else await finalSubmit();
}

async function createSession(event) {
  event.preventDefault();
  if (state.creatingSession) return;
  const info = sessionPayload(elements.basicForm);
  const error = validateSessionPayload(info);
  if (error) {
    elements.basicError.textContent = error;
    elements.basicError.hidden = false;
    return;
  }
  elements.basicError.hidden = true;
  await runSessionCreation({
    state,
    button: elements.createSessionButton,
    setBusy: (active) => setLoading(active, "正在准备测评..."),
    task: async (owner) => {
      try {
        const payload = await requestJson("/api/sessions", { method: "POST", body: JSON.stringify(info) });
        if (!payload.session?.id || !Array.isArray(payload.items) || payload.items.length !== FIXED_COUNT) throw new Error("题目数据无效");
        const ordered = orderFixedItems(payload.items);
        Object.assign(state, {
          ...initialState(),
          creatingSession: owner,
          sessionId: payload.session.id,
          anonymousCode: payload.session.anonymousCode ?? null,
          startedAt: new Date().toISOString(),
          itemOrder: ordered.map(({ id }) => id),
          fixedItems: ordered,
          preferenceScale: Array.isArray(payload.preferenceScale) && payload.preferenceScale.length === 5
            ? payload.preferenceScale
            : PREFERENCE_SCALE,
          strategyScale: Array.isArray(payload.strategyScale) && payload.strategyScale.length === 5
            ? payload.strategyScale
            : STRATEGY_SCALE
        });
        persistDraft();
        showView(elements.assessmentView);
        renderPage();
      } catch {
        elements.basicError.textContent = "暂时无法开始测评，请检查网络后重试。";
        elements.basicError.hidden = false;
      }
    }
  });
}

function bindEvents() {
  elements.startButton.addEventListener("click", () => showView(elements.basicView));
  elements.basicBackButton.addEventListener("click", () => showView(elements.startView));
  elements.basicForm.addEventListener("submit", createSession);
  for (const input of elements.basicForm.querySelectorAll('input[name="foreignLanguage"]')) {
    input.addEventListener("change", updateTargetSubjects);
  }
  elements.targetSubject.addEventListener("change", updateTargetSubjectScoreLimit);
  for (const control of elements.basicForm.querySelectorAll("input, select")) {
    const refreshError = () => {
      if (elements.basicError.hidden) return;
      const error = validateSessionPayload(sessionPayload(elements.basicForm));
      elements.basicError.textContent = error;
      elements.basicError.hidden = !error;
    };
    control.addEventListener("input", refreshError);
    control.addEventListener("change", refreshError);
  }
  elements.previousButton.addEventListener("click", () => {
    if (state.currentPage > 0) {
      state.currentPage -= 1;
      renderPage();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
  elements.nextButton.addEventListener("click", advancePage);
  elements.retryButton.addEventListener("click", () => {
    if (state.stage === "calibration" && state.answers.length < FIXED_COUNT + CALIBRATION_COUNT) {
      showView(elements.assessmentView);
      renderPage();
    } else if (state.answers.length === FIXED_COUNT && state.stage === "fixed") {
      prepareResult();
    } else {
      finalSubmit();
    }
  });
  elements.resumeButton.addEventListener("click", () => {
    showView(elements.assessmentView);
    renderPage();
  });
}

function bootstrap() {
  elements = {
    startView: byId("startView"),
    basicView: byId("basicView"),
    assessmentView: byId("assessmentView"),
    submitErrorView: byId("submitErrorView"),
    startButton: byId("startButton"),
    resumeButton: byId("resumeButton"),
    basicForm: byId("basicForm"),
    basicBackButton: byId("basicBackButton"),
    createSessionButton: byId("createSessionButton"),
    basicError: byId("basicError"),
    targetSubject: byId("targetSubject"),
    targetSubjectScore: byId("targetSubjectScore"),
    targetSubjectScoreHelp: byId("targetSubjectScoreHelp"),
    targetSubjectScoreUnit: byId("targetSubjectScoreUnit"),
    questionList: byId("questionList"),
    completionText: byId("completionText"),
    progressBar: byId("progressBar"),
    progressFill: byId("progressFill"),
    previousButton: byId("previousButton"),
    nextButton: byId("nextButton"),
    pageError: byId("pageError"),
    retryButton: byId("retryButton"),
    loadingOverlay: byId("loadingOverlay"),
    loadingText: byId("loadingText")
  };
  bindEvents();
  if (recoverDraft()) elements.resumeButton.hidden = false;
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  else bootstrap();
}
