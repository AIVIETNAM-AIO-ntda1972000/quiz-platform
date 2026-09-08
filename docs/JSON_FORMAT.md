# Quiz JSON format

Each file contains exactly one quiz and uses `schemaVersion: 1`. See [`public/examples/basic-math.json`](../public/examples/basic-math.json) for a complete example.

## Shared fields

- `quiz.id`, every `question.id`, and every option `id` must be non-empty and unique within their collection.
- `quiz.title` and each question `prompt` are required.
- `quiz.description` and each question `explanation` are optional.
- `quiz.learningMaterial` is optional. When present, the quiz card includes a **Study guide** button.
- Unknown fields are rejected so that AI-generated mistakes are visible during import.

## Optional learning material

Learning material is stored inside the same JSON file as its quiz, so importing, deleting, and cloud-syncing the quiz also handles its guide.

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

## Question types

- `singleChoice`: at least two `options` and one `correctOptionId` that references an option.
- `multipleChoice`: at least two `options` and one or more unique `correctOptionIds`. The learner must select the exact correct set.
- `shortText`: one or more `acceptedAnswers`. Matching ignores case, surrounding whitespace, repeated internal whitespace, and Unicode presentation differences, but preserves accents.

The importer validates the whole file before saving it. Re-importing the same quiz ID asks before replacing the quiz and clearing its saved progress.
