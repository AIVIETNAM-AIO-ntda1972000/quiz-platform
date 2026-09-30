import { z } from "zod";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { visit } from "unist-util-visit";
import type { QuizFile } from "../src/models.ts";

export const MAX_RICH_QUIZ_BYTES = 1_048_576;
const MAX_IMAGE_BYTES = 262_144;
const MAX_TOTAL_IMAGE_BYTES = 524_288;
const MAX_MARKDOWN_BYTES = 102_400;
const imageMimeTypes = ["image/png", "image/jpeg", "image/webp"] as const;
const assetId = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

function decodedImageLength(base64: string, mimeType: typeof imageMimeTypes[number]): number | undefined {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) return undefined;
  try {
    const binary = atob(base64);
    const bytes = Array.from(binary.slice(0, 12), (value) => value.charCodeAt(0));
    const png = [137, 80, 78, 71, 13, 10, 26, 10];
    const jpeg = [255, 216, 255];
    const valid = mimeType === "image/png" ? png.every((byte, index) => bytes[index] === byte)
      : mimeType === "image/jpeg" ? jpeg.every((byte, index) => bytes[index] === byte)
        : binary.slice(0, 4) === "RIFF" && binary.slice(8, 12) === "WEBP";
    return valid ? binary.length : undefined;
  } catch {
    return undefined;
  }
}

function checkMarkdown(content: string, assets: Set<string>, path: (string | number)[], context: z.RefinementCtx): void {
  const root = unified().use(remarkParse).parse(content);
  visit(root, "html", () => context.addIssue({ code: "custom", path, message: "Raw HTML is not allowed in Markdown" }));
  visit(root, "imageReference", () => context.addIssue({ code: "custom", path, message: "Use inline quiz-asset image references" }));
  visit(root, "linkReference", () => context.addIssue({ code: "custom", path, message: "Use inline HTTPS or heading links" }));
  visit(root, "image", (image) => {
    if (!image.url.startsWith("quiz-asset:") || !assets.has(image.url.slice("quiz-asset:".length))) {
      context.addIssue({ code: "custom", path, message: `Image must reference an embedded asset: ${image.url}` });
    }
    if (!image.alt?.trim()) context.addIssue({ code: "custom", path, message: "Images need descriptive alt text" });
  });
  visit(root, "link", (link) => {
    if (!link.url.startsWith("#") && !/^https:\/\/[^\s]+$/i.test(link.url)) {
      context.addIssue({ code: "custom", path, message: `Link must use HTTPS or a heading anchor: ${link.url}` });
    }
  });
  visit(root, "code", (code) => {
    if (code.lang?.toLowerCase() !== "mermaid") return;
    if (new TextEncoder().encode(code.value).byteLength > 10_000) {
      context.addIssue({ code: "custom", path, message: "Mermaid diagrams must be at most 10 KB" });
    }
    if (!/^(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram)\b/.test(code.value.trim())) {
      context.addIssue({ code: "custom", path, message: "Unsupported Mermaid diagram type" });
    }
    if (/\b(?:https?|data|javascript):/i.test(code.value) || /\bclick\s+\w+/i.test(code.value) || /%%\{/.test(code.value)) {
      context.addIssue({ code: "custom", path, message: "Mermaid external resources and configuration directives are not allowed" });
    }
  });
}

const nonEmptyText = z.string().trim().min(1, "Required");
const optionSchema = z.object({ id: nonEmptyText, text: nonEmptyText }).strict();
const baseQuestion = { id: nonEmptyText, prompt: nonEmptyText, explanation: nonEmptyText.optional(), passageId: nonEmptyText.optional() };

const singleChoiceSchema = z.object({
  ...baseQuestion,
  type: z.literal("singleChoice"),
  options: z.array(optionSchema).min(2, "Add at least two options"),
  correctOptionId: nonEmptyText,
}).strict();

const multipleChoiceSchema = z.object({
  ...baseQuestion,
  type: z.literal("multipleChoice"),
  options: z.array(optionSchema).min(2, "Add at least two options"),
  correctOptionIds: z.array(nonEmptyText).min(1, "Add at least one correct option"),
}).strict();

const shortTextSchema = z.object({
  ...baseQuestion,
  type: z.literal("shortText"),
  acceptedAnswers: z.array(nonEmptyText).min(1, "Add at least one accepted answer"),
}).strict();

const illustrationItemSchema = z.object({
  label: nonEmptyText,
  detail: nonEmptyText.optional(),
}).strict();

const learningIllustrationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("flow"),
    title: nonEmptyText.optional(),
    items: z.array(illustrationItemSchema).min(2, "Add at least two flow items").max(8, "Use at most eight flow items"),
  }).strict(),
  z.object({
    type: z.literal("comparison"),
    title: nonEmptyText.optional(),
    items: z.array(z.object({
      label: nonEmptyText,
      detail: nonEmptyText,
      highlight: z.boolean().optional(),
    }).strict()).min(2, "Add at least two comparison items").max(6, "Use at most six comparison items"),
  }).strict(),
  z.object({
    type: z.literal("distribution"),
    title: nonEmptyText.optional(),
    groups: z.array(z.object({
      label: nonEmptyText,
      note: nonEmptyText.optional(),
      segments: z.array(z.object({
        label: nonEmptyText,
        count: z.number().int().positive().max(1000000),
      }).strict()).min(1, "Add at least one distribution segment").max(6, "Use at most six distribution segments"),
    }).strict()).min(2, "Add at least two distribution groups").max(6, "Use at most six distribution groups"),
  }).strict(),
]);

