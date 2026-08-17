export const DRAFT_KEY = "lsa:learning-mode:scenario-v2";
const DRAFT_VERSION = 7;
const SUBJECTS = Object.freeze(["语文", "数学", "英语", "日语", "物理", "化学", "生物", "政治", "历史", "地理"]);
const state = { sessionId: null, items: [], answers: [], currentIndex: 0, normalQuestionCount: 20, startedAt: null, submitting: false, questionOpenedAt: new Map() };
const byId = (id) => document.getElementById(id);
const elements = typeof document === "undefined" ? {} : Object.fromEntries(["startView", "basicView", "assessmentView", "submitErrorView", "startButton", "resumeButton", "basicForm", "basicBackButton", "targetSubject", "basicError", "questionList", "completionText", "pageText", "progressBar", "progressFill", "pageError", "previousButton", "nextButton", "retryButton", "loadingOverlay", "loadingText"].map((id) => [id, byId(id)]));

export function targetSubjectsForLanguage(language) {
  if (!["英语", "日语", "其他"].includes(language)) throw new RangeError("未知的外语科目");
  return SUBJECTS.filter((subject) => subject !== "英语" && subject !== "日语").concat(language === "其他" ? [] : [language]);
}

export function questionGroupAccessibility(index) {
  if (!Number.isInteger(index) || index < 1) throw new RangeError("题目序号无效");
  return { promptId: `question-prompt-${index}`, role: "group", labelledBy: `question-prompt-${index}` };
}

export function makeDraft(source = state) {
  return {
    version: DRAFT_VERSION,
    sessionId: source.sessionId,
    items: source.items,
    answers: source.answers,
    currentIndex: source.currentIndex,
    normalQuestionCount: source.normalQuestionCount,
    startedAt: source.startedAt
  };
}

export function isCompleteAnswer(answer) {
  return Array.isArray(answer?.optionIds) && answer.optionIds.length > 0;
}

export function completionCount(answers) {
  return answers.filter(isCompleteAnswer).length;
}

export function replaceAnswer(answers, answer) {
  const remaining = answers.filter(({ questionId }) => questionId !== answer.questionId);
  if (!isCompleteAnswer(answer)) return remaining;
  const normalized = { ...answer, optionIds: [...answer.optionIds] };
  return [...remaining, normalized];
}

export function toggleOption(answers, questionId, optionId, openedAt, now) {
  const current = answers.find((answer) => answer.questionId === questionId);
  const selected = new Set(current?.optionIds ?? []);
  if (selected.has(optionId)) selected.delete(optionId);
  else selected.add(optionId);
  return replaceAnswer(answers, { questionId, optionIds: [...selected], responseTimeMs: Math.max(0, now - openedAt) });
}

export function buildSubmissionPayload(items, answers, durationSeconds) {
  const slots = items.map(({ id }) => answers.find((answer) => answer.questionId === id));
  return slots.every(isCompleteAnswer) ? { answers: slots, durationSeconds } : null;
}

function persistDraft() {
  if (state.sessionId) localStorage.setItem(DRAFT_KEY, JSON.stringify(makeDraft()));
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

function loadDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
    return draft?.version === DRAFT_VERSION && draft.sessionId ? draft : null;
  } catch {
    return null;
  }
}

function answerFor(questionId) {
  return state.answers.find((answer) => answer.questionId === questionId);
}

function saveAnswer(answer) {
  state.answers = replaceAnswer(state.answers, answer);
  persistDraft();
  updateProgress();
}

function openedAtFor(questionId) {
  if (!state.questionOpenedAt.has(questionId)) state.questionOpenedAt.set(questionId, Date.now());
  return state.questionOpenedAt.get(questionId);
}

