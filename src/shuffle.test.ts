import { describe, expect, it } from "vitest";
import { exampleQuizFile } from "./exampleQuiz";
import type { Attempt } from "./models";
import { createSeededRandom, displayOptions, displayQuestions, newShuffleSeed, shuffleItems } from "./shuffle";

function attemptWith(seed: number | undefined): Attempt {
  return { quizId: "basic-math", answers: {}, currentIndex: 0, updatedAt: "now", shuffleSeed: seed };
}

describe("shuffle", () => {
  it("generates a usable attempt seed", () => {
    const seed = newShuffleSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffffffff);
  });

  it("replays one seed deterministically", () => {
    const take = (count: number): number[] => {
      const next = createSeededRandom(1234);
      return Array.from({ length: count }, () => next());
    };
    const values = take(5);
    expect(take(5)).toEqual(values);
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(new Set(values).size).toBeGreaterThan(1);
  });

  it("returns every item exactly once without mutating the input", () => {
    const items = ["a", "b", "c", "d", "e"];
    const shuffled = shuffleItems(items, 7);
    expect([...shuffled].sort()).toEqual([...items].sort());
    expect(items).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("keeps the authored order when an attempt has no seed", () => {
    const attempt = attemptWith(undefined);
    expect(displayQuestions(exampleQuizFile.quiz, attempt).map((question) => question.id))
      .toEqual(exampleQuizFile.quiz.questions.map((question) => question.id));
    const [single] = exampleQuizFile.quiz.questions;
    if (single.type !== "singleChoice") throw new Error("The starter quiz changed unexpectedly");
    expect(displayOptions(single, attempt, 0)).toEqual(single.options);
  });

  it("reshuffles questions and choices with a new attempt seed", () => {
    const quiz = exampleQuizFile.quiz;
    const questionOrders = new Set<string>();
    const optionOrders = new Set<string>();

    for (let seed = 0; seed < 25; seed += 1) {
      const attempt = attemptWith(seed);
      const questions = displayQuestions(quiz, attempt);
      const questionOrder = questions.map((question) => question.id).join(",");
      questionOrders.add(questionOrder);
      expect(questionOrder.split(",").sort()).toEqual(quiz.questions.map((question) => question.id).sort());
      questions.forEach((question, index) => {
        if (question.type !== "singleChoice" && question.type !== "multipleChoice") return;
        optionOrders.add(`${question.id}:${displayOptions(question, attempt, index).map((option) => option.id).join(",")}`);
      });
    }

    const authoredQuestions = quiz.questions.map((question) => question.id).join(",");
    expect(questionOrders.size).toBeGreaterThan(1);
    expect([...questionOrders].some((order) => order !== authoredQuestions)).toBe(true);
    expect(optionOrders.size).toBeGreaterThan(1);
  });

  it("gives the same question the same order for one seed and different orders across seeds", () => {
    const quiz = exampleQuizFile.quiz;
    const multiple = quiz.questions.find((question) => question.type === "multipleChoice");
    if (!multiple) throw new Error("The starter quiz changed unexpectedly");

    const first = displayOptions(multiple, attemptWith(42), 0).map((option) => option.id);
    expect(displayOptions(multiple, attemptWith(42), 0).map((option) => option.id)).toEqual(first);

    const seen = new Set([first.join(",")]);
    for (let seed = 0; seed < 25 && seen.size < 2; seed += 1) {
      seen.add(displayOptions(multiple, attemptWith(seed), 0).map((option) => option.id).join(","));
    }
    expect(seen.size).toBeGreaterThan(1);
    expect([...seen].every((order) => order.split(",").sort().join(",") === "a,b,c")).toBe(true);
  });
});
