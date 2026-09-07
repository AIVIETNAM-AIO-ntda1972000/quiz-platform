import { expect, test } from "@playwright/test";

const importedQuiz = {
  schemaVersion: 1,
  quiz: {
    id: "offline-check",
    title: "Offline Check",
    questions: [{ id: "q1", type: "shortText", prompt: "Type ready", acceptedAnswers: ["ready"], explanation: "You are ready." }]
  }
};

test("imports, completes, reloads, and starts offline", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Import quiz" }).click();
  await page.getByLabel("Choose a JSON file").setInputFiles({ name: "offline.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(importedQuiz)) });
  await expect(page.getByRole("heading", { name: "Offline Check" })).toBeVisible();
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
});
