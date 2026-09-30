# Quiz JSON format

Each file contains exactly one quiz and uses `schemaVersion: 1`. See [`public/examples/basic-math.json`](../public/examples/basic-math.json) for a general example and [`public/examples/reading-practice.json`](../public/examples/reading-practice.json) for a passage shared by multiple questions.

The same contract and validator apply to every creation path:

| Path | How the quiz enters the app |
|---|---|
| File import | Select a `.json` file on the import screen. |
| Pasted JSON | Paste the JSON-only response from any AI chatbot. |
| Local-browser WebMCP | A compatible browser tool imports directly into that device after duplicate confirmation. |
| Remote OAuth MCP | A connected client publishes a pending AI Inbox draft; the user must accept it. |

No path has a more permissive schema. Remote MCP publishing never writes directly to the synchronized quiz library.

## Shared fields

- `quiz.id`, every `question.id`, and every option `id` must be non-empty and unique within their collection.
- `quiz.title` and each question `prompt` are required.
- `quiz.description` and each question `explanation` are optional.
- `quiz.learningMaterial` is optional and belongs inside the `quiz` object. When present, the quiz card includes a **Study guide** button.
- `quiz.passages` is optional and belongs inside `quiz`. A question can refer to one passage with its optional `passageId`.
- Unknown fields are rejected so that AI-generated mistakes are visible during import.

## Optional learning material

Learning material is stored inside the same JSON file as its quiz, so importing, offline storage, deletion, and cloud synchronization also handle its guide. The reusable AI prompt recommends three to six sections, while the schema accepts one to thirty sections.

```json
{
  "learningMaterial": {
    "title": "Study guide title",
    "summary": "Optional overview",
    "sections": [
      {
        "id": "unique-section-id",
        "title": "Section title",
        "paragraphs": ["One or more explanatory paragraphs."],
        "keyPoints": ["Optional practical point"],
        "illustration": {
          "type": "flow",
          "title": "Optional diagram title",
          "items": [
            { "label": "Step one", "detail": "Optional detail" },
            { "label": "Step two", "detail": "Optional detail" }
          ]
        }
      }
    ]
  }
}
```

Section IDs must be unique within the guide. A guide may contain up to thirty sections. Each section requires one to eight paragraphs and may include one to ten key points.

### Illustration types

- `flow`: two to eight ordered `items`. Each item requires `label` and may include `detail`.
- `comparison`: two to six `items`. Each item requires `label` and `detail`; set `highlight: true` on the preferred or most important item.
- `distribution`: two to six `groups`. Each group has a `label`, optional `note`, and one to six `segments`. Every segment requires a `label` and a positive integer `count`.

Illustrations are rendered by the app instead of loading external images. This keeps imported guides safe, responsive, and available offline.

The downloadable Basic Mathematics example demonstrates all three illustration structures. Their minimal shapes are:

```json
{
  "flow": {
    "type": "flow",
    "items": [{ "label": "Start" }, { "label": "Finish", "detail": "Expected result" }]
  },
  "comparison": {
    "type": "comparison",
    "items": [
      { "label": "Option A", "detail": "First use case", "highlight": true },
      { "label": "Option B", "detail": "Second use case" }
    ]
  },
  "distribution": {
    "type": "distribution",
    "groups": [
      { "label": "Group A", "segments": [{ "label": "Yes", "count": 8 }, { "label": "No", "count": 2 }] },
      { "label": "Group B", "segments": [{ "label": "Yes", "count": 5 }, { "label": "No", "count": 5 }] }
    ]
  }
}
```

These are separate shape examples. A real section uses one illustration object, not the wrapper object shown above.

## Shared reading passages

Use `passages` when several questions refer to the same source text, such as an IELTS-style reading exercise. Define the text once inside `quiz`, then link any question type to it by ID. The learner can open the passage beside each linked question and again during answer review. The passage remains available after import, offline, and through normal quiz synchronization. It is not the same as `learningMaterial`: passages are source texts to answer from; learning material is a separate teaching guide.

```json
{
  "schemaVersion": 1,
  "quiz": {
    "id": "reading-example",
    "title": "Reading example",
    "passages": [
      {
        "id": "article-1",
        "title": "A short article",
        "paragraphs": ["The town opened a new library in May.", "Visitors can borrow books and use computers."]
      }
    ],
    "questions": [
      {
        "id": "q1",
        "type": "singleChoice",
        "passageId": "article-1",
        "prompt": "When did the library open?",
        "options": [{ "id": "a", "text": "May" }, { "id": "b", "text": "June" }],
        "correctOptionId": "a"
      },
      {
        "id": "q2",
        "type": "shortText",
        "passageId": "article-1",
        "prompt": "Name one thing visitors can borrow.",
        "acceptedAnswers": ["books", "a book"]
      }
    ]
  }
}
```

Each passage requires a unique non-empty `id`, a non-empty `title`, and one to thirty non-empty `paragraphs`. A quiz can have one to twenty passages. If a question has `passageId`, that ID must exist in `quiz.passages`; otherwise import fails with a field-level error. Unlinked questions and quizzes without passages remain valid. Paragraphs are displayed as plain text, so HTML and external images are not supported.

## Question types

- `singleChoice`: at least two `options` and one `correctOptionId` that references an option.
- `multipleChoice`: at least two `options` and one or more unique `correctOptionIds`. The learner must select the exact correct set.
- `shortText`: one or more `acceptedAnswers`. Matching ignores case, surrounding whitespace, repeated internal whitespace, and Unicode presentation differences, but preserves accents.

The importer validates the whole file before saving it. Re-importing the same quiz ID asks before replacing the quiz and clearing its saved progress.
