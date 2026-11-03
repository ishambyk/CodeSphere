CREATE TABLE students (
  id INTEGER PRIMARY KEY,
  display_name TEXT NOT NULL
);

CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  language TEXT NOT NULL,
  level TEXT NOT NULL,
  description TEXT NOT NULL,
  duration_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL UNIQUE
);

CREATE TABLE lessons (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK(duration_minutes > 0),
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  example_code TEXT NOT NULL,
  explanation TEXT NOT NULL,
  UNIQUE(course_id, position)
);

CREATE TABLE lesson_progress (
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(student_id, lesson_id)
);

CREATE TABLE quizzes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  sort_order INTEGER NOT NULL UNIQUE
);

CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  choices_json TEXT NOT NULL,
  correct_index INTEGER NOT NULL CHECK(correct_index >= 0),
  explanation TEXT NOT NULL,
  UNIQUE(quiz_id, position)
);

CREATE TABLE quiz_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id),
  score INTEGER NOT NULL CHECK(score >= 0),
  total INTEGER NOT NULL CHECK(total > 0),
  attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quiz_answers (
  attempt_id INTEGER NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id),
  choice_index INTEGER NOT NULL CHECK(choice_index >= 0),
  is_correct INTEGER NOT NULL CHECK(is_correct IN (0, 1)),
  PRIMARY KEY(attempt_id, question_id)
);

CREATE INDEX idx_lessons_course_position ON lessons(course_id, position);
CREATE INDEX idx_attempts_student_date ON quiz_attempts(student_id, attempted_at);
