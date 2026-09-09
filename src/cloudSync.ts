import { createClient, type User } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Attempt, Quiz, QuizResult } from "./models";
import { validateQuizFile } from "./quizSchema";
import {
  exportStorageSnapshot,
  importStorageSnapshot,
  subscribeToStorageChanges,
  type StorageSnapshot,
} from "./storage";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ?? import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim();

export const isCloudConfigured = Boolean(supabaseUrl && supabaseKey);

const supabase = isCloudConfigured
  ? createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  : undefined;

export type SyncStatus = "disabled" | "signedOut" | "syncing" | "synced" | "offline" | "error";

type CloudSyncState = {
  user?: User;
  status: SyncStatus;
  message: string;
  signIn: (username: string, password: string) => Promise<boolean>;
  signUp: (username: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
};

export function normalizeUsername(value: string): string {
  const username = value.normalize("NFKC").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
    throw new Error("Username must be 3–32 characters and use only letters, numbers, dot, dash, or underscore.");
  }
  return username;
}

export function usernameToAuthEmail(value: string): string {
  return `${normalizeUsername(value)}@users.quiz-platform.invalid`;
}

function stableSerialize(value: unknown): string {
  const canonicalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(canonicalize);
    if (item && typeof item === "object") {
      return Object.fromEntries(Object.entries(item)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]));
    }
    return item;
  };

  return JSON.stringify(canonicalize(value));
}

export function storageSnapshotsEqual(left: StorageSnapshot, right: StorageSnapshot): boolean {
  return stableSerialize(left) === stableSerialize(right);
}

function timestamp(value: string | undefined): number {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function newest<T>(left: T | undefined, leftTime: string | undefined, right: T | undefined, rightTime: string | undefined): T | undefined {
  if (!left) return right;
  if (!right) return left;
  return timestamp(leftTime) >= timestamp(rightTime) ? left : right;
}

export function mergeStorageSnapshots(local: StorageSnapshot, remote: StorageSnapshot): StorageSnapshot {
  const localQuizzes = new Map(local.quizzes.map((quiz) => [quiz.id, quiz]));
  const remoteQuizzes = new Map(remote.quizzes.map((quiz) => [quiz.id, quiz]));
  const quizIds = new Set([
    ...localQuizzes.keys(),
    ...remoteQuizzes.keys(),
    ...Object.keys(local.deletedQuizAt),
    ...Object.keys(remote.deletedQuizAt),
  ]);
  const quizzes: Quiz[] = [];
  const quizUpdatedAt: Record<string, string> = {};
  const deletedQuizAt: Record<string, string> = {};

  quizIds.forEach((quizId) => {
    const localQuizTime = local.quizUpdatedAt[quizId] ?? local.modifiedAt;
    const remoteQuizTime = remote.quizUpdatedAt[quizId] ?? remote.modifiedAt;
    const localQuiz = localQuizzes.get(quizId);
    const remoteQuiz = remoteQuizzes.get(quizId);
    const chosenQuiz = newest(localQuiz, localQuizTime, remoteQuiz, remoteQuizTime);
    const chosenQuizTime = timestamp(localQuizTime) >= timestamp(remoteQuizTime) ? localQuizTime : remoteQuizTime;
    const deletionTime = timestamp(local.deletedQuizAt[quizId]) >= timestamp(remote.deletedQuizAt[quizId])
      ? local.deletedQuizAt[quizId]
      : remote.deletedQuizAt[quizId];

    if (deletionTime && timestamp(deletionTime) >= timestamp(chosenQuizTime)) {
      deletedQuizAt[quizId] = deletionTime;
      return;
    }
    if (chosenQuiz) {
      quizzes.push(chosenQuiz);
      quizUpdatedAt[quizId] = chosenQuizTime;
    }
  });

  const existingIds = new Set(quizzes.map((quiz) => quiz.id));
  const attempts: Record<string, Attempt> = {};
  const results: Record<string, QuizResult> = {};
  existingIds.forEach((quizId) => {
    const localAttempt = local.attempts[quizId];
    const remoteAttempt = remote.attempts[quizId];
    const attempt = newest(localAttempt, localAttempt?.updatedAt, remoteAttempt, remoteAttempt?.updatedAt);
    if (attempt) attempts[quizId] = attempt;

    const localResult = local.results[quizId];
    const remoteResult = remote.results[quizId];
    const result = newest(localResult, localResult?.completedAt, remoteResult, remoteResult?.completedAt);
    if (result) results[quizId] = result;
  });

  const modifiedAt = timestamp(local.modifiedAt) >= timestamp(remote.modifiedAt) ? local.modifiedAt : remote.modifiedAt;
  return { schemaVersion: 1, quizzes, attempts, results, quizUpdatedAt, deletedQuizAt, modifiedAt };
}

function parseSnapshot(value: unknown): StorageSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const data = value as Partial<StorageSnapshot>;
  if (data.schemaVersion !== 1 || !Array.isArray(data.quizzes) || typeof data.modifiedAt !== "string") return undefined;
  const quizzes: Quiz[] = [];
  for (const quiz of data.quizzes) {
    const validation = validateQuizFile({ schemaVersion: 1, quiz });
    if (!validation.success) return undefined;
    quizzes.push(validation.data.quiz);
  }
  return {
    schemaVersion: 1,
    quizzes,
    attempts: data.attempts && typeof data.attempts === "object" ? data.attempts : {},
    results: data.results && typeof data.results === "object" ? data.results : {},
    quizUpdatedAt: data.quizUpdatedAt && typeof data.quizUpdatedAt === "object" ? data.quizUpdatedAt : {},
    deletedQuizAt: data.deletedQuizAt && typeof data.deletedQuizAt === "object" ? data.deletedQuizAt : {},
    modifiedAt: data.modifiedAt,
  } as StorageSnapshot;
}

