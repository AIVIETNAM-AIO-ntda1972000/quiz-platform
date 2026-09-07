export type ChoiceOption = { id: string; text: string };

type BaseQuestion = { id: string; prompt: string; explanation?: string };

export type SingleChoiceQuestion = BaseQuestion & {
  type: "singleChoice";
  options: ChoiceOption[];
  correctOptionId: string;
};

export type MultipleChoiceQuestion = BaseQuestion & {
  type: "multipleChoice";
  options: ChoiceOption[];
  correctOptionIds: string[];
};

export type ShortTextQuestion = BaseQuestion & {
  type: "shortText";
  acceptedAnswers: string[];
};

export type Question = SingleChoiceQuestion | MultipleChoiceQuestion | ShortTextQuestion;
export type Quiz = { id: string; title: string; description?: string; questions: Question[] };
export type QuizFile = { schemaVersion: 1; quiz: Quiz };
export type Answer = string | string[];
export type Attempt = {
  quizId: string;
  answers: Record<string, Answer>;
  currentIndex: number;
  updatedAt: string;
};
export type QuizResult = {
  quizId: string;
  answers: Record<string, Answer>;
  correct: number;
  total: number;
  completedAt: string;
};
