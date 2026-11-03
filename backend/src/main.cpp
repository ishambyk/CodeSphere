#include <httplib.h>
#include <nlohmann/json.hpp>
#include <sqlite3.h>

#include <algorithm>
#include <cstdint>
#include <cstdlib>
#include <exception>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <map>
#include <mutex>
#include <set>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace {

using json = nlohmann::json;
constexpr int kLocalStudentId = 1;

class Statement {
 public:
  Statement(sqlite3* db, const std::string& sql) : db_(db) {
    const int result = sqlite3_prepare_v2(db_, sql.c_str(), -1, &statement_, nullptr);
    if (result != SQLITE_OK) {
      throw std::runtime_error(sqlite3_errmsg(db_));
    }
  }

  ~Statement() { sqlite3_finalize(statement_); }
  Statement(const Statement&) = delete;
  Statement& operator=(const Statement&) = delete;

  sqlite3_stmt* get() const { return statement_; }

  void bindText(int index, const std::string& value) {
    const int result = sqlite3_bind_text(statement_, index, value.c_str(), -1, SQLITE_TRANSIENT);
    if (result != SQLITE_OK) throw std::runtime_error(sqlite3_errmsg(db_));
  }

  void bindInt(int index, int value) {
    const int result = sqlite3_bind_int(statement_, index, value);
    if (result != SQLITE_OK) throw std::runtime_error(sqlite3_errmsg(db_));
  }

  bool stepRow() {
    const int result = sqlite3_step(statement_);
    if (result == SQLITE_ROW) return true;
    if (result == SQLITE_DONE) return false;
    throw std::runtime_error(sqlite3_errmsg(db_));
  }

  void stepDone() {
    const int result = sqlite3_step(statement_);
    if (result != SQLITE_DONE) throw std::runtime_error(sqlite3_errmsg(db_));
  }

 private:
  sqlite3* db_;
  sqlite3_stmt* statement_ = nullptr;
};

std::string columnText(sqlite3_stmt* statement, int column) {
  const auto* text = sqlite3_column_text(statement, column);
  return text ? reinterpret_cast<const char*>(text) : "";
}

std::string decodeSqlCode(std::string code) {
  const std::string newlineEscape = "\\n";
  const std::string sourceEscape = "\\\\n";
  const std::string marker = "\x1f";
  std::size_t position = 0;
  while ((position = code.find(sourceEscape, position)) != std::string::npos) {
    code.replace(position, sourceEscape.size(), marker);
    position += marker.size();
  }
  position = 0;
  while ((position = code.find(newlineEscape, position)) != std::string::npos) {
    code.replace(position, newlineEscape.size(), "\n");
    ++position;
  }
  position = 0;
  while ((position = code.find(marker, position)) != std::string::npos) {
    code.replace(position, marker.size(), newlineEscape);
    position += newlineEscape.size();
  }
  return code;
}

int columnInt(sqlite3_stmt* statement, int column) {
  return sqlite3_column_int(statement, column);
}

void executeSql(sqlite3* db, const std::string& sql) {
  char* error = nullptr;
  const int result = sqlite3_exec(db, sql.c_str(), nullptr, nullptr, &error);
  if (result != SQLITE_OK) {
    const std::string message = error ? error : sqlite3_errmsg(db);
    sqlite3_free(error);
    throw std::runtime_error(message);
  }
}

std::string readFile(const std::filesystem::path& path) {
  std::ifstream input(path, std::ios::binary);
  if (!input) throw std::runtime_error("Could not read migration: " + path.string());
  std::ostringstream contents;
  contents << input.rdbuf();
  return contents.str();
}

