import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const decisionTreeQuiz = JSON.parse(readFileSync(new URL("../sample-quizzes/decision-tree-practical-work.json", import.meta.url), "utf8"));

const importedQuiz = {
  schemaVersion: 1,
  quiz: {
    id: "offline-check",
    title: "Offline Check",
    learningMaterial: {
      title: "Offline Study Guide",
      sections: [{
        id: "steps",
        title: "Three offline steps",
        paragraphs: ["Imported learning material remains available without a network connection."],
        illustration: {
          type: "flow",
          items: [{ label: "Import" }, { label: "Study" }, { label: "Practice" }]
        }
      }]
    },
    questions: [{ id: "q1", type: "shortText", prompt: "Type ready", acceptedAnswers: ["ready"], explanation: "You are ready." }]
  }
};

test("imports, completes, reloads, and starts offline", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Import quiz" }).click();
  await page.getByLabel("Choose a JSON file").setInputFiles({ name: "offline.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(importedQuiz)) });
  await expect(page.getByRole("heading", { name: "Offline Check" })).toBeVisible();
  await page.getByRole("button", { name: "Study Offline Check" }).click();
  await expect(page.getByRole("heading", { name: "Offline Study Guide" })).toBeVisible();
  await page.getByRole("button", { name: "Back to library" }).click();
  await page.getByRole("button", { name: "Start Offline Check" }).click();
  await page.getByLabel("Your answer").fill("ready");
  await page.reload();
  await page.getByRole("button", { name: "Resume Offline Check" }).click();
  await expect(page.getByLabel("Your answer")).toHaveValue("ready");
  await page.getByRole("button", { name: "Finish quiz" }).click();
  await expect(page.getByText("100%")).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.goto("/");
  await expect(page.getByText("What will you learn today?")).toBeVisible();
  await page.getByRole("button", { name: "Study Offline Check" }).click();
  await expect(page.getByRole("heading", { name: "Offline Study Guide" })).toBeVisible();
});

test("imports and renders the illustrated decision-tree guide", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Import quiz" }).click();
  await page.getByLabel("Choose a JSON file").setInputFiles({
    name: "decision-tree-practical-work.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(decisionTreeQuiz))
  });
  await page.getByRole("button", { name: "Study Decision Trees for Practical Work" }).click();
  await expect(page.getByRole("heading", { name: "Decision Trees: From Node Impurity to Reliable Models" })).toBeVisible();
  await expect(page.getByRole("img")).toHaveCount(6);
  await expect(page.getByRole("heading", { name: "Impurity measures class mixture inside a node" })).toBeVisible();
});
