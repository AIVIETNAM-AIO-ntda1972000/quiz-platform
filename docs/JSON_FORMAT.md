# Quiz JSON format

Each file contains exactly one quiz. Use `schemaVersion: 1` for the original plain-text contract or `schemaVersion: 2` for Markdown passages. See [`public/examples/basic-math.json`](../public/examples/basic-math.json) for a general example, [`public/examples/reading-practice.json`](../public/examples/reading-practice.json) for a plain shared passage, and [`public/examples/rich-reading.json`](../public/examples/rich-reading.json) for a Markdown passage.

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

### Markdown passages (schema version 2)

Version 2 keeps the same quiz and question fields. Each passage may use either the plain `paragraphs` shape above or this Markdown shape:

```json
{
  "id": "network-guide",
  "title": "How a network learns",
  "format": "markdown",
  "content": "# Training\n\nA model updates its **weights**.\n\n$L = (y - \\hat y)^2$",
  "assets": [
    { "id": "figure-1", "mimeType": "image/png", "base64": "BASE64_OF_A_REAL_SMALL_PNG" }
  ]
}
```

The code block above illustrates field placement; its placeholder image is not importable. Refer to an asset in Markdown with `![Descriptive alt text](quiz-asset:figure-1)`. Images must be actual PNG, JPEG, or WebP bytes encoded as base64. Remote images, SVG, raw HTML, JavaScript URLs, reference-style links/images, MDX, and executable code are rejected. Ordinary links must use HTTPS or a heading anchor. Asset IDs must be unique within their passage.

Markdown supports headings, lists, tables, fenced code, `$inline math$`, `$$display math$$`, and fenced `mermaid` blocks for flowchart, sequence, class, state, or ER diagrams. Invalid diagrams show a readable source fallback. Full LaTeX documents and other diagram languages are not supported. Markdown content is limited to 100 KiB per passage; images to 256 KiB each and 512 KiB total per quiz; and the complete version 2 JSON file to 1 MiB. Keep diagrams under 10 KiB. The app packages its rendering code and KaTeX fonts for offline use.

To create rich material with AI, use [`public/AI_RICH_PROMPT.md`](../public/AI_RICH_PROMPT.md). Ask the chatbot for Mermaid rather than invented image base64. If a real image is needed, encode a local PNG/JPEG/WebP file and place its data in `assets`; the quiz and images then import and synchronize together. Because assets use browser storage, importing many image-heavy quizzes can reach a device's quota; a failed import keeps the previous quiz and progress.

On Windows PowerShell, `[Convert]::ToBase64String([IO.File]::ReadAllBytes('diagram.png'))` produces the `base64` value for a local PNG file. Use the corresponding MIME type and a unique asset ID. The app will reject a file whose actual bytes do not match the declared type.

Reading position is kept only on the current device and is cleared if the quiz is replaced or deleted. On results, correct answers and explanations are initially hidden behind **Show answers**; score, your response, and correctness remain visible.

## Question types

- `singleChoice`: at least two `options` and one `correctOptionId` that references an option.
- `multipleChoice`: at least two `options` and one or more unique `correctOptionIds`. The learner must select the exact correct set.
- `shortText`: one or more `acceptedAnswers`. Matching ignores case, surrounding whitespace, repeated internal whitespace, and Unicode presentation differences, but preserves accents.

The importer validates the whole file before saving it. Re-importing the same quiz ID asks before replacing the quiz and clearing its saved progress.
