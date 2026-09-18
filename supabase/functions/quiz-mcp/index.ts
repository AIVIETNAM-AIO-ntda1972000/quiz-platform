import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createMcpHandler, McpServer } from "npm:@modelcontextprotocol/server@^2.0.0";
import { pipeline } from "npm:@supabase/middleware@^0.5.0";
import { withOAuthProtectedResource, withSupabase } from "npm:@supabase/server@^1.6.0";
import { createClient } from "npm:@supabase/supabase-js@^2.116.0";
import { z } from "npm:zod@^4.5.4";

import type { Quiz } from "../../../src/models.ts";
import {
  MAX_QUIZ_PAYLOAD_BYTES,
  QUIZ_CONTRACT,
  QUIZ_CREATION_INSTRUCTIONS,
  publishQuizDraft,
  summarizeQuiz,
  validateMcpQuiz,
  type PendingQuizSummary,
  type QuizMcpRepository,
} from "../_shared/quizMcpCore.ts";

const APP_URL = Deno.env.get("QUIZ_PLATFORM_APP_URL")
  ?? "https://aivietnam-aio-ntda1972000.github.io/quiz-platform/";
const securitySchemes = [{ type: "oauth2" as const, scopes: [] }];

type SupabaseClient = ReturnType<typeof createClient>;

function textResult(structuredContent: Record<string, unknown>, message: string) {
  return {
    structuredContent,
    content: [{ type: "text" as const, text: `${message}\n${JSON.stringify(structuredContent)}` }],
  };
}

function createRepository(userClient: SupabaseClient, adminClient: SupabaseClient): QuizMcpRepository {
  return {
    async listQuizzes(): Promise<Quiz[]> {
      const { data, error } = await userClient
        .from("quiz_platform_data")
        .select("data")
        .maybeSingle();
      if (error) throw new Error(error.message);
      const quizzes = data?.data && typeof data.data === "object" && "quizzes" in data.data
        ? (data.data as { quizzes?: unknown }).quizzes
        : undefined;
      if (!Array.isArray(quizzes)) return [];
      return quizzes.flatMap((quiz) => {
        const validation = validateMcpQuiz({ schemaVersion: 1, quiz });
        return validation.success ? [validation.data.quiz] : [];
      });
    },

    async listPendingQuizzes(): Promise<PendingQuizSummary[]> {
      const { data, error } = await userClient
        .from("quiz_inbox")
        .select("id,quiz_id,title,payload,source_client_id,created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => {
        const payload = row.payload as { quiz?: { questions?: unknown[] } } | null;
        return {
          id: row.id,
          quizId: row.quiz_id,
          title: row.title,
          questionCount: Array.isArray(payload?.quiz?.questions) ? payload.quiz.questions.length : 0,
          ...(row.source_client_id ? { sourceClientId: row.source_client_id } : {}),
          createdAt: row.created_at,
        };
      });
    },

    async countPendingQuizzes(): Promise<number> {
      const { count, error } = await userClient
        .from("quiz_inbox")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw new Error(error.message);
      return count ?? 0;
    },

    async insertPendingQuiz(input) {
      const { data, error } = await adminClient
        .from("quiz_inbox")
        .insert({
          user_id: input.userId,
          quiz_id: input.quizId,
          title: input.title,
          payload: input.payload,
          status: "pending",
          source_client_id: input.sourceClientId ?? null,
        })
        .select("id,created_at")
        .single();
      if (error) throw new Error(error.message);
      return { id: data.id, createdAt: data.created_at };
    },
  };
}

