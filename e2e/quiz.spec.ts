import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const decisionTreeQuiz = JSON.parse(readFileSync(new URL("../sample-quizzes/decision-tree-practical-work.json", import.meta.url), "utf8"));
const readingQuiz = JSON.parse(readFileSync(new URL("../public/examples/reading-practice.json", import.meta.url), "utf8"));

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

test("follows the system theme and remembers a manual override", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0b1026");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("button", { name: "Switch to dark mode" })).toBeVisible();
});

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

test("reuses a reading passage across questions, review, and offline reload", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Import quiz" }).click();
  await page.getByLabel("Choose a JSON file").setInputFiles({
    name: "reading-practice.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(readingQuiz))
  });
  await page.getByRole("button", { name: "Start Reading Practice: Urban Wetlands" }).click();
  await page.getByRole("button", { name: "Read passage: The Return of Urban Wetlands" }).click();
  await expect(page.getByRole("dialog", { name: "The Return of Urban Wetlands" })).toContainText("city planners often drained wetlands");
  await page.getByRole("button", { name: "Close passage" }).click();
  await page.getByText("To explain why some cities restore wetlands and what those wetlands can and cannot do").click();
  await page.getByRole("button", { name: /Next question/ }).click();
  await page.reload();
  await page.getByRole("button", { name: "Resume Reading Practice: Urban Wetlands" }).click();
  await page.getByRole("button", { name: "Read passage: The Return of Urban Wetlands" }).click();
  await expect(page.getByRole("dialog")).toContainText("city planners often drained wetlands");
  await page.getByRole("button", { name: "Close passage" }).click();
  await page.getByText("They hold rainwater temporarily.").click();
  await page.getByText("They provide habitat for birds and insects.").click();
  await page.getByRole("button", { name: /Next question/ }).click();
  await page.getByLabel("Your answer").fill("native species");
  await page.getByRole("button", { name: /Next question/ }).click();
  await page.getByText("To show that wetlands work best as one part of a wider flood strategy").click();
  await page.getByRole("button", { name: "Finish quiz" }).click();
  await expect(page.getByText("100%")).toBeVisible();
  await page.getByRole("button", { name: "Read passage: The Return of Urban Wetlands" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("city planners often drained wetlands");
  await page.getByRole("button", { name: "Close passage" }).click();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.goto("/");
  await page.getByRole("button", { name: "Start Reading Practice: Urban Wetlands" }).click();
  await page.getByRole("button", { name: "Read passage: The Return of Urban Wetlands" }).click();
  await expect(page.getByRole("dialog")).toContainText("city planners often drained wetlands");
});
