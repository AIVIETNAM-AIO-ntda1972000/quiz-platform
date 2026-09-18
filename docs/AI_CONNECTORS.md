# AI Chatbot Connections

Quiz Platform supports a universal pasted-JSON workflow and an authenticated remote MCP workflow. Neither path calls a paid AI API from the app. The user's chosen chatbot creates the content.

## Architecture

```text
ChatGPT or compatible MCP client
            |
      OAuth 2.1 + PKCE
            |
Supabase Edge Function: quiz-mcp
            |
   validated quiz_inbox row
            |
      user previews and accepts
            |
local quiz library + existing cloud sync
```

The MCP server is stateless. It reads user-scoped metadata through Row Level Security and uses a server-only Supabase client only after validation to insert a pending inbox row. It never writes to `quiz_platform_data`. Accepted quizzes use the existing app storage and cloud-sync path and remain usable offline.

## Choose a connection path

| Client type | Recommended path | Current verification status |
|---|---|---|
| ChatGPT with developer-mode plugin access | Remote MCP | Implementation and eval package are ready; one production web and mobile connection still require owner verification. |
| MCP Inspector | Remote MCP protocol testing | Required release test after deployment; not runnable without the production project endpoint. |
| Any client implementing Streamable HTTP MCP OAuth | Remote MCP | Standards-compatible by design; verify the client's current stable release. |
| Qwen Code and LM Studio | Remote MCP candidate | Mark compatible only after the current stable version completes OAuth successfully. |
| Gemini, DeepSeek, or Qwen consumer chat without arbitrary MCP support | Pasted JSON | Use the JSON-only prompt and paste the response manually. |

Plugin availability depends on the user's ChatGPT account, workspace policy, client surface, and current host rollout. Do not promise that every Free-plan account can install or use the plugin.

## Universal JSON workflow

1. Open [`public/AI_PROMPT.md`](../public/AI_PROMPT.md).
2. Replace `[TOPIC]` and `[LEVEL]`, then send the prompt to any chatbot.
3. Copy only the returned JSON.
4. In Quiz Platform, open **Import quiz**, paste the response, and select **Import pasted JSON**.
5. Review any field-level errors. If the quiz ID already exists, confirm replacement in the app.

File import, pasted JSON, local-browser WebMCP, and remote MCP use the same schema described in [`JSON_FORMAT.md`](JSON_FORMAT.md).

## Supabase administrator setup

### 1. Database and frontend sync

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](../supabase/schema.sql) in the SQL Editor. It creates `quiz_platform_data`, `quiz_inbox`, indexes, Realtime publication entries, and user-isolating RLS policies.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` locally in `.env.local` and as GitHub Actions secrets.
4. Never use `SUPABASE_SERVICE_ROLE_KEY` in Vite variables, GitHub Pages output, Android resources, plugin files, or other client code.

### 2. OAuth 2.1

In the Supabase dashboard:

1. Switch the project to an asymmetric JWT signing key such as ES256 or RS256.
2. Enable the OAuth 2.1 server.
3. Enable dynamic client registration so compatible MCP clients can register.
4. Set the Site URL origin to `https://aivietnam-aio-ntda1972000.github.io`.
5. Set the authorization path to `/quiz-platform/oauth-consent.html`.
6. Keep the existing Email/password provider settings used by Quiz Platform accounts.

For local development, [`supabase/config.toml`](../supabase/config.toml) enables OAuth and uses `http://localhost:5173/oauth-consent.html`. Production dashboard settings must use the deployed GitHub Pages origin and path; do not push the localhost Site URL into production.

### 3. Deploy the MCP Edge Function

Install and authenticate a current Supabase CLI, then run:

```bash
supabase link --project-ref tqclweyjcawvwgjbhacb
supabase secrets set QUIZ_PLATFORM_APP_URL=https://aivietnam-aio-ntda1972000.github.io/quiz-platform/
supabase functions deploy quiz-mcp
```

Supabase automatically supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the deployed function. The endpoint is:

```text
https://tqclweyjcawvwgjbhacb.supabase.co/functions/v1/quiz-mcp
```

Keep `[functions.quiz-mcp] verify_jwt = false` in `supabase/config.toml`. This does not make the tools public: it allows the function's OAuth middleware to serve discovery and verify the user token itself.

### 4. Configure the plugin package

The production MCP endpoint is configured in both files:

- `plugins/quiz-platform/mcp.json`
- `plugins/quiz-platform/.mcp.json`

The root files are the portable Agent Plugins package. The `.codex-plugin` files are a compatibility fallback and the repository marketplace is at `.agents/plugins/marketplace.json`.

## Verify the MCP server

An unauthenticated initialize request should return `401` and a `WWW-Authenticate` header pointing to OAuth protected-resource metadata:

```bash
curl -i -X POST "https://tqclweyjcawvwgjbhacb.supabase.co/functions/v1/quiz-mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'
```

