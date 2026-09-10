import type { QuizFile } from "./models";

export const exampleQuizFile: QuizFile = {
  schemaVersion: 1,
  quiz: {
    id: "basic-math",
    title: "Basic Mathematics",
    description: "Three quick questions to try every answer type.",
    learningMaterial: {
      title: "A Quick Guide to the Quiz Concepts",
      summary: "Review addition, even numbers, and capital cities before trying the example quiz.",
      sections: [
        {
          id: "addition",
          title: "Addition combines quantities",
          paragraphs: ["Addition finds the total after quantities are combined. For example, two objects plus two more objects produce four objects."],
          illustration: {
            type: "flow",
            title: "A simple addition process",
            items: [
              { label: "Start", detail: "2 objects" },
              { label: "Add", detail: "2 more objects" },
              { label: "Total", detail: "4 objects" }
            ]
          }
        },
        {
          id: "even-numbers",
          title: "Even numbers divide into equal pairs",
          paragraphs: ["An even integer is divisible by two with no remainder. Two and four are even, while three is odd."],
          illustration: {
            type: "comparison",
            title: "Even and odd",
            items: [
              { label: "Even", detail: "2 and 4 divide evenly by two.", highlight: true },
              { label: "Odd", detail: "3 leaves a remainder after division by two." }
            ]
          }
        },
        {
          id: "capital-cities",
          title: "A capital city is a country's government center",
          paragraphs: ["A capital city is the official center of national government. It may also be the largest city, but size alone does not determine capital status."],
          keyPoints: ["Paris is the capital of France.", "Use official status rather than city size when answering."],
          illustration: {
            type: "distribution",
            title: "Cities in two small example sets",
            groups: [
              {
                label: "France",
                note: "Paris is the capital",
                segments: [
                  { label: "Capital", count: 1 },
                  { label: "Other example cities", count: 2 }
                ]
              },
              {
                label: "Germany",
                note: "Berlin is the capital",
                segments: [
                  { label: "Capital", count: 1 },
                  { label: "Other example cities", count: 2 }
                ]
              }
            ]
          }
        }
      ]
    },
    questions: [
      {
        id: "q1",
        type: "singleChoice",
        prompt: "What is 2 + 2?",
        options: [{ id: "a", text: "3" }, { id: "b", text: "4" }],
        correctOptionId: "b",
        explanation: "Two plus two equals four."
      },
      {
        id: "q2",
        type: "multipleChoice",
        prompt: "Select the even numbers.",
        options: [{ id: "a", text: "2" }, { id: "b", text: "3" }, { id: "c", text: "4" }],
        correctOptionIds: ["a", "c"],
        explanation: "Even numbers divide evenly by two."
      },
      {
        id: "q3",
        type: "shortText",
        prompt: "What is the capital of France?",
        acceptedAnswers: ["Paris"],
        explanation: "Paris is the capital and largest city of France."
      }
    ]
  }
};
