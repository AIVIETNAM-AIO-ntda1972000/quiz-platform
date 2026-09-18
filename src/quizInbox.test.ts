import { describe, expect, it } from "vitest";
import { parseInboxRow } from "./quizInbox";

describe("quiz inbox data", () => {
  it("accepts valid payloads and rejects invalid rows", () => {
    const base = {
      id: "submission-1",
      user_id: "user-1",
      quiz_id: "quiz-1",
      title: "Quiz One",
      status: "pending" as const,
      source_client_id: null,
      created_at: "2026-09-18T00:00:00.000Z",
      reviewed_at: null,
    };
    expect(parseInboxRow({
      ...base,
      payload: { schemaVersion: 1, quiz: { id: "quiz-1", title: "Quiz One", questions: [{ id: "q1", type: "shortText", prompt: "Answer?", acceptedAnswers: ["Yes"] }] } },
    })?.quizId).toBe("quiz-1");
    expect(parseInboxRow({ ...base, payload: {} })).toBeUndefined();
  });
});
