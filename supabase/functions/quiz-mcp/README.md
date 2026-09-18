# Quiz MCP Edge Function

This function exposes the Quiz Platform through authenticated Streamable HTTP MCP. Every tool requires a Supabase OAuth user token.

The function uses the caller-scoped Supabase client for reads so Row Level Security applies. It uses `SUPABASE_SERVICE_ROLE_KEY` only inside the Edge Function to insert a payload that has passed the shared quiz validator into `quiz_inbox`. It never writes to `quiz_platform_data`.

## Runtime configuration

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions. Set the optional app URL when deploying:

```text
QUIZ_PLATFORM_APP_URL=https://aivietnam-aio-ntda1972000.github.io/quiz-platform/
```

The public endpoint is:

```text
https://<project-ref>.supabase.co/functions/v1/quiz-mcp
```

Keep `verify_jwt = false` in `supabase/config.toml`. The function's OAuth middleware must receive unauthenticated discovery requests before it verifies user access tokens.

## Safety boundaries

- Maximum serialized quiz payload: 1 MiB.
- Maximum pending drafts per user: 20.
- List tools return metadata only and never expose answers.
- `publish_quiz` creates a pending inbox record; the user must accept it in the app.
- The service-role key must never be copied into Vite environment variables or browser code.
