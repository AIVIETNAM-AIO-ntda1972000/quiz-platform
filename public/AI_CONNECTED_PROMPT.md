# Connected AI prompt for Quiz Platform

Create a quiz about **[TOPIC]** for a learner at **[LEVEL]** and submit it to my Quiz Platform AI Inbox.

Follow this workflow exactly:

1. Call `get_quiz_instructions` before creating the quiz.
2. Create one complete `schemaVersion: 1` payload that follows those instructions. Add useful `learningMaterial` for concepts, reasons, practical steps, and common pitfalls.
3. Call `validate_quiz` with the complete payload.
4. If validation fails, correct every reported field error and validate again. Do not publish invalid data.
5. After validation succeeds, call `publish_quiz` exactly once with the complete validated payload.
6. Tell me the quiz ID, question count, whether that ID already exists, and that I must open Quiz Platform's **AI Inbox** to preview and accept the draft.

Never claim that the quiz is already in my library. Publishing creates only a pending draft and cannot approve replacement of an existing quiz.
