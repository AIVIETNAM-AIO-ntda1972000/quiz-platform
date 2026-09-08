import { describe, expect, it } from "vitest";
import decisionTreeQuiz from "../sample-quizzes/decision-tree-practical-work.json";
import vietnameseAiQuiz from "../sample-quizzes/kien-thuc-ai-co-ban.json";
import { exampleQuizFile } from "./exampleQuiz";
import { parseQuizJson, validateQuizFile } from "./quizSchema";

describe("quiz validation", () => {
  it("accepts the included practical decision-tree quiz", () => {
    expect(decisionTreeQuiz.quiz.questions).toHaveLength(50);
    expect(validateQuizFile(decisionTreeQuiz).success).toBe(true);
  });

  it("accepts the included Vietnamese AI quiz", () => {
    expect(validateQuizFile(vietnameseAiQuiz).success).toBe(true);
  });

  it("accepts the example quiz", () => {
    expect(validateQuizFile(exampleQuizFile).success).toBe(true);
  });

  it("returns a useful error for invalid JSON", () => {
    expect(parseQuizJson("not json")).toEqual({ success: false, errors: ["file: This is not valid JSON"] });
  });

  it("rejects duplicate ids and missing answer references", () => {
    const invalid = structuredClone(exampleQuizFile);
    invalid.quiz.questions[1].id = "q1";
    if (invalid.quiz.questions[0].type === "singleChoice") invalid.quiz.questions[0].correctOptionId = "missing";
    const result = validateQuizFile(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((error) => error.includes("Duplicate question id"))).toBe(true);
      expect(result.errors.some((error) => error.includes("does not exist"))).toBe(true);
    }
  });
});
