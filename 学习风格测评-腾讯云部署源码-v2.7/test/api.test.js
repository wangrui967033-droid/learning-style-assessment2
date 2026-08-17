import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db/database.js";

async function withServer(run) {
  const database = openDatabase(":memory:");
  const app = createApp({ database, config: { adminExportToken: "secret", assessmentVersion: "learning-mode-v1" } });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    database.close();
  }
}

const basic = {
  studentName: "王小明",
  contact: "13800138000",
  grade: "高三",
  specialtyDirection: "美术设计",
  foreignLanguage: "英语",
  targetSubject: "英语",
  learningLevel: "稳定提升"
};

test("health endpoint is available without exposing implementation details", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  });
});

test("session input is an allowlist and rejects unsupported personal fields", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...basic, name: "不应收集姓名" })
    });
    assert.equal(response.status, 400);
  });
});

test("admin export requires the configured bearer token", async () => {
  await withServer(async (baseUrl) => {
    const denied = await fetch(`${baseUrl}/api/admin/export.csv`);
    assert.equal(denied.status, 401);

    const allowed = await fetch(`${baseUrl}/api/admin/export.csv`, {
      headers: { authorization: "Bearer secret" }
    });
    assert.equal(allowed.status, 200);
    assert.match(allowed.headers.get("content-type"), /text\/csv/);
    assert.match(allowed.headers.get("content-disposition"), /learning-mode-assessment\.csv/);
  });
});

test("oversized JSON bodies are rejected", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...basic, padding: "x".repeat(300_000) })
    });
    assert.equal(response.status, 413);
  });
});