void applyMigrations(sqlite3* db, const std::filesystem::path& migrationDirectory) {
  executeSql(db,
      "CREATE TABLE IF NOT EXISTS schema_migrations ("
      "filename TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");

  if (!std::filesystem::exists(migrationDirectory)) {
    throw std::runtime_error("Migration directory not found: " + migrationDirectory.string());
  }

  std::vector<std::filesystem::path> migrations;
  for (const auto& entry : std::filesystem::directory_iterator(migrationDirectory)) {
    if (entry.is_regular_file() && entry.path().extension() == ".sql") {
      migrations.push_back(entry.path());
    }
  }
  std::sort(migrations.begin(), migrations.end());

  for (const auto& migration : migrations) {
    Statement check(db, "SELECT 1 FROM schema_migrations WHERE filename = ?1");
    check.bindText(1, migration.filename().string());
    if (check.stepRow()) continue;

    executeSql(db, "BEGIN IMMEDIATE");
    try {
      executeSql(db, readFile(migration));
      Statement record(db, "INSERT INTO schema_migrations(filename) VALUES(?1)");
      record.bindText(1, migration.filename().string());
      record.stepDone();
      executeSql(db, "COMMIT");
      std::cout << "Applied " << migration.filename().string() << "\n";
    } catch (...) {
      executeSql(db, "ROLLBACK");
      throw;
    }
  }
}

class Database {
 public:
  Database(const std::filesystem::path& filename,
           const std::filesystem::path& migrationDirectory) {
    if (!filename.parent_path().empty()) {
      std::filesystem::create_directories(filename.parent_path());
    }
    const int result = sqlite3_open_v2(filename.string().c_str(), &db_,
                                       SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX,
                                       nullptr);
    if (result != SQLITE_OK) {
      const std::string message = db_ ? sqlite3_errmsg(db_) : "SQLite could not open the database.";
      if (db_) sqlite3_close(db_);
      db_ = nullptr;
      throw std::runtime_error(message);
    }
    sqlite3_busy_timeout(db_, 4000);
    executeSql(db_, "PRAGMA foreign_keys = ON");
    executeSql(db_, "PRAGMA journal_mode = WAL");
    applyMigrations(db_, migrationDirectory);
    std::cout << "SQLite database: " << std::filesystem::absolute(filename).string() << "\n";
  }

  ~Database() {
    if (db_) sqlite3_close(db_);
  }

  Database(const Database&) = delete;
  Database& operator=(const Database&) = delete;

  sqlite3* handle() const { return db_; }
  std::mutex& mutex() { return mutex_; }

 private:
  sqlite3* db_ = nullptr;
  std::mutex mutex_;
};

void jsonResponse(httplib::Response& response, int status, const json& body) {
  response.status = status;
  response.set_content(body.dump(2), "application/json; charset=utf-8");
}

void apiError(httplib::Response& response, int status, const std::string& code,
              const std::string& message) {
  jsonResponse(response, status, {{"error", {{"code", code}, {"message", message}}}});
}

void handleException(httplib::Response& response, const std::exception& error) {
  std::cerr << "API error: " << error.what() << "\n";
  apiError(response, 500, "internal_error", "The local CodeSphere service could not complete the request.");
}

json courseList(sqlite3* db) {
  json courses = json::array();
  Statement query(db,
      "SELECT id, slug, title, language, level, description, duration_text "
      "FROM courses ORDER BY sort_order");
  while (query.stepRow()) {
    const std::string courseId = columnText(query.get(), 0);
    Statement count(db, "SELECT COUNT(*) FROM lessons WHERE course_id = ?1");
    count.bindText(1, courseId);
    count.stepRow();
    courses.push_back({
        {"id", courseId},
        {"slug", columnText(query.get(), 1)},
        {"title", columnText(query.get(), 2)},
        {"language", columnText(query.get(), 3)},
        {"level", columnText(query.get(), 4)},
        {"description", columnText(query.get(), 5)},
        {"durationText", columnText(query.get(), 6)},
        {"moduleCount", columnInt(count.get(), 0)}
    });
  }
  return {{"courses", courses}};
}

