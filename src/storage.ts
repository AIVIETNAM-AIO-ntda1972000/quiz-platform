import type { Attempt, Quiz, QuizResult } from "./models";

const QUIZZES_KEY = "quiz-platform:quizzes";
const ATTEMPTS_KEY = "quiz-platform:attempts";
const RESULTS_KEY = "quiz-platform:results";

function readValue<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeValue<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadQuizzes(): Quiz[] { return readValue<Quiz[]>(QUIZZES_KEY, []); }
export function saveQuiz(quiz: Quiz): { replaced: boolean } {
  const quizzes = loadQuizzes();
  const index = quizzes.findIndex((item) => item.id === quiz.id);
  const replaced = index >= 0;
  if (replaced) quizzes[index] = quiz;
  else quizzes.push(quiz);
  writeValue(QUIZZES_KEY, quizzes);
  return { replaced };
}
export function loadAttempt(quizId: string): Attempt | undefined { return readValue<Record<string, Attempt>>(ATTEMPTS_KEY, {})[quizId]; }
export function saveAttempt(attempt: Attempt): void {
  const attempts = readValue<Record<string, Attempt>>(ATTEMPTS_KEY, {});
  attempts[attempt.quizId] = attempt;
  writeValue(ATTEMPTS_KEY, attempts);
}
export function clearAttempt(quizId: string): void {
  const attempts = readValue<Record<string, Attempt>>(ATTEMPTS_KEY, {});
  delete attempts[quizId];
  writeValue(ATTEMPTS_KEY, attempts);
}
export function loadResult(quizId: string): QuizResult | undefined { return readValue<Record<string, QuizResult>>(RESULTS_KEY, {})[quizId]; }
export function saveResult(result: QuizResult): void {
  const results = readValue<Record<string, QuizResult>>(RESULTS_KEY, {});
  results[result.quizId] = result;
  writeValue(RESULTS_KEY, results);
}
export function clearQuizProgress(quizId: string): void {
  clearAttempt(quizId);
  const results = readValue<Record<string, QuizResult>>(RESULTS_KEY, {});
  delete results[quizId];
  writeValue(RESULTS_KEY, results);
}
