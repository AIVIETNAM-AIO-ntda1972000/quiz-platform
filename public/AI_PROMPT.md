# AI prompt for Quiz Platform

Create a quiz about **[TOPIC]** for a learner at **[LEVEL]**.

Return only valid JSON. Do not use Markdown fences or add commentary. Follow schema version 1 from the example below. Use unique IDs. Include a mix of `singleChoice`, `multipleChoice`, and `shortText` questions. Every choice answer must reference existing option IDs. For short-text questions, include reasonable alternative accepted answers. Explanations should be short and educational.

```json
{
  "schemaVersion": 1,
  "quiz": {
    "id": "topic-level",
    "title": "Quiz title",
    "description": "One-sentence description",
    "questions": [
      {
        "id": "q1",
        "type": "singleChoice",
        "prompt": "Question text",
        "options": [{ "id": "a", "text": "Answer A" }, { "id": "b", "text": "Answer B" }],
        "correctOptionId": "a",
        "explanation": "Why this answer is correct."
      }
    ]
  }
}
```
