# Quiz Platform

A small, offline-first quiz app for the web and Android. Import AI-generated JSON quizzes with optional learning material or shared reading passages, search or delete them, answer one question at a time, leave and resume, then review your score and explanations. Data stays on the current device by default, with optional Supabase account sync.

## Run locally

Requirements: Node.js 22 or later.

```bash
npm install
npm run dev
```

Run unit and component tests with `npm test`, create a production build with `npm run build`, and run the mobile browser flow with `npm run test:e2e` after installing Playwright Chromium (`npx playwright install chromium`).

## Create and import quizzes

1. On the **Import quiz** screen, select **Copy AI prompt** (or download the same text from [`public/AI_PROMPT.txt`](public/AI_PROMPT.txt)).
2. Replace the text inside the `Topic: "..."` line with what you want to learn, and delete the `Level:` line if you do not need it.
3. Give the prompt to an AI assistant and save its JSON response as a `.json` file.
4. Open Quiz Platform, choose **Import quiz**, then select the file or paste the JSON response directly.

The importer validates the complete file before saving it. The exact versioned contract is documented in [`docs/JSON_FORMAT.md`](docs/JSON_FORMAT.md), with two ready-to-import starting points: [Basic Mathematics](public/examples/basic-math.json) for a plain quiz, and the [rich reading example](public/examples/rich-reading.json) for reading material.

A quiz may include `learningMaterial` with explanatory sections, key points, and structured `flow`, `comparison`, or `distribution` illustrations. In schema version 2, it may instead point to a rich Markdown passage with `learningMaterial: { "passageId": "lesson" }`. The **Learning material** button opens that document from the library; the same passage may also be linked to questions. Both forms are imported and synced with the quiz and remain available offline.

Question types are `singleChoice`, `multipleChoice`, `shortText`, and `matching`. A `matching` question pairs a left-hand prompt with its answer in a dropdown; it requires `schemaVersion: 3` and grades as correct only when every row is paired correctly.

For reading practice, add source text once in `quiz.passages` and give multiple questions the same `passageId`. Learners can open the passage beside each question and while reviewing answers; the app remembers the reading position on that device. The rich reading example demonstrates this with one Markdown lesson and four questions, including one of each question type. That practice example is original learning material, not an official IELTS exercise. A plain shared-passage version used by the test suite is kept in [`sample-quizzes/plain-reading-practice.json`](sample-quizzes/plain-reading-practice.json).

For AI or coding lessons, use the [rich reading example](public/examples/rich-reading.json). Schema version 2 and 3 passages render Markdown, code, KaTeX math, Mermaid diagrams, and small offline image assets. Raw HTML and remote images are not supported.

Every attempt shuffles the question order and the answer-choice order, and **Try again** draws a new order, so a learner cannot memorize positions instead of answers. The order is fixed for the attempt and survives leaving or reloading the app. Answers are still stored by option ID, and review keeps its stable authored order. After completing a quiz, correct answers and explanations stay hidden until **Show answers** is pressed; saved results can be reviewed again from the library.

Additional ready-to-import quiz files are kept in [`sample-quizzes`](sample-quizzes), including a Vietnamese introduction to AI.

### Create quizzes with an AI chatbot

Use either path:

- **Works with any chatbot:** select **Copy AI prompt** on the **Import quiz** screen, give it to Gemini, ChatGPT, DeepSeek, Qwen, or another assistant, then paste the returned JSON into **Import quiz**.
- **Connected MCP client:** after the owner deploys the Supabase MCP server, give [`public/AI_CONNECTED_PROMPT.md`](public/AI_CONNECTED_PROMPT.md) to a compatible client. The chatbot validates and publishes a pending draft; open **AI Inbox** to preview and accept it.

Connected chatbots cannot overwrite the synchronized quiz library. They can only submit validated pending drafts. Full owner setup, client compatibility, security details, and troubleshooting are in [`docs/AI_CONNECTORS.md`](docs/AI_CONNECTORS.md).

## Web app

Pushes to `main` deploy the PWA through the **Deploy web app** GitHub Actions workflow. After opening it once, the installed app shell works offline.

## Optional Supabase sync

Cloud sync lets the same account access quizzes and progress on the web and Android. The app continues to work locally when Supabase is not configured or the device is offline.

Signed-in users also receive AI-generated quiz drafts in a private review inbox. Inbox drafts require an internet connection; accepted quizzes use the existing offline storage and synchronization flow.

1. Create a Supabase project and open its SQL Editor.
2. Run [`supabase/schema.sql`](supabase/schema.sql). This creates private synchronized data and quiz-inbox rows per user and enables Row Level Security.
   If the project already exists, run only [`supabase/migrations/20260930_rich_sync.sql`](supabase/migrations/20260930_rich_sync.sql) in the SQL Editor before deploying a version 2-capable web app. It adds a sync-capability check and blocks older clients from overwriting a rich snapshot. An older Android APK must be updated after the account has synchronized rich content.
3. Copy `.env.example` to `.env.local`, then enter the project URL and publishable key.
4. For GitHub Pages and APK builds, add repository Actions secrets named `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
5. In Supabase Authentication, enable the Email provider and disable **Confirm email**. The app derives an internal, non-deliverable auth address from each username, so users only enter a username and password.

The publishable key is designed for frontend use when Row Level Security is enabled. Never add the Supabase service-role key to this repository or a frontend environment variable.

OAuth connections require an asymmetric JWT signing key and the Supabase OAuth 2.1 server. For this GitHub Pages deployment, set the production Site URL origin to `https://aivietnam-aio-ntda1972000.github.io`, set the Authorization Path to `/quiz-platform/oauth-consent.html`, and enable dynamic client registration. The repository's `supabase/config.toml` contains the matching local-development settings.

Usernames are case-insensitive, contain 3–32 ASCII letters, numbers, dots, dashes, or underscores, and cannot be recovered by email. Administrators should provide a separate account-recovery process before using this beyond a personal or classroom deployment.

## Android app

The **Build Android APK** workflow builds the same interface as a debug APK. Download `quiz-platform-debug-apk` from the workflow run's **Artifacts** section and install it on an Android device that allows debug APK installation.

For a local Android build, install a current Android SDK and JDK 21, then run:

```bash
npm run android:build
```

The generated APK is intended for testing. It is not signed or configured for Google Play distribution.

## Current limits

There are no in-app AI calls, media questions, collaborative authoring, or administrator dashboard in version 1. Sync uses a last-change merge for each quiz and keeps deletion records so removed quizzes do not normally reappear from another device.
