# Quiz JSON format

Each file contains exactly one quiz and uses `schemaVersion: 1`. See [`public/examples/basic-math.json`](../public/examples/basic-math.json) for a complete example.

## Shared fields

- `quiz.id`, every `question.id`, and every option `id` must be non-empty and unique within their collection.
- `quiz.title` and each question `prompt` are required.
- `quiz.description` and each question `explanation` are optional.
- Unknown fields are rejected so that AI-generated mistakes are visible during import.

## Question types

- `singleChoice`: at least two `options` and one `correctOptionId` that references an option.
- `multipleChoice`: at least two `options` and one or more unique `correctOptionIds`. The learner must select the exact correct set.
- `shortText`: one or more `acceptedAnswers`. Matching ignores case, surrounding whitespace, repeated internal whitespace, and Unicode presentation differences, but preserves accents.

The importer validates the whole file before saving it. Re-importing the same quiz ID asks before replacing the quiz and clearing its saved progress.
