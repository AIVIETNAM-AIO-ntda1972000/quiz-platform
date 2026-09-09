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
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
};

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

  const pushSnapshot = useCallback(async (activeUser: User) => {
    if (!supabase) return;
    if (!navigator.onLine) {
      setStatus("offline");
      setMessage("Changes are saved locally and will sync when you are online.");
      return;
    }
    setStatus("syncing");
    const { error } = await supabase.from("quiz_platform_data").upsert({
      user_id: activeUser.id,
      data: exportStorageSnapshot(),
      updated_at: new Date().toISOString(),
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("synced");
    setMessage("All changes are synced.");
  }, []);

  const syncNow = useCallback(async () => {
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
      return;
    }
    const local = exportStorageSnapshot();
    const merged = mergeStorageSnapshots(local, remote);
    if (JSON.stringify(merged) !== JSON.stringify(local)) {
      importStorageSnapshot(merged, "cloud");
      onCloudData();
    }
    if (JSON.stringify(merged) !== JSON.stringify(remote)) await pushSnapshot(activeUser);
    else {
      setStatus("synced");
      setMessage("All changes are synced.");
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

  useEffect(() => subscribeToStorageChanges((source) => {
    if (source === "cloud" || !userRef.current) return;
    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => void pushSnapshot(userRef.current!), 450);
  }), [pushSnapshot]);

  useEffect(() => {
    const handleOnline = () => void syncNow();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncNow]);

  useEffect(() => {
    if (!supabase || !user) return;
    const channel = supabase
      .channel(`quiz-platform-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_platform_data", filter: `user_id=eq.${user.id}` }, () => void syncNow())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [syncNow, user]);

  const signIn = async (email: string, password: string): Promise<boolean> => {
    if (!supabase) return false;
    setStatus("syncing");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return false;
    }
    return true;
  };

  const signUp = async (email: string, password: string): Promise<boolean> => {
    if (!supabase) return false;
    setStatus("syncing");
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return false;
    }
    if (!data.session) {
      setStatus("signedOut");
      setMessage("Check your email to confirm the account, then sign in.");
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
