# Quiz Platform

A small, offline-first quiz app for the web and Android. Import AI-generated JSON quizzes, answer them one question at a time, leave and resume, then review your score and explanations. All quiz data and progress stay on the current device.

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

## Web app

Pushes to `main` deploy the PWA through the **Deploy web app** GitHub Actions workflow. After opening it once, the installed app shell works offline. Quiz data and progress remain local to each browser or installed app.

## Android app

The **Build Android APK** workflow builds the same interface as a debug APK. Download `quiz-platform-debug-apk` from the workflow run's **Artifacts** section and install it on an Android device that allows debug APK installation.

For a local Android build, install a current Android SDK and JDK 21, then run:

```bash
npm run android:build
```

The generated APK is intended for testing. It is not signed or configured for Google Play distribution.

## Current limits

There are no accounts, cloud sync, server database, in-app AI calls, media questions, or collaborative authoring in version 1.
