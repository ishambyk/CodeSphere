# CodeSphere

**Computing Aptitude & C/C++ Learning Platform**

CodeSphere is a separate project inspired by CampusLoop's navy, warm cream, and gold palette. The frontend uses HTML, CSS, and JavaScript; a local C++17 HTTP API grades quizzes and stores lesson completions and quiz attempts in SQLite.

## Run the frontend

Open a PowerShell window in this folder and start the static frontend server:

```powershell
py -m http.server 4173 --bind 127.0.0.1
```

Open <http://127.0.0.1:4173>. Stop the frontend server with `Ctrl+C`. Without the C++ service, the page stays in clearly labeled preview mode: lesson marks and quiz scores are temporary and are not saved.

## Build and run the C++ backend on Windows

You need a C++17 compiler, CMake 3.24+, Git, and vcpkg. The manifest in `backend/vcpkg.json` installs cpp-httplib, nlohmann/json, and SQLite for the build. cpp-httplib is used as the HTTP layer; nlohmann/json handles API payloads; SQLite stores content, attempts, and completions.

If vcpkg is not installed, install it once:

```powershell
git clone https://github.com/microsoft/vcpkg.git "$env:USERPROFILE\vcpkg"
& "$env:USERPROFILE\vcpkg\bootstrap-vcpkg.bat" -disableMetrics
$env:VCPKG_ROOT = "$env:USERPROFILE\vcpkg"
```

Then build the backend from the CodeSphere folder:

```powershell
cmake -S backend -B backend/build -DCMAKE_TOOLCHAIN_FILE="$env:VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake"
cmake --build backend/build --config Release
Set-Location backend
.\build\bin\codesphere-server.exe
```

The first CMake configure downloads dependencies through vcpkg. The server applies the SQL migrations and creates `backend/data/codesphere.db` automatically. Keep this terminal open while using the frontend. Refresh <http://localhost:4173>; the status changes to **API connected** when the C++ service is reachable.

The default server binds only to `127.0.0.1:8080`. It uses a single local learner and has no login or multi-user access. Keep it on your own computer; it is not configured for public hosting.

## What is connected

- C and C++ course and lesson lists are read from SQLite.
- Lesson details and example code are returned by the C++ API.
- Lesson completion is saved to SQLite.
- Quiz questions are loaded from SQLite without answer keys.
- The C++ API grades submitted choices, saves the attempt and answers in one transaction, and returns the review.
- Progress totals and weekly quiz counts are read from the database.
- If the backend is stopped, the interface falls back to the clearly labeled local preview. No backend request is treated as successful when it fails.

The snippets are lesson content only; this project does not compile or execute learner-submitted C/C++ code.

## Project structure

```text
CodeSphere/
├── index.html
├── css/styles.css
├── js/app.js
├── js/api-client.js
├── backend/
│   ├── CMakeLists.txt
│   ├── vcpkg.json
│   ├── src/main.cpp
│   ├── migrations/
│   └── data/
└── docs/
    ├── API_CONTRACT.md
    └── BACKEND_PLAN.md
```

See [backend/README.md](backend/README.md) for endpoints and troubleshooting.
