export type ReadingPosition = { block: string; offset: number };

function key(quizId: string, passageId: string): string {
  return `quiz-platform:reading-position:${encodeURIComponent(quizId)}:${encodeURIComponent(passageId)}`;
}

export function loadReadingPosition(quizId: string, passageId: string): ReadingPosition | undefined {
  try {
    const value = localStorage.getItem(key(quizId, passageId));
    if (!value) return undefined;
    const position: unknown = JSON.parse(value);
    if (position && typeof position === "object" && "block" in position && "offset" in position
      && typeof position.block === "string" && typeof position.offset === "number" && Number.isFinite(position.offset)) {
      return { block: position.block, offset: position.offset };
    }
  } catch { /* Reading position is optional. */ }
  return undefined;
}

export function saveReadingPosition(quizId: string, passageId: string, position: ReadingPosition): void {
  try { localStorage.setItem(key(quizId, passageId), JSON.stringify(position)); } catch { /* Reading position is optional. */ }
}

export function clearReadingPositions(quizId: string): void {
  const prefix = `quiz-platform:reading-position:${encodeURIComponent(quizId)}:`;
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const itemKey = localStorage.key(index);
      if (itemKey?.startsWith(prefix)) localStorage.removeItem(itemKey);
    }
  } catch { /* Reading position is optional. */ }
}
