import { describe, expect, it, vi } from "vitest";
import { exampleQuizFile } from "./exampleQuiz";
import { gradeQuiz, isCorrect, normalizeText } from "./grading";
import type { Question } from "./models";

describe("grading", () => {
  it("normalizes case, spacing, and compatible Unicode without removing accents", () => {
    expect(normalizeText("  PARIS   City ")).toBe("paris city");
    expect(normalizeText("é")).not.toBe(normalizeText("e"));
    expect(normalizeText("Ａ")).toBe("a");
  });

  it("grades every supported question type", () => {
    const [single, multiple, text] = exampleQuizFile.quiz.questions;
    expect(isCorrect(single, "b")).toBe(true);
    expect(isCorrect(multiple, ["c", "a"])).toBe(true);
    expect(isCorrect(multiple, ["a"])).toBe(false);
    expect(isCorrect(text, "  pArIs ")).toBe(true);
  });

  it("calculates the final score", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T00:00:00Z"));
    expect(gradeQuiz(exampleQuizFile.quiz, { q1: "b", q2: ["a", "c"], q3: "wrong" }))
      .toMatchObject({ correct: 2, total: 3, completedAt: "2026-09-07T00:00:00.000Z" });
    vi.useRealTimers();
  });

  it("grades a matching question only when every row is paired correctly", () => {
    const matching: Question = {
      id: "m1",
      type: "matching",
      prompt: "Match the term to its meaning.",
      pairs: [
        { id: "p1", prompt: "Weight", match: "A learned number" },
        { id: "p2", prompt: "Loss", match: "A measure of error" },
      ],
    };
    expect(isCorrect(matching, ["p1", "p2"])).toBe(true);
    expect(isCorrect(matching, ["p2", "p1"])).toBe(false);
    expect(isCorrect(matching, ["p1", ""])).toBe(false);
    expect(isCorrect(matching, ["p1"])).toBe(false);
    expect(isCorrect(matching, [])).toBe(false);
    expect(isCorrect(matching, ["p1", "unknown"])).toBe(false);
    expect(isCorrect(matching, undefined)).toBe(false);
  });
});
