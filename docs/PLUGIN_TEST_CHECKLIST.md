# Plugin Test and Release Checklist

## Configuration

- [ ] Replace `your-project-ref` in both plugin MCP configuration files.
- [ ] Apply `supabase/schema.sql` to the production project.
- [ ] Enable the Supabase OAuth server, dynamic client registration, and an asymmetric JWT signing key.
- [ ] Configure the production consent URL as `/quiz-platform/oauth-consent.html`.
- [ ] Deploy the `quiz-mcp` Edge Function and set `QUIZ_PLATFORM_APP_URL`.
- [ ] Confirm no service-role key is present in browser assets, plugin files, or repository secrets visible to clients.

## Protocol and authentication

- [ ] Confirm an unauthenticated MCP request returns `401` with OAuth protected-resource discovery.
- [ ] Complete approved, denied, expired, and revoked OAuth flows.
- [ ] Confirm `get_profile` returns the stable signed-in user ID.
- [ ] Run every tool through MCP Inspector.
- [ ] Confirm one user's tools cannot read another user's quizzes or pending drafts.

## ChatGPT developer mode

- [ ] Add the public HTTPS MCP endpoint in ChatGPT developer mode.
- [ ] Complete one connection on ChatGPT web.
- [ ] Complete one connection and publish flow on a supported mobile ChatGPT surface.
- [ ] Run every case in `plugins/quiz-platform/evals/prompts.json`.
- [ ] Confirm invalid data is never published and replacement remains an app-side decision.
- [ ] Confirm tool responses link the user back to the AI Inbox.

## Submission

- [ ] Review tool names, descriptions, annotations, OAuth scopes, privacy notice, and support URL.
- [ ] Capture required submission assets only after production behavior is verified.
- [ ] Verify current account and host eligibility; do not promise availability on every Free plan.
- [ ] Submit to the public directory manually as the repository owner.
