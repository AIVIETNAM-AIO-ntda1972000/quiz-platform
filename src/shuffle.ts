import type { Attempt, ChoiceOption, Question, Quiz } from "./models";

const UINT32_RANGE = 4_294_967_296;

/** A random seed for one attempt. Falls back so the app still works without Web Crypto. */
export function newShuffleSeed(): number {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
    return cryptoApi.getRandomValues(new Uint32Array(1))[0];
  }
  return Math.floor(Math.random() * UINT32_RANGE);
}

/** Deterministic PRNG (mulberry32) so one seed always produces one quiz order. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

export function shuffleItems<T>(items: readonly T[], seed: number): T[] {
  const shuffled = [...items];
  const random = createSeededRandom(seed);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function hashText(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function questionSeed(seed: number, question: Question, index: number): number {
  return (seed + hashText(question.id) + Math.imul(index, 0x9e3779b1)) >>> 0;
}

/** The attempt's question order. An attempt without a recorded seed keeps the authored order. */
export function displayQuestions(quiz: Quiz, attempt: Attempt): Question[] {
  if (attempt.shuffleSeed === undefined) return quiz.questions;
  return shuffleItems(quiz.questions, attempt.shuffleSeed);
}

/** The attempt's choice order for one question. Answers stay keyed by option id. */
export function displayOptions(question: Question, attempt: Attempt, questionIndex: number): ChoiceOption[] {
  if (attempt.shuffleSeed === undefined) {
    return question.type === "singleChoice" || question.type === "multipleChoice" ? question.options : [];
  }
  if (question.type === "singleChoice" || question.type === "multipleChoice") {
    return shuffleItems(question.options, questionSeed(attempt.shuffleSeed, question, questionIndex));
  }
  return [];
}

/**
 * The attempt's right-hand column for a matching question. The left-hand prompts keep the
 * authored pair order so the rows a learner sees stay in a predictable sequence.
 */
export function displayMatches(question: Question, attempt: Attempt, questionIndex: number): string[] {
  if (question.type !== "matching") return [];
  const matches = question.pairs.map((pair) => pair.match);
  if (attempt.shuffleSeed === undefined) return matches;
  return shuffleItems(matches, questionSeed(attempt.shuffleSeed, question, questionIndex));
}