Then run MCP Inspector with the Streamable HTTP endpoint, complete sign-in and consent, and exercise every tool:

- `get_profile`
- `get_quiz_instructions`
- `validate_quiz`
- `list_quizzes`
- `list_pending_quizzes`
- `publish_quiz`

Confirm that list tools return metadata only, invalid quizzes are not inserted, publishing writes only `quiz_inbox`, existing IDs are reported without replacement, and the twentieth pending-draft limit blocks further submissions.

## Connect ChatGPT

After the public HTTPS endpoint passes MCP Inspector:

1. In ChatGPT, open **Settings**, then **Security and login**, and enable **Developer mode** if available for the account.
2. Open the Plugins area, add a new MCP connection, and enter the deployed `quiz-mcp` URL.
3. Complete the Quiz Platform username/password sign-in and explicitly approve consent.
4. Use [`public/AI_CONNECTED_PROMPT.md`](../public/AI_CONNECTED_PROMPT.md) or a similar request.
5. Open the web or Android app, sign in with the same Quiz Platform account, open **AI Inbox**, preview the draft, and accept or reject it.
6. Run every case in [`plugins/quiz-platform/evals/prompts.json`](../plugins/quiz-platform/evals/prompts.json).

The repository prepares the package and checklist but intentionally does not submit it to a public marketplace. The owner must complete the live checks in [`PLUGIN_TEST_CHECKLIST.md`](PLUGIN_TEST_CHECKLIST.md) and perform submission manually.

## Generic MCP clients

A client needs all of the following:

- Streamable HTTP MCP support.
- OAuth protected-resource discovery.
- OAuth 2.1 authorization code flow with PKCE.
- Dynamic client registration, unless the owner registers the client separately.
- A system browser or equivalent way to complete the hosted consent screen.

If any item is missing, use pasted JSON. Consumer branding alone does not guarantee arbitrary MCP support, and support can change between client releases.

## Security model

- Every remote tool requires a verified Supabase OAuth user token.
- RLS restricts reads to the signed-in user's rows.
- `list_quizzes` exposes ID, title, description, and question count, not questions or answers.
- `publish_quiz` validates the full payload, limits it to 1 MiB, limits each user to 20 pending drafts, and inserts only into `quiz_inbox`.
- The OAuth `client_id` is stored with the draft so users can see its source.
- Accepting or replacing a quiz always happens in the app.
- The service-role key stays in the Edge Function environment and never reaches clients.
- The plugin does not contain a model API key and does not invoke a paid AI model itself.

Dynamic registration allows new compatible clients to request access. Users should verify the requesting client and redirect URI on the consent screen before approving.

## Revoke access

Open the app's account screen and use **Connected AI clients** to inspect and revoke grants. A revoked client must complete OAuth again. Reject or delete unwanted pending drafts separately in **AI Inbox**.

## Cost and free-tier notes

Supabase documents no separate charge for its OAuth 2.1 server; OAuth users count toward the project's normal Monthly Active User quota. Database, Edge Function, bandwidth, Realtime, and hosting quotas still apply to the selected Supabase plan.

The app adds no AI API bill. The chatbot account supplies the model interaction. ChatGPT, Gemini, DeepSeek, Qwen, LM Studio, and other hosts have their own changing limits and feature policies, so confirm current availability with the chosen provider.

## Troubleshooting

### The endpoint returns 401

That is expected before authorization if the response includes `WWW-Authenticate` with protected-resource metadata. A plain 401 without discovery usually means the OAuth middleware or forwarded public URL is misconfigured.

### OAuth rejects otherwise valid tokens

Confirm the Supabase project uses an asymmetric JWT signing key. The Edge Function middleware rejects legacy symmetric HS256 project tokens.

### Consent opens a GitHub Pages 404

Use the origin `https://aivietnam-aio-ntda1972000.github.io` and the exact authorization path `/quiz-platform/oauth-consent.html`. Confirm the Pages deployment contains that file.

### The plugin cannot connect

Confirm the configured project is correct, deploy the function, and confirm the endpoint is HTTPS. Then test OAuth through MCP Inspector before debugging the chatbot host.

### A published quiz is not in the library

Publishing intentionally creates a pending draft. Sign in to the app with the same account, connect to the internet, open **AI Inbox**, and accept it.

### Publishing says the pending limit was reached

Accept, reject, or delete at least one pending draft. The server permits at most 20 pending submissions per user.

## Primary references

- [Supabase authenticated MCP deployment](https://supabase.com/docs/guides/ai-tools/byo-mcp)
- [Supabase OAuth 2.1 server](https://supabase.com/docs/guides/auth/oauth-server)
- [OpenAI plugin authentication](https://developers.openai.com/plugins/build/auth)
- [OpenAI plugin connection and testing](https://developers.openai.com/plugins/deploy/connect-chatgpt)
- [OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins)