export function useCloudSync(onCloudData: () => void): CloudSyncState {
  const [user, setUser] = useState<User>();
  const [status, setStatus] = useState<SyncStatus>(isCloudConfigured ? "signedOut" : "disabled");
  const [message, setMessage] = useState(isCloudConfigured ? "Sign in to sync across devices." : "Cloud sync is not configured.");
  const userRef = useRef<User | undefined>(undefined);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastPushedSnapshot = useRef<string | undefined>(undefined);
  const syncPromise = useRef<Promise<void> | undefined>(undefined);
  const syncRequested = useRef(false);

  const pushSnapshot = useCallback(async (activeUser: User) => {
    if (!supabase) return;
    if (!navigator.onLine) {
      setStatus("offline");
      setMessage("Changes are saved locally and will sync when you are online.");
      return;
    }
    setStatus("syncing");
    const snapshot = exportStorageSnapshot();
    const snapshotSignature = stableSerialize(snapshot);
    lastPushedSnapshot.current = snapshotSignature;
    const { error } = await supabase.from("quiz_platform_data").upsert({
      user_id: activeUser.id,
      data: snapshot,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      if (lastPushedSnapshot.current === snapshotSignature) lastPushedSnapshot.current = undefined;
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("synced");
    setMessage("All changes are synced.");
  }, []);

  const syncNow = useCallback(async () => {
    if (syncPromise.current) {
      syncRequested.current = true;
      await syncPromise.current;
      return;
    }

    const operation = (async () => {
      do {
        syncRequested.current = false;
        const activeUser = userRef.current;
        if (!supabase || !activeUser) return;
        if (!navigator.onLine) {
          setStatus("offline");
          setMessage("You are offline. Local changes will sync after reconnecting.");
          return;
        }
        setStatus("syncing");
        const { data, error } = await supabase
          .from("quiz_platform_data")
          .select("data")
          .eq("user_id", activeUser.id)
          .maybeSingle();
        if (error) {
          setStatus("error");
          setMessage(error.message);
          return;
        }

        const remote = parseSnapshot(data?.data);
        if (!remote) {
          await pushSnapshot(activeUser);
          continue;
        }
        const local = exportStorageSnapshot();
        const merged = mergeStorageSnapshots(local, remote);
        if (!storageSnapshotsEqual(merged, local)) {
          importStorageSnapshot(merged, "cloud");
          onCloudData();
        }
        if (!storageSnapshotsEqual(merged, remote)) await pushSnapshot(activeUser);
        else {
          setStatus("synced");
          setMessage("All changes are synced.");
        }
      } while (syncRequested.current);
    })();

    syncPromise.current = operation;
    try {
      await operation;
    } finally {
      if (syncPromise.current === operation) syncPromise.current = undefined;
    }
  }, [onCloudData, pushSnapshot]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active || !data.session?.user) return;
      userRef.current = data.session.user;
      setUser(data.session.user);
      void syncNow();
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user;
      userRef.current = nextUser;
      setUser(nextUser);
      if (nextUser) window.setTimeout(() => void syncNow(), 0);
      else {
        setStatus("signedOut");
        setMessage("Sign in to sync across devices.");
      }
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [syncNow]);

  useEffect(() => {
    const unsubscribe = subscribeToStorageChanges((source) => {
      if (source === "cloud" || !userRef.current) return;
      clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(() => void syncNow(), 450);
    });
    return () => {
      clearTimeout(pushTimer.current);
      unsubscribe();
    };
  }, [syncNow]);

  useEffect(() => {
    const handleOnline = () => void syncNow();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncNow]);

  useEffect(() => {
    if (!supabase || !user) return;
    const channel = supabase
      .channel(`quiz-platform-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_platform_data", filter: `user_id=eq.${user.id}` }, (payload) => {
        const remoteSnapshot = (payload.new as { data?: unknown }).data;
        if (remoteSnapshot && stableSerialize(remoteSnapshot) === lastPushedSnapshot.current) return;
        void syncNow();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [syncNow, user]);

  const signIn = async (username: string, password: string): Promise<boolean> => {
    if (!supabase) return false;
    setStatus("syncing");
    let email: string;
    try {
      email = usernameToAuthEmail(username);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Invalid username.");
      return false;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return false;
    }
    return true;
  };

  const signUp = async (username: string, password: string): Promise<boolean> => {
    if (!supabase) return false;
    setStatus("syncing");
    let normalizedUsername: string;
    try {
      normalizedUsername = normalizeUsername(username);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Invalid username.");
      return false;
    }
    const { data, error } = await supabase.auth.signUp({
      email: usernameToAuthEmail(normalizedUsername),
      password,
      options: { data: { username: normalizedUsername } },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return false;
    }
    if (!data.session) {
      setStatus("signedOut");
      setMessage("Account created, but Supabase email confirmation is still enabled. Disable Confirm email, then create the account again.");
    }
    return true;
  };

  const signOut = async (): Promise<void> => {
    if (!supabase) return;
    await supabase.auth.signOut();
    userRef.current = undefined;
    setUser(undefined);
    setStatus("signedOut");
    setMessage("Signed out. Local data remains on this device.");
  };

  return { user, status, message, signIn, signUp, signOut, syncNow };
}
