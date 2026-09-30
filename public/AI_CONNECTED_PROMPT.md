# Connected AI prompt for Quiz Platform

Create a quiz about **[TOPIC]** for a learner at **[LEVEL]** and submit it to my Quiz Platform AI Inbox.

Follow this workflow exactly:

1. Call `get_quiz_instructions` before creating the quiz.
2. Create one complete quiz payload that follows those instructions. Use `schemaVersion: 1` for plain passages or `schemaVersion: 2` for Markdown passages. Add useful `learningMaterial` for concepts, reasons, practical steps, and common pitfalls. For reading practice, write each passage once in `quiz.passages` and link several questions to it with `passageId`. In Markdown, use Mermaid and math syntax for diagrams and equations; do not invent image data or external image links.
3. Call `validate_quiz` with the complete payload.
4. If validation fails, correct every reported field error and validate again. Do not publish invalid data.
5. After validation succeeds, call `publish_quiz` exactly once with the complete validated payload.
6. Tell me the quiz ID, question count, whether that ID already exists, and that I must open Quiz Platform's **AI Inbox** to preview and accept the draft.

Never claim that the quiz is already in my library. Publishing creates only a pending draft and cannot approve replacement of an existing quiz.
