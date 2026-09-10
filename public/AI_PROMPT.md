# AI prompt for Quiz Platform

Create a quiz about **[TOPIC]** for a learner at **[LEVEL]**.

Return one valid JSON object only. Do not use Markdown fences, comments, explanations outside the JSON, external URLs, HTML, image data, or properties that are not shown in schema version 1.

Requirements:

- Put the optional `learningMaterial` object inside `quiz`. It is recommended for teaching-oriented quizzes and is imported, stored offline, deleted, and cloud-synchronized together with the quiz.
- Create three to six focused study-guide sections covering concepts, reasons, practical steps, and common pitfalls. Each section needs a unique ID, one to eight paragraphs, and may contain one to ten key points and one structured illustration.
- Use `flow` for two to eight ordered steps, `comparison` for two to six alternatives, and `distribution` for two to six groups of labeled counts. Each distribution group needs one to six segments, and every `count` must be a positive integer.
- Include an appropriate mix of `singleChoice`, `multipleChoice`, and `shortText` questions. Question IDs must be unique. Option IDs must be unique within each question.
- Every correct choice ID must reference an option in the same question. Include reasonable alternative accepted answers for short text.
- Keep explanations short and educational. Use illustrations only when they materially improve understanding.

Use this complete example as the structural template:

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
        },
        {
          "id": "compare-options",
          "title": "Compare the main options",
          "paragraphs": ["Explain when each option is useful."],
          "illustration": {
            "type": "comparison",
            "title": "Option comparison",
            "items": [
              { "label": "Option A", "detail": "Use when the first condition applies.", "highlight": true },
              { "label": "Option B", "detail": "Use when the second condition applies." }
            ]
          }
        },
        {
          "id": "read-distribution",
          "title": "Read grouped counts",
          "paragraphs": ["Explain what the counts show and what they do not prove."],
          "illustration": {
            "type": "distribution",
            "title": "Two example groups",
            "groups": [
              {
                "label": "Group A",
                "note": "Mostly category one",
                "segments": [
                  { "label": "Category one", "count": 8 },
                  { "label": "Category two", "count": 2 }
                ]
              },
              {
                "label": "Group B",
                "note": "Evenly mixed",
                "segments": [
                  { "label": "Category one", "count": 5 },
                  { "label": "Category two", "count": 5 }
                ]
              }
            ]
          }
        }
      ]
    },
    "questions": [
      {
        "id": "q1",
        "type": "singleChoice",
        "prompt": "Choose one answer.",
        "options": [{ "id": "a", "text": "Answer A" }, { "id": "b", "text": "Answer B" }],
        "correctOptionId": "a",
        "explanation": "Why answer A is correct."
      },
      {
        "id": "q2",
        "type": "multipleChoice",
        "prompt": "Choose every correct answer.",
        "options": [{ "id": "a", "text": "Answer A" }, { "id": "b", "text": "Answer B" }, { "id": "c", "text": "Answer C" }],
        "correctOptionIds": ["a", "c"],
        "explanation": "Why A and C form the exact correct set."
      },
      {
        "id": "q3",
        "type": "shortText",
        "prompt": "Type the short answer.",
        "acceptedAnswers": ["Expected answer", "Accepted alternative"],
        "explanation": "Why this answer is correct."
      }
    ]
  }
}
```
