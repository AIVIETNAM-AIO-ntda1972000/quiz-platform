import { afterEach, describe, expect, it, vi } from "vitest";
import { aiPromptText, copyAiPrompt } from "./aiPrompt";

function stubClipboard(writeText: ((text: string) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: writeText ? { writeText } : undefined });
}

describe("ai prompt", () => {
  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    Reflect.deleteProperty(document, "execCommand");
  });

  it("ships one prompt with an editable topic and no placeholder tokens", () => {
    expect(aiPromptText).toContain('Topic: "Describe what you want to learn"');
    expect(aiPromptText).not.toContain("[TOPIC]");
    expect(aiPromptText).not.toContain("[LEVEL]");
    expect(aiPromptText).toContain('"schemaVersion"');
    expect(aiPromptText).toContain('"type": "matching"');
  });

  it("prefers the Clipboard API", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { configurable: true, value: execCommand });

    await expect(copyAiPrompt()).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith(aiPromptText);
    expect(execCommand).not.toHaveBeenCalled();
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("falls back to execCommand when the Clipboard API is missing", async () => {
    stubClipboard(undefined);
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { configurable: true, value: execCommand });

    await expect(copyAiPrompt()).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("falls back to execCommand when the Clipboard API rejects", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error("NotAllowedError")));
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { configurable: true, value: execCommand });

    await expect(copyAiPrompt()).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("reports failure and leaves no stray field behind", async () => {
    stubClipboard(undefined);
    Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn().mockReturnValue(false) });

    await expect(copyAiPrompt()).resolves.toBe(false);
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("reports failure when no copy mechanism exists", async () => {
    stubClipboard(undefined);
    await expect(copyAiPrompt()).resolves.toBe(false);
    expect(document.querySelector("textarea")).toBeNull();
  });
});
