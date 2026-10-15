export type ChoiceOption = { id: string; text: string };

type BaseQuestion = { id: string; prompt: string; explanation?: string; passageId?: string };

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

/** One row of a matching question: a prompt on the left, its correct match on the right. */
export type MatchingPair = { id: string; prompt: string; match: string };

export type MatchingQuestion = BaseQuestion & {
  type: "matching";
  pairs: MatchingPair[];
};

export type Question = SingleChoiceQuestion | MultipleChoiceQuestion | ShortTextQuestion | MatchingQuestion;

export function hasChoiceOptions(question: Question): question is SingleChoiceQuestion | MultipleChoiceQuestion {
  return question.type === "singleChoice" || question.type === "multipleChoice";
}

export type LearningIllustration =
  | {
      type: "flow";
      title?: string;
      items: Array<{ label: string; detail?: string }>;
    }
  | {
      type: "comparison";
      title?: string;
      items: Array<{ label: string; detail: string; highlight?: boolean }>;
    }
  | {
      type: "distribution";
      title?: string;
      groups: Array<{
        label: string;
        note?: string;
        segments: Array<{ label: string; count: number }>;
      }>;
    };

export type LearningSection = {
  id: string;
  title: string;
  paragraphs: string[];
  keyPoints?: string[];
  illustration?: LearningIllustration;
};

export type LearningMaterial = {
  title: string;
  summary?: string;
  sections: LearningSection[];
};

export type LearningMaterialReference = { passageId: string };
export type QuizLearningMaterial = LearningMaterial | LearningMaterialReference;

export function isLearningMaterialReference(material: QuizLearningMaterial): material is LearningMaterialReference {
  return "passageId" in material;
}

export type PlainReadingPassage = {
  id: string;
  title: string;
  paragraphs: string[];
};

export type PassageImage = { id: string; mimeType: "image/png" | "image/jpeg" | "image/webp"; base64: string };
export type MarkdownReadingPassage = {
  id: string;
  title: string;
  format: "markdown";
  content: string;
  assets?: PassageImage[];
};
export type ReadingPassage = PlainReadingPassage | MarkdownReadingPassage;

export type Quiz = {
  id: string;
  title: string;
  description?: string;
  learningMaterial?: QuizLearningMaterial;
  passages?: ReadingPassage[];
  questions: Question[];
};
export type QuizFile = { schemaVersion: 1 | 2 | 3; quiz: Quiz };
export type Answer = string | string[];
export type Attempt = {
  quizId: string;
  answers: Record<string, Answer>;
  currentIndex: number;
  updatedAt: string;
  /** Seed for the attempt's question and choice order. Absent on attempts saved by older builds. */
  shuffleSeed?: number;
};
export type QuizResult = {
  quizId: string;
  answers: Record<string, Answer>;
  correct: number;
  total: number;
  completedAt: string;
};