json courseLessons(sqlite3* db, const std::string& slug, bool& courseExists) {
  Statement course(db, "SELECT id FROM courses WHERE slug = ?1");
  course.bindText(1, slug);
  if (!course.stepRow()) {
    courseExists = false;
    return {{"lessons", json::array()}};
  }
  courseExists = true;
  const std::string courseId = columnText(course.get(), 0);
  json lessons = json::array();
  Statement query(db,
      "SELECT id, position, title, kind, duration_minutes, summary "
      "FROM lessons WHERE course_id = ?1 ORDER BY position");
  query.bindText(1, courseId);
  while (query.stepRow()) {
    lessons.push_back({
        {"id", columnText(query.get(), 0)},
        {"position", columnInt(query.get(), 1)},
        {"title", columnText(query.get(), 2)},
        {"kind", columnText(query.get(), 3)},
        {"durationMinutes", columnInt(query.get(), 4)},
        {"summary", columnText(query.get(), 5)}
    });
  }
  return {{"lessons", lessons}};
}

json lessonDetail(sqlite3* db, const std::string& lessonId, bool& found) {
  Statement query(db,
      "SELECT l.id, c.language, l.position, l.title, l.kind, l.duration_minutes, "
      "l.summary, l.body, l.example_code, l.explanation "
      "FROM lessons l JOIN courses c ON c.id = l.course_id WHERE l.id = ?1");
  query.bindText(1, lessonId);
  if (!query.stepRow()) {
    found = false;
    return json::object();
  }
  found = true;
  return {{"lesson", {
      {"id", columnText(query.get(), 0)},
      {"language", columnText(query.get(), 1)},
      {"position", columnInt(query.get(), 2)},
      {"title", columnText(query.get(), 3)},
      {"kind", columnText(query.get(), 4)},
      {"durationMinutes", columnInt(query.get(), 5)},
      {"summary", columnText(query.get(), 6)},
      {"body", columnText(query.get(), 7)},
      {"exampleCode", decodeSqlCode(columnText(query.get(), 8))},
      {"explanation", columnText(query.get(), 9)}
  }}};
}

json progressSummary(sqlite3* db) {
  json completedIds = json::array();
  Statement completed(db,
      "SELECT lesson_id FROM lesson_progress WHERE student_id = ?1 ORDER BY completed_at");
  completed.bindInt(1, kLocalStudentId);
  while (completed.stepRow()) completedIds.push_back(columnText(completed.get(), 0));

  json courseProgress = json::array();
  Statement courses(db, "SELECT id, title FROM courses ORDER BY sort_order");
  int completedTotal = 0;
  int lessonTotal = 0;
  while (courses.stepRow()) {
    const std::string courseId = columnText(courses.get(), 0);
    Statement counts(db,
        "SELECT COUNT(l.id), COUNT(lp.lesson_id) FROM lessons l "
        "LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.student_id = ?1 "
        "WHERE l.course_id = ?2");
    counts.bindInt(1, kLocalStudentId);
    counts.bindText(2, courseId);
    counts.stepRow();
    const int total = columnInt(counts.get(), 0);
    const int done = columnInt(counts.get(), 1);
    lessonTotal += total;
    completedTotal += done;
    courseProgress.push_back({
        {"courseId", courseId},
        {"title", columnText(courses.get(), 1)},
        {"completed", done},
        {"total", total},
        {"percent", total == 0 ? 0 : static_cast<int>((done * 100.0 / total) + 0.5)}
    });
  }

  Statement attempts(db,
      "SELECT COUNT(*), COALESCE(AVG(score * 100.0 / total), 0) "
      "FROM quiz_attempts WHERE student_id = ?1");
  attempts.bindInt(1, kLocalStudentId);
  attempts.stepRow();

  std::vector<int> weeklyAttempts(7, 0);  // SQLite weekday order: Sunday through Saturday.
  Statement weekly(db,
      "SELECT CAST(strftime('%w', attempted_at) AS INTEGER), COUNT(*) "
      "FROM quiz_attempts WHERE student_id = ?1 "
      "AND date(attempted_at) >= date('now', '-6 days') GROUP BY 1");
  weekly.bindInt(1, kLocalStudentId);
  while (weekly.stepRow()) {
    const int weekday = columnInt(weekly.get(), 0);
    if (weekday >= 0 && weekday < static_cast<int>(weeklyAttempts.size())) {
      weeklyAttempts[weekday] = columnInt(weekly.get(), 1);
    }
  }

  return {
      {"student", {{"id", kLocalStudentId}, {"displayName", "Local learner"}}},
      {"completedLessonIds", completedIds},
      {"courseProgress", courseProgress},
      {"overallProgress", {
          {"completed", completedTotal},
          {"total", lessonTotal},
          {"percent", lessonTotal == 0 ? 0 : static_cast<int>((completedTotal * 100.0 / lessonTotal) + 0.5)}
      }},
      {"quizSummary", {
          {"attemptCount", columnInt(attempts.get(), 0)},
          {"averagePercent", static_cast<int>(sqlite3_column_double(attempts.get(), 1) + 0.5)}
      }},
      {"weeklyAttempts", weeklyAttempts}
  };
}

