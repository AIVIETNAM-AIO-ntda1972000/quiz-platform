import { describe, expect, it } from "vitest";
import downloadableExample from "../public/examples/basic-math.json";
import readingExample from "../public/examples/reading-practice.json";
import richExample from "../public/examples/rich-reading.json";
import decisionTreeQuiz from "../sample-quizzes/decision-tree-practical-work.json";
import vietnameseAiQuiz from "../sample-quizzes/kien-thuc-ai-co-ban.json";
import { exampleQuizFile } from "./exampleQuiz";
import type { MarkdownReadingPassage } from "./models";
import { parseQuizJson, validateQuizFile } from "./quizSchema";

describe("quiz validation", () => {
  it("accepts the included practical decision-tree quiz", () => {
    expect(decisionTreeQuiz.quiz.questions).toHaveLength(50);
    expect(decisionTreeQuiz.quiz.learningMaterial?.sections).toHaveLength(6);
    expect(validateQuizFile(decisionTreeQuiz).success).toBe(true);
  });

  it("rejects duplicate learning section ids", () => {
    const invalid = structuredClone(decisionTreeQuiz);
    invalid.quiz.learningMaterial!.sections[1].id = invalid.quiz.learningMaterial!.sections[0].id;
    const result = validateQuizFile(invalid);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.some((error) => error.includes("Duplicate learning section id"))).toBe(true);
  });

  it("accepts the included Vietnamese AI quiz", () => {
    expect(validateQuizFile(vietnameseAiQuiz).success).toBe(true);
  });

  it("accepts the example quiz", () => {
    expect(validateQuizFile(exampleQuizFile).success).toBe(true);
  });

  it("keeps the downloadable example complete and synchronized", () => {
    expect(validateQuizFile(downloadableExample).success).toBe(true);
    expect(downloadableExample).toEqual(exampleQuizFile);
    expect(downloadableExample.quiz.questions.map((question) => question.type)).toEqual([
      "singleChoice",
      "multipleChoice",
      "shortText"
    ]);
    expect(downloadableExample.quiz.learningMaterial.sections.map((section) => section.illustration?.type)).toEqual([
      "flow",
      "comparison",
      "distribution"
    ]);
  });

  it("accepts a passage reused by different question types", () => {
    const result = validateQuizFile(readingExample);
    expect(result.success).toBe(true);
    expect(readingExample.quiz.questions.map((question) => question.passageId)).toEqual([
      "wetlands", "wetlands", "wetlands", "wetlands"
    ]);
  });

  it("accepts a version 2 Markdown passage and keeps version 1 strict", () => {
    expect(validateQuizFile(richExample).success).toBe(true);
    expect(validateQuizFile({ ...richExample, schemaVersion: 1 }).success).toBe(false);
  });

  it.each([
    ["remote image", "![Chart](https://example.com/chart.png)"],
    ["raw HTML", "<script>alert(1)</script>"],
    ["unsafe link", "[Click](javascript:alert(1))"],
    ["unsupported diagram", "```mermaid\npie\n  1: 2\n```"],
    ["Mermaid remote resource", "```mermaid\nflowchart LR\n  A[https://example.com/image.png] --> B\n```"],
  ])("rejects %s in rich material", (_name, content) => {
    const invalid = structuredClone(richExample);
    invalid.quiz.passages[0].content = content;
    expect(validateQuizFile(invalid).success).toBe(false);
  });

  it("rejects duplicate, missing, and disguised image assets", () => {
    const invalid = structuredClone(richExample);
    invalid.quiz.passages[0].content += "\n![Figure](quiz-asset:figure)";
    const passage = invalid.quiz.passages[0] as MarkdownReadingPassage;
    passage.assets = [
      { id: "figure", mimeType: "image/png", base64: "PHN2Zz48L3N2Zz4=" },
      { id: "figure", mimeType: "image/png", base64: "PHN2Zz48L3N2Zz4=" },
    ];
    const result = validateQuizFile(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((error) => error.includes("Duplicate image asset id"))).toBe(true);
      expect(result.errors.some((error) => error.includes("Invalid image data"))).toBe(true);
    }
    passage.assets = [];
    const missing = validateQuizFile(invalid);
    expect(missing.success).toBe(false);
    if (!missing.success) expect(missing.errors.some((error) => error.includes("embedded asset"))).toBe(true);
  });

  it("rejects duplicate passage ids and missing passage references", () => {
    const invalid = structuredClone(readingExample);
    invalid.quiz.passages.push({ ...invalid.quiz.passages[0] });
    invalid.quiz.questions[1].passageId = "missing";
    const result = validateQuizFile(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContain("quiz.passages.1.id: Duplicate passage id: wetlands");
      expect(result.errors).toContain("quiz.questions.1.passageId: Passage id does not exist: missing");
    }
  });

  it("requires non-empty passage paragraphs", () => {
    const invalid = structuredClone(readingExample);
    invalid.quiz.passages[0].paragraphs[0] = "   ";
    const result = validateQuizFile(invalid);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.some((error) => error.startsWith("quiz.passages.0.paragraphs.0:"))).toBe(true);
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
