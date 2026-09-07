import { useEffect } from "react";
import type { Quiz, QuizFile } from "./models";
import { validateQuizFile } from "./quizSchema";

type ModelTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: object;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute(input: unknown): unknown | Promise<unknown>;
};

declare global {
  interface Document {
    modelContext?: { registerTool(tool: ModelTool, options?: { signal?: AbortSignal }): void | Promise<void> };
  }
}

export function useWebMcp(quizzes: Quiz[], importQuiz: (file: QuizFile, replace: boolean) => void): void {
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: ModelTool) => { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => undefined); };

    register({
      name: "list_quizzes",
      title: "List quizzes",
      description: "List the quizzes currently stored on this device.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () => quizzes.map(({ id, title, questions }) => ({ id, title, questionCount: questions.length }))
    });
    register({
      name: "import_quiz",
      title: "Import quiz",
      description: "Validate and import a schemaVersion 1 quiz into this device's quiz library.",
      inputSchema: {
        type: "object",
        properties: {
          payload: { type: "object", description: "The complete quiz JSON object." },
          replaceExisting: { type: "boolean", description: "Replace a quiz with the same id and clear its progress." }
        },
        required: ["payload"],
        additionalProperties: false
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: (input) => {
        const values = input as { payload?: unknown; replaceExisting?: boolean };
        const result = validateQuizFile(values.payload);
        if (!result.success) throw new Error(result.errors.join("; "));
        const exists = quizzes.some((quiz) => quiz.id === result.data.quiz.id);
        if (exists && !values.replaceExisting) throw new Error("A quiz with this id already exists. Set replaceExisting to true to replace it.");
        importQuiz(result.data, Boolean(values.replaceExisting));
        return { imported: true, quizId: result.data.quiz.id, replaced: exists };
      }
    });
    return () => lifecycle.abort();
  }, [importQuiz, quizzes]);
}
