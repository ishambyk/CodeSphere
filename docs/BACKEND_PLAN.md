# C++ backend implementation and next steps

The first local backend is implemented in `backend/`. It uses C++17, a loopback HTTP service, and SQLite migrations. It serves course content, returns quiz questions without keys, grades quiz submissions in C++, saves lesson completions and attempts, and serves database-backed progress.

## Current implementation

- `backend/src/main.cpp` contains the HTTP routes, request validation, grading, transaction handling, and SQLite access.
- `backend/migrations/001_initial_schema.sql` creates learner, course, lesson, quiz, attempt, answer, and progress tables with foreign keys and constraints.
- `backend/migrations/002_seed_local_curriculum.sql` adds C/C++ lesson content and five question sets.
- `backend/vcpkg.json` declares the HTTP, JSON, and SQLite libraries.
- `js/api-client.js` calls the real local service. The frontend checks `/healthz` on load and shows live data only after the API responds. If it cannot connect, the page marks itself as preview mode.

## Practical next milestones

1. Install a C++17 compiler, CMake, Git, and vcpkg, then build the service using `backend/README.md`.
2. Run the frontend on port 4173 and backend on port 8080. Confirm the status shows **API connected** and verify a lesson completion and quiz attempt survive a page refresh.
3. If the project needs multiple student profiles, add registration and authentication before exposing learner-specific progress. Do not accept a student ID from the browser as proof of identity.
4. Add server-side pagination/content authoring only if the course scope grows.
5. Keep code execution out of scope unless explicitly required. The current site renders source examples only.

## Current scope limits

The service is a local, single-learner classroom backend. It binds to `127.0.0.1`, has no authentication, and is not suitable for public hosting. The frontend only permits configured localhost development origins. This keeps the mini-project focused on C++, HTTP/JSON integration, SQL migrations, persistence, and server-side quiz grading.
