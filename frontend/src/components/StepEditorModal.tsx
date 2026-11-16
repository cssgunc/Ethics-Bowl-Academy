"use client";

import type { Step } from "@/lib/firebase/types";

import DebateEditorModal from "./step-editors/DebateEditorModal";
import VideoEditorModal from "./step-editors/VideoEditorModal";
import QuizEditorModal from "./step-editors/QuizEditorModal";
import FlashcardsEditorModal from "./step-editors/FlashcardsEditorModal";
import FreeResponseEditorModal from "./step-editors/FreeResponseEditorModal";
import PollEditorModal from "./step-editors/PollEditorModal";
import SortingEditorModal from "./step-editors/SortingEditorModal";

interface StepEditorModalProps {
  moduleId: string;
  step: Step;
  onClose: () => void;
  onSave: (step: Step) => void;
}

export default function StepEditorModal({
  moduleId,
  step,
  onClose,
  onSave,
}: StepEditorModalProps) {
  const handleBack = () => onClose();

  switch (step.type) {
    case "debate":
      return <DebateEditorModal moduleId={moduleId} step={step} onClose={onClose} onBack={handleBack} onSave={onSave} />;
    case "video":
      return (
        <VideoEditorModal
          moduleId={moduleId}
          step={step}
          onClose={onClose}
          onBack={handleBack}
          onSave={onSave}
        />
      );

    case "quiz":
      return (
        <QuizEditorModal
          moduleId={moduleId}
          step={step}
          onClose={onClose}
          onBack={handleBack}
          onSave={onSave}
        />
      );

    case "flashcards":
      return (
        <FlashcardsEditorModal
          moduleId={moduleId}
          step={step}
          onClose={onClose}
          onBack={handleBack}
          onSave={onSave}
        />
      );

    case "freeResponse":
      return (
        <FreeResponseEditorModal
          moduleId={moduleId}
          step={step}
          onClose={onClose}
          onBack={handleBack}
          onSave={onSave}
        />
      );

    case "sorting":
      return (
        <SortingEditorModal
          moduleId={moduleId}
          step={step}
          onClose={onClose}
          onBack={handleBack}
          onSave={onSave}
        />
      );

    case "poll":
      return (
        <PollEditorModal
          moduleId={moduleId}
          step={step}
          onClose={onClose}
          onBack={handleBack}
          onSave={onSave}
        />
      );

    default:
      return null;
  }
}