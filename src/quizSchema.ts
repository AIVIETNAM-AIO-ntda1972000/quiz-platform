import { z } from "zod";
import type { QuizFile } from "./models";

const nonEmptyText = z.string().trim().min(1, "Required");
const optionSchema = z.object({ id: nonEmptyText, text: nonEmptyText }).strict();
const baseQuestion = { id: nonEmptyText, prompt: nonEmptyText, explanation: nonEmptyText.optional() };

const singleChoiceSchema = z.object({
  ...baseQuestion,
  type: z.literal("singleChoice"),
  options: z.array(optionSchema).min(2, "Add at least two options"),
  correctOptionId: nonEmptyText
}).strict();

const multipleChoiceSchema = z.object({
  ...baseQuestion,
  type: z.literal("multipleChoice"),
  options: z.array(optionSchema).min(2, "Add at least two options"),
  correctOptionIds: z.array(nonEmptyText).min(1, "Add at least one correct option")
}).strict();

const shortTextSchema = z.object({
  ...baseQuestion,
  type: z.literal("shortText"),
  acceptedAnswers: z.array(nonEmptyText).min(1, "Add at least one accepted answer")
}).strict();

export const quizFileSchema = z.object({
  schemaVersion: z.literal(1, { error: "Only schemaVersion 1 is supported" }),
  quiz: z.object({
    id: nonEmptyText,
    title: nonEmptyText,
    description: nonEmptyText.optional(),
    questions: z.array(z.discriminatedUnion("type", [singleChoiceSchema, multipleChoiceSchema, shortTextSchema])).min(1, "Add at least one question")
  }).strict()
}).strict().superRefine((data, context) => {
  const questionIds = new Set<string>();
  data.quiz.questions.forEach((question, questionIndex) => {
    if (questionIds.has(question.id)) {
      context.addIssue({ code: "custom", path: ["quiz", "questions", questionIndex, "id"], message: `Duplicate question id: ${question.id}` });
    }
    questionIds.add(question.id);

    if (question.type === "shortText") {
      const answers = new Set<string>();
      question.acceptedAnswers.forEach((answer, answerIndex) => {
        const normalized = answer.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
        if (answers.has(normalized)) {
          context.addIssue({ code: "custom", path: ["quiz", "questions", questionIndex, "acceptedAnswers", answerIndex], message: `Duplicate accepted answer: ${answer}` });
        }
        answers.add(normalized);
      });
      return;
    }

    const optionIds = new Set<string>();
    question.options.forEach((option, optionIndex) => {
      if (optionIds.has(option.id)) {
        context.addIssue({ code: "custom", path: ["quiz", "questions", questionIndex, "options", optionIndex, "id"], message: `Duplicate option id: ${option.id}` });
      }
      optionIds.add(option.id);
    });
    const correctIds = question.type === "singleChoice" ? [question.correctOptionId] : question.correctOptionIds;
    if (new Set(correctIds).size !== correctIds.length) {
      context.addIssue({ code: "custom", path: ["quiz", "questions", questionIndex, "correctOptionIds"], message: "Correct option ids must be unique" });
    }
    correctIds.forEach((id) => {
      if (!optionIds.has(id)) {
        context.addIssue({ code: "custom", path: ["quiz", "questions", questionIndex], message: `Correct option id does not exist: ${id}` });
      }
    });
  });
});

export type ValidationResult = { success: true; data: QuizFile } | { success: false; errors: string[] };

export function validateQuizFile(input: unknown): ValidationResult {
  const result = quizFileSchema.safeParse(input);
  if (result.success) return { success: true, data: result.data as QuizFile };
  return { success: false, errors: result.error.issues.map((issue) => `${issue.path.length ? issue.path.join(".") : "file"}: ${issue.message}`) };
}

export function parseQuizJson(text: string): ValidationResult {
  try {
    return validateQuizFile(JSON.parse(text));
  } catch {
    return { success: false, errors: ["file: This is not valid JSON"] };
  }
}
