# CodeSphere C++ API

This is a local, single-learner backend for the CodeSphere frontend. It is implemented in C++17, uses cpp-httplib for HTTP, nlohmann/json for JSON, and SQLite for storage. It binds to `127.0.0.1` by default and has no authentication, so do not expose it to a public network.

## Build

Install a C++17 compiler, CMake 3.24+, Git, and vcpkg. From the CodeSphere folder:

```powershell
$env:VCPKG_ROOT = "$env:USERPROFILE\vcpkg"
cmake -S backend -B backend/build -DCMAKE_TOOLCHAIN_FILE="$env:VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake"
cmake --build backend/build --config Release
```

The vcpkg manifest installs the three dependencies. On the first run, the server applies numbered SQL migrations and creates `backend/data/codesphere.db`.

## Start

```powershell
Set-Location backend
.\build\bin\codesphere-server.exe
```

Optional arguments: `--db PATH`, `--migrations PATH`, `--host 127.0.0.1`, and `--port 8080`. The server rejects non-loopback host values. Keep the process open while the browser app is in use.

## API routes

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/healthz` | Reports service and SQLite status |
| `GET` | `/api/v1/courses` | Lists seeded C and C++ courses |
| `GET` | `/api/v1/courses/{slug}/lessons` | Lists ordered lesson summaries |
| `GET` | `/api/v1/lessons/{id}` | Returns lesson text and example code |
| `POST` | `/api/v1/lessons/{id}/completion` | Saves one lesson completion for the local learner |
| `GET` | `/api/v1/me/progress` | Returns saved course totals, attempts, and a weekly count |
| `GET` | `/api/v1/quizzes/{id}` | Returns question prompts and choices, without answer keys |
| `POST` | `/api/v1/quiz-attempts` | Grades on the server and stores the attempt and answers transactionally |

The frontend on ports 4173 and 5500 is allowed by the development CORS policy. The API accepts no learner ID from the browser; this classroom version always uses the seeded local learner row. Multi-user access requires authentication and is outside this first backend milestone.

## Troubleshooting

- **CMake cannot find a compiler:** install a C++17 toolchain and CMake, reopen PowerShell, then configure again.
- **vcpkg is not found:** set `$env:VCPKG_ROOT` to the folder containing `scripts/buildsystems/vcpkg.cmake`.
- **Address already in use:** start the backend with `--port 8081` and set `window.CODESPHERE_API_ORIGIN = 'http://127.0.0.1:8081'` before `js/app.js` loads.
- **Frontend still says preview mode:** keep the backend running, use the frontend at `http://localhost:4173` or `http://127.0.0.1:4173`, and refresh the page.