function showView(active) {
  for (const view of [elements.startView, elements.basicView, elements.assessmentView, elements.submitErrorView]) {
    const visible = view === active;
    view.hidden = !visible;
    view.classList.toggle("is-active", visible);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setLoading(active, message = "正在处理...") {
  elements.loadingText.textContent = message;
  elements.loadingOverlay.hidden = !active;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { accept: "application/json", "content-type": "application/json", ...(options.headers ?? {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "请求失败");
  return payload;
}

function optionCard(item, index) {
  const article = document.createElement("article");
  article.className = "question-card";
  const access = questionGroupAccessibility(index);
  article.setAttribute("role", access.role);
  article.setAttribute("aria-labelledby", access.promptId);

  const number = document.createElement("span");
  number.className = "question-index";
  number.textContent = String(index).padStart(2, "0");
  const prompt = document.createElement("h2");
  prompt.id = access.promptId;
  prompt.className = "question-prompt";
  prompt.textContent = item.prompt;

  const options = document.createElement("div");
  options.className = "question-options";
  const current = answerFor(item.id);
  const selected = new Set(current?.optionIds ?? []);
  for (const [optionIndex, option] of item.options.entries()) {
    const label = document.createElement("label");
    label.className = "question-option";
    if (selected.has(option.id)) label.classList.add("is-selected");

    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = `answer-${item.id}`;
    input.value = option.id;
    input.checked = selected.has(option.id);

    const content = document.createElement("span");
    const letter = document.createElement("strong");
    letter.className = "option-letter";
    letter.textContent = String.fromCharCode(65 + optionIndex);
    const copy = document.createElement("span");
    copy.className = "option-copy";
    copy.textContent = option.text;
    content.append(letter, copy);
    input.addEventListener("change", () => {
      state.answers = toggleOption(state.answers, item.id, option.id, openedAtFor(item.id), Date.now());
      persistDraft();
      updateProgress();
      label.classList.toggle("is-selected", input.checked);
    });
    label.append(input, content);
    options.append(label);
  }

  const hint = document.createElement("p");
  hint.className = "question-answer-hint";
  hint.textContent = "可以选一个，也可以选几个。选最贴近你平时会做的。";
  article.append(number, prompt, hint, options);
  if (item.exampleNote) article.append(Object.assign(document.createElement("p"), { className: "field-help", textContent: item.exampleNote }));
  return article;
}

function updateProgress() {
  const total = state.normalQuestionCount;
  elements.completionText.textContent = `已完成 ${completionCount(state.answers)} / ${total}`;
  elements.pageText.textContent = `第 ${state.currentIndex + 1} 题 / ${total}题`;
  elements.progressBar.setAttribute("aria-valuemax", String(total));
  elements.progressBar.setAttribute("aria-valuenow", String(completionCount(state.answers)));
  elements.progressFill.style.width = `${Math.min(100, completionCount(state.answers) / total * 100)}%`;
}

function renderQuestion() {
  state.currentIndex = Math.max(0, Math.min(state.currentIndex, state.items.length - 1));
  const item = state.items[state.currentIndex];
  openedAtFor(item.id);
  elements.questionList.replaceChildren(optionCard(item, state.currentIndex + 1));
  elements.previousButton.disabled = state.currentIndex === 0;
  elements.nextButton.textContent = state.currentIndex === state.items.length - 1 ? "生成报告" : "下一题";
  elements.pageError.hidden = true;
  updateProgress();
  persistDraft();
}

function completeCurrent() {
  const answer = answerFor(state.items[state.currentIndex].id);
  if (isCompleteAnswer(answer)) return true;
  elements.pageError.textContent = "请至少选一项最像你平时做法的选项。";
  elements.pageError.hidden = false;
  return false;
}

function durationSeconds() {
  return Math.max(0, Math.min(86400, Math.round((Date.now() - Date.parse(state.startedAt)) / 1000)));
}

async function submitAssessment() {
  const submission = buildSubmissionPayload(state.items, state.answers, durationSeconds());
  if (state.submitting || !submission) return;
  state.submitting = true;
  setLoading(true, "正在生成你的学习模式报告...");
  try {
    const payload = await requestJson(`/api/sessions/${encodeURIComponent(state.sessionId)}/submit`, { method: "POST", body: JSON.stringify(submission) });
    clearDraft();
    window.location.assign(payload.reportUrl || `/report.html?id=${encodeURIComponent(state.sessionId)}`);
  } catch {
    persistDraft();
    showView(elements.submitErrorView);
  } finally {
    state.submitting = false;
    setLoading(false);
  }
}

async function advance() {
  if (!completeCurrent()) return;
  if (state.currentIndex < state.items.length - 1) {
    state.currentIndex += 1;
    renderQuestion();
    return;
  }
  return submitAssessment();
}

function updateSubjects(language) {
  const prior = elements.targetSubject.value;
  elements.targetSubject.replaceChildren(new Option("请选择一门学科", ""), ...targetSubjectsForLanguage(language).map((subject) => new Option(subject, subject)));
  if ([...elements.targetSubject.options].some(({ value }) => value === prior)) elements.targetSubject.value = prior;
}

async function createSession(event) {
  event.preventDefault();
  const form = new FormData(elements.basicForm);
  const fields = ["studentName", "contact", "grade", "specialtyDirection", "foreignLanguage", "targetSubject", "learningLevel"];
  const labels = { studentName: "姓名", contact: "联系方式", grade: "年级", specialtyDirection: "专业方向", foreignLanguage: "外语科目", targetSubject: "目标学科", learningLevel: "学习阶段" };
  const body = Object.fromEntries(fields.map((key) => [key, String(form.get(key) || "").trim()]));
  const missing = fields.filter((key) => !body[key]);
  if (missing.length) {
    elements.basicError.textContent = `请先选择：${missing.map((key) => labels[key]).join("、")}。`;
    elements.basicError.hidden = false;
    return;
  }

  setLoading(true, "正在准备题目...");
  try {
    const payload = await requestJson("/api/sessions", { method: "POST", body: JSON.stringify(body) });
    Object.assign(state, { sessionId: payload.session.id, items: payload.items, answers: [], currentIndex: 0, normalQuestionCount: payload.normalQuestionCount, startedAt: new Date().toISOString(), questionOpenedAt: new Map() });
    showView(elements.assessmentView);
    renderQuestion();
  } catch (error) {
    elements.basicError.textContent = error.message || "暂时无法开始，请检查网络后再试。";
    elements.basicError.hidden = false;
  } finally {
    setLoading(false);
  }
}

function boot() {
  const draft = loadDraft();
  elements.resumeButton.hidden = !draft;
  elements.startButton.addEventListener("click", () => showView(elements.basicView));
  elements.resumeButton.addEventListener("click", () => {
    Object.assign(state, draft);
    state.questionOpenedAt = new Map();
    showView(elements.assessmentView);
    renderQuestion();
  });
  elements.basicBackButton.addEventListener("click", () => showView(elements.startView));
  elements.basicForm.addEventListener("submit", createSession);
  elements.basicForm.querySelectorAll('input[name="foreignLanguage"]').forEach((input) => input.addEventListener("change", () => updateSubjects(input.value)));
  elements.previousButton.addEventListener("click", () => {
    if (state.currentIndex > 0) {
      state.currentIndex -= 1;
      renderQuestion();
    }
  });
  elements.nextButton.addEventListener("click", advance);
  elements.retryButton.addEventListener("click", submitAssessment);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
}