const learningMaterialSchema = z.object({
  title: nonEmptyText,
  summary: nonEmptyText.optional(),
  sections: z.array(z.object({
    id: nonEmptyText,
    title: nonEmptyText,
    paragraphs: z.array(nonEmptyText).min(1, "Add at least one paragraph").max(8, "Use at most eight paragraphs"),
    keyPoints: z.array(nonEmptyText).min(1).max(10).optional(),
    illustration: learningIllustrationSchema.optional(),
  }).strict()).min(1, "Add at least one learning section").max(30, "Use at most thirty learning sections"),
}).strict();

const readingPassageSchema = z.object({
  id: nonEmptyText,
  title: nonEmptyText,
  paragraphs: z.array(nonEmptyText).min(1, "Add at least one passage paragraph").max(30, "Use at most thirty passage paragraphs"),
}).strict();

const passageImageSchema = z.object({
  id: z.string().regex(assetId, "Use 1–64 letters, numbers, dashes, or underscores"),
  mimeType: z.enum(imageMimeTypes),
  base64: z.string().min(1).max(Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 4),
}).strict();

const markdownPassageSchema = z.object({
  id: nonEmptyText,
  title: nonEmptyText,
  format: z.literal("markdown"),
  content: nonEmptyText,
  assets: z.array(passageImageSchema).optional(),
}).strict();

const quizFields = <T extends typeof readingPassageSchema | z.ZodUnion<[typeof readingPassageSchema, typeof markdownPassageSchema]>>(passages: T) => z.object({
  id: nonEmptyText,
  title: nonEmptyText,
  description: nonEmptyText.optional(),
  learningMaterial: learningMaterialSchema.optional(),
  passages: z.array(passages).min(1, "Add at least one passage").max(20, "Use at most twenty passages").optional(),
  questions: z.array(z.discriminatedUnion("type", [singleChoiceSchema, multipleChoiceSchema, shortTextSchema])).min(1, "Add at least one question"),
}).strict();

export const quizFileSchema = z.discriminatedUnion("schemaVersion", [
  z.object({ schemaVersion: z.literal(1), quiz: quizFields(readingPassageSchema) }).strict(),
  z.object({ schemaVersion: z.literal(2), quiz: quizFields(z.union([readingPassageSchema, markdownPassageSchema])) }).strict(),
]).superRefine((data, context) => {
  if (data.schemaVersion === 2 && new TextEncoder().encode(JSON.stringify(data)).byteLength > MAX_RICH_QUIZ_BYTES) {
    context.addIssue({ code: "custom", path: [], message: "Version 2 quiz exceeds the 1 MiB JSON limit" });
  }
  const passageIds = new Set<string>();
  let totalImageBytes = 0;
  data.quiz.passages?.forEach((passage, passageIndex) => {
    if (passageIds.has(passage.id)) {
      context.addIssue({ code: "custom", path: ["quiz", "passages", passageIndex, "id"], message: `Duplicate passage id: ${passage.id}` });
    }
    passageIds.add(passage.id);
    if (!("format" in passage)) return;
    const contentPath = ["quiz", "passages", passageIndex, "content"];
    if (new TextEncoder().encode(passage.content).byteLength > MAX_MARKDOWN_BYTES) {
      context.addIssue({ code: "custom", path: contentPath, message: "Markdown passage must be at most 100 KiB" });
    }
    const imageIds = new Set<string>();
    passage.assets?.forEach((asset, imageIndex) => {
      if (imageIds.has(asset.id)) context.addIssue({ code: "custom", path: ["quiz", "passages", passageIndex, "assets", imageIndex, "id"], message: `Duplicate image asset id: ${asset.id}` });
      imageIds.add(asset.id);
      const decodedLength = decodedImageLength(asset.base64, asset.mimeType);
      if (decodedLength === undefined || decodedLength > MAX_IMAGE_BYTES) {
        context.addIssue({ code: "custom", path: ["quiz", "passages", passageIndex, "assets", imageIndex, "base64"], message: "Invalid image data or image exceeds 256 KiB" });
      } else totalImageBytes += decodedLength;
    });
    checkMarkdown(passage.content, imageIds, contentPath, context);
  });
  if (totalImageBytes > MAX_TOTAL_IMAGE_BYTES) context.addIssue({ code: "custom", path: ["quiz", "passages"], message: "Embedded images exceed 512 KiB per quiz" });

  const sectionIds = new Set<string>();
  data.quiz.learningMaterial?.sections.forEach((section, sectionIndex) => {
    if (sectionIds.has(section.id)) {
      context.addIssue({ code: "custom", path: ["quiz", "learningMaterial", "sections", sectionIndex, "id"], message: `Duplicate learning section id: ${section.id}` });
    }
    sectionIds.add(section.id);
  });

  const questionIds = new Set<string>();
  data.quiz.questions.forEach((question, questionIndex) => {
    if (questionIds.has(question.id)) {
      context.addIssue({ code: "custom", path: ["quiz", "questions", questionIndex, "id"], message: `Duplicate question id: ${question.id}` });
    }
    questionIds.add(question.id);

    if (question.passageId && !passageIds.has(question.passageId)) {
      context.addIssue({ code: "custom", path: ["quiz", "questions", questionIndex, "passageId"], message: `Passage id does not exist: ${question.passageId}` });
    }

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
