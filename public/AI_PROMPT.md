# AI prompt for Quiz Platform

Create a quiz and visual study guide about **[TOPIC]** for a learner at **[LEVEL]**.

Return only valid JSON. Do not use Markdown fences or add commentary. Follow schema version 1 from the example below. Use unique IDs. Include a mix of `singleChoice`, `multipleChoice`, and `shortText` questions. Every choice answer must reference existing option IDs. For short-text questions, include reasonable alternative accepted answers. Explanations should be short and educational.

Add an optional `learningMaterial` object to the quiz. It should contain three to six focused sections explaining concepts, reasons, steps, and practical pitfalls before the learner attempts the questions. Each section may have one structured offline illustration:

- `flow`: two to eight ordered items with `label` and optional `detail`.
- `comparison`: two to six items with `label`, `detail`, and optional `highlight`.
- `distribution`: two to six groups containing labeled positive integer counts.

Use illustrations only when they improve understanding. Keep all content self-contained and do not include external URLs, HTML, Markdown, or image data.

```json
{
  "schemaVersion": 1,
  "quiz": {
    "id": "topic-level",
    "title": "Quiz title",
    "description": "One-sentence description",
    "learningMaterial": {
      "title": "Study guide title",
      "summary": "What the learner will understand",
      "sections": [
        {
          "id": "core-process",
          "title": "Core process",
          "paragraphs": ["Explain the concept and why it matters."],
          "keyPoints": ["A practical point", "A common pitfall"],
          "illustration": {
            "type": "flow",
            "title": "Process overview",
            "items": [
              { "label": "First step", "detail": "Reason for this step" },
              { "label": "Second step", "detail": "Expected result" }
            ]
          }
        }
      ]
    },
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
