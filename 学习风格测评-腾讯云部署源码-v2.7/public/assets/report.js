function element(id) { const node = document.getElementById(id); if (!node) throw new Error(`报告页面缺少元素：${id}`); return node; }
function text(tag, value, className = "") { const node = document.createElement(tag); node.textContent = value ?? ""; if (className) node.className = className; return node; }
function setText(id, value, fallback = "--") { element(id).textContent = value || fallback; }
function reportId() { return new URLSearchParams(window.location.search).get("id")?.trim() ?? ""; }
async function requestJson(url) { const response = await fetch(url, { cache: "no-store", headers: { accept: "application/json" } }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || "请求失败"); return payload; }
const RADAR_CENTER = 120;
const RADAR_RADIUS = 80;
const LEGACY_RADAR_MAX = 20;
const svg = (name, attributes = {}) => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
};
const pointFor = (position, fraction = 1) => {
  const angle = -Math.PI / 2 + position * Math.PI / 2;
  const radius = RADAR_RADIUS * fraction;
  return { x: RADAR_CENTER + Math.cos(angle) * radius, y: RADAR_CENTER + Math.sin(angle) * radius };
};
const pointList = (fraction) => Array.from({ length: 4 }, (_, position) => pointFor(position, fraction)).map(({ x, y }) => `${x},${y}`).join(" ");

export function reportRenderKind(report) {
  if (report?.formatVersion === "scenario-report-v3") return "normalized";
  if (report?.formatVersion === "scenario-report-v2") return "count";
  return "legacy";
}

export function chartRowsForReport(report) {
  const counts = Array.isArray(report?.conclusion?.counts) ? report.conclusion.counts : [];
  if (reportRenderKind(report) === "normalized") {
    return counts.map(({ code, label, rate }) => {
      const value = Math.round((Number(rate) || 0) * 100);
      return { code, label, value, detail: `${value}%` };
    });
  }
  return counts.map(({ code, label, count }) => ({ code, label, value: Number(count) || 0, detail: `${count}次` }));
}

export function chartMeasurementsForReport(report) {
  const normalized = reportRenderKind(report) === "normalized";
  const maximum = normalized ? 100 : LEGACY_RADAR_MAX;
  const measurements = chartRowsForReport(report).map((row) => {
    const value = Math.max(0, Math.min(maximum, Number(row.value) || 0));
    const fraction = value / maximum;
    return {
      ...row,
      value,
      progress: {
        width: `${fraction * 100}%`,
        ariaValueMin: 0,
        ariaValueMax: maximum,
        ariaValueNow: value
      },
      radar: { value, maximum, fraction }
    };
  });
  return { normalized, maximum, measurements };
}

function renderRadar({ measurements, normalized }) {
  const chart = element("modeRadar");
  const title = svg("title", { id: "modeRadarTitle" });
  title.textContent = `${normalized ? "本次选择比例" : "本次选择次数"}：${measurements.map(({ label, detail }) => `${label}${detail}`).join("，")}`;
  chart.setAttribute("aria-labelledby", "modeRadarTitle");
  const grid = [0.25, 0.5, 0.75, 1].map((fraction) => svg("polygon", { class: "radar-grid", points: pointList(fraction) }));
  const axes = measurements.map((_, position) => {
    const { x, y } = pointFor(position);
    return svg("line", { class: "radar-axis", x1: RADAR_CENTER, y1: RADAR_CENTER, x2: x, y2: y });
  });
  const points = measurements.map(({ radar }, position) => {
    const { x, y } = pointFor(position, radar.fraction);
    return `${x},${y}`;
  }).join(" ");
  const shape = svg("polygon", { class: "radar-shape", points });
  const dots = measurements.map(({ radar }, position) => {
    const { x, y } = pointFor(position, radar.fraction);
    return svg("circle", { class: "radar-dot", cx: x, cy: y, r: 4 });
  });
  const labels = measurements.map(({ label, value }, position) => {
    const { x, y } = pointFor(position, 1.28);
    const labelNode = svg("text", { class: "radar-label", x, y, "text-anchor": "middle" });
    labelNode.textContent = `${label.replace("模式", "")} ${value}${normalized ? "%" : "次"}`;
    return labelNode;
  });
  chart.replaceChildren(title, ...grid, ...axes, shape, ...dots, ...labels);
}

