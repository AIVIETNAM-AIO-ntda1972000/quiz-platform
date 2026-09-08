import { beforeEach, describe, expect, it } from "vitest";
import { exampleQuizFile } from "./exampleQuiz";
import { clearQuizProgress, deleteQuiz, initializeQuizLibrary, loadAttempt, loadQuizzes, loadResult, saveAttempt, saveQuiz, saveResult } from "./storage";

describe("local persistence", () => {
  beforeEach(() => localStorage.clear());

  it("adds and replaces quizzes without duplicates", () => {
    expect(saveQuiz(exampleQuizFile.quiz)).toEqual({ replaced: false });
    expect(saveQuiz({ ...exampleQuizFile.quiz, title: "Updated" })).toEqual({ replaced: true });
    expect(loadQuizzes()).toHaveLength(1);
    expect(loadQuizzes()[0].title).toBe("Updated");
  });

  it("saves attempts and clears all progress for a replaced quiz", () => {
    saveAttempt({ quizId: "basic-math", answers: { q1: "b" }, currentIndex: 1, updatedAt: "now" });
    saveResult({ quizId: "basic-math", answers: {}, correct: 0, total: 3, completedAt: "now" });
    expect(loadAttempt("basic-math")?.currentIndex).toBe(1);
    expect(loadResult("basic-math")?.total).toBe(3);
    clearQuizProgress("basic-math");
    expect(loadAttempt("basic-math")).toBeUndefined();
    expect(loadResult("basic-math")).toBeUndefined();
  });

  it("deletes a quiz and does not restore the starter quiz after reload", () => {
    initializeQuizLibrary(exampleQuizFile.quiz);
    saveAttempt({ quizId: "basic-math", answers: {}, currentIndex: 0, updatedAt: "now" });
    saveResult({ quizId: "basic-math", answers: {}, correct: 0, total: 3, completedAt: "now" });
    deleteQuiz("basic-math");
    expect(loadQuizzes()).toEqual([]);
    expect(loadAttempt("basic-math")).toBeUndefined();
    expect(loadResult("basic-math")).toBeUndefined();
    expect(initializeQuizLibrary(exampleQuizFile.quiz)).toEqual([]);
  });
});
