import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const decisionTreeQuiz = JSON.parse(readFileSync(new URL("../sample-quizzes/decision-tree-practical-work.json", import.meta.url), "utf8"));
const readingQuiz = JSON.parse(readFileSync(new URL("../sample-quizzes/plain-reading-practice.json", import.meta.url), "utf8"));
const richQuiz = JSON.parse(readFileSync(new URL("../public/examples/rich-reading.json", import.meta.url), "utf8"));
const basicQuiz = JSON.parse(readFileSync(new URL("../public/examples/basic-math.json", import.meta.url), "utf8"));

type QuizFixture = {
  quiz: {
    questions: Array<{
      prompt: string;
      type: string;
      options?: Array<{ id: string; text: string }>;
      correctOptionId?: string;
      correctOptionIds?: string[];
      acceptedAnswers?: string[];
      pairs?: Array<{ id: string; prompt: string; match: string }>;
    }>;
  };
};

/** Answer whatever question is on screen, so the test survives a random question order. */
async function answerCurrentQuestion(page: import("@playwright/test").Page, fixture: QuizFixture): Promise<void> {
  const prompt = await page.getByRole("heading", { level: 1 }).innerText();
  const question = fixture.quiz.questions.find((item) => item.prompt === prompt);
  if (!question) throw new Error(`The fixture has no question with the prompt: ${prompt}`);
  if (question.type === "shortText") {
    await page.getByLabel("Your answer").fill(question.acceptedAnswers![0]);
    return;
  }
  if (question.type === "matching") {
    const rows = page.locator(".matching-row");
    await expect(rows).toHaveCount(question.pairs!.length);
    for (const [index, pair] of question.pairs!.entries()) {
      await rows.nth(index).getByRole("combobox").selectOption({ label: pair.match });
    }
    return;
  }
  const correctIds = question.type === "singleChoice" ? [question.correctOptionId!] : question.correctOptionIds!;
  for (const id of correctIds) {
    const text = question.options!.find((option) => option.id === id)!.text;
    await page.locator(".choice", { hasText: text }).click();
  }
}

/** Answer every question in whatever order it appears, until the quiz is finished. */
async function completeQuiz(page: import("@playwright/test").Page, fixture: QuizFixture): Promise<void> {
  for (let answered = 0; answered <= fixture.quiz.questions.length; answered += 1) {
    await answerCurrentQuestion(page, fixture);
    if (await page.getByRole("button", { name: "Finish quiz" }).isVisible()) {
      await page.getByRole("button", { name: "Finish quiz" }).click();
      return;
    }
    await page.getByRole("button", { name: /Next question/ }).click();
  }
  throw new Error("The quiz never reached its last question");
}

const matchingQuiz = {
  schemaVersion: 3,
  quiz: {
    id: "matching-e2e",
    title: "Matching Check",
    questions: [
      {
        id: "q1",
        type: "matching",
        prompt: "Match each term to its meaning.",
        pairs: [
          { id: "p1", prompt: "Weight", match: "A learned number" },
          { id: "p2", prompt: "Loss", match: "A measure of prediction error" },
        ],
        explanation: "Weights are learned from examples; loss measures error.",
      },
    ],
  },
};

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
  await page.getByRole("button", { name: "Learning material for Offline Check" }).click();
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
  await page.getByRole("button", { name: "Learning material for Offline Check" }).click();
  await expect(page.getByRole("heading", { name: "Offline Study Guide" })).toBeVisible();
});

test("imports and completes a matching question", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Import quiz" }).click();
  await page.getByLabel("Choose a JSON file").setInputFiles({
    name: "matching.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(matchingQuiz)),
  });
  await page.getByRole("button", { name: "Start Matching Check" }).click();
  await expect(page.locator(".question-panel .eyebrow")).toHaveText("MATCH EACH ITEM");

  const rows = page.locator(".matching-row");
  await expect(rows).toHaveCount(2);
  await rows.nth(0).getByRole("combobox").selectOption({ label: "A learned number" });
  await rows.nth(1).getByRole("combobox").selectOption({ label: "A measure of prediction error" });
  await page.getByRole("button", { name: "Finish quiz" }).click();

  await expect(page.getByText("100%")).toBeVisible();
  await page.getByRole("button", { name: "Show answers" }).click();
  await expect(page.getByText("Weight → A learned number").first()).toBeVisible();
  await expect(page.getByText(/Weights are learned from examples/)).toBeVisible();
});

