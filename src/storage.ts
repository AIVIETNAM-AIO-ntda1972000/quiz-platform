import type { Attempt, Quiz, QuizResult } from "./models";
import { clearReadingPositions } from "./readingPosition";

const QUIZZES_KEY = "quiz-platform:quizzes";
const ATTEMPTS_KEY = "quiz-platform:attempts";
const RESULTS_KEY = "quiz-platform:results";
const QUIZ_UPDATED_KEY = "quiz-platform:quiz-updated-at";
const DELETED_QUIZZES_KEY = "quiz-platform:deleted-quizzes";
const MODIFIED_KEY = "quiz-platform:modified-at";
const SNAPSHOT_VERSION_KEY = "quiz-platform:snapshot-version";

export type StorageSnapshot = {
  schemaVersion: 1 | 2;
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

function writeChanges(changes: Map<string, string>): void {
  const previous = new Map(Array.from(changes.keys(), (key) => [key, localStorage.getItem(key)]));
  try {
    for (const [key, value] of changes) localStorage.setItem(key, value);
  } catch (error) {
    for (const key of changes.keys()) localStorage.removeItem(key);
    for (const [key, value] of previous) if (value !== null) localStorage.setItem(key, value);
    throw error;
  }
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
  const updatedAt = readValue<Record<string, string>>(QUIZ_UPDATED_KEY, {});
  const now = new Date().toISOString();
  updatedAt[quiz.id] = now;
  const deletedAt = readValue<Record<string, string>>(DELETED_QUIZZES_KEY, {});
  delete deletedAt[quiz.id];
  const changes = new Map<string, string>([
    [QUIZZES_KEY, JSON.stringify(quizzes)],
    [QUIZ_UPDATED_KEY, JSON.stringify(updatedAt)],
    [DELETED_QUIZZES_KEY, JSON.stringify(deletedAt)],
    [MODIFIED_KEY, now],
  ]);
  if (quiz.passages?.some((passage) => "format" in passage)) changes.set(SNAPSHOT_VERSION_KEY, "2");
  writeChanges(changes);
  if (replaced) clearReadingPositions(quiz.id);
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
  clearReadingPositions(quizId);
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
    schemaVersion: localStorage.getItem(SNAPSHOT_VERSION_KEY) === "2" ? 2 : 1,
    quizzes: loadQuizzes(),
    attempts: readValue<Record<string, Attempt>>(ATTEMPTS_KEY, {}),
    results: readValue<Record<string, QuizResult>>(RESULTS_KEY, {}),
    quizUpdatedAt: readValue<Record<string, string>>(QUIZ_UPDATED_KEY, {}),
    deletedQuizAt: readValue<Record<string, string>>(DELETED_QUIZZES_KEY, {}),
    modifiedAt: localStorage.getItem(MODIFIED_KEY) ?? new Date(0).toISOString(),
  };
}

export function importStorageSnapshot(snapshot: StorageSnapshot, source: StorageChangeSource = "cloud"): void {
  const existing = new Map(loadQuizzes().map((quiz) => [quiz.id, JSON.stringify(quiz)]));
  const changes = new Map<string, string>([
    [QUIZZES_KEY, JSON.stringify(snapshot.quizzes)],
    [ATTEMPTS_KEY, JSON.stringify(snapshot.attempts)],
    [RESULTS_KEY, JSON.stringify(snapshot.results)],
    [QUIZ_UPDATED_KEY, JSON.stringify(snapshot.quizUpdatedAt)],
    [DELETED_QUIZZES_KEY, JSON.stringify(snapshot.deletedQuizAt)],
    [MODIFIED_KEY, snapshot.modifiedAt],
  ]);
  if (snapshot.schemaVersion === 2) changes.set(SNAPSHOT_VERSION_KEY, "2");
  writeChanges(changes);
  for (const [quizId, value] of existing) {
    const replacement = snapshot.quizzes.find((quiz) => quiz.id === quizId);
    if (!replacement || JSON.stringify(replacement) !== value) clearReadingPositions(quizId);
  }
  notifyStorageChange(source);
}
