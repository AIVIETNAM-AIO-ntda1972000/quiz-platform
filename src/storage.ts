import type { Attempt, Quiz, QuizResult } from "./models";

const QUIZZES_KEY = "quiz-platform:quizzes";
const ATTEMPTS_KEY = "quiz-platform:attempts";
const RESULTS_KEY = "quiz-platform:results";
const QUIZ_UPDATED_KEY = "quiz-platform:quiz-updated-at";
const DELETED_QUIZZES_KEY = "quiz-platform:deleted-quizzes";
const MODIFIED_KEY = "quiz-platform:modified-at";

export type StorageSnapshot = {
  schemaVersion: 1;
  quizzes: Quiz[];
  attempts: Record<string, Attempt>;
  results: Record<string, QuizResult>;
  quizUpdatedAt: Record<string, string>;
  deletedQuizAt: Record<string, string>;
  modifiedAt: string;
};

type StorageChangeSource = "local" | "cloud";
type StorageChangeListener = (source: StorageChangeSource) => void;

const listeners = new Set<StorageChangeListener>();

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

function markModified(): string {
  const modifiedAt = new Date().toISOString();
  localStorage.setItem(MODIFIED_KEY, modifiedAt);
  return modifiedAt;
}

function notifyStorageChange(source: StorageChangeSource): void {
  listeners.forEach((listener) => listener(source));
}

export function subscribeToStorageChanges(listener: StorageChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function loadQuizzes(): Quiz[] { return readValue<Quiz[]>(QUIZZES_KEY, []); }
export function initializeQuizLibrary(starterQuiz: Quiz): Quiz[] {
  if (localStorage.getItem(QUIZZES_KEY) !== null) return loadQuizzes();
  writeValue(QUIZZES_KEY, [starterQuiz]);
  writeValue(QUIZ_UPDATED_KEY, { [starterQuiz.id]: new Date(0).toISOString() });
  localStorage.setItem(MODIFIED_KEY, new Date(0).toISOString());
  return [starterQuiz];
}

export function saveQuiz(quiz: Quiz): { replaced: boolean } {
  const quizzes = loadQuizzes();
  const index = quizzes.findIndex((item) => item.id === quiz.id);
  const replaced = index >= 0;
  if (replaced) quizzes[index] = quiz;
  else quizzes.push(quiz);
  writeValue(QUIZZES_KEY, quizzes);
  const updatedAt = readValue<Record<string, string>>(QUIZ_UPDATED_KEY, {});
  updatedAt[quiz.id] = markModified();
  writeValue(QUIZ_UPDATED_KEY, updatedAt);
  const deletedAt = readValue<Record<string, string>>(DELETED_QUIZZES_KEY, {});
  delete deletedAt[quiz.id];
  writeValue(DELETED_QUIZZES_KEY, deletedAt);
  notifyStorageChange("local");
  return { replaced };
}
export function loadAttempt(quizId: string): Attempt | undefined { return readValue<Record<string, Attempt>>(ATTEMPTS_KEY, {})[quizId]; }
export function saveAttempt(attempt: Attempt): void {
  const attempts = readValue<Record<string, Attempt>>(ATTEMPTS_KEY, {});
  attempts[attempt.quizId] = attempt;
  writeValue(ATTEMPTS_KEY, attempts);
  markModified();
  notifyStorageChange("local");
}
export function clearAttempt(quizId: string): void {
  const attempts = readValue<Record<string, Attempt>>(ATTEMPTS_KEY, {});
  delete attempts[quizId];
  writeValue(ATTEMPTS_KEY, attempts);
  markModified();
  notifyStorageChange("local");
}
export function loadResult(quizId: string): QuizResult | undefined { return readValue<Record<string, QuizResult>>(RESULTS_KEY, {})[quizId]; }
export function saveResult(result: QuizResult): void {
  const results = readValue<Record<string, QuizResult>>(RESULTS_KEY, {});
  results[result.quizId] = result;
  writeValue(RESULTS_KEY, results);
  markModified();
  notifyStorageChange("local");
}
export function clearQuizProgress(quizId: string): void {
  const attempts = readValue<Record<string, Attempt>>(ATTEMPTS_KEY, {});
  delete attempts[quizId];
  writeValue(ATTEMPTS_KEY, attempts);
  const results = readValue<Record<string, QuizResult>>(RESULTS_KEY, {});
  delete results[quizId];
  writeValue(RESULTS_KEY, results);
  markModified();
  notifyStorageChange("local");
}

export function deleteQuiz(quizId: string): void {
  writeValue(QUIZZES_KEY, loadQuizzes().filter((quiz) => quiz.id !== quizId));
  const attempts = readValue<Record<string, Attempt>>(ATTEMPTS_KEY, {});
  const results = readValue<Record<string, QuizResult>>(RESULTS_KEY, {});
  const updatedAt = readValue<Record<string, string>>(QUIZ_UPDATED_KEY, {});
  delete attempts[quizId];
  delete results[quizId];
  delete updatedAt[quizId];
  writeValue(ATTEMPTS_KEY, attempts);
  writeValue(RESULTS_KEY, results);
  writeValue(QUIZ_UPDATED_KEY, updatedAt);
  const deletedAt = readValue<Record<string, string>>(DELETED_QUIZZES_KEY, {});
  deletedAt[quizId] = markModified();
  writeValue(DELETED_QUIZZES_KEY, deletedAt);
  notifyStorageChange("local");
}

export function exportStorageSnapshot(): StorageSnapshot {
  return {
    schemaVersion: 1,
    quizzes: loadQuizzes(),
    attempts: readValue<Record<string, Attempt>>(ATTEMPTS_KEY, {}),
    results: readValue<Record<string, QuizResult>>(RESULTS_KEY, {}),
    quizUpdatedAt: readValue<Record<string, string>>(QUIZ_UPDATED_KEY, {}),
    deletedQuizAt: readValue<Record<string, string>>(DELETED_QUIZZES_KEY, {}),
    modifiedAt: localStorage.getItem(MODIFIED_KEY) ?? new Date(0).toISOString(),
  };
}

export function importStorageSnapshot(snapshot: StorageSnapshot, source: StorageChangeSource = "cloud"): void {
  writeValue(QUIZZES_KEY, snapshot.quizzes);
  writeValue(ATTEMPTS_KEY, snapshot.attempts);
  writeValue(RESULTS_KEY, snapshot.results);
  writeValue(QUIZ_UPDATED_KEY, snapshot.quizUpdatedAt);
  writeValue(DELETED_QUIZZES_KEY, snapshot.deletedQuizAt);
  localStorage.setItem(MODIFIED_KEY, snapshot.modifiedAt);
  notifyStorageChange(source);
}
