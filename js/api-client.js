/* HTTP boundary for the local C++ service. This module never supplies mock responses. */
const API_ORIGIN = window.CODESPHERE_API_ORIGIN || "http://127.0.0.1:8080";
const API_BASE = API_ORIGIN + "/api/v1";

async function request(url, options) {
  const settings = options || {};
  let response;
  try {
    response = await fetch(url, {
      method: settings.method || "GET",
      headers: settings.body ? { "Content-Type": "application/json", "Accept": "application/json" } : { "Accept": "application/json" },
      body: settings.body ? JSON.stringify(settings.body) : undefined,
      cache: "no-store",
      mode: "cors"
    });
  } catch (error) {
    throw new Error("The C++ backend is not reachable. Start codesphere-server and try again.");
  }

  const payload = response.status === 204 ? null : await response.json().catch(function () { return null; });
  if (!response.ok) {
    const message = payload && payload.error && payload.error.message;
    throw new Error(message || "CodeSphere API returned HTTP " + response.status + ".");
  }
  return payload;
}

export function checkHealth() {
  return request(API_ORIGIN + "/healthz");
}

export function getCourses() {
  return request(API_BASE + "/courses");
}

export function getCourseLessons(courseId) {
  return request(API_BASE + "/courses/" + encodeURIComponent(courseId) + "/lessons");
}

export function getLesson(lessonId) {
  return request(API_BASE + "/lessons/" + encodeURIComponent(lessonId));
}

export function getMyProgress() {
  return request(API_BASE + "/me/progress");
}

export function markLessonComplete(lessonId) {
  return request(API_BASE + "/lessons/" + encodeURIComponent(lessonId) + "/completion", {
    method: "POST",
    body: {}
  });
}

export function getQuiz(quizId) {
  return request(API_BASE + "/quizzes/" + encodeURIComponent(quizId));
}

export function submitQuizAttempt(quizId, answers) {
  return request(API_BASE + "/quiz-attempts", {
    method: "POST",
    body: { quizId: quizId, answers: answers }
  });
}
