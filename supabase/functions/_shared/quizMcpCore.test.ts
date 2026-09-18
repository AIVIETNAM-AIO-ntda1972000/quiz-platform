import { describe, expect, it, vi } from "vitest";
import type { QuizFile } from "../../../src/models";
import {
  MAX_PENDING_QUIZZES,
  MAX_QUIZ_PAYLOAD_BYTES,
  publishQuizDraft,
  summarizeQuiz,
  validateMcpQuiz,
  type QuizMcpRepository,
} from "./quizMcpCore";

const validQuiz: QuizFile = {
  schemaVersion: 1,
  quiz: {
    id: "safe-quiz",
    title: "Safe quiz",
    description: "A test quiz",
    questions: [
      {
        id: "q1",
        type: "singleChoice",
        prompt: "Choose B",
        options: [{ id: "a", text: "A" }, { id: "b", text: "B" }],
        correctOptionId: "b",
      },
    ],
  },
};

function repository(overrides: Partial<QuizMcpRepository> = {}): QuizMcpRepository {
  return {
    listQuizzes: vi.fn().mockResolvedValue([]),
    listPendingQuizzes: vi.fn().mockResolvedValue([]),
    countPendingQuizzes: vi.fn().mockResolvedValue(0),
    insertPendingQuiz: vi.fn().mockResolvedValue({ id: "draft-1", createdAt: "2026-09-18T00:00:00.000Z" }),
    ...overrides,
  };
}

describe("quiz MCP core", () => {
  it("validates the same contract used by the browser", () => {
    expect(validateMcpQuiz(validQuiz)).toEqual({ success: true, data: validQuiz });
    const invalid = validateMcpQuiz({ schemaVersion: 1, quiz: { id: "x" } });
    expect(invalid.success).toBe(false);
  });

  it("rejects payloads over the request limit", () => {
    const result = validateMcpQuiz({ value: "x".repeat(MAX_QUIZ_PAYLOAD_BYTES) });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors[0]).toContain("exceeds");
  });

  it("summarizes quizzes without exposing questions or answers", () => {
    const summary = summarizeQuiz(validQuiz.quiz);
    expect(summary).toEqual({ id: "safe-quiz", title: "Safe quiz", description: "A test quiz", questionCount: 1 });
    expect(summary).not.toHaveProperty("questions");
    expect(JSON.stringify(summary)).not.toContain("correctOptionId");
  });

  it("publishes only through the pending-inbox repository method", async () => {
    const repo = repository({ listQuizzes: vi.fn().mockResolvedValue([validQuiz.quiz]) });
    const result = await publishQuizDraft(repo, "user-1", "client-1", validQuiz);

    expect(result.existingQuiz).toBe(true);
    expect(repo.insertPendingQuiz).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      sourceClientId: "client-1",
      quizId: "safe-quiz",
      payload: validQuiz,
    }));
  });

  it("stops publishing at the pending-draft limit", async () => {
    const repo = repository({ countPendingQuizzes: vi.fn().mockResolvedValue(MAX_PENDING_QUIZZES) });
    await expect(publishQuizDraft(repo, "user-1", undefined, validQuiz)).rejects.toThrow("pending drafts");
    expect(repo.insertPendingQuiz).not.toHaveBeenCalled();
  });

  it("does not insert an invalid payload", async () => {
    const repo = repository();
    await expect(publishQuizDraft(repo, "user-1", undefined, {})).rejects.toThrow("schemaVersion");
    expect(repo.countPendingQuizzes).not.toHaveBeenCalled();
    expect(repo.insertPendingQuiz).not.toHaveBeenCalled();
  });
});
