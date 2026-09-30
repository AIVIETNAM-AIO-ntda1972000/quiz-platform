import { beforeEach, describe, expect, it, vi } from "vitest";
import { exampleQuizFile } from "./exampleQuiz";
import type { Quiz } from "./models";
import richExample from "../public/examples/rich-reading.json";
import { loadReadingPosition, saveReadingPosition } from "./readingPosition";
import { clearQuizProgress, deleteQuiz, exportStorageSnapshot, initializeQuizLibrary, loadAttempt, loadQuizzes, loadResult, saveAttempt, saveQuiz, saveResult } from "./storage";

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

  it("keeps reading position locally and clears it on replacement or deletion", () => {
    saveQuiz(exampleQuizFile.quiz);
    saveReadingPosition("basic-math", "article", { block: "12", offset: 42 });
    expect(loadReadingPosition("basic-math", "article")).toEqual({ block: "12", offset: 42 });
    saveQuiz({ ...exampleQuizFile.quiz, title: "Updated" });
    expect(loadReadingPosition("basic-math", "article")).toBeUndefined();
    saveReadingPosition("basic-math", "article", { block: "20", offset: 10 });
    deleteQuiz("basic-math");
    expect(loadReadingPosition("basic-math", "article")).toBeUndefined();
  });

  it("promotes rich quiz snapshots to version 2 even after deleting rich material", () => {
    saveQuiz(richExample.quiz as Quiz);
    expect(exportStorageSnapshot().schemaVersion).toBe(2);
    deleteQuiz(richExample.quiz.id);
    expect(exportStorageSnapshot().schemaVersion).toBe(2);
  });

  it("leaves a prior quiz and progress untouched when storage rejects an import", () => {
    saveQuiz(exampleQuizFile.quiz);
    saveResult({ quizId: "basic-math", answers: {}, correct: 0, total: 3, completedAt: "now" });
    const originalSetItem = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === "quiz-platform:quizzes" && String(value).includes("Too large")) throw new DOMException("Quota exceeded", "QuotaExceededError");
      originalSetItem.call(this, key, value);
    });
    try {
      expect(() => saveQuiz({ ...exampleQuizFile.quiz, title: "Too large" })).toThrow();
      expect(loadQuizzes()[0].title).toBe("Basic Mathematics");
      expect(loadResult("basic-math")).toBeDefined();
    } finally { spy.mockRestore(); }
  });
});
