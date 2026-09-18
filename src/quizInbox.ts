import type { RealtimeChannel, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import type { QuizFile } from "./models";
import { supabase } from "./cloudSync";
import { validateQuizFile } from "./quizSchema";

export type QuizInboxStatus = "pending" | "accepted" | "rejected";

export type QuizInboxItem = {
  id: string;
  userId: string;
  quizId: string;
  title: string;
  payload: QuizFile;
  status: QuizInboxStatus;
  sourceClientId?: string;
  createdAt: string;
  reviewedAt?: string;
};

type InboxRow = {
  id: string;
  user_id: string;
  quiz_id: string;
  title: string;
  payload: unknown;
  status: QuizInboxStatus;
  source_client_id: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export function parseInboxRow(row: InboxRow): QuizInboxItem | undefined {
  const validation = validateQuizFile(row.payload);
  if (!validation.success) return undefined;
  return {
    id: row.id,
    userId: row.user_id,
    quizId: row.quiz_id,
    title: row.title,
    payload: validation.data,
    status: row.status,
    sourceClientId: row.source_client_id ?? undefined,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at ?? undefined,
  };
}

export type QuizInboxState = {
  items: QuizInboxItem[];
  loading: boolean;
  message: string;
  refresh: () => Promise<void>;
  review: (id: string, status: Exclude<QuizInboxStatus, "pending">) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
};

export function useQuizInbox(user?: User): QuizInboxState {
  const [items, setItems] = useState<QuizInboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    if (!supabase || !user) {
      setItems([]);
      return;
    }
    if (!navigator.onLine) {
      setMessage("The AI inbox needs an internet connection.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("quiz_inbox")
      .select("id,user_id,quiz_id,title,payload,status,source_client_id,created_at,reviewed_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    const parsed = (data as InboxRow[]).map(parseInboxRow).filter((item): item is QuizInboxItem => Boolean(item));
    setItems(parsed);
    setMessage(parsed.length ? "" : "No AI-generated quizzes are waiting for review.");
  }, [user]);

  const review = useCallback(async (id: string, status: Exclude<QuizInboxStatus, "pending">): Promise<boolean> => {
    if (!supabase || !user || !navigator.onLine) {
      setMessage("Connect to the internet before reviewing this quiz.");
      return false;
    }
    const { data, error } = await supabase
      .from("quiz_inbox")
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (error || !data) {
      setMessage(error?.message ?? "This submission was already reviewed on another device.");
      await refresh();
      return false;
    }
    setItems((current) => current.filter((item) => item.id !== id));
    return true;
  }, [refresh, user]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    if (!supabase || !user || !navigator.onLine) {
      setMessage("Connect to the internet before deleting this submission.");
      return false;
    }
    const { error } = await supabase.from("quiz_inbox").delete().eq("id", id);
    if (error) {
      setMessage(error.message);
      return false;
    }
    setItems((current) => current.filter((item) => item.id !== id));
    return true;
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const client = supabase;
    if (!client || !user) return;
    let channel: RealtimeChannel | undefined;
    channel = client
      .channel(`quiz-inbox-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_inbox", filter: `user_id=eq.${user.id}` }, () => void refresh())
      .subscribe();
    return () => { if (channel) void client.removeChannel(channel); };
  }, [refresh, user]);

  return { items, loading, message, refresh, review, remove };
}
