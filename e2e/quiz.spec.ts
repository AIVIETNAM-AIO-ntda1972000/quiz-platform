import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const decisionTreeQuiz = JSON.parse(readFileSync(new URL("../sample-quizzes/decision-tree-practical-work.json", import.meta.url), "utf8"));
const readingQuiz = JSON.parse(readFileSync(new URL("../public/examples/reading-practice.json", import.meta.url), "utf8"));
const richQuiz = JSON.parse(readFileSync(new URL("../public/examples/rich-reading.json", import.meta.url), "utf8"));

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

test("renders rich reading offline, restores position, and reveals answers only on request", async ({ page, context }) => {
  const quizWithImage = structuredClone(richQuiz);
  quizWithImage.quiz.passages[0].content += "\n\n![Small embedded image](quiz-asset:figure-1)";
  quizWithImage.quiz.passages[0].assets = [{
    id: "figure-1",
    mimeType: "image/png",
    base64: readFileSync(new URL("../public/pwa-64x64.png", import.meta.url)).toString("base64"),
  }];
  await page.goto("/");
  await page.getByRole("button", { name: "Import quiz" }).click();
  await page.getByLabel("Choose a JSON file").setInputFiles({
    name: "rich-reading.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(quizWithImage)),
  });
  await page.getByRole("button", { name: "Start Reading Practice: A Small Neural Network" }).click();
  await page.getByRole("button", { name: "Read passage: How a Neural Network Learns" }).click();
  const dialog = page.getByRole("dialog", { name: "How a Neural Network Learns" });
  await expect(dialog.getByRole("heading", { name: "A small neural network" })).toBeVisible();
  await expect(dialog.locator(".katex").first()).toBeVisible();
  await expect(dialog.locator(".reading-diagram img")).toBeVisible();
  await expect(dialog.getByRole("img", { name: "Small embedded image" })).toBeVisible();
  const scrollArea = dialog.locator(".reading-dialog-body");
  const initialScroll = await scrollArea.evaluate((element) => {
    element.scrollTop = element.scrollHeight - element.clientHeight;
    element.dispatchEvent(new Event("scroll"));
    return element.scrollTop;
  });
  expect(initialScroll).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Close passage" }).click();
  await page.getByRole("button", { name: "Read passage: How a Neural Network Learns" }).click();
  await expect.poll(() => scrollArea.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Close passage" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Resume Reading Practice: A Small Neural Network" }).click();
  await page.getByRole("button", { name: "Read passage: How a Neural Network Learns" }).click();
  await expect.poll(() => scrollArea.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Close passage" }).click();
  await page.getByText("Numbers learned from examples").click();
  await page.getByRole("button", { name: /Next question/ }).click();
  await page.getByRole("button", { name: "Read passage: How a Neural Network Learns" }).click();
  await expect.poll(() => scrollArea.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Close passage" }).click();
  await page.getByText("Loss measures prediction error.").click();
  await page.getByText("Validation data can help assess performance on new examples.").click();
  await page.getByRole("button", { name: /Next question/ }).click();
  await page.getByLabel("Your answer").fill("optimizer");
  await page.getByRole("button", { name: "Finish quiz" }).click();
  await expect(page.getByText("100%")).toBeVisible();
  await expect(page.getByText("Correct answer:")).toHaveCount(0);
  await expect(page.getByText("The passage says weights are learned from examples rather than written by hand.")).toHaveCount(0);
  await page.getByRole("button", { name: "Show answers" }).click();
  await expect(page.getByText("Correct answer:")).toHaveCount(3);
  await page.getByRole("button", { name: "Hide answers" }).click();
  await expect(page.getByText("Correct answer:")).toHaveCount(0);
  await page.getByRole("button", { name: "Back to library" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Review Reading Practice: A Small Neural Network" }).click();
  await expect(page.getByRole("button", { name: "Show answers" })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.goto("/");
  await page.getByRole("button", { name: "Review Reading Practice: A Small Neural Network" }).click();
  await page.getByRole("button", { name: "Read passage: How a Neural Network Learns" }).first().click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "A small neural network" })).toBeVisible();
  await expect(page.getByRole("dialog").locator(".reading-diagram img")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("img", { name: "Small embedded image" })).toBeVisible();
});
