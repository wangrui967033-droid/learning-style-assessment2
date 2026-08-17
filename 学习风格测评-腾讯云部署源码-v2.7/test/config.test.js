import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";

test("loadConfig requires an admin export token", () => {
  assert.throws(() => loadConfig({ DATABASE_PATH: ":memory:" }), /ADMIN_EXPORT_TOKEN/);
});

test("loadConfig normalizes defaults", () => {
  const config = loadConfig({ ADMIN_EXPORT_TOKEN: "secret" });
  assert.equal(config.port, 3000);
  assert.equal(config.databasePath, "./data/assessment.sqlite");
  assert.equal(config.adminExportToken, "secret");
  assert.equal(config.publicBaseUrl, "http://localhost:3000");
});
