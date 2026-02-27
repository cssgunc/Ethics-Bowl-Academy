/**
 * TYPE DEFINITIONS FOR MODULE MANAGEMENT SYSTEM
 * 
 * This file defines all the TypeScript interfaces and types used throughout
 * the admin module management interface. It establishes the data structure
 * for modules and their various feature types.
 */

/**
 * BASE FEATURE INTERFACE
 * 
 * All features (video, flashcards, quiz, journal) share these common properties.
 * This base interface ensures consistency across all feature types and makes
 * it easier to work with features generically in the UI components.
 */
export interface BaseFeature {
  id: string; // Unique identifier for the feature (auto-generated UUID)
  type: 'video' | 'flashcards' | 'quiz' | 'journal'| 'resources'; // Discriminated union type for feature classification
  title: string; // Display name for the feature in the UI
}

/**
 * VIDEO FEATURE INTERFACE
 * 
 * Represents a video lesson or tutorial within a module.
 * Extends BaseFeature and adds video-specific properties.
 */
export interface VideoFeature extends BaseFeature {
  type: 'video'; // Type discriminator - must be 'video' for this interface
  url: string; // URL to the video content (YouTube, Vimeo, etc.)
}

/**
 * RESOURCES FEATURE INTERFACE
 *
 * Represents additional learning resources such as articles or PDFs.
 * Extends BaseFeature and adds resource-specific properties.
 */
export interface ResourcesFeature extends BaseFeature {
  type: 'resources'; // Type discriminator - must be 'resources' for this interface
  resources: {
    link: string; // URL to the resource (e.g., article, website)
    pdf: string; // URL to the PDF version of the resource
  };
}

/**
 * FLASHCARD CARD INTERFACE
 * 
 * Represents a single flashcard with front and back text.
 * Used within the FlashcardsFeature to store individual card data.
 */
export interface FlashcardCard {
  front: string; // Text displayed on the front of the card (question/prompt)
  back: string; // Text displayed on the back of the card (answer/explanation)
}

/**
 * FLASHCARDS FEATURE INTERFACE
 * 
 * Represents a set of flashcards for memorization and study.
 * Contains an array of FlashcardCard objects for interactive learning.
 */
export interface FlashcardsFeature extends BaseFeature {
  type: 'flashcards'; // Type discriminator - must be 'flashcards' for this interface
  cards: FlashcardCard[]; // Array of individual flashcard objects
}

/**
 * QUIZ QUESTION INTERFACE
 * 
 * Represents a single multiple-choice question within a quiz.
 * Contains the question text, answer options, and the index of the correct answer.
 */
export interface QuizQuestion {
  question: string; // The question text displayed to the user
  options: string[]; // Array of answer choices (minimum 2, no maximum)
  correctIndex: number; // Zero-based index of the correct answer in the options array
}

/**
 * QUIZ FEATURE INTERFACE
 * 
 * Represents a multiple-choice quiz within a module.
 * Contains an array of QuizQuestion objects for assessment.
 */
export interface QuizFeature extends BaseFeature {
  type: 'quiz'; // Type discriminator - must be 'quiz' for this interface
  questions: QuizQuestion[]; // Array of quiz questions
}

/**
 * JOURNAL FEATURE INTERFACE
 * 
 * Represents a reflective writing prompt within a module.
 * Encourages personal reflection and written responses.
 */
export interface JournalFeature extends BaseFeature {
  type: 'journal'; // Type discriminator - must be 'journal' for this interface
  prompt: string; // The writing prompt or question for reflection
}

/**
 * FEATURE UNION TYPE
 * 
 * This discriminated union type allows us to work with any feature type
 * while maintaining type safety. TypeScript can narrow the type based
 * on the 'type' property, enabling type-safe access to feature-specific properties.
 */
export type Feature = VideoFeature | ResourcesFeature | FlashcardsFeature | QuizFeature | JournalFeature;

/**
 * MODULE INTERFACE
 * 
 * Represents a complete learning module that can contain multiple features.
 * This is the main data structure that admins create, edit, and manage.
 */
export interface Module {
  id: string; // Unique identifier for the module (auto-generated UUID)
  title: string; // Display name for the module in the admin interface
  description: string; // Optional description explaining the module's purpose
  features: Feature[]; // Array of features within this module (can be empty or contain any combination of feature types)
}

/**
 * FEATURE TYPE OPTIONS
 * 
 * Used in the "Add Feature" modal to provide type selection options.
 * This ensures consistency with the BaseFeature type property and makes
 * it easy to add new feature types in the future.
 */
export type FeatureType = 'video' | 'resources' | 'flashcards' | 'quiz' | 'journal';
