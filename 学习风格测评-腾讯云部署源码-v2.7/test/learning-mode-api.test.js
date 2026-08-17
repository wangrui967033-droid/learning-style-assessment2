import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db/database.js";
import { getScenarioQuestions } from "../src/domain/learning-mode-bank.js";

const BY_PROMPT = new Map(getScenarioQuestions().map((question) => [question.prompt, question]));

async function withServer(run) {
  const database = openDatabase(":memory:");
  const app = createApp({ database, config: { adminExportToken: "secret", assessmentVersion: "scenario-learning-mode-v2" } });
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  try { await run({ baseUrl: `http://127.0.0.1:${server.address().port}`, database }); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); database.close(); }
}

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { "content-type": "application/json", ...(options.headers ?? {}) } });
  return { response, payload: await response.json() };
}

async function createSession(baseUrl, overrides = {}) {
  const result = await jsonRequest(`${baseUrl}/api/sessions`, { method: "POST", body: JSON.stringify({ grade: "高三", specialtyDirection: "美术设计", foreignLanguage: "英语", targetSubject: "数学", learningLevel: "基础巩固", studentName: "王小明", contact: "13800138000", ...overrides }) });
  assert.equal(result.response.status, 201); return result.payload;
}

function answers(items, modeFor = () => ["V"]) {
  return items.map((item) => {
    const question = BY_PROMPT.get(item.prompt); const modes = modeFor(question);
    const texts = modes.map((mode) => question.options.find((option) => option.mode === mode).text);
    return { questionId: item.id, optionIds: texts.map((text) => item.options.find((option) => option.text === text).id), responseTimeMs: 1200 };
  });
}

