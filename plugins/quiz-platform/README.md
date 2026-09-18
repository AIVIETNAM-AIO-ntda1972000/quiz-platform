# Quiz Platform Plugin Package

This package connects ChatGPT, Codex, or another compatible plugin host to the authenticated Quiz Platform MCP server. It has no embedded custom UI. Quiz submissions always go to the user's AI Inbox for approval.

## Before testing

1. Deploy `supabase/functions/quiz-mcp` to the target Supabase project.
2. Confirm the configured production endpoint is public HTTPS and returns an OAuth discovery challenge to unauthenticated MCP requests.
3. Configure the Supabase OAuth consent URL and deploy the GitHub Pages consent page.
4. Use the cases in `evals/prompts.json` during developer-mode testing.

The compatibility manifest under `.codex-plugin/` supports local Codex authoring. The root `plugin.json` and `mcp.json` form the portable Agent Plugins package.

Marketplace submission is intentionally not automated. The repository owner must verify the production endpoint, complete the checklist in `docs/PLUGIN_TEST_CHECKLIST.md`, and submit the package manually.

Support: <https://github.com/AIVIETNAM-AIO-ntda1972000/quiz-platform/issues>

Privacy: <https://github.com/AIVIETNAM-AIO-ntda1972000/quiz-platform/blob/main/docs/PRIVACY.md>
