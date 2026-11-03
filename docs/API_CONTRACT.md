# CodeSphere local API contract

This contract describes the implemented local C++ API. It uses JSON and `/api/v1`. The backend binds to `127.0.0.1` by default and accepts frontend origins on ports 4173 and 5500. It is a single-learner classroom build without authentication; do not expose it to a public network.

Error responses use this shape:

```json
{
  "error": {
    "code": "lesson_not_found",
    "message": "The requested lesson was not found."
  }
}
```

## Health

`GET /healthz`

```json
{ "status": "ok", "service": "CodeSphere C++ API", "storage": "SQLite" }
```

## Courses and lessons

`GET /api/v1/courses`

```json
{
  "courses": [
    {
      "id": "c",
      "slug": "c",
      "title": "C Foundations",
      "language": "C",
      "level": "Beginner",
      "description": "...",
      "durationText": "2.5h",
      "moduleCount": 8
    }
  ]
}
```

`GET /api/v1/courses/{slug}/lessons` returns ordered summaries: `id`, `position`, `title`, `kind`, `durationMinutes`, and `summary`.

`GET /api/v1/lessons/{id}` returns a `lesson` with its summary, explanatory body, example source code, and explanation. Example source is displayed as text; the backend does not execute it.

## Lesson completion

`POST /api/v1/lessons/{id}/completion`

```json
{}
```

The route uses the seeded local learner identity and inserts the `(student_id, lesson_id)` completion once. The response contains `lessonId`, `completedAt`, and `saved: true`.

## Progress

`GET /api/v1/me/progress`

```json
{
  "student": { "id": 1, "displayName": "Local learner" },
  "completedLessonIds": ["c-start"],
  "courseProgress": [
    { "courseId": "c", "title": "C Foundations", "completed": 1, "total": 8, "percent": 13 }
  ],
  "overallProgress": { "completed": 1, "total": 18, "percent": 6 },
  "quizSummary": { "attemptCount": 1, "averagePercent": 80 },
  "weeklyAttempts": [0, 1, 0, 0, 0, 0, 0]
}
```

`weeklyAttempts` is a seven-element array in SQLite weekday order: Sunday through Saturday.

## Quiz loading and server grading

`GET /api/v1/quizzes/{id}` returns questions and choices but never includes answer keys:

```json
{
  "quiz": {
    "id": "daily",
    "title": "Daily mixed practice",
    "topic": "Daily practice",
    "questions": [
      { "id": "daily-1", "prompt": "What is 15% of 240?", "choices": ["24", "30", "36", "42"] }
    ]
  }
}
```

`POST /api/v1/quiz-attempts` submits all answers. The server checks that every question belongs to the selected quiz, grades against the SQLite answer key, then saves the attempt and all selected choices in one transaction.

```json
{
  "quizId": "daily",
  "answers": [
    { "questionId": "daily-1", "choiceIndex": 2 }
  ]
}
```

The response includes the server-calculated score, total, saved attempt ID, and review feedback with selected answer, correct answer, and explanation. The frontend never supplies a score as authoritative.
