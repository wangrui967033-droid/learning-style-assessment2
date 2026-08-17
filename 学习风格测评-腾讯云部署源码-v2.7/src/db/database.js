import { readFileSync } from "node:fs";
import Database from "better-sqlite3";

const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

export function initializeDatabase(database) {
  database.pragma("foreign_keys = ON");
  if (database.name !== ":memory:") database.pragma("journal_mode = WAL");
  database.exec(schema);
  const sessionColumns = new Set(database.pragma("table_info(assessment_sessions)").map(({ name }) => name));
  const additions = [
    ["retry_timestamps_json", "TEXT NOT NULL DEFAULT '[]'"],
    ["student_name", "TEXT"],
    ["contact", "TEXT"],
    ["learning_level", "TEXT"],
    ["question_bank_version", "TEXT"],
    ["scoring_version", "TEXT"],
    ["assessment_payload_json", "TEXT"]
  ];
  for (const [name, definition] of additions) {
    if (!sessionColumns.has(name)) database.exec(`ALTER TABLE assessment_sessions ADD COLUMN ${name} ${definition}`);
  }
  return database;
}

export function openDatabase(path) {
  return initializeDatabase(new Database(path));
}
