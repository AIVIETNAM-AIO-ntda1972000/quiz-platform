import promptText from "../public/AI_PROMPT.txt?raw";

/** The universal quiz-creation prompt shipped with the app, bundled so it works offline. */
export const aiPromptText: string = promptText;

/** Copy the AI prompt. Falls back to the legacy execCommand path where the Clipboard API is unavailable. */
export async function copyAiPrompt(): Promise<boolean> {
  const clipboard = navigator.clipboard;
  if (clipboard && typeof clipboard.writeText === "function") {
    try {
      await clipboard.writeText(aiPromptText);
      return true;
    } catch {
      // Fall through to the legacy path.
    }
  }
  return copyWithExecCommand();
}

function copyWithExecCommand(): boolean {
  const field = document.createElement("textarea");
  field.value = aiPromptText;
  field.setAttribute("readonly", "");
  field.setAttribute("aria-hidden", "true");
  field.style.position = "fixed";
  field.style.top = "0";
  field.style.left = "-9999px";
  document.body.append(field);
  try {
    field.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}