const protectedHandler = pipeline(
  [withOAuthProtectedResource(), withSupabase({ auth: "user" })],
  async (request, { supabase }) => {
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const claims = claimsData?.claims as Record<string, unknown> | undefined;
    const userId = typeof claims?.sub === "string" ? claims.sub : undefined;
    if (claimsError || !userId) return new Response("Unauthorized", { status: 401 });

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!serviceRoleKey || !supabaseUrl) return new Response("Server configuration error", { status: 500 });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const repository = createRepository(supabase as SupabaseClient, adminClient);
    const sourceClientId = typeof claims.client_id === "string"
      ? claims.client_id
      : typeof claims.azp === "string" ? claims.azp : undefined;
    const username = claims.user_metadata && typeof claims.user_metadata === "object"
      && "username" in claims.user_metadata && typeof claims.user_metadata.username === "string"
      ? claims.user_metadata.username
      : undefined;

    const handler = createMcpHandler(() => {
      const server = new McpServer({ name: "quiz-platform", version: "1.0.0" });

      server.registerTool("get_profile", {
        title: "Get quiz profile",
        description: "Return the stable identity of the signed-in Quiz Platform user.",
        inputSchema: z.object({}),
        outputSchema: z.object({ id: z.string(), displayName: z.string().optional() }),
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
        securitySchemes,
        _meta: { "openai/profile": true },
      }, async () => {
        const profile = { id: userId, ...(username ? { displayName: username } : {}) };
        return textResult(profile, "Signed-in Quiz Platform profile.");
      });

      server.registerTool("get_quiz_instructions", {
        title: "Get quiz creation instructions",
        description: "Return the current schemaVersion 1 quiz contract and safe publishing workflow.",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
        securitySchemes,
      }, async () => textResult({
        schemaVersion: 1,
        contract: QUIZ_CONTRACT,
        instructions: QUIZ_CREATION_INSTRUCTIONS,
        supportedQuestionTypes: ["singleChoice", "multipleChoice", "shortText"],
        supportedIllustrations: ["flow", "comparison", "distribution"],
        maximumPayloadBytes: MAX_QUIZ_PAYLOAD_BYTES,
        workflow: ["create", "validate_quiz", "publish_quiz", "user reviews AI Inbox"],
      }, "Use this contract to create a quiz, then validate it before publishing."));

      server.registerTool("validate_quiz", {
        title: "Validate quiz",
        description: "Validate a complete quiz payload without storing it.",
        inputSchema: z.object({ payload: z.unknown() }),
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
        securitySchemes,
      }, async ({ payload }) => {
        const result = validateMcpQuiz(payload);
        if (!result.success) return textResult({ valid: false, errors: result.errors }, "The quiz is invalid.");
        return textResult({ valid: true, quiz: summarizeQuiz(result.data.quiz), errors: [] }, "The quiz is valid and ready to publish.");
      });

      server.registerTool("list_quizzes", {
        title: "List quiz metadata",
        description: "List only IDs, titles, descriptions, and question counts for the signed-in user's synchronized quizzes.",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
        securitySchemes,
      }, async () => {
        const quizzes = (await repository.listQuizzes()).map(summarizeQuiz);
        return textResult({ quizzes }, `Found ${quizzes.length} synchronized quizzes.`);
      });

      server.registerTool("list_pending_quizzes", {
        title: "List pending quiz drafts",
        description: "List metadata for AI-created drafts waiting in the signed-in user's review inbox.",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
        securitySchemes,
      }, async () => {
        const pendingQuizzes = await repository.listPendingQuizzes();
        return textResult({ pendingQuizzes }, `Found ${pendingQuizzes.length} drafts waiting for review.`);
      });

      server.registerTool("publish_quiz", {
        title: "Publish quiz for review",
        description: "Validate a complete quiz and add it to the user's AI Inbox. This never overwrites synchronized quizzes.",
        inputSchema: z.object({ payload: z.unknown() }),
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
        securitySchemes,
      }, async ({ payload }) => {
        const published = await publishQuizDraft(repository, userId, sourceClientId, payload);
        return textResult({
          ...published,
          reviewUrl: APP_URL,
          status: "pending",
        }, published.existingQuiz
          ? "Draft published. A quiz with this ID already exists, so the user must confirm replacement in the AI Inbox."
          : "Draft published. Ask the user to open the AI Inbox and accept it.");
      });

      return server;
    });

    return handler.fetch(request);
  },
);

Deno.serve((request) => {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_QUIZ_PAYLOAD_BYTES) {
    return new Response("Request body is too large", { status: 413 });
  }
  return protectedHandler(request);
});
