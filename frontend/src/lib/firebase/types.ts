import { Timestamp } from "firebase/firestore";

// User

export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: Timestamp | Date;
  lastLoginAt: Timestamp | Date;
  isAdmin: boolean;
}

export interface UserProgress {
  completedStepIds: string[];
  lastViewedAt: Timestamp;
  quizScores: { [stepId: string]: number };
  pollVotes: { [stepId: string]: string[] };
  startedAt: Timestamp | Date;
  completedAt: Timestamp | Date | null;
}

// Module
export interface Module {
  id: string;
  title: string;
  description: string;
  createdBy: string; // userId
  collaborators?: string[]; // userIds
  isPublic: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  stepCount: number;
  publishedVersion?: number;
  thumbnailUrl?: string;
  order?: number; // Display order on student page
}

// Quiz Question (still needed by QuizStep)
export interface QuizQuestion {
  prompt: string;
  choices: string[];
  correctIndex: number;
  // Optional explanations for each choice (aligned by index with choices array)
  choiceExplanations?: (string | null)[];
  // Legacy: question-level explanation (kept for backward compatibility)
  explanation?: string;
}

// Flashcard (still needed by FlashcardsStep)
export interface Flashcard {
  front: string;
  back: string;
}

// Poll Option (needed by PollStep)
export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

// Base Step Interface
export interface StepBase {
  id: string;
  moduleId: string;
  type: StepType;
  title: string;
  order: number;
  estimatedMinutes?: number;
  isOptional: boolean;
  createdBy: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export type StepType =
  | "video"
  | "quiz"
  | "flashcards"
  | "freeResponse"
  | "sorting"
  | "poll"
  | "additionalResources";

// Subcollection name mapping
export const STEP_COLLECTIONS = {
  video: "videos",
  quiz: "quizzes",
  flashcards: "flashcards",
  freeResponse: "freeResponses",
  sorting: "sorting",
  poll: "polls",
  additionalResources: "additionalResources",
} as const;

export type StepCollectionName = (typeof STEP_COLLECTIONS)[StepType];

// Specific Step Interfaces

export interface VideoStep extends StepBase {
  type: "video";
  youtubeUrl: string;
  thumbnailUrl?: string;
  durationSec?: number;
}

export interface AdditionalResourcesStep extends StepBase {
  type: "additionalResources";
  resources: {
    link: string;
    pdf: string;
    all?: Array<{
      // ⭐ ADD THIS OPTIONAL FIELD
      id: string;
      name: string;
      url: string;
      type: "link" | "pdf";
    }>;
  };
}

export interface QuizStep extends StepBase {
  type: "quiz";
  shuffle: boolean;
  questions: QuizQuestion[];
  passingScore: number;
}

export interface FlashcardsStep extends StepBase {
  type: "flashcards";
  cards: Flashcard[];
  studyMode?: "spaced" | "random";
}

export interface FreeResponseStep extends StepBase {
  type: "freeResponse";
  prompt: string;
  sampleAnswer?: string;
  maxLength?: number;
}

export interface SortingBucket {
  id: string;
  label: string;
}

export interface SortingCard {
  id: string;
  text: string;
}

export interface SortingStep extends StepBase {
  type: "sorting";
  prompt: string;
  buckets: SortingBucket[];
  cards: SortingCard[];
  answerKey?: Record<string, string>;
}

export interface PollStep extends StepBase {
  type: "poll";
  question: string;
  options: PollOption[];
  allowMultipleChoice: boolean;
}

// Step type used throughout the app
export type Step =
  | VideoStep
  | QuizStep
  | FlashcardsStep
  | FreeResponseStep
  | SortingStep
  | PollStep
  | AdditionalResourcesStep;

// Journal
export interface JournalEntry {
  id: string;
  title: string;
  body: string | Record<string, [string, string]>;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  moduleId?: string; // optional - for future module association
  stepId?: string; // optional - for future step association
}
