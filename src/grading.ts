import type { Answer, Question, Quiz, QuizResult } from "./models";

export function normalizeText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function isCorrect(question: Question, answer: Answer | undefined): boolean {
  if (question.type === "shortText") {
    if (typeof answer !== "string") return false;
    const normalized = normalizeText(answer);
    return normalized.length > 0 && question.acceptedAnswers.some((accepted) => normalizeText(accepted) === normalized);
  }
  if (question.type === "singleChoice") return typeof answer === "string" && answer === question.correctOptionId;
  if (!Array.isArray(answer)) return false;
  const selected = [...new Set(answer)].sort();
  const expected = [...new Set(question.correctOptionIds)].sort();
  return selected.length === expected.length && selected.every((id, index) => id === expected[index]);
}

export function gradeQuiz(quiz: Quiz, answers: Record<string, Answer>): QuizResult {
  return {
    quizId: quiz.id,
    answers,
    correct: quiz.questions.filter((question) => isCorrect(question, answers[question.id])).length,
    total: quiz.questions.length,
    completedAt: new Date().toISOString()
  };
}
