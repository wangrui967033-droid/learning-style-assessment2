import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { generateOpaqueToken, maskPhone } from "../lib/security.js";

const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

function removeStoredPhoneNumbers(value) {
  if (!value || typeof value !== "object") return false;
  let changed = false;
  for (const key of Object.keys(value)) {
    if (key === "phoneNumber") {
      delete value[key];
      changed = true;
    } else if (removeStoredPhoneNumbers(value[key])) {
      changed = true;
    }
  }
  return changed;
}

function sanitizeStoredReports(database) {
  const rows = database.prepare(`
    SELECT id, phone_number, report_json FROM assessment_sessions
    WHERE report_json IS NOT NULL
  `).all();
  const updateReport = database.prepare("UPDATE assessment_sessions SET report_json = ? WHERE id = ?");
  for (const row of rows) {
    let report;
    try {
      report = JSON.parse(row.report_json);
    } catch {
      continue;
    }
    if (!report || typeof report !== "object" || Array.isArray(report)) continue;
    const changed = removeStoredPhoneNumbers(report);
    if (changed) {
      const maskedPhone = maskPhone(row.phone_number);
      if (maskedPhone) report.maskedPhone = maskedPhone;
      updateReport.run(JSON.stringify(report), row.id);
    }
  }
}

export function initializeDatabase(database) {
  database.pragma("foreign_keys = ON");
  if (database.name !== ":memory:") database.pragma("journal_mode = WAL");
  database.exec(schema);
  const sessionColumns = database.pragma("table_info(assessment_sessions)");
  if (!sessionColumns.some(({ name }) => name === "retry_timestamps_json")) {
    database.exec("ALTER TABLE assessment_sessions ADD COLUMN retry_timestamps_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!sessionColumns.some(({ name }) => name === "quality_status")) {
    database.exec("ALTER TABLE assessment_sessions ADD COLUMN quality_status TEXT");
  }
  if (!sessionColumns.some(({ name }) => name === "quality_flags_json")) {
    database.exec("ALTER TABLE assessment_sessions ADD COLUMN quality_flags_json TEXT");
  }
  if (!sessionColumns.some(({ name }) => name === "prepared_duration_seconds")) {
    database.exec("ALTER TABLE assessment_sessions ADD COLUMN prepared_duration_seconds INTEGER");
  }
  if (!sessionColumns.some(({ name }) => name === "prepared_answers_hash")) {
    database.exec("ALTER TABLE assessment_sessions ADD COLUMN prepared_answers_hash TEXT");
  }
  if (!sessionColumns.some(({ name }) => name === "student_name")) {
    database.exec("ALTER TABLE assessment_sessions ADD COLUMN student_name TEXT");
  }
  if (!sessionColumns.some(({ name }) => name === "phone_number")) {
    database.exec("ALTER TABLE assessment_sessions ADD COLUMN phone_number TEXT");
  }
  if (!sessionColumns.some(({ name }) => name === "privacy_consented_at")) {
    database.exec("ALTER TABLE assessment_sessions ADD COLUMN privacy_consented_at TEXT");
  }
  if (!sessionColumns.some(({ name }) => name === "learning_focus")) {
    database.exec("ALTER TABLE assessment_sessions ADD COLUMN learning_focus TEXT NOT NULL DEFAULT 'practice'");
  }
  if (!sessionColumns.some(({ name }) => name === "learning_task")) {
    database.exec("ALTER TABLE assessment_sessions ADD COLUMN learning_task TEXT NOT NULL DEFAULT '本周学习任务'");
  }
  if (!sessionColumns.some(({ name }) => name === "target_subject_score")) {
    database.exec("ALTER TABLE assessment_sessions ADD COLUMN target_subject_score REAL");
  }
  if (!sessionColumns.some(({ name }) => name === "target_subject_full_score")) {
    database.exec("ALTER TABLE assessment_sessions ADD COLUMN target_subject_full_score INTEGER");
  }
  if (!sessionColumns.some(({ name }) => name === "score_level")) {
    database.exec("ALTER TABLE assessment_sessions ADD COLUMN score_level TEXT");
  }
  if (!sessionColumns.some(({ name }) => name === "task_unit_id")) {
    database.exec("ALTER TABLE assessment_sessions ADD COLUMN task_unit_id TEXT");
  }
  if (!sessionColumns.some(({ name }) => name === "report_access_token")) {
    database.exec("ALTER TABLE assessment_sessions ADD COLUMN report_access_token TEXT");
  }
  const tokenRows = database.prepare("SELECT id, report_access_token FROM assessment_sessions ORDER BY rowid").all();
  const seenTokens = new Set();
  const updateToken = database.prepare("UPDATE assessment_sessions SET report_access_token = ? WHERE id = ?");
  for (const row of tokenRows) {
    let token = row.report_access_token;
    if (typeof token !== "string" || token.length === 0 || seenTokens.has(token)) {
      do token = generateOpaqueToken(); while (seenTokens.has(token));
      updateToken.run(token, row.id);
    }
    seenTokens.add(token);
  }
  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS assessment_sessions_report_access_token_uq
    ON assessment_sessions(report_access_token)
  `);
  if (sessionColumns.some(({ name }) => name === "report_json")) sanitizeStoredReports(database);
  return database;
}

export function openDatabase(path) {
  return initializeDatabase(new Database(path));
}
