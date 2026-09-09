import { describe, expect, it } from "vitest";
import { mergeStorageSnapshots, normalizeUsername, storageSnapshotsEqual, usernameToAuthEmail } from "./cloudSync";
import { exampleQuizFile } from "./exampleQuiz";
import type { StorageSnapshot } from "./storage";

function snapshot(overrides: Partial<StorageSnapshot> = {}): StorageSnapshot {
  return {
    schemaVersion: 1,
    quizzes: [],
    attempts: {},
    results: {},
    quizUpdatedAt: {},
    deletedQuizAt: {},
    modifiedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("cloud snapshot merge", () => {
  it("keeps the newest quiz and progress from either device", () => {
    const local = snapshot({
      quizzes: [exampleQuizFile.quiz],
      quizUpdatedAt: { "basic-math": "2026-01-02T00:00:00.000Z" },
      attempts: { "basic-math": { quizId: "basic-math", answers: {}, currentIndex: 0, updatedAt: "2026-01-02T00:00:00.000Z" } },
    });
    const remote = snapshot({
      quizzes: [{ ...exampleQuizFile.quiz, title: "Remote title" }],
      quizUpdatedAt: { "basic-math": "2026-01-03T00:00:00.000Z" },
      attempts: { "basic-math": { quizId: "basic-math", answers: { q1: "b" }, currentIndex: 1, updatedAt: "2026-01-04T00:00:00.000Z" } },
    });
    const merged = mergeStorageSnapshots(local, remote);
    expect(merged.quizzes[0].title).toBe("Remote title");
    expect(merged.attempts["basic-math"].currentIndex).toBe(1);
  });

  it("keeps a deletion when it is newer than the quiz", () => {
    const local = snapshot({ deletedQuizAt: { "basic-math": "2026-01-05T00:00:00.000Z" } });
    const remote = snapshot({
      quizzes: [exampleQuizFile.quiz],
      quizUpdatedAt: { "basic-math": "2026-01-03T00:00:00.000Z" },
    });
    const merged = mergeStorageSnapshots(local, remote);
    expect(merged.quizzes).toEqual([]);
    expect(merged.deletedQuizAt["basic-math"]).toBe("2026-01-05T00:00:00.000Z");
  });

  it("treats snapshots with differently ordered object keys as equal", () => {
    const left = snapshot({
      quizUpdatedAt: { alpha: "2026-01-02T00:00:00.000Z", beta: "2026-01-03T00:00:00.000Z" },
      deletedQuizAt: { gamma: "2026-01-04T00:00:00.000Z", delta: "2026-01-05T00:00:00.000Z" },
    });
    const right = snapshot({
      quizUpdatedAt: { beta: "2026-01-03T00:00:00.000Z", alpha: "2026-01-02T00:00:00.000Z" },
      deletedQuizAt: { delta: "2026-01-05T00:00:00.000Z", gamma: "2026-01-04T00:00:00.000Z" },
    });

    expect(storageSnapshotsEqual(left, right)).toBe(true);
  });
});

describe("username authentication", () => {
  it("normalizes a username into the internal Supabase email", () => {
    expect(normalizeUsername("  Duy.Anh_07 ")).toBe("duy.anh_07");
    expect(usernameToAuthEmail("Duy.Anh_07")).toBe("duy.anh_07@users.quiz-platform.invalid");
  });

  it("rejects usernames that cannot safely become an auth identity", () => {
    expect(() => normalizeUsername("ab")).toThrow();
    expect(() => normalizeUsername("duy anh")).toThrow();
    expect(() => normalizeUsername("tên-tiếng-việt")).toThrow();
  });
});