json quizList(sqlite3* db) {
  json quizzes = json::array();
  Statement query(db,
      "SELECT q.id, q.title, q.topic, COUNT(questions.id) "
      "FROM quizzes q LEFT JOIN questions ON questions.quiz_id = q.id "
      "GROUP BY q.id ORDER BY q.sort_order");
  while (query.stepRow()) {
    quizzes.push_back({
        {"id", columnText(query.get(), 0)},
        {"title", columnText(query.get(), 1)},
        {"topic", columnText(query.get(), 2)},
        {"questionCount", columnInt(query.get(), 3)}
    });
  }
  return {{"quizzes", quizzes}};
}

json quizDetail(sqlite3* db, const std::string& quizId, bool& found) {
  Statement quiz(db, "SELECT id, title, topic FROM quizzes WHERE id = ?1");
  quiz.bindText(1, quizId);
  if (!quiz.stepRow()) {
    found = false;
    return json::object();
  }
  found = true;
  json questions = json::array();
  Statement query(db,
      "SELECT id, prompt, choices_json FROM questions WHERE quiz_id = ?1 ORDER BY position");
  query.bindText(1, quizId);
  while (query.stepRow()) {
    const std::string questionId = columnText(query.get(), 0);
    const auto choices = json::parse(columnText(query.get(), 2));
    questions.push_back({
        {"id", questionId},
        {"prompt", columnText(query.get(), 1)},
        {"choices", choices}
    });
  }
  return {{"quiz", {
      {"id", columnText(quiz.get(), 0)},
      {"title", columnText(quiz.get(), 1)},
      {"topic", columnText(quiz.get(), 2)},
      {"questions", questions}
  }}};
}

