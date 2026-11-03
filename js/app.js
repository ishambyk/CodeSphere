/* CodeSphere frontend preview: all state below lives only in this browser tab. */
(function () {
  "use strict";

  const viewNames = {
    dashboard: "Home",
    learn: "Learning paths",
    aptitude: "Aptitude practice",
    quiz: "Practice session",
    progress: "My progress"
  };
  const views = Array.from(document.querySelectorAll(".view"));
  const navItems = Array.from(document.querySelectorAll(".nav-item"));
  const currentSectionLabel = document.querySelector("#current-section-label");
  const toastRegion = document.querySelector("#toast-region");
  const completedThisVisit = new Set();
  const savedLessonIds = new Set();
  const backendCourseLessons = {};
  let activeCourse = "c";
  let activeLesson = null;
  let activeQuiz = null;
  let backendApi = null;
  let backendConnected = false;
  let toastTimer = null;

  const courseContent = {
    c: {
      level: "THE FOUNDATIONS",
      title: "A clear start with C.",
      description: "Learn how a program moves: from values and decisions to functions and memory. Each lesson is short, focused, and built around one useful idea.",
      count: "8",
      duration: "2.5h",
      lessons: [
        { id: "c-start", title: "A first look at C", kind: "Getting oriented", time: "10 min", code: "#include <stdio.h>\n\nint main(void) {\n    printf(\"Hello, world!\\n\");\n    return 0;\n}", copy: "A C program begins in main. The include line makes the standard input and output tools available to your program.", explanation: "Start by finding the entry point, then read each line from top to bottom." },
        { id: "c-values", title: "Values, variables & types", kind: "Working with data", time: "14 min", code: "int score = 12;\nfloat average = 8.5f;\nchar grade = 'A';", copy: "A variable gives a value a name. Its type tells C how to interpret and store that value.", explanation: "Choose a type that matches the kind of information you need to represent." },
        { id: "c-decisions", title: "Making a decision", kind: "Conditions", time: "12 min", code: "if (score >= 10) {\n    puts(\"Ready\");\n} else {\n    puts(\"Keep practicing\");\n}", copy: "A condition lets a program choose a path. The expression inside the parentheses evaluates to true or false.", explanation: "Try tracing the condition with one value above and one value below the threshold." },
        { id: "c-functions", title: "Function fundamentals", kind: "Reusable logic", time: "12 min", code: "int add(int a, int b) {\n    return a + b;\n}\n\nint total = add(3, 4);", copy: "A function gives a useful task a name. Parameters carry information in; a return value can carry a result back.", explanation: "The signature describes the result type and the information the function expects." },
        { id: "c-loops", title: "Repeating with loops", kind: "Iteration", time: "13 min", code: "for (int i = 0; i < 3; i++) {\n    printf(\"%d\\n\", i);\n}", copy: "A loop repeats a block of work while its condition remains true. The for loop puts its setup, condition, and update together.", explanation: "Always trace the condition and update so the loop has a clear stopping point." },
        { id: "c-arrays", title: "A collection of values", kind: "Arrays", time: "15 min", code: "int marks[3] = {8, 9, 10};\nprintf(\"%d\\n\", marks[0]);", copy: "An array stores several values of the same type under one name. Its positions start at index zero.", explanation: "For an array of three items, the valid indexes are 0, 1, and 2." },
        { id: "c-pointers", title: "Pointers, gently", kind: "Memory basics", time: "18 min", code: "int value = 7;\nint *address = &value;\nprintf(\"%d\\n\", *address);", copy: "A pointer holds an address. The address-of operator finds where a variable lives; dereferencing reads the value at that address.", explanation: "First distinguish the address (`&value`) from the value at that address (`*address`)." },
        { id: "c-strings", title: "Text and C strings", kind: "Character arrays", time: "16 min", code: "char name[] = \"Mira\";\nprintf(\"Hello, %s\\n\", name);", copy: "In C, text is represented as a sequence of characters ending with a special null character.", explanation: "The null terminator marks the end of the string for standard C string functions." }
      ]
    },
    cpp: {
      level: "A MODERN START",
      title: "Meet modern C++.",
      description: "Build on programming fundamentals and explore objects, standard library tools, and expressive ways to organize a program.",
      count: "10",
      duration: "3h",
      lessons: [
        { id: "cpp-start", title: "A first look at C++", kind: "Getting oriented", time: "10 min", code: "#include <iostream>\n\nint main() {\n    std::cout << \"Hello, world!\\n\";\n}", copy: "C++ includes the standard input and output stream tools from iostream. The main function is where execution begins.", explanation: "Notice the scope operator in std::cout: it identifies cout as part of the std namespace." },
        { id: "cpp-types", title: "Types and auto", kind: "Working with data", time: "13 min", code: "int count = 4;\nauto next = count + 1;\nconst std::string name = \"Mira\";", copy: "C++ offers familiar built-in types and can infer a variable's type with auto when the initializer makes it clear.", explanation: "Use const for values that should not change after initialization." },
        { id: "cpp-conditions", title: "Decisions & repetition", kind: "Control flow", time: "13 min", code: "for (int n : {2, 4, 6}) {\n    std::cout << n << '\\n';\n}", copy: "Control flow helps your program choose and repeat. A range-based for loop is a readable way to visit every item in a range.", explanation: "Use a range-based loop when you need each value and do not need to manage an index." },
        { id: "cpp-functions", title: "Functions & parameters", kind: "Reusable logic", time: "14 min", code: "int add(int left, int right) {\n    return left + right;\n}\n\nauto total = add(3, 4);", copy: "Functions collect a task into one named place. Clear parameter names make the function easier to understand at the call site.", explanation: "Keep a function focused so its name can describe the work it performs." },
        { id: "cpp-strings", title: "Working with strings", kind: "Standard library", time: "13 min", code: "#include <string>\n\nstd::string name = \"Mira\";\nname += \" Rao\";", copy: "The std::string type manages text as a value and makes common operations easier to express.", explanation: "The standard library gives you tested building blocks for everyday tasks." },
        { id: "cpp-vectors", title: "A flexible collection", kind: "Standard library", time: "15 min", code: "#include <vector>\n\nstd::vector<int> marks{8, 9, 10};\nmarks.push_back(11);", copy: "A vector is a sequence that can grow as you add items. It keeps track of its size for you.", explanation: "Choose vector for a general-purpose, resizable sequence of values." },
        { id: "cpp-classes", title: "Objects & classes", kind: "Object thinking", time: "18 min", code: "class Counter {\npublic:\n    void increment() { ++value; }\n    int get() const { return value; }\nprivate:\n    int value = 0;\n};", copy: "A class groups related data and operations. An object is a value created from that class.", explanation: "Use the public interface to expose what a caller needs and keep implementation details private." },
        { id: "cpp-constructors", title: "Creating useful objects", kind: "Initialization", time: "16 min", code: "struct Point {\n    double x;\n    double y;\n};\n\nPoint origin{0.0, 0.0};", copy: "Initialization gives an object a meaningful state at the moment it is created.", explanation: "Brace initialization makes the values used to create this Point visible at a glance." },
        { id: "cpp-references", title: "References & const", kind: "Function design", time: "16 min", code: "void show(const std::string& text) {\n    std::cout << text;\n}", copy: "A const reference can let a function read an existing object without making a copy or changing it.", explanation: "The ampersand in a parameter declaration means reference; const communicates read-only intent." },
        { id: "cpp-algorithms", title: "Useful standard algorithms", kind: "Standard library", time: "19 min", code: "#include <algorithm>\n\nstd::sort(values.begin(), values.end());", copy: "The standard library includes algorithms that work with ranges, so you can focus on what you want to do.", explanation: "Prefer a well-known library algorithm when it clearly expresses the operation you need." }
      ]
    }
  };

  const quizSets = {
    daily: [
      { prompt: "What is 15% of 240?", choices: ["24", "30", "36", "42"], answer: 2, explanation: "10% of 240 is 24, and 5% is 12. Together, 15% is 36." },
      { prompt: "What number comes next: 2, 6, 12, 20, 30, …?", choices: ["36", "40", "42", "44"], answer: 2, explanation: "The differences grow by two: +4, +6, +8, +10, then +12. So the next value is 42." },
      { prompt: "A program repeats a block while a condition is true. Which idea is this?", choices: ["Iteration", "Declaration", "Compilation", "Assignment"], answer: 0, explanation: "Iteration means repeating a block of work, commonly with a loop." },
      { prompt: "How many bits are in one byte in the usual modern definition?", choices: ["4", "8", "16", "32"], answer: 1, explanation: "A byte is made up of 8 bits." },
      { prompt: "What is the average of 6, 8, and 10?", choices: ["7", "8", "9", "24"], answer: 1, explanation: "The sum is 24; divide by 3 values to get an average of 8." }
    ],
    numerical: [
      { prompt: "What is 15% of 240?", choices: ["24", "30", "36", "42"], answer: 2, explanation: "10% is 24 and 5% is 12; together they make 36." },
      { prompt: "A ratio is 3:5 and the total is 64. What is the smaller part?", choices: ["18", "21", "24", "32"], answer: 2, explanation: "There are 8 equal parts. 64 divided by 8 is 8; the smaller part is 3 × 8 = 24." },
      { prompt: "What number comes next: 2, 6, 12, 20, 30, …?", choices: ["36", "40", "42", "44"], answer: 2, explanation: "The differences are +4, +6, +8, +10. Add +12 to get 42." },
      { prompt: "The mean of 4, 7, and one other number is 8. What is the third number?", choices: ["9", "11", "13", "15"], answer: 2, explanation: "A mean of 8 across 3 values needs a total of 24. 24 − 4 − 7 = 13." }
    ],
    logic: [
      { prompt: "Which number continues the pattern: 1, 4, 9, 16, …?", choices: ["20", "24", "25", "36"], answer: 2, explanation: "These are square numbers: 1², 2², 3², 4². The next is 5² = 25." },
      { prompt: "All zips are folders. Some folders are shared. Which statement must be true?", choices: ["All zips are shared", "Some zips are shared", "All zips are folders", "No folders are zips"], answer: 2, explanation: "The first sentence directly guarantees that every zip belongs to the folder group." },
      { prompt: "If A comes before B, and B comes before C, which must come last?", choices: ["A", "B", "C", "There is not enough information"], answer: 2, explanation: "The two ordering relationships place C after both A and B." },
      { prompt: "Which item is the odd one out?", choices: ["Triangle", "Square", "Circle", "Cube"], answer: 3, explanation: "A cube is three-dimensional; the other shapes are two-dimensional." }
    ],
    computing: [
      { prompt: "Which part of a computer carries out most instructions?", choices: ["CPU", "Monitor", "Keyboard", "Speaker"], answer: 0, explanation: "The central processing unit (CPU) executes program instructions." },
      { prompt: "What is the smallest unit of digital information?", choices: ["Byte", "Bit", "Pixel", "Word"], answer: 1, explanation: "A bit can represent one of two values, often written as 0 or 1." },
      { prompt: "Which memory is typically cleared when a computer loses power?", choices: ["RAM", "SSD", "Flash drive", "Hard disk"], answer: 0, explanation: "RAM is volatile working memory; it does not retain its contents without power." },
      { prompt: "What does a compiler primarily do?", choices: ["Draws the user interface", "Translates source code", "Stores a password", "Connects a keyboard"], answer: 1, explanation: "A compiler translates source code into another form, commonly machine code or an intermediate form." }
    ],
    code: [
      { prompt: "In C, what value is printed by `printf(\"%d\", 3 + 4);`?", choices: ["34", "7", "3 + 4", "A compile error"], answer: 1, explanation: "The expression 3 + 4 is evaluated first, so the integer printed is 7." },
      { prompt: "In C++, what does `values[0]` refer to in a non-empty vector?", choices: ["Its first element", "Its last element", "Its number of elements", "The vector's type"], answer: 0, explanation: "Sequence indexing begins at zero, so index 0 refers to the first element." },
      { prompt: "How many times does this loop body run? `for (int i=0; i<3; ++i)`", choices: ["2", "3", "4", "It never runs"], answer: 1, explanation: "The values 0, 1, and 2 satisfy i < 3. At 3 the condition is false." },
      { prompt: "What is the value of `x` after `int x = 5; x += 2;`?", choices: ["2", "5", "7", "10"], answer: 2, explanation: "The += operator adds 2 to the current value, so x becomes 7." }
    ]
  };
  const quizLabels = {
    daily: "DAILY MIXED PRACTICE",
    numerical: "NUMBER SENSE",
    logic: "CLEAR THINKING",
    computing: "COMPUTING BASICS",
    code: "C & C++ OUTPUT TRACING"
  };

  function setView(name) {
    if (!viewNames[name]) return;
    views.forEach(function (view) {
      const visible = view.id === "view-" + name;
      view.classList.toggle("is-visible", visible);
      view.hidden = !visible;
    });
    navItems.forEach(function (item) {
      const selected = item.dataset.viewTarget === name;
      item.classList.toggle("is-active", selected);
      if (selected) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    currentSectionLabel.textContent = viewNames[name];
    closeMobileNav();
    if (name === "progress" && backendConnected) refreshBackendProgress();
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toastRegion.replaceChildren();
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    toastRegion.appendChild(toast);
    toastTimer = window.setTimeout(function () { toast.remove(); }, 4800);
  }

  function updateDate() {
    const now = new Date();
    const eyebrow = document.querySelector("#date-eyebrow");
    const topDate = document.querySelector("#today-label");
    const longDate = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(now);
    eyebrow.textContent = longDate.toLocaleUpperCase();
    topDate.textContent = longDate;
  }

  function updateBackendStatus(connected) {
    backendConnected = connected;
    document.querySelector("#backend-status-text").textContent = connected
      ? "C++ API connected · SQLite active"
      : "C++ backend offline · preview data";
    document.querySelector("#connection-label").textContent = connected ? "API connected" : "Preview mode";
    document.querySelector("#profile-label").textContent = connected ? "Local learner" : "Student preview";
    document.querySelector("#profile-caption").textContent = connected ? "SQLite profile" : "Local prototype";
    document.querySelector("#preview-info").setAttribute("aria-label", connected
      ? "About the local C++ backend"
      : "About the frontend preview");
    document.querySelector("#dashboard-data-tag").textContent = connected ? "Live local database" : "Sample preview data";
    document.querySelector("#dashboard-boundary-note").textContent = connected
      ? "Connected to the local C++ API. Lesson completions and quiz attempts are saved in SQLite on this computer."
      : "This is a browser-only preview until the C++ service is started. Example values are not saved.";
    document.querySelector("#practice-mode-note").textContent = connected
      ? "The C++ API grades each answer and saves completed attempts to the local SQLite database."
      : "When the C++ API is running, attempts are graded by the server and saved to SQLite.";
    document.querySelector("#progress-boundary p").innerHTML = connected
      ? "<strong>Live local data.</strong> These values come from the C++ API and the SQLite database on this computer."
      : "<strong>Illustrative sample view.</strong> These figures are example content; start the local C++ API to use SQLite-backed progress.";
    document.querySelector(".app-footer span:last-child").textContent = connected
      ? "C++ API connected · Local SQLite storage"
      : "Frontend preview · C++ backend offline";
  }

  async function loadBackendCatalog() {
    const response = await backendApi.getCourses();
    for (const item of response.courses) {
      const courseId = item.slug;
      if (!courseContent[courseId]) continue;
      courseContent[courseId].level = item.level.toUpperCase();
      courseContent[courseId].title = item.language === "C" ? "A clear start with C." : "Meet modern C++.";
      courseContent[courseId].description = item.description;
      courseContent[courseId].count = String(item.moduleCount);
      courseContent[courseId].duration = item.durationText;
      const lessonResponse = await backendApi.getCourseLessons(courseId);
      backendCourseLessons[courseId] = lessonResponse.lessons.map(function (lesson) {
        const localLesson = courseContent[courseId].lessons.find(function (candidate) { return candidate.id === lesson.id; });
        return Object.assign({}, localLesson || {}, lesson, { time: lesson.durationMinutes + " min" });
      });
    }
    renderCourse(activeCourse);
  }

  function applyBackendProgress(progress) {
    savedLessonIds.clear();
    (progress.completedLessonIds || []).forEach(function (lessonId) { savedLessonIds.add(lessonId); });
    const overall = progress.overallProgress || { completed: 0, total: 0, percent: 0 };
    const percent = Number(overall.percent) || 0;
    const quizSummary = progress.quizSummary || { attemptCount: 0 };
    const weekly = progress.weeklyAttempts || [0, 0, 0, 0, 0, 0, 0];
    const weeklyTotal = weekly.reduce(function (sum, value) { return sum + Number(value || 0); }, 0);

    document.querySelector("#dashboard-progress-value").innerHTML = percent + "<span>%</span>";
    document.querySelector("#dashboard-progress-caption").textContent = "Saved course completion";
    document.querySelector("#dashboard-progress-note").textContent = overall.completed + " of " + overall.total + " lessons saved";
    document.querySelector("#dashboard-progress-bar").style.width = percent + "%";
    document.querySelector("#dashboard-quiz-count").innerHTML = weeklyTotal.toString().padStart(2, "0") + "<span class=\"value-unit\"> sessions</span>";
    document.querySelector("#dashboard-quiz-caption").textContent = "Attempts saved this week";
    document.querySelector("#dashboard-quiz-note").textContent = quizSummary.attemptCount + " total saved attempts";
    document.querySelector("#progress-course-label").textContent = "SAVED CURRICULUM";
    document.querySelector("#progress-course-value").innerHTML = percent + "<span>%</span>";
    document.querySelector("#progress-course-caption").textContent = "Completion across both paths";
    document.querySelector("#progress-course-bar").style.width = percent + "%";
    document.querySelector("#progress-lessons-label").textContent = "SAVED LESSONS";
    document.querySelector("#progress-lessons-value").innerHTML = overall.completed + "<span class=\"value-unit\"> / " + overall.total + "</span>";
    document.querySelector("#progress-lessons-caption").textContent = "Completions in local SQLite";
    document.querySelector("#visit-completed-count").textContent = String(completedThisVisit.size).padStart(2, "0");
    document.querySelector("#visit-completed-caption").textContent = "Lessons completed this visit";
    document.querySelector("#activity-kicker").textContent = "LAST SEVEN DAYS";
    document.querySelector("#activity-title").textContent = "Quiz attempts this week";
    document.querySelector("#activity-scope").textContent = "FROM SQLITE";
    document.querySelector("#weekly-chart").setAttribute("aria-label", "Quiz attempts saved over the last seven days");
    document.querySelector("#weekly-chart-caption").innerHTML = "<span class=\"chart-legend\"></span> Saved quiz attempts · local database";

    const max = Math.max(1, ...weekly.map(function (value) { return Number(value || 0); }));
    const ticks = document.querySelectorAll("#weekly-chart .chart-y-labels span");
    [max, Math.ceil(max * 2 / 3), Math.ceil(max / 3), 0].forEach(function (value, index) {
      if (ticks[index]) ticks[index].textContent = String(value);
    });
    const chartColumns = Array.from(document.querySelectorAll("#weekly-chart-columns > div"));
    chartColumns.forEach(function (column, index) {
      const count = Number(weekly[index] || 0);
      const bar = column.querySelector("i");
      bar.style.height = count === 0 ? "2%" : Math.max(9, count / max * 90) + "%";
      bar.classList.toggle("chart-muted-bar", count === 0);
      column.setAttribute("aria-label", count + " saved quiz attempts");
    });
    const miniBars = Array.from(document.querySelectorAll("#dashboard-week-bars i"));
    miniBars.forEach(function (bar, index) {
      const count = Number(weekly[index] || 0);
      bar.style.height = count === 0 ? "5%" : Math.max(10, count / max * 90) + "%";
      bar.classList.toggle("bar-today", index === new Date().getDay());
    });
    renderCourse(activeCourse);
  }

  async function refreshBackendProgress() {
    if (!backendConnected || !backendApi) return;
    try {
      applyBackendProgress(await backendApi.getMyProgress());
    } catch (error) {
      showToast("Progress could not be refreshed: " + error.message);
    }
  }

  async function connectBackend() {
    try {
      const health = await backendApi.checkHealth();
      if (!health || health.status !== "ok") throw new Error("The service health check did not pass.");
      updateBackendStatus(true);
      await loadBackendCatalog();
      applyBackendProgress(await backendApi.getMyProgress());
    } catch (error) {
      updateBackendStatus(false);
    }
  }

  function renderCourse(courseId) {
    if (!courseContent[courseId]) return;
    activeCourse = courseId;
    const course = courseContent[courseId];
    const lessons = backendCourseLessons[courseId] || course.lessons;
    document.querySelectorAll(".course-tab").forEach(function (tab) {
      const selected = tab.dataset.course === courseId;
      tab.classList.toggle("is-selected", selected);
      tab.setAttribute("aria-selected", String(selected));
    });
    document.querySelector("#course-level").textContent = course.level;
    document.querySelector("#course-title").textContent = course.title;
    document.querySelector("#course-description").textContent = course.description;
    document.querySelector("#course-module-count").textContent = String(lessons.length);
    document.querySelector("#course-duration").textContent = course.duration;
    document.querySelector("#module-count-label").textContent = "01 — " + String(lessons.length).padStart(2, "0");
    const lessonList = document.querySelector("#lesson-list");
    lessonList.replaceChildren();
    lessons.forEach(function (lesson, index) {
      const row = document.createElement("article");
      const isDone = savedLessonIds.has(lesson.id) || completedThisVisit.has(lesson.id);
      row.className = "lesson-row" + (isDone ? " is-done" : "");
      const number = document.createElement("span");
      number.className = "lesson-index";
      number.textContent = String(index + 1).padStart(2, "0");
      const copy = document.createElement("span");
      copy.className = "lesson-row-copy";
      const title = document.createElement("strong");
      title.textContent = lesson.title;
      const meta = document.createElement("small");
      meta.textContent = lesson.kind + " · " + (lesson.time || (lesson.durationMinutes + " min")) + (savedLessonIds.has(lesson.id) ? " · saved in SQLite" : completedThisVisit.has(lesson.id) ? " · marked this visit" : "");
      copy.append(title, meta);
      const button = document.createElement("button");
      button.className = "lesson-open";
      button.type = "button";
      button.dataset.lessonId = lesson.id;
      button.textContent = "Open →";
      row.append(number, copy, button);
      lessonList.appendChild(row);
    });
    if (activeLesson && !lessons.some(function (lesson) { return lesson.id === activeLesson.id; })) {
      activeLesson = null;
      showEmptyLesson();
    }
  }

  function showEmptyLesson() {
    document.querySelector(".lesson-panel-empty").hidden = false;
    document.querySelector("#lesson-detail").hidden = true;
  }

  function renderLessonDetail(lesson, courseId) {
    activeLesson = lesson;
    document.querySelector(".lesson-panel-empty").hidden = true;
    document.querySelector("#lesson-detail").hidden = false;
    document.querySelector("#lesson-language").textContent = lesson.language || (courseId === "c" ? "C" : "C++");
    document.querySelector("#lesson-duration").textContent = lesson.time || (lesson.durationMinutes + " min");
    document.querySelector("#lesson-kicker").textContent = "MODULE " + String(lesson.position || 1).padStart(2, "0");
    document.querySelector("#lesson-detail-title").textContent = lesson.title;
    document.querySelector("#lesson-detail-copy").textContent = lesson.body || lesson.copy || lesson.summary;
    document.querySelector("#lesson-detail-code").textContent = lesson.exampleCode || lesson.code || "No code example is available for this lesson yet.";
    document.querySelector("#lesson-explanation").textContent = lesson.explanation || "Read the example and trace how the idea works.";
    const completeButton = document.querySelector("#lesson-complete");
    const isSaved = savedLessonIds.has(lesson.id);
    const isTemporary = completedThisVisit.has(lesson.id);
    const isComplete = isSaved || isTemporary;
    completeButton.classList.toggle("is-complete", isComplete);
    completeButton.textContent = isSaved ? "Saved to SQLite ✓" : isTemporary ? "Marked complete in this tab ✓" : "Mark complete";
    completeButton.setAttribute("aria-pressed", String(isComplete));
  }

  function openLesson(lessonId) {
    const courseId = lessonId.indexOf("cpp-") === 0 ? "cpp" : "c";
    if (activeCourse !== courseId) renderCourse(courseId);
    const availableLessons = backendCourseLessons[courseId] || courseContent[courseId].lessons;
    const lesson = availableLessons.find(function (item) { return item.id === lessonId; });
    if (!lesson) return;
    renderLessonDetail(Object.assign({ position: availableLessons.indexOf(lesson) + 1 }, lesson), courseId);
    if (backendConnected) {
      backendApi.getLesson(lessonId).then(function (response) {
        if (activeLesson && activeLesson.id === lessonId) renderLessonDetail(response.lesson, courseId);
      }).catch(function (error) {
        showToast("Lesson details could not load from the C++ API: " + error.message);
      });
    }
  }

  async function markLessonComplete() {
    if (!activeLesson) return;
    if (savedLessonIds.has(activeLesson.id)) {
      showToast("This lesson is already saved in the local SQLite database.");
      return;
    }
    if (!backendConnected && completedThisVisit.has(activeLesson.id)) {
      showToast("This lesson is already marked for this visit. The preview resets on refresh.");
      return;
    }
    if (backendConnected) {
      try {
        await backendApi.markLessonComplete(activeLesson.id);
        savedLessonIds.add(activeLesson.id);
      } catch (error) {
        showToast("The lesson was not saved: " + error.message);
        return;
      }
    }
    completedThisVisit.add(activeLesson.id);
    renderCourse(activeCourse);
    openLesson(activeLesson.id);
    document.querySelector("#visit-completed-count").textContent = String(completedThisVisit.size).padStart(2, "0");
    if (backendConnected) {
      showToast("Lesson completion saved to the local SQLite database.");
      refreshBackendProgress();
    } else {
      showToast("Marked for this visit only. It is not saved and clears when you refresh.");
    }
  }

  async function startQuiz(topic) {
    if (!backendConnected && backendApi) await connectBackend();
    let questions = quizSets[topic];
    let source = "local";
    if (backendConnected) {
      try {
        const response = await backendApi.getQuiz(topic);
        questions = response.quiz.questions;
        source = "server";
      } catch (error) {
        showToast("The quiz could not load from the C++ API: " + error.message);
        return;
      }
    }
    if (!questions) return;
    activeQuiz = { id: topic, topic: topic, questions: questions, index: 0, answers: [], source: source };
    document.querySelector("#quiz-content").hidden = false;
    document.querySelector("#quiz-results").hidden = true;
    document.querySelector("#quiz-results").replaceChildren();
    document.querySelector("#quiz-topic-label").textContent = quizLabels[topic];
    document.querySelector("#quiz-page-title").textContent = topic === "daily" ? "A moment to think." : "Practice with focus.";
    document.querySelector("#quiz-aside-total").textContent = String(questions.length).padStart(2, "0");
    document.querySelector("#quiz-time-label").textContent = "Untimed";
    document.querySelector("#quiz-mode-label").textContent = source === "server" ? "C++ SERVER · SQLITE SAVES" : "LOCAL PREVIEW · NOT SAVED";
    document.querySelector("#quiz-boundary-note").textContent = source === "server"
      ? "The C++ API grades your answers and saves this attempt in the local SQLite database."
      : "Local preview: answers and score stay in this tab; nothing is saved.";
    renderQuestion();
    setView("quiz");
  }

  function renderQuestion() {
    if (!activeQuiz) return;
    const question = activeQuiz.questions[activeQuiz.index];
    const current = activeQuiz.index + 1;
    const total = activeQuiz.questions.length;
    const percent = Math.round((current / total) * 100);
    document.querySelector("#quiz-step-label").innerHTML = "QUESTION " + String(current).padStart(2, "0") + " <i>/</i> " + String(total).padStart(2, "0");
    document.querySelector("#quiz-progress-percent").textContent = percent + "%";
    document.querySelector("#quiz-progress-fill").style.width = percent + "%";
    document.querySelector("#question-number").textContent = "QUESTION " + String(current).padStart(2, "0");
    document.querySelector("#question-prompt").textContent = question.prompt;
    const answerList = document.querySelector("#answer-list");
    answerList.replaceChildren();
    question.choices.forEach(function (choice, index) {
      const button = document.createElement("button");
      const selected = activeQuiz.answers[activeQuiz.index] === index;
      button.className = "answer-option" + (selected ? " is-selected" : "");
      button.type = "button";
      button.dataset.answerIndex = String(index);
      button.setAttribute("aria-pressed", String(selected));
      const key = document.createElement("span");
      key.className = "answer-key";
      key.textContent = String.fromCharCode(65 + index);
      const text = document.createElement("span");
      text.textContent = typeof choice === "string" ? choice : choice.text;
      const check = document.createElement("span");
      check.className = "answer-check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = "✓";
      button.append(key, text, check);
      answerList.appendChild(button);
    });
    const nextButton = document.querySelector("#quiz-next");
    nextButton.disabled = typeof activeQuiz.answers[activeQuiz.index] !== "number";
    nextButton.innerHTML = current === total ? "See my result <span aria-hidden=\"true\">→</span>" : "Continue <span aria-hidden=\"true\">→</span>";
  }

  function selectAnswer(index) {
    if (!activeQuiz || index < 0 || index >= activeQuiz.questions[activeQuiz.index].choices.length) return;
    activeQuiz.answers[activeQuiz.index] = index;
    renderQuestion();
    const selected = document.querySelector(".answer-option.is-selected");
    if (selected) selected.focus({ preventScroll: true });
  }

  function renderResults() {
    const correct = activeQuiz.questions.reduce(function (count, question, index) {
      return count + (activeQuiz.answers[index] === question.answer ? 1 : 0);
    }, 0);
    const result = document.querySelector("#quiz-results");
    const kicker = document.createElement("p");
    kicker.className = "results-kicker";
    kicker.textContent = "PRACTICE COMPLETE · LOCAL RESULT";
    const title = document.createElement("h2");
    title.textContent = correct === activeQuiz.questions.length ? "A lovely clear run." : "Good thinking takes practice.";
    const score = document.createElement("div");
    score.className = "results-score";
    const scoreStrong = document.createElement("strong");
    scoreStrong.textContent = String(correct).padStart(2, "0") + " / " + String(activeQuiz.questions.length).padStart(2, "0");
    const scoreLabel = document.createElement("span");
    scoreLabel.textContent = "correct in this browser session";
    score.append(scoreStrong, scoreLabel);
    const copy = document.createElement("p");
    copy.className = "results-copy";
    copy.textContent = "Use the notes below to revisit each idea. This is a local practice result; it has not been saved or sent to a server.";
    const list = document.createElement("div");
    list.className = "review-list";
    activeQuiz.questions.forEach(function (question, index) {
      const isCorrect = activeQuiz.answers[index] === question.answer;
      const item = document.createElement("article");
      item.className = "review-item" + (isCorrect ? "" : " is-wrong");
      const reviewTitle = document.createElement("h3");
      reviewTitle.textContent = String(index + 1).padStart(2, "0") + " · " + question.prompt;
      const answerLine = document.createElement("p");
      answerLine.textContent = "Answer: " + question.choices[question.answer];
      const explanation = document.createElement("p");
      explanation.textContent = question.explanation;
      const resultLine = document.createElement("p");
      resultLine.className = "review-result";
      resultLine.textContent = isCorrect ? "✓ Your answer was correct" : "↗ Revisit this idea";
      item.append(reviewTitle, answerLine, explanation, resultLine);
      list.appendChild(item);
    });
    const actions = document.createElement("div");
    actions.className = "results-actions";
    const retry = document.createElement("button");
    retry.className = "button button-dark";
    retry.type = "button";
    retry.textContent = "Try this set again";
    retry.addEventListener("click", function () { startQuiz(activeQuiz.topic); });
    const returnButton = document.createElement("button");
    returnButton.className = "button button-light";
    returnButton.type = "button";
    returnButton.textContent = "Choose another practice";
    returnButton.addEventListener("click", function () { setView("aptitude"); });
    actions.append(retry, returnButton);
    result.replaceChildren(kicker, title, score, copy, list, actions);
    document.querySelector("#quiz-content").hidden = true;
    result.hidden = false;
  }

  async function submitServerQuiz() {
    if (!activeQuiz || activeQuiz.source !== "server") return;
    const nextButton = document.querySelector("#quiz-next");
    nextButton.disabled = true;
    nextButton.textContent = "Saving result…";
    const answers = activeQuiz.questions.map(function (question, index) {
      return { questionId: question.id, choiceIndex: activeQuiz.answers[index] };
    });
    try {
      const response = await backendApi.submitQuizAttempt(activeQuiz.id, answers);
      activeQuiz.serverResult = response;
      renderServerResults(response);
      refreshBackendProgress();
    } catch (error) {
      nextButton.disabled = false;
      nextButton.textContent = "Retry save";
      showToast("The result was not saved. Your answers remain here so you can retry: " + error.message);
    }
  }

  function renderServerResults(serverResult) {
    const result = document.querySelector("#quiz-results");
    const kicker = document.createElement("p");
    kicker.className = "results-kicker";
    kicker.textContent = "PRACTICE COMPLETE · GRADED BY C++ · SAVED TO SQLITE";
    const title = document.createElement("h2");
    title.textContent = serverResult.score === serverResult.total ? "A lovely clear run." : "Good thinking takes practice.";
    const score = document.createElement("div");
    score.className = "results-score";
    const scoreStrong = document.createElement("strong");
    scoreStrong.textContent = String(serverResult.score).padStart(2, "0") + " / " + String(serverResult.total).padStart(2, "0");
    const scoreLabel = document.createElement("span");
    scoreLabel.textContent = "graded and saved by the local C++ service";
    score.append(scoreStrong, scoreLabel);
    const copy = document.createElement("p");
    copy.className = "results-copy";
    copy.textContent = "Review the explanations below. This attempt is stored in the SQLite database on this computer.";
    const list = document.createElement("div");
    list.className = "review-list";
    serverResult.feedback.forEach(function (item, index) {
      const review = document.createElement("article");
      review.className = "review-item" + (item.correct ? "" : " is-wrong");
      const heading = document.createElement("h3");
      heading.textContent = String(index + 1).padStart(2, "0") + " · " + item.prompt;
      const answer = document.createElement("p");
      answer.textContent = "Your answer: " + item.selectedAnswer;
      const correctAnswer = document.createElement("p");
      correctAnswer.textContent = "Correct answer: " + item.correctAnswer;
      const explanation = document.createElement("p");
      explanation.textContent = item.explanation;
      const status = document.createElement("p");
      status.className = "review-result";
      status.textContent = item.correct ? "✓ Your answer was correct" : "↗ Revisit this idea";
      review.append(heading, answer, correctAnswer, explanation, status);
      list.appendChild(review);
    });
    const actions = document.createElement("div");
    actions.className = "results-actions";
    const retry = document.createElement("button");
    retry.className = "button button-dark";
    retry.type = "button";
    retry.textContent = "Try this set again";
    retry.addEventListener("click", function () { startQuiz(activeQuiz.topic); });
    const returnButton = document.createElement("button");
    returnButton.className = "button button-light";
    returnButton.type = "button";
    returnButton.textContent = "Choose another practice";
    returnButton.addEventListener("click", function () { setView("aptitude"); });
    actions.append(retry, returnButton);
    result.replaceChildren(kicker, title, score, copy, list, actions);
    document.querySelector("#quiz-content").hidden = true;
    result.hidden = false;
  }

  function continueQuiz() {
    if (!activeQuiz || typeof activeQuiz.answers[activeQuiz.index] !== "number") return;
    if (activeQuiz.index + 1 >= activeQuiz.questions.length) {
      if (activeQuiz.source === "server") submitServerQuiz();
      else renderResults();
      return;
    }
    activeQuiz.index += 1;
    renderQuestion();
  }

  function closeMobileNav() {
    const sidebar = document.querySelector("#sidebar");
    const scrim = document.querySelector("#mobile-scrim");
    const toggle = document.querySelector("#menu-toggle");
    const focusWasInSidebar = sidebar.contains(document.activeElement);
    const isMobile = window.matchMedia("(max-width: 700px)").matches;
    sidebar.classList.remove("is-open");
    sidebar.inert = isMobile;
    scrim.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open navigation");
    if (focusWasInSidebar && isMobile) toggle.focus();
  }

  document.addEventListener("click", function (event) {
    const viewTarget = event.target.closest("[data-view-target]");
    if (viewTarget) {
      event.preventDefault();
      setView(viewTarget.dataset.viewTarget);
      return;
    }
    const courseTarget = event.target.closest("[data-course-select]");
    if (courseTarget) {
      renderCourse(courseTarget.dataset.courseSelect);
      setView("learn");
      return;
    }
    const lessonTarget = event.target.closest("[data-open-lesson]");
    if (lessonTarget) {
      openLesson(lessonTarget.dataset.openLesson);
      setView("learn");
      return;
    }
    const lessonButton = event.target.closest("[data-lesson-id]");
    if (lessonButton) {
      openLesson(lessonButton.dataset.lessonId);
      return;
    }
    const quizTarget = event.target.closest("[data-start-quiz]");
    if (quizTarget) {
      startQuiz(quizTarget.dataset.startQuiz);
      return;
    }
    const answerButton = event.target.closest("[data-answer-index]");
    if (answerButton) selectAnswer(Number(answerButton.dataset.answerIndex));
  });

  document.querySelectorAll(".course-tab").forEach(function (tab) {
    tab.addEventListener("click", function () { renderCourse(tab.dataset.course); });
    tab.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const tabs = Array.from(document.querySelectorAll(".course-tab"));
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const next = (tabs.indexOf(tab) + direction + tabs.length) % tabs.length;
      tabs[next].focus();
      renderCourse(tabs[next].dataset.course);
    });
  });
  document.querySelector("#lesson-complete").addEventListener("click", markLessonComplete);
  document.querySelector("#quiz-next").addEventListener("click", continueQuiz);
  document.querySelector("#preview-info").addEventListener("click", function () {
    if (!backendConnected) {
      showToast("Checking for the local C++ service. If it is running, live SQLite data will load now.");
      if (backendApi) connectBackend();
      return;
    }
    showToast("Connected to the local C++ API. Quiz attempts and lesson completions are saved in SQLite on this computer.");
  });
  document.querySelector("#menu-toggle").addEventListener("click", function () {
    const sidebar = document.querySelector("#sidebar");
    const scrim = document.querySelector("#mobile-scrim");
    const open = !sidebar.classList.contains("is-open");
    sidebar.classList.toggle("is-open", open);
    sidebar.inert = !open;
    scrim.hidden = !open;
    this.setAttribute("aria-expanded", String(open));
    this.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  });
  document.querySelector("#mobile-scrim").addEventListener("click", closeMobileNav);
  window.matchMedia("(max-width: 700px)").addEventListener("change", function (event) {
    const sidebar = document.querySelector("#sidebar");
    if (!event.matches) {
      sidebar.inert = false;
      sidebar.classList.remove("is-open");
      document.querySelector("#mobile-scrim").hidden = true;
    } else {
      sidebar.inert = !sidebar.classList.contains("is-open");
    }
  });
  document.addEventListener("keydown", function (event) {
    if (activeQuiz && !document.querySelector("#view-quiz").hidden && /^[1-4]$/.test(event.key) && !event.target.matches("input,textarea,select")) {
      selectAnswer(Number(event.key) - 1);
    }
    if (event.key === "Escape") closeMobileNav();
  });

  updateDate();
  renderCourse("c");
  setView("dashboard");
  import("./api-client.js").then(function (api) {
    backendApi = api;
    connectBackend();
  }).catch(function () {
    updateBackendStatus(false);
  });
})();
