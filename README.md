# Quiz Platform

A small, offline-first quiz app for the web and Android. Import AI-generated JSON quizzes, search or delete them, answer one question at a time, leave and resume, then review your score and explanations. Data stays on the current device by default, with optional Supabase account sync.

## Run locally

Requirements: Node.js 22 or later.

```bash
npm install
npm run dev
```

Run unit and component tests with `npm test`, create a production build with `npm run build`, and run the mobile browser flow with `npm run test:e2e` after installing Playwright Chromium (`npx playwright install chromium`).

## Create and import quizzes

1. Download [`public/AI_PROMPT.md`](public/AI_PROMPT.md) and replace `[TOPIC]` and `[LEVEL]`.
2. Give the prompt to an AI assistant and save its JSON response as a `.json` file.
3. Open Quiz Platform, choose **Import quiz**, and select the file.

The importer validates the complete file before saving it. The exact versioned contract is documented in [`docs/JSON_FORMAT.md`](docs/JSON_FORMAT.md), with a ready-to-import example at [`public/examples/basic-math.json`](public/examples/basic-math.json).

Additional ready-to-import quiz files are kept in [`sample-quizzes`](sample-quizzes), including a Vietnamese introduction to AI.

## Web app

Pushes to `main` deploy the PWA through the **Deploy web app** GitHub Actions workflow. After opening it once, the installed app shell works offline.

## Optional Supabase sync

Cloud sync lets the same account access quizzes and progress on the web and Android. The app continues to work locally when Supabase is not configured or the device is offline.

1. Create a Supabase project and open its SQL Editor.
2. Run [`supabase/schema.sql`](supabase/schema.sql). This creates one private data row per user and enables Row Level Security.
3. Copy `.env.example` to `.env.local`, then enter the project URL and anonymous key.
4. For GitHub Pages and APK builds, add repository Actions secrets named `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. In Supabase Authentication, enable Email authentication. For the simplest personal setup, either disable email confirmation or confirm the signup email before signing in.

The anonymous key is designed for frontend use when Row Level Security is enabled. Never add the Supabase service-role key to this repository or a frontend environment variable.

## Android app

The **Build Android APK** workflow builds the same interface as a debug APK. Download `quiz-platform-debug-apk` from the workflow run's **Artifacts** section and install it on an Android device that allows debug APK installation.

For a local Android build, install a current Android SDK and JDK 21, then run:

```bash
npm run android:build
```

The generated APK is intended for testing. It is not signed or configured for Google Play distribution.

## Current limits

There are no in-app AI calls, media questions, collaborative authoring, or administrator dashboard in version 1. Sync uses a last-change merge for each quiz and keeps deletion records so removed quizzes do not normally reappear from another device.