bool submitQuiz(sqlite3* db, const json& body, json& result, int& status,
                std::string& errorMessage) {
  if (!body.is_object() || !body.contains("quizId") || !body["quizId"].is_string() ||
      !body.contains("answers") || !body["answers"].is_array()) {
    status = 400;
    errorMessage = "Send a quizId and an answers array.";
    return false;
  }

  const std::string quizId = body["quizId"].get<std::string>();
  const json& submitted = body["answers"];
  std::map<std::string, int> selected;
  for (const auto& answer : submitted) {
    if (!answer.is_object() || !answer.contains("questionId") || !answer["questionId"].is_string() ||
        !answer.contains("choiceIndex") || !answer["choiceIndex"].is_number_integer()) {
      status = 400;
      errorMessage = "Each answer needs a questionId and integer choiceIndex.";
      return false;
    }
    const std::string questionId = answer["questionId"].get<std::string>();
    const int choiceIndex = answer["choiceIndex"].get<int>();
    if (!selected.emplace(questionId, choiceIndex).second) {
      status = 400;
      errorMessage = "A question can be answered only once.";
      return false;
    }
  }

  Statement quizCheck(db, "SELECT 1 FROM quizzes WHERE id = ?1");
  quizCheck.bindText(1, quizId);
  if (!quizCheck.stepRow()) {
    status = 404;
    errorMessage = "The requested quiz was not found.";
    return false;
  }

  std::vector<json> feedback;
  int score = 0;
  Statement questions(db,
      "SELECT id, prompt, choices_json, correct_index, explanation "
      "FROM questions WHERE quiz_id = ?1 ORDER BY position");
  questions.bindText(1, quizId);
  while (questions.stepRow()) {
    const std::string questionId = columnText(questions.get(), 0);
    const auto selectedAnswer = selected.find(questionId);
    if (selectedAnswer == selected.end()) {
      status = 400;
      errorMessage = "Submit an answer for every question before finishing.";
      return false;
    }
    const auto choices = json::parse(columnText(questions.get(), 2));
    const int correctIndex = columnInt(questions.get(), 3);
    const int choiceIndex = selectedAnswer->second;
    if (choiceIndex < 0 || choiceIndex >= static_cast<int>(choices.size())) {
      status = 400;
      errorMessage = "An answer choice is outside the available range.";
      return false;
    }
    const bool correct = choiceIndex == correctIndex;
    if (correct) ++score;
    feedback.push_back({
        {"questionId", questionId},
        {"prompt", columnText(questions.get(), 1)},
        {"correct", correct},
        {"selectedAnswer", choices.at(choiceIndex)},
        {"correctAnswer", choices.at(correctIndex)},
        {"explanation", columnText(questions.get(), 4)}
    });
  }

  if (feedback.size() != selected.size()) {
    status = 400;
    errorMessage = "One or more submitted questions do not belong to this quiz.";
    return false;
  }

  executeSql(db, "BEGIN IMMEDIATE");
  try {
    Statement attempt(db,
        "INSERT INTO quiz_attempts(student_id, quiz_id, score, total) VALUES(?1, ?2, ?3, ?4)");
    attempt.bindInt(1, kLocalStudentId);
    attempt.bindText(2, quizId);
    attempt.bindInt(3, score);
    attempt.bindInt(4, static_cast<int>(feedback.size()));
    attempt.stepDone();
    const sqlite3_int64 attemptId = sqlite3_last_insert_rowid(db);

    for (std::size_t index = 0; index < feedback.size(); ++index) {
      const std::string questionId = feedback[index]["questionId"].get<std::string>();
      Statement answer(db,
          "INSERT INTO quiz_answers(attempt_id, question_id, choice_index, is_correct) "
          "VALUES(?1, ?2, ?3, ?4)");
      answer.bindInt(1, static_cast<int>(attemptId));
      answer.bindText(2, questionId);
      answer.bindInt(3, selected.at(questionId));
      answer.bindInt(4, feedback[index]["correct"].get<bool>() ? 1 : 0);
      answer.stepDone();
    }
    executeSql(db, "COMMIT");
    result = {
        {"attemptId", attemptId},
        {"quizId", quizId},
        {"score", score},
        {"total", feedback.size()},
        {"feedback", feedback},
        {"saved", true}
    };
    return true;
  } catch (...) {
    executeSql(db, "ROLLBACK");
    throw;
  }
}

struct Options {
  std::filesystem::path database = "data/codesphere.db";
  std::filesystem::path migrations = "migrations";
  std::string host = "127.0.0.1";
  int port = 8080;
};

Options parseOptions(int argc, char** argv) {
  Options options;
  for (int index = 1; index < argc; ++index) {
    const std::string key = argv[index];
    if (key == "--help" || key == "-h") {
      std::cout << "CodeSphere local C++ API\n"
                   "  --db PATH          SQLite database path (default: data/codesphere.db)\n"
                   "  --migrations PATH  SQL migration folder (default: migrations)\n"
                   "  --host ADDRESS     Bind address (default: 127.0.0.1)\n"
                   "  --port NUMBER      HTTP port (default: 8080)\n";
      std::exit(0);
    }
    if (index + 1 >= argc) throw std::runtime_error("Missing value after " + key);
    const std::string value = argv[++index];
    if (key == "--db") options.database = value;
    else if (key == "--migrations") options.migrations = value;
    else if (key == "--host") options.host = value;
    else if (key == "--port") options.port = std::stoi(value);
    else throw std::runtime_error("Unknown option: " + key);
  }
  if (options.port < 1 || options.port > 65535) throw std::runtime_error("Port must be between 1 and 65535.");
  if (options.host != "127.0.0.1" && options.host != "localhost") {
    throw std::runtime_error("This classroom backend only accepts loopback host addresses.");
  }
  return options;
}