test("session returns twenty multiselect questions and submits without prepare", async () => {
  await withServer(async ({ baseUrl, database }) => {
    const created = await createSession(baseUrl);
    assert.equal(created.normalQuestionCount, 20); assert.equal(created.maximumQuestionCount, 20); assert.equal(created.items.length, 20);
    assert.ok(created.items.every(({ id, options, multiple, allowSkip }) => /^Q-[A-Za-z0-9_-]{12}$/.test(id) && options.length === 4 && multiple && allowSkip === undefined));
    assert.doesNotMatch(JSON.stringify(created.items), /"mode"|specificMode|process/);
    const row = database.prepare("SELECT learning_level, student_name, contact FROM assessment_sessions WHERE id = ?").get(created.session.id);
    assert.deepEqual(row, { learning_level: "基础巩固", student_name: "王小明", contact: "13800138000" });

    const prepared = await fetch(`${baseUrl}/api/sessions/${created.session.id}/prepare`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal(prepared.status, 404);

    const submitted = await jsonRequest(`${baseUrl}/api/sessions/${created.session.id}/submit`, { method: "POST", body: JSON.stringify({
      answers: created.items.map((item) => ({ questionId: item.id, optionIds: item.options.slice(0, 2).map(({ id }) => id) })),
      durationSeconds: 360
    }) });
    assert.equal(submitted.response.status, 201);
    assert.equal(submitted.payload.report.formatVersion, "scenario-report-v3");
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM assessment_answers WHERE session_id = ?").get(created.session.id).count, 20);
    const stored = database.prepare("SELECT option_id, preference_code, subdimension_code FROM assessment_answers WHERE session_id = ? AND question_id = 'Q01'").get(created.session.id);
    assert.deepEqual(stored, { option_id: '["Q01-A","Q01-B"]', preference_code: "V,A", subdimension_code: "structure_mapping,interactive_clarification" });

    const stale = JSON.parse(database.prepare("SELECT report_json FROM assessment_sessions WHERE id = ?").get(created.session.id).report_json);
    stale.modeCards.reverse();
    stale.modeCards[0].subjectExample = "旧版学科建议";
    stale.taskCard.firstStep = "旧版开始方式";
    database.prepare("UPDATE assessment_sessions SET report_json = ? WHERE id = ?").run(JSON.stringify(stale), created.session.id);
    const refreshed = await jsonRequest(`${baseUrl}/api/reports/${created.session.id}`);
    assert.equal(refreshed.response.status, 200);
    assert.doesNotMatch(JSON.stringify(refreshed.payload.report), /旧版学科建议|旧版开始方式/);
    const returnedRates = refreshed.payload.report.modeCards.map(({ code }) => refreshed.payload.report.conclusion.counts.find((count) => count.code === code).rate);
    assert.deepEqual(returnedRates, [...returnedRates].sort((left, right) => right - left));
  });
});

test("other foreign language can start but is never stored as a report language", async () => {
  await withServer(async ({ baseUrl, database }) => {
    const created = await createSession(baseUrl, { foreignLanguage: "其他", targetSubject: "语文" });
    assert.equal(database.prepare("SELECT foreign_language FROM assessment_sessions WHERE id = ?").get(created.session.id).foreign_language, null);
  });
});

test("submit rejects skip-shaped answers and retries after a valid submission", async () => {
  await withServer(async ({ baseUrl, database }) => {
    const created = await createSession(baseUrl);
    const rejected = await jsonRequest(`${baseUrl}/api/sessions/${created.session.id}/submit`, { method: "POST", body: JSON.stringify({ answers: created.items.map(({ id }) => ({ questionId: id, skipped: true })), durationSeconds: 360 }) });
    assert.equal(rejected.response.status, 400);
    const submitted = await jsonRequest(`${baseUrl}/api/sessions/${created.session.id}/submit`, { method: "POST", body: JSON.stringify({ answers: answers(created.items), durationSeconds: 360 }) });
    assert.equal(submitted.response.status, 201); assert.match(submitted.response.headers.get("cache-control"), /no-store/);
    assert.equal(submitted.payload.report.formatVersion, "scenario-report-v3");
    assert.equal(submitted.payload.report.modeCards.length, 4);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM assessment_answers WHERE session_id = ?").get(created.session.id).count, 20);
    const storedSession = database.prepare("SELECT result_type, preference_scores_json, assessment_payload_json FROM assessment_sessions WHERE id = ?").get(created.session.id);
    assert.equal(JSON.parse(storedSession.assessment_payload_json).modeResult.answeredCount, 20);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM assessment_answers WHERE session_id = ? AND option_id = ?").get(created.session.id, '["SKIP"]').count, 0);
    const duplicate = await jsonRequest(`${baseUrl}/api/sessions/${created.session.id}/submit`, { method: "POST", body: JSON.stringify({ answers: [], durationSeconds: 1 }) });
    assert.equal(duplicate.response.status, 200); assert.deepEqual(duplicate.payload.report, submitted.payload.report);
  });
});

test("submit rejects invalid multiselect sets and an invalid language pairing", async () => {
  await withServer(async ({ baseUrl }) => {
    const mismatch = await jsonRequest(`${baseUrl}/api/sessions`, { method: "POST", body: JSON.stringify({ grade: "高三", specialtyDirection: "音乐", foreignLanguage: "日语", targetSubject: "英语", learningLevel: "稳定提升", studentName: "王小明", contact: "微信号123" }) });
    assert.equal(mismatch.response.status, 400);
    for (const mutate of [
      (all) => all.slice(0, 19),
      (all) => { all[0].optionIds = ["O-not-public"]; return all; },
      (all) => { all[0].optionIds = [all[0].optionIds[0], all[0].optionIds[0]]; return all; },
      (all) => { all[0].skipped = true; return all; }
    ]) {
      const created = await createSession(baseUrl);
      const invalid = mutate(answers(created.items, () => ["V", "A"]));
      const submitted = await jsonRequest(`${baseUrl}/api/sessions/${created.session.id}/submit`, { method: "POST", body: JSON.stringify({ answers: invalid, durationSeconds: 60 }) });
      assert.equal(submitted.response.status, 400);
    }
  });
});
