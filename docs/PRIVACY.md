# Privacy Notice

Quiz Platform stores quizzes, progress, and results locally by default. When cloud synchronization is configured and a user signs in, the app stores that user's synchronized quiz snapshot and AI Inbox submissions in the configured Supabase project.

The Quiz Platform MCP server uses Supabase OAuth to identify the signed-in user. It can read quiz metadata and pending-draft metadata for that user. It does not expose quiz answers through list tools. A published AI-generated quiz is stored as a pending inbox item and is not added to the quiz library until the user accepts it.

The service records the OAuth client identifier with each submitted draft for source visibility. It does not require or store an AI provider API key. Theme preferences remain local to each installation.

Users can reject or delete inbox submissions, revoke connected AI clients from the account screen, delete local quizzes, and remove synchronized data through the configured Supabase project administrator.

This repository is self-hosted software. The person or organization operating a deployment is responsible for its data-retention policy, support contact, and any additional privacy disclosures required for its users.
