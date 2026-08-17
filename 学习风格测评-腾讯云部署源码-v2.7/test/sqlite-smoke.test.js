import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";

test("better-sqlite3 creates and queries an in-memory database", () => {
  const database = new Database(":memory:");

  try {
    database.exec("CREATE TABLE smoke_test (value INTEGER NOT NULL)");
    database.prepare("INSERT INTO smoke_test (value) VALUES (?)").run(42);

    const row = database.prepare("SELECT value FROM smoke_test").get();
    assert.equal(row.value, 42);
  } finally {
    database.close();
  }
});
