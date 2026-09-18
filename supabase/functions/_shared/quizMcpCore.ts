import type { Quiz, QuizFile } from "../../../src/models.ts";
import { validateQuizFile, type ValidationResult } from "../../../shared/quizContract.ts";

export const MAX_QUIZ_PAYLOAD_BYTES = 1_048_576;
export const MAX_PENDING_QUIZZES = 20;

export const QUIZ_CREATION_INSTRUCTIONS = [
  "Create one schemaVersion 1 quiz JSON object.",
  "Include quiz.id, quiz.title, and at least one supported question.",
  "Supported question types are singleChoice, multipleChoice, and shortText.",
  "Use unique quiz, question, option, and learning-section IDs.",
  "Choice answers must reference existing option IDs.",
  "learningMaterial is optional but recommended for teaching-oriented quizzes.",
  "Call validate_quiz before publish_quiz. Publishing creates a pending draft that the user must accept in the AI Inbox.",
].join(" ");

export const QUIZ_CONTRACT = {
  root: { schemaVersion: 1, quiz: "Quiz" },
  Quiz: {
    required: ["id", "title", "questions"],
    optional: ["description", "learningMaterial"],
  },
  singleChoice: {
    required: ["id", "type", "prompt", "options", "correctOptionId"],
    rules: ["type must be singleChoice", "at least two options", "correctOptionId must reference an option"],
  },
  multipleChoice: {
    required: ["id", "type", "prompt", "options", "correctOptionIds"],
    rules: ["type must be multipleChoice", "at least two options", "every correctOptionId must reference an option"],
  },
  shortText: {
    required: ["id", "type", "prompt", "acceptedAnswers"],
    rules: ["type must be shortText", "at least one non-empty accepted answer"],
  },
  learningMaterial: {
    required: ["title", "sections"],
    sectionRequired: ["id", "title", "paragraphs"],
    illustrationTypes: ["flow", "comparison", "distribution"],
  },
} as const;

export type QuizSummary = {
  id: string;
  title: string;
  description?: string;
  questionCount: number;
};

export type PendingQuizSummary = {
  id: string;
  quizId: string;
  title: string;
  questionCount: number;
  sourceClientId?: string;
  createdAt: string;
};

export type InboxInsert = {
  userId: string;
  quizId: string;
  title: string;
  payload: QuizFile;
  sourceClientId?: string;
};

export type QuizMcpRepository = {
  listQuizzes(): Promise<Quiz[]>;
  listPendingQuizzes(): Promise<PendingQuizSummary[]>;
  countPendingQuizzes(): Promise<number>;
  insertPendingQuiz(input: InboxInsert): Promise<{ id: string; createdAt: string }>;
};

export function payloadSizeBytes(payload: unknown): number {
  return new TextEncoder().encode(JSON.stringify(payload)).byteLength;
}

export function validateMcpQuiz(payload: unknown): ValidationResult {
  if (payloadSizeBytes(payload) > MAX_QUIZ_PAYLOAD_BYTES) {
    return {
      success: false,
      errors: [`file: Quiz payload exceeds the ${MAX_QUIZ_PAYLOAD_BYTES}-byte limit`],
    };
  }
  return validateQuizFile(payload);
}

export function summarizeQuiz(quiz: Quiz): QuizSummary {
  return {
    id: quiz.id,
    title: quiz.title,
    ...(quiz.description ? { description: quiz.description } : {}),
    questionCount: quiz.questions.length,
  };
}

export async function publishQuizDraft(
  repository: QuizMcpRepository,
  userId: string,
  sourceClientId: string | undefined,
  payload: unknown,
): Promise<{
  inboxId: string;
  quiz: QuizSummary;
  existingQuiz: boolean;
  createdAt: string;
}> {
  const validation = validateMcpQuiz(payload);
  if (!validation.success) throw new Error(validation.errors.join("\n"));

  const pendingCount = await repository.countPendingQuizzes();
  if (pendingCount >= MAX_PENDING_QUIZZES) {
    throw new Error(`You already have ${MAX_PENDING_QUIZZES} pending drafts. Review or delete one before publishing another.`);
  }

  const quizzes = await repository.listQuizzes();
  const existingQuiz = quizzes.some((quiz) => quiz.id === validation.data.quiz.id);
  const created = await repository.insertPendingQuiz({
    userId,
    quizId: validation.data.quiz.id,
    title: validation.data.quiz.title,
    payload: validation.data,
    sourceClientId,
  });

  return {
    inboxId: created.id,
    quiz: summarizeQuiz(validation.data.quiz),
    existingQuiz,
    createdAt: created.createdAt,
  };
}
