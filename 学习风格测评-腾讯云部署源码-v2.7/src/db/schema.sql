CREATE TABLE IF NOT EXISTS assessment_sessions (
  id TEXT PRIMARY KEY,
  anonymous_code TEXT NOT NULL UNIQUE,
  report_access_token TEXT NOT NULL,
  student_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  privacy_consented_at TEXT NOT NULL,
  grade TEXT,
  score_band TEXT,
  specialty_direction TEXT,
  foreign_language TEXT,
  exam_subjects_json TEXT,
  target_subject TEXT NOT NULL,
  learning_focus TEXT NOT NULL DEFAULT 'practice',
  learning_task TEXT NOT NULL DEFAULT '本周学习任务',
  target_subject_score REAL,
  target_subject_full_score INTEGER,
  score_level TEXT,
  task_unit_id TEXT,
  assessment_version TEXT NOT NULL,
  started_at TEXT NOT NULL,
  submitted_at TEXT,
  retry_timestamps_json TEXT NOT NULL DEFAULT '[]',
  duration_seconds INTEGER,
  dynamic_pair TEXT,
  dynamic_result TEXT,
  result_type TEXT,
  primary_preference TEXT,
  secondary_preference TEXT,
  preference_scores_json TEXT,
  science_scores_json TEXT,
  quality_status TEXT,
  quality_flags_json TEXT,
  prepared_duration_seconds INTEGER,
  prepared_answers_hash TEXT,
  report_json TEXT
);

CREATE TABLE IF NOT EXISTS assessment_answers (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  answer_type TEXT NOT NULL CHECK (answer_type IN ('scale', 'choice')),
  section_code TEXT NOT NULL,
  option_id TEXT,
  preference_code TEXT,
  subdimension_code TEXT,
  process_code TEXT,
  scenario_type TEXT,
  is_reverse INTEGER NOT NULL DEFAULT 0 CHECK (is_reverse IN (0, 1)),
  response_value INTEGER,
  scored_value REAL,
  scenario_weight REAL,
  response_time_ms INTEGER,
  answered_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES assessment_sessions(id),
  UNIQUE (session_id, question_id),
  CHECK (
    (answer_type = 'scale' AND response_value BETWEEN 1 AND 5)
    OR (answer_type = 'choice' AND option_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS assessment_feedback (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  fit_rating INTEGER CHECK (fit_rating BETWEEN 1 AND 5),
  self_identified_preference TEXT,
  helpful_section TEXT,
  confusing_text TEXT,
  comment TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES assessment_sessions(id)
);