test("imports and renders the illustrated decision-tree guide", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Import quiz" }).click();
  await page.getByLabel("Choose a JSON file").setInputFiles({
    name: "decision-tree-practical-work.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(decisionTreeQuiz))
  });
  await page.getByRole("button", { name: "Learning material for Decision Trees for Practical Work" }).click();
  await expect(page.getByRole("heading", { name: "Decision Trees: From Node Impurity to Reliable Models" })).toBeVisible();
  await expect(page.getByRole("img")).toHaveCount(6);
  await expect(page.getByRole("heading", { name: "Impurity measures class mixture inside a node" })).toBeVisible();
});

test("reuses a reading passage across questions, review, and offline reload", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Import quiz" }).click();
  await page.getByLabel("Choose a JSON file").setInputFiles({
    name: "plain-reading-practice.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(readingQuiz))
  });
  await page.getByRole("button", { name: "Start Reading Practice: Urban Wetlands" }).click();
  await page.getByRole("button", { name: "Read passage: The Return of Urban Wetlands" }).click();
  await expect(page.getByRole("dialog", { name: "The Return of Urban Wetlands" })).toContainText("city planners often drained wetlands");
  await page.getByRole("button", { name: "Close passage" }).click();
  await answerCurrentQuestion(page, readingQuiz);
  await page.getByRole("button", { name: /Next question/ }).click();
  await page.reload();
  await page.getByRole("button", { name: "Resume Reading Practice: Urban Wetlands" }).click();
  await page.getByRole("button", { name: "Read passage: The Return of Urban Wetlands" }).click();
  await expect(page.getByRole("dialog")).toContainText("city planners often drained wetlands");
  await page.getByRole("button", { name: "Close passage" }).click();
  await answerCurrentQuestion(page, readingQuiz);
  await page.getByRole("button", { name: /Next question/ }).click();
  await answerCurrentQuestion(page, readingQuiz);
  await page.getByRole("button", { name: /Next question/ }).click();
  await answerCurrentQuestion(page, readingQuiz);
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

test("offers two downloadable examples and a click-to-copy AI prompt", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole("button", { name: "Import quiz" }).click();
  const exampleLinks = page.locator(".resource-actions a[download]");
  await expect(exampleLinks).toHaveText(["Quiz example", "Reading material example"]);
  await expect(exampleLinks.first()).toHaveAttribute("href", "/examples/basic-math.json");
  await expect(exampleLinks.nth(1)).toHaveAttribute("href", "/examples/rich-reading.json");
  await expect(page.locator('.resource-actions a[href$=".md"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Copy AI prompt" }).click();
  await expect(page.getByRole("status")).toContainText("Prompt copied");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('Topic: "Describe what you want to learn"');
  expect(copied).not.toContain("[TOPIC]");
  expect(copied).toContain('"schemaVersion"');

  await page.locator('input[type="file"]').setInputFiles({
    name: "rich-reading.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(richQuiz)),
  });
  await expect(page.getByRole("heading", { name: "Reading Practice: A Small Neural Network" })).toBeVisible();
});

test("shuffles question and choice order for every new attempt", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Import quiz" }).click();
  await page.getByLabel("Choose a JSON file").setInputFiles({
    name: "plain-reading-practice.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(readingQuiz))
  });

  const shownOrder = async (): Promise<string> => `${await page.getByRole("heading", { level: 1 }).innerText()} | ${(await page.locator(".choice").allInnerTexts()).join(" / ")}`;
  const storedSeed = async (): Promise<number> => {
    const stored = await page.evaluate(() => localStorage.getItem("quiz-platform:attempts"));
    return (JSON.parse(stored ?? "{}")["urban-wetlands-reading"] as { shuffleSeed: number }).shuffleSeed;
  };

  await page.getByRole("button", { name: "Start Reading Practice: Urban Wetlands" }).click();
  const firstAttempt = await shownOrder();
  const firstSeed = await storedSeed();

  await page.reload();
  await page.getByRole("button", { name: "Resume Reading Practice: Urban Wetlands" }).click();
  expect(await shownOrder()).toBe(firstAttempt);
  expect(await storedSeed()).toBe(firstSeed);

  await completeQuiz(page, readingQuiz);
  await expect(page.getByText("100%")).toBeVisible();

  const seeds = new Set([firstSeed]);
  for (let attempt = 0; attempt < 5 && seeds.size < 2; attempt += 1) {
    await page.getByRole("button", { name: "Try again" }).click();
    seeds.add(await storedSeed());
  }
  expect(seeds.size).toBeGreaterThan(1);
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
  await page.getByRole("button", { name: "Learning material for Reading Practice: A Small Neural Network" }).click();
  await expect(page.getByRole("dialog", { name: "How a Neural Network Learns" })).toContainText("LEARNING MATERIAL");
  await expect(page.getByRole("dialog").locator(".reading-diagram img")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("img", { name: "Small embedded image" })).toBeVisible();
  const materialScroll = await page.getByRole("dialog").locator(".reading-dialog-body").evaluate((element) => {
    element.scrollTop = element.scrollHeight - element.clientHeight;
    element.dispatchEvent(new Event("scroll"));
    return element.scrollTop;
  });
  expect(materialScroll).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Close material" }).click();
  await page.getByRole("button", { name: "Start Reading Practice: A Small Neural Network" }).click();
  await page.getByRole("button", { name: "Read passage: How a Neural Network Learns" }).click();
  const dialog = page.getByRole("dialog", { name: "How a Neural Network Learns" });
  await expect(dialog.getByRole("heading", { name: "A small neural network" })).toBeVisible();
  await expect(dialog.locator(".katex").first()).toBeVisible();
  await expect(dialog.locator(".reading-diagram img")).toBeVisible();
  await expect(dialog.getByRole("img", { name: "Small embedded image" })).toBeVisible();
  const scrollArea = dialog.locator(".reading-dialog-body");
  await expect.poll(() => scrollArea.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
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
  await answerCurrentQuestion(page, richQuiz);
  await page.getByRole("button", { name: /Next question/ }).click();
  await page.getByRole("button", { name: "Read passage: How a Neural Network Learns" }).click();
  await expect.poll(() => scrollArea.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Close passage" }).click();
  await answerCurrentQuestion(page, richQuiz);
  await page.getByRole("button", { name: /Next question/ }).click();
  await answerCurrentQuestion(page, richQuiz);
  await page.getByRole("button", { name: /Next question/ }).click();
  await answerCurrentQuestion(page, richQuiz);
  await page.getByRole("button", { name: "Finish quiz" }).click();
  await expect(page.getByText("100%")).toBeVisible();
  await expect(page.getByText("Correct answer:")).toHaveCount(0);
  await expect(page.getByText("The passage says weights are learned from examples rather than written by hand.")).toHaveCount(0);
  await page.getByRole("button", { name: "Show answers" }).click();
  await expect(page.getByText("Correct answer:")).toHaveCount(4);
  await page.getByRole("button", { name: "Hide answers" }).click();
  await expect(page.getByText("Correct answer:")).toHaveCount(0);
  await page.getByRole("button", { name: "Back to library" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Review Reading Practice: A Small Neural Network" }).click();
  await expect(page.getByRole("button", { name: "Show answers" })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.goto("/");
  await page.getByRole("button", { name: "Learning material for Reading Practice: A Small Neural Network" }).click();
  await expect(page.getByRole("dialog", { name: "How a Neural Network Learns" }).locator(".katex").first()).toBeVisible();
  await page.getByRole("button", { name: "Close material" }).click();
  await page.getByRole("button", { name: "Review Reading Practice: A Small Neural Network" }).click();
  await page.getByRole("button", { name: "Read passage: How a Neural Network Learns" }).first().click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "A small neural network" })).toBeVisible();
  await expect(page.getByRole("dialog").locator(".reading-diagram img")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("img", { name: "Small embedded image" })).toBeVisible();
});
