import type { Step, StepType } from "@/lib/firebase/types";

// Shared types for module import (#131). Every import sub-issue uses these
// exactly as written. If one needs to change, comment on #131 first.

export interface ParseError {
  line: number;
  message: string;
}

export interface ParsedStep {
  id?: string;                   // missing = new step
  type: StepType;
  title: string;
  line: number;                  // where the step starts in the file
  data: Record<string, unknown>; // type-specific fields per #130;
                                 // nested items with no id are new
}

export interface ParsedModule {
  id?: string;                   // missing = new module
  title: string;
  description: string;
  tags: string[];
  isPublic: boolean;
  updatedAt?: string;
  steps: ParsedStep[];
  imageFilenames: string[];      // local images the user must upload
}

export interface ImportPlan {
  isNewModule: boolean;
  isStale: boolean;
  creates: ParsedStep[];
  updates: { parsed: ParsedStep; live: Step }[];
  deletes: Step[];
  removedPollOptions: { stepTitle: string; optionText: string; votes: number }[];
  errors: ParseError[];
}