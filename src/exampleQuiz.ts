import type { QuizFile } from "./models";

export const exampleQuizFile: QuizFile = {
  schemaVersion: 1,
  quiz: {
    id: "basic-math",
    title: "Basic Mathematics",
    description: "Three quick questions to try every answer type.",
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