void addCorsHeaders(const httplib::Request& request, httplib::Response& response) {
  const std::string origin = request.get_header_value("Origin");
  static const std::set<std::string> allowedOrigins = {
      "http://localhost:4173", "http://127.0.0.1:4173",
      "http://localhost:5500", "http://127.0.0.1:5500"
  };
  if (allowedOrigins.count(origin) != 0) {
    response.set_header("Access-Control-Allow-Origin", origin);
    response.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.set_header("Access-Control-Allow-Headers", "Content-Type");
    response.set_header("Access-Control-Max-Age", "600");
    response.set_header("Vary", "Origin");
  }
}

void registerRoutes(httplib::Server& server, Database& database) {
  sqlite3* db = database.handle();
  server.set_payload_max_length(64 * 1024);
  server.set_post_routing_handler(addCorsHeaders);
  server.Options(R"(/api/v1/.*)", [](const httplib::Request&, httplib::Response& response) {
    response.status = 204;
  });
  server.set_error_handler([](const httplib::Request&, httplib::Response& response) {
    if (response.body.empty()) {
      const int status = response.status == 404 ? 404 : 400;
      apiError(response, status, status == 404 ? "not_found" : "bad_request",
               status == 404 ? "The requested endpoint was not found." : "The request could not be processed.");
    }
  });
  server.set_exception_handler([](const httplib::Request&, httplib::Response& response,
                                  std::exception_ptr error) {
    try {
      if (error) std::rethrow_exception(error);
    } catch (const std::exception& exception) {
      handleException(response, exception);
    } catch (...) {
      apiError(response, 500, "internal_error", "The local CodeSphere service encountered an unknown error.");
    }
  });

  server.Get("/healthz", [](const httplib::Request&, httplib::Response& response) {
    jsonResponse(response, 200, {{"status", "ok"}, {"service", "CodeSphere C++ API"}, {"storage", "SQLite"}});
  });

  server.Get("/api/v1/courses", [&database, db](const httplib::Request&, httplib::Response& response) {
    try {
      std::lock_guard<std::mutex> lock(database.mutex());
      jsonResponse(response, 200, courseList(db));
    } catch (const std::exception& error) { handleException(response, error); }
  });

  server.Get(R"(/api/v1/courses/([^/]+)/lessons)", [&database, db](const httplib::Request& request, httplib::Response& response) {
    try {
      std::lock_guard<std::mutex> lock(database.mutex());
      bool found = false;
      const json body = courseLessons(db, request.matches[1].str(), found);
      if (!found) return apiError(response, 404, "course_not_found", "The requested course was not found.");
      jsonResponse(response, 200, body);
    } catch (const std::exception& error) { handleException(response, error); }
  });

  server.Get(R"(/api/v1/lessons/([^/]+))", [&database, db](const httplib::Request& request, httplib::Response& response) {
    try {
      std::lock_guard<std::mutex> lock(database.mutex());
      bool found = false;
      const json body = lessonDetail(db, request.matches[1].str(), found);
      if (!found) return apiError(response, 404, "lesson_not_found", "The requested lesson was not found.");
      jsonResponse(response, 200, body);
    } catch (const std::exception& error) { handleException(response, error); }
  });

  server.Post(R"(/api/v1/lessons/([^/]+)/completion)", [&database, db](const httplib::Request& request, httplib::Response& response) {
    try {
      std::lock_guard<std::mutex> lock(database.mutex());
      const std::string lessonId = request.matches[1].str();
      Statement lesson(db, "SELECT id FROM lessons WHERE id = ?1");
      lesson.bindText(1, lessonId);
      if (!lesson.stepRow()) return apiError(response, 404, "lesson_not_found", "The requested lesson was not found.");
      executeSql(db, "BEGIN IMMEDIATE");
      try {
        Statement save(db,
            "INSERT INTO lesson_progress(student_id, lesson_id) VALUES(?1, ?2) "
            "ON CONFLICT(student_id, lesson_id) DO NOTHING");
        save.bindInt(1, kLocalStudentId);
        save.bindText(2, lessonId);
        save.stepDone();
        executeSql(db, "COMMIT");
      } catch (...) {
        executeSql(db, "ROLLBACK");
        throw;
      }
      Statement timestamp(db,
          "SELECT completed_at FROM lesson_progress WHERE student_id = ?1 AND lesson_id = ?2");
      timestamp.bindInt(1, kLocalStudentId);
      timestamp.bindText(2, lessonId);
      timestamp.stepRow();
      jsonResponse(response, 200, {{"lessonId", lessonId}, {"completedAt", columnText(timestamp.get(), 0)}, {"saved", true}});
    } catch (const std::exception& error) { handleException(response, error); }
  });

  server.Get("/api/v1/me/progress", [&database, db](const httplib::Request&, httplib::Response& response) {
    try {
      std::lock_guard<std::mutex> lock(database.mutex());
      jsonResponse(response, 200, progressSummary(db));
    } catch (const std::exception& error) { handleException(response, error); }
  });

  server.Get("/api/v1/quizzes", [&database, db](const httplib::Request&, httplib::Response& response) {
    try {
      std::lock_guard<std::mutex> lock(database.mutex());
      jsonResponse(response, 200, quizList(db));
    } catch (const std::exception& error) { handleException(response, error); }
  });

  server.Get(R"(/api/v1/quizzes/([^/]+))", [&database, db](const httplib::Request& request, httplib::Response& response) {
    try {
      std::lock_guard<std::mutex> lock(database.mutex());
      bool found = false;
      const json body = quizDetail(db, request.matches[1].str(), found);
      if (!found) return apiError(response, 404, "quiz_not_found", "The requested quiz was not found.");
      jsonResponse(response, 200, body);
    } catch (const std::exception& error) { handleException(response, error); }
  });

  server.Post("/api/v1/quiz-attempts", [&database, db](const httplib::Request& request, httplib::Response& response) {
    try {
      json body;
      try {
        body = json::parse(request.body);
      } catch (const json::parse_error&) {
        return apiError(response, 400, "invalid_json", "The request body must contain valid JSON.");
      }
      std::lock_guard<std::mutex> lock(database.mutex());
      json result;
      int status = 400;
      std::string errorMessage;
      if (!submitQuiz(db, body, result, status, errorMessage)) {
        return apiError(response, status, status == 404 ? "quiz_not_found" : "invalid_attempt", errorMessage);
      }
      jsonResponse(response, 201, result);
    } catch (const std::exception& error) { handleException(response, error); }
  });
}

}  // namespace

int main(int argc, char** argv) {
  try {
    const Options options = parseOptions(argc, argv);
    Database database(options.database, options.migrations);
    httplib::Server server;
    registerRoutes(server, database);
    std::cout << "CodeSphere C++ API listening at http://" << options.host << ':' << options.port << "\n"
              << "Local single-learner mode; do not expose this service to a public network.\n"
              << "Press Ctrl+C to stop.\n";
    if (!server.listen(options.host, options.port)) {
      std::cerr << "Could not listen on " << options.host << ':' << options.port << ".\n";
      return 1;
    }
  } catch (const std::exception& error) {
    std::cerr << "CodeSphere backend could not start: " << error.what() << "\n";
    return 1;
  }
  return 0;
}