function renderCounts({ measurements }) {
  element("modeCounts").replaceChildren(...measurements.map(({ label, detail, progress }) => {
    const row = document.createElement("div");
    row.className = "mode-progress";
    const heading = document.createElement("div");
    heading.className = "mode-progress-heading";
    heading.append(text("span", label), text("strong", detail));
    const track = document.createElement("div");
    track.className = "mode-progress-track";
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-label", `${label}${detail}`);
    track.setAttribute("aria-valuemin", String(progress.ariaValueMin));
    track.setAttribute("aria-valuemax", String(progress.ariaValueMax));
    track.setAttribute("aria-valuenow", String(progress.ariaValueNow));
    const fill = document.createElement("span");
    fill.style.width = progress.width;
    track.append(fill);
    row.append(heading, track);
    return row;
  }));
}
function modeCard(card) { const article = document.createElement("article"); article.className = "mode-card"; article.append(text("p", card.role, "mode-role"), text("h3", card.label), text("p", card.description)); const list = document.createElement("ul"); list.className = "mechanism-list"; for (const mechanism of card.mechanisms) { const item = document.createElement("li"); const head = document.createElement("div"); head.append(text("strong", mechanism.label), text("span", mechanism.status, "mechanism-status")); item.append(head, text("p", mechanism.definition), text("p", mechanism.subjectExample, "mechanism-example")); list.append(item); } article.append(list); return article; }
function renderTask(card) { setText("taskHeading", card.heading); setText("taskMaterials", card.materials, ""); setText("taskMinutes", `${card.minutes}分钟`, ""); setText("taskQuantity", card.quantity, ""); setText("taskFirstStep", card.firstStep, ""); setText("taskSecondStep", card.secondStep, ""); setText("taskCheck", card.completionCheck, ""); const row = element("taskChoicesRow"); const choices = element("taskChoices"); if (!card.startChoices.length) { row.hidden = true; choices.replaceChildren(); return; } row.hidden = false; choices.replaceChildren(...card.startChoices.map(({ label, copy }) => text("p", `${label}：${copy}`))); }
function renderScenarioReport(report) { const { overview, conclusion, modeCards, learningPath, taskCard } = report; const chartMeasurements = chartMeasurementsForReport(report); for (const [id, value] of Object.entries({ studentName: overview.studentName, contact: overview.contact, anonymousCode: overview.anonymousCode, grade: overview.grade, targetSubject: overview.targetSubject, learningLevel: overview.learningLevel })) setText(id, value); setText("conclusionTitle", conclusion.title); setText("conclusionSummary", conclusion.summary, ""); renderRadar(chartMeasurements); renderCounts(chartMeasurements); element("modeCards").replaceChildren(...modeCards.map(modeCard)); setText("learningPathTitle", learningPath.title); setText("learningPathCopy", learningPath.copy, ""); renderTask(taskCard); element("reportDocument").hidden = false; }
function renderLegacyReport(report) { const overview = report?.overview ?? {}; const summary = report?.modeCombination?.summary || "这是一份较早生成的报告。原有结果仍被保留，不会用新版规则重新解释。"; setText("legacyCopy", `${overview.targetSubject || "本次学科"}｜${overview.learningLevel || "原记录"}\n${summary}`, "历史报告暂时无法完整显示。"); element("legacyReportDocument").hidden = false; }
function showError(message) { element("reportLoading").hidden = true; element("reportDocument").hidden = true; element("legacyReportDocument").hidden = true; setText("reportErrorText", message, "请稍后再试。"); element("reportError").hidden = false; }
async function loadReport(id) { element("reportError").hidden = true; element("reportDocument").hidden = true; element("legacyReportDocument").hidden = true; element("reportLoading").hidden = false; try { const payload = await requestJson(`/api/reports/${encodeURIComponent(id)}`); if (!payload.report) throw new Error("报告数据不完整"); if (["normalized", "count"].includes(reportRenderKind(payload.report))) renderScenarioReport(payload.report); else renderLegacyReport(payload.report); element("reportLoading").hidden = true; } catch (error) { showError(error.message || "暂时无法读取报告。"); } }
function boot() { const id = reportId(); if (!id) return showError("报告链接缺少编号，请从测评完成页重新进入。"); element("retryReport").addEventListener("click", () => loadReport(id)); element("printReport").addEventListener("click", () => window.print()); loadReport(id); }
if (typeof window !== "undefined" && typeof document !== "undefined") { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true }); else boot(); }
