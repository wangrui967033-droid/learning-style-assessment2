import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path) => readFile(resolve(root, path), "utf8");

test("student pages are self-contained and use the approved learning-mode language", async () => {
  const [entry, report] = await Promise.all([source("public/index.html"), source("public/report.html")]);
  for (const html of [entry, report]) {
    assert.match(html, /<html lang="zh-CN">/);
    assert.match(html, /<meta name="viewport"/);
    assert.doesNotMatch(html, /学习风格|试测版本|预测试|重测|认知访谈|真实执行结果/);
  }
  assert.match(entry, /学习模式定位/);
  assert.match(report, /学习模式定位报告/);
  assert.doesNotMatch(entry, /看起来更努力/);
});

test("basic information collects name and contact and offers an unstored other-language choice", async () => {
  const [entry, script, report] = await Promise.all([
    source("public/index.html"), source("public/assets/assessment.js"), source("public/report.html")
  ]);
  assert.match(entry, /name="studentName"/);
  assert.match(entry, /name="contact"/);
  assert.match(entry, /name="foreignLanguage" value="其他"/);
  assert.match(script, /studentName/);
  assert.match(script, /contact/);
  assert.match(script, /请先选择：/);
  assert.match(report, /id="studentName"/);
  assert.match(report, /id="contact"/);
});

test("interactive controls keep accessible labels and report keeps print support", async () => {
  const [entry, report, styles] = await Promise.all([
    source("public/index.html"), source("public/report.html"), source("public/assets/styles.css")
  ]);
  assert.match(entry, /<legend[^>]*>你目前所在年级/);
  assert.match(entry, /aria-live="polite"/);
  assert.match(report, /id="printReport"/);
  assert.match(styles, /@media print/);
  assert.match(styles, /@media \(max-width:/);
});

test("assessment markup removes confirmation and skip actions", async () => {
  const [entry, script] = await Promise.all([source("public/index.html"), source("public/assets/assessment.js")]);
  assert.doesNotMatch(entry, /id="confirmView"|id="confirmButton"|RESULT CONFIRMATION/);
  assert.match(script, /options\.className = "question-options"/);
  assert.doesNotMatch(script, /skipQuestion|skipActionState|skip-button|跳过/);
  assert.match(script, /请至少选一项最像你平时做法的选项。/);
});

test("student-facing scripts do not render internal test or feedback modules", async () => {
  const scripts = `${await source("public/assets/assessment.js")}\n${await source("public/assets/report.js")}`;
  assert.doesNotMatch(scripts, /feedbackForm|submitFeedback|内测|试测版本|学习风格/);
  assert.match(scripts, /学习模式/);
  assert.doesNotMatch(scripts, /使用倾向|你的7天学习方案/);
});
