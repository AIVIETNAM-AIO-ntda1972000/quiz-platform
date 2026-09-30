# AI prompt for rich reading quizzes

Create a quiz about **[TOPIC]** for a learner at **[LEVEL]**. Return one valid JSON object only, without Markdown fences or commentary outside the JSON.

Use `schemaVersion: 2`. Put one or more reading or reference documents in `quiz.passages`. A Markdown passage has `id`, `title`, `format: "markdown"`, and `content`. For a teaching-oriented quiz, add `"learningMaterial": { "passageId": "lesson" }` inside `quiz` so the learner can open that passage from the quiz library. Link multiple questions to one document by repeating its `passageId`; do not repeat the document in question prompts. Include `singleChoice`, `multipleChoice`, and `shortText` questions with correct references and short explanations.

Inside `content`, use ordinary Markdown headings, lists, tables, links, and fenced code. Use `$...$` and `$$...$$` for mathematical expressions, and fenced `mermaid` blocks for flowchart, sequence, class, state, or ER diagrams. Use Mermaid or text for AI-generated diagrams. Do not invent image base64 data. Images require real PNG, JPEG, or WebP files embedded in the JSON as passage assets and referenced as `![alt text](quiz-asset:image-id)`; do not use external image URLs. Do not include raw HTML, scripts, MDX, executable code, unsafe links, or unsupported diagram languages.

Keep each Markdown passage under 100 KiB, each image under 256 KiB, all images under 512 KiB, and the entire JSON file under 1 MiB. Follow the repository's complete `public/examples/rich-reading.json` example and `docs/JSON_FORMAT.md` contract. Escape newlines and backslashes correctly inside JSON strings.

Use this JSON shape, replacing the placeholder text with real teaching content:

```json
{
  "schemaVersion": 2,
  "quiz": {
    "id": "topic-level-reading",
    "title": "Quiz title",
    "learningMaterial": { "passageId": "lesson" },
    "passages": [
      { "id": "lesson", "title": "Lesson title", "format": "markdown", "content": "# Heading\n\nA useful explanation." }
    ],
    "questions": [
      {
        "id": "q1", "type": "singleChoice", "passageId": "lesson", "prompt": "Choose one answer.",
        "options": [{ "id": "a", "text": "First option" }, { "id": "b", "text": "Second option" }],
        "correctOptionId": "a", "explanation": "Why the first option is correct."
      },
      {
        "id": "q2", "type": "multipleChoice", "passageId": "lesson", "prompt": "Choose all correct answers.",
        "options": [{ "id": "a", "text": "First" }, { "id": "b", "text": "Second" }, { "id": "c", "text": "Third" }],
        "correctOptionIds": ["a", "c"], "explanation": "Why both choices are needed."
      },
      {
        "id": "q3", "type": "shortText", "passageId": "lesson", "prompt": "Type a short answer.",
        "acceptedAnswers": ["Expected answer", "Accepted alternative"], "explanation": "Why this answer is correct."
      }
    ]
  }
}
```

The chatbot's response must be the JSON object itself, not this fenced example or any extra prose.
