"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useModuleStore, ModuleWithSteps } from "@/store/moduleStore";
import { Step } from "@/lib/firebase/types";
import AddFeatureModal from "./AddStepModal";
import StepEditorModal from "./StepEditorModal";
import { useAlert } from "@/context/AlertContext";
import ImportModuleModal from "./ImportModuleModal";

interface ModuleEditorProps {
  moduleId: string | null;
  onClose: () => void;
}

export default function ModuleEditor({ moduleId, onClose }: ModuleEditorProps) {
  const {
    modules,
    createNewModule,
    updateModuleData,
    saveModuleWithSteps, // Use the new action
    fetchModules,
  } = useModuleStore();
  const { showAlert, showConfirm } = useAlert();

  // Get the latest module data from store
  const currentModule = moduleId ? modules.find((m) => m.id === moduleId) : null;

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    order: 1,
  });

  // Local state for steps (draft)
  const [steps, setSteps] = useState<Step[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddStepModal, setShowAddStepModal] = useState(false);
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Track the initial state to detect unsaved changes
  const initialFormData = useRef({ title: "", description: "", order: 1 });
  const initialSteps = useRef<Step[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (currentModule) {
      const fd = {
        title: currentModule.title,
        description: currentModule.description,
        order: currentModule.order ?? 1,
      };
      setFormData(fd);
      setSteps(currentModule.steps || []);
      initialFormData.current = fd;
      initialSteps.current = currentModule.steps || [];
    } else {
      const nextOrder = modules.length + 1;
      const fd = { title: "", description: "", order: nextOrder };
      setFormData(fd);
      setSteps([]);
      initialFormData.current = fd;
      initialSteps.current = [];
    }
    setIsDirty(false);
  }, [currentModule, modules]);

  // Detect changes
  useEffect(() => {
    const formChanged =
      formData.title !== initialFormData.current.title ||
      formData.description !== initialFormData.current.description;

    const stepsChanged =
      JSON.stringify(steps) !== JSON.stringify(initialSteps.current);

    setIsDirty(formChanged || stepsChanged);
  }, [formData, steps]);

  const handleClose = useCallback(async () => {
    if (isDirty) {
      const confirmed = await showConfirm(
        "Unsaved Changes",
        "You have unsaved changes. Are you sure you want to close without saving?"
      );
      if (!confirmed) return;
    }
    onClose();
  }, [isDirty, showConfirm, onClose]); // modules dependency is okay if we want to update if store changes, but for draft we might want to isolate. 
  // However, `module` changes when store updates, so keeping it is fine.
  // Actually, if we are editing, we might not want to overwrite local changes if `module` updates from background?
  // But here we only set on mount or if module ID changes essentially (or if module object ref changes).
  // Ideally we should only set initial state once. But for now this is fine.

  const handleSave = async () => {
    if (!formData.title.trim()) {
      await showAlert("Validation Error", "Please enter a module title", "error");
      return;
    }

    setIsSaving(true);
    try {
      // Use the new atomic save action
      await saveModuleWithSteps(
        {
          title: formData.title.trim(),
          description: formData.description.trim(),
          order: formData.order,
        },
        steps
      );

      onClose();
    } catch (error) {
      console.error("Error saving module:", error);
      await showAlert("Error", "Failed to save module. Please try again.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    const confirmed = await showConfirm("Delete Step", "Are you sure you want to delete this step?");
    if (!confirmed) return;

    // Update local state only
    setSteps(prev => prev.filter(s => s.id !== stepId));
  };

  const handleCloneStep = async (stepId: string) => {
    const stepToClone = steps.find(s => s.id === stepId);
    if (!stepToClone) return;

    // Clone locally
    const { id, createdAt, updatedAt, ...clonedData } = stepToClone;
    // We need a temporary ID for the new step so keys work
    const tempId = `temp-${Date.now()}`;
    // Actually, we should probably generate a real UUID if possible, or just let the backend handle ID creation on save.
    // But React needs a key.

    // Import uuid if needed or just use random string
    // Let's use a simple random string for now as it will be replaced on save/create if logic handles it.
    // Wait, our `saveModuleWithSteps` treats existing IDs as updates. New IDs as create?
    // It filters existing via `selectedModule.steps`. So purely new random ID is fine, it won't be found in existing steps.

    const newStep = {
      ...clonedData,
      id: tempId,
      title: `${clonedData.title} (Copy)`,
      updatedAt: new Date(),
      createdAt: new Date(),
      order: steps.length,
    } as Step; // Cast to Step (temp ID is string)

    setSteps(prev => [...prev, newStep]);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newSteps = [...steps];
    const draggedStep = newSteps[draggedIndex];
    newSteps.splice(draggedIndex, 1);
    newSteps.splice(dropIndex, 0, draggedStep);

    // ✅ reindex order
    const reOrdered = newSteps.map((s, i) => ({ ...s, order: i }));

    setSteps(reOrdered);
    setDraggedIndex(null);
  };

  // New handler for saving steps from modals
  const handleStepSave = (savedStep: Step) => {
  // ✅ ensure sorting has answerKey
  if (savedStep.type === "sorting") {
    (savedStep as any).answerKey = (savedStep as any).answerKey ?? {};
  }

  setSteps((prev) => {
    const index = prev.findIndex((s) => s.id === savedStep.id);

    if (index >= 0) {
      const newSteps = [...prev];
      newSteps[index] = savedStep;
      return newSteps;
    }

    // ✅ make sure new steps get an order
    return [...prev, { ...savedStep, order: prev.length }];
  });
};

  const getStepIcon = (type: Step["type"]) => {
    switch (type) {
      case "video":
        return (
          <svg
            className="w-5 h-5 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        );
      case "flashcards":
        return (
          <svg
            className="w-5 h-5 text-blue-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        );
      case "quiz":
        return (
          <svg
            className="w-5 h-5 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case "freeResponse":
        return (
          <svg
            className="w-5 h-5 text-purple-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        );
      case "sorting":
        return (
          <svg
            className="w-5 h-5 text-cyan-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7h7M3 12h11M3 17h7M14 7h7M18 7v10m0 0l-2-2m2 2l2-2"
            />
          </svg>
        );
      case "poll":
        return (
          <svg
            className="w-5 h-5 text-orange-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {currentModule ? "Edit Module" : "Create New Module"}
          </h2>
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200 disabled:opacity-50"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Module Details */}
          <div className="mb-8">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Module Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                disabled={isSaving}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                placeholder="Enter module title"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                disabled={isSaving}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                rows={3}
                placeholder="Enter module description"
              />
            </div>
          </div>

          {/* Steps Section - Show for both new and existing modules if we have steps */}
          {/* In draft mode, we allow adding steps even to new modules! */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Steps</h3>
              <button
                onClick={() => setShowAddStepModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Step
              </button>
            </div>

            {steps.length === 0 ? (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                <p>No steps yet. Click Add Step to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div
                    key={step.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors duration-200 cursor-move"
                  >
                    <div className="flex-shrink-0">
                      <svg
                        className="w-4 h-4 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 8h16M4 16h16"
                        />
                      </svg>
                    </div>
                    <div className="flex-shrink-0">
                      {getStepIcon(step.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {step.title}
                      </h4>
                      <p className="text-xs text-gray-500 capitalize">
                        {step.type === "freeResponse"
                          ? "Free Response"
                          : step.type}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingStep(step)}
                        className="text-gray-400 hover:text-blue-600 transition-colors duration-200"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleCloneStep(step.id)}
                        title="Clone step"
                        className="text-gray-400 hover:text-green-600 transition-colors duration-200"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteStep(step.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors duration-200"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          {moduleId && (
            <span className="mr-auto" title={isDirty ? "Save your changes before importing." : undefined}>
              <button
                onClick={() => setShowImportModal(true)}
                disabled={isDirty || isSaving}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50"
              >
                Import
              </button>
            </span>
          )}
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
          >
            {isSaving && (
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            {isSaving
              ? "Saving..."
              : currentModule
                ? "Update Module"
                : "Create Module"}
          </button>
        </div>
      </div>

      {/* Add Step Modal */}
      {showImportModal && moduleId && (
        <ImportModuleModal
          moduleId={moduleId}
          onClose={() => setShowImportModal(false)}
          onImported={() => {
            setShowImportModal(false);
            onClose();
            void fetchModules();
          }}
        />
      )}
      {showAddStepModal && (
        <AddFeatureModal
          moduleId={currentModule?.id || 'new-module'} // Pass a placeholder ID for new modules if needed, or better, the modal shouldn't depend on it for saving now
          onClose={() => setShowAddStepModal(false)}
          onSave={handleStepSave}
        />
      )}

      {/* Edit Step Modal */}
      {editingStep && (
        <StepEditorModal
          moduleId={currentModule?.id || 'new-module'}
          step={editingStep}
          onClose={() => setEditingStep(null)}
          onSave={handleStepSave}
        />
      )}
    </div>
  );
}
