import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSubmissionPayload, completionCount, toggleOption } from "../public/assets/assessment.js";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path) => readFile(resolve(root, path), "utf8");

test("entry page explains a required twenty-question multiselect assessment", async () => {
  const html = await source("public/index.html");
  assert.match(html, /学习模式定位/); assert.match(html, />20题</); assert.match(html, /可多选/);
  assert.match(html, /每题可以选一个，也可以选几个。没有标准答案，选最贴近你平时会做的。/);
  assert.doesNotMatch(html, /跳过/);
  assert.match(html, /找到自己更顺手的学习优势；遇到学习任务时，知道可以从哪儿下手。/);
  assert.doesNotMatch(html, /无论怎样作答，都会生成一份完整报告/);
  assert.match(html, /name="learningLevel"/);
  assert.doesNotMatch(html, /最多追加|再确认几个学习场景|最像我|第二像我|学习风格/);
});

test("report separates subject scenes, learning-path integration, and the concrete task", async () => {
  const html = await source("public/report.html");
  assert.match(html, /02 · 学科里的学习画面/);
  assert.match(html, /这门课里，你可能会这样学/);
  assert.match(html, /03 · 先选学习入口/);
  assert.match(html, /04 · 把第一步做出来/);
});

test("mode-card examples lead with the concrete subject scene", async () => {
  const script = await source("public/assets/report.js");
  assert.match(script, /text\("p", mechanism\.subjectExample, "mechanism-example"\)/);
  assert.doesNotMatch(script, /学科里的画面：/);
});

test("assessment client saves multiselect scenario answers and submits directly", async () => {
  const script = await source("public/assets/assessment.js");
  for (const token of ["optionIds", "type = \"checkbox\"", "可以选一个，也可以选几个。选最贴近你平时会做的。", "/submit", "learning-mode:scenario-v2", "DRAFT_VERSION = 7"]) assert.match(script, new RegExp(token));
  assert.doesNotMatch(script, /skipQuestion|skipActionState|skip-button|跳过/);
  assert.doesNotMatch(script, /confirmationAnswers|confirmationItems|confirmView|\/prepare|optionId: option\.id|type = "radio"/);
});

test("assessment options are independent checkboxes", async () => {
  const [script, styles] = await Promise.all([source("public/assets/assessment.js"), source("public/assets/styles.css")]);
  assert.match(script, /input\.addEventListener\("change", \(\) => \{[\s\S]*label\.classList\.toggle\("is-selected", input\.checked\)/);
  const changeHandler = script.match(/input\.addEventListener\("change", \(\) => \{[\s\S]*?\n    \}\);/)?.[0] ?? "";
  assert.doesNotMatch(changeHandler, /renderQuestion/);
  assert.match(styles, /\.question-options\s*{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(styles, /\.question-option\.is-selected/);
  assert.doesNotMatch(styles, /skip-button/);
});

test("assessment transitions retain selections and measure from the question opening", () => {
  const openedAt = 1_000;
  let answers = toggleOption([], "Q01", "Q01-A", openedAt, 1_300);
  answers = toggleOption(answers, "Q01", "Q01-B", openedAt, 1_800);
  assert.deepEqual(answers, [{ questionId: "Q01", optionIds: ["Q01-A", "Q01-B"], responseTimeMs: 800 }]);

  answers = toggleOption(answers, "Q01", "Q01-C", openedAt, 2_400);
  assert.deepEqual(answers, [{ questionId: "Q01", optionIds: ["Q01-A", "Q01-B", "Q01-C"], responseTimeMs: 1_400 }]);
});

test("assessment transitions remove an empty selection from progress and submit ordered complete slots", () => {
  const openedAt = 1_000;
  let answers = toggleOption([], "Q01", "Q01-A", openedAt, 1_100);
  answers = toggleOption(answers, "Q02", "Q02-B", openedAt, 1_200);
  assert.equal(completionCount(answers), 2);

  answers = toggleOption(answers, "Q01", "Q01-A", openedAt, 1_300);
  assert.deepEqual(answers, [{ questionId: "Q02", optionIds: ["Q02-B"], responseTimeMs: 200 }]);
  assert.equal(completionCount(answers), 1);

  assert.equal(buildSubmissionPayload([{ id: "Q01" }, { id: "Q02" }], answers, 42), null);
  const complete = toggleOption(answers, "Q01", "Q01-C", openedAt, 1_400);
  assert.deepEqual(buildSubmissionPayload([{ id: "Q01" }, { id: "Q02" }], complete, 42), {
    answers: [
      { questionId: "Q01", optionIds: ["Q01-C"], responseTimeMs: 400 },
      { questionId: "Q02", optionIds: ["Q02-B"], responseTimeMs: 200 }
    ],
    durationSeconds: 42
  });
});

test("report page has the integrated five-section layout and one task card", async () => {
  const html = await source("public/report.html");
  const sections = [...html.matchAll(/data-report-section="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(sections, ["cover", "conclusion", "mode-cards", "learning-path", "task-card"]);
  assert.match(html, /04 · 把第一步做出来/);
  assert.doesNotMatch(html, /今天先做这一件事/);
  assert.match(html, /id="modeRadar"/);
  assert.doesNotMatch(html, /四类学习模式使用倾向|你的7天学习方案|feedbackForm|学习风格/);
});

test("report client renders complete cards, task actions, and a legacy read-only branch", async () => {
  const script = await source("public/assets/report.js");
  for (const token of ["modeCards", "mechanisms", "taskCard", "completionCheck", "startChoices", "renderLegacyReport", "scenario-report-v2", "renderRadar", "mode-progress"]) assert.match(script, new RegExp(token));
  assert.doesNotMatch(script, /sevenDayPlan|使用倾向/);
});

test("report chart stacks its radar and progress bars on a narrow screen", async () => {
  const styles = await source("public/assets/styles.css");
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*\.conclusion-visuals\s*{[\s\S]*grid-template-columns:\s*1fr/);
});
