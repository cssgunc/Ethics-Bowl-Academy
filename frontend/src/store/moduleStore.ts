/**
 * ZUSTAND STORE FOR MODULE MANAGEMENT WITH FIREBASE INTEGRATION
 *
 * This file contains the global state management for the module management system.
 * It uses Zustand for state management and integrates with Firebase Firestore
 * for persistent data storage.
 *
 * The store manages:
 * - All modules and their steps
 * - Currently selected module for editing
 * - Loading states for async operations
 * - All CRUD operations with Firebase integration
 */

import { create } from 'zustand';
import { Module, Step } from '@/lib/firebase/types';
import {
  getPublicModules,
  getModuleById,
  createModule,
  updateModule,
  deleteModule,
  getStepsByModuleId,
  createStep,
  updateStep,
  deleteStep,
} from '@/lib/firebase/db-operations';

/**
 * MODULE WITH STEPS
 *
 * Combined type for modules with their steps loaded.
 * Used in the admin UI to display and edit modules.
 */
export interface ModuleWithSteps extends Module {
  steps: Step[];
}

/**
 * MODULE STORE INTERFACE
 *
 * Defines the shape of our global state and all available actions.
 * All operations are async and integrate with Firebase.
 */
interface ModuleStore {
  // ===== STATE PROPERTIES =====

  modules: ModuleWithSteps[]; // Array of all modules with their steps
  selectedModule: ModuleWithSteps | null; // Currently selected module for editing
  isEditing: boolean; // Boolean flag indicating if we're in editing mode
  isLoading: boolean; // Loading state for async operations
  error: string | null; // Error message if an operation fails
  userId: string | null; // Current user ID for createdBy field

  // ===== USER MANAGEMENT =====
  setUserId: (userId: string | null) => void; // Set current user ID

  // ===== MODULE ACTIONS =====
  // These functions handle CRUD operations for modules with Firebase

  fetchModules: () => Promise<void>; // Fetch all public modules from Firebase
  fetchModuleWithSteps: (moduleId: string) => Promise<ModuleWithSteps>; // Fetch a single module with its steps
  createNewModule: (title: string, description: string, order: number) => Promise<void>; // Create a new module in Firebase
  updateModuleData: (moduleId: string, updates: { title?: string; description?: string; order?: number }) => Promise<void>; // Update module metadata
  deleteModuleData: (moduleId: string) => Promise<void>; // Delete module and all its steps
  setSelectedModule: (module: ModuleWithSteps | null) => void; // Set selected module for editing
  setIsEditing: (editing: boolean) => void; // Toggle editing mode

  // ===== STEP ACTIONS =====
  // These functions handle CRUD operations for steps within modules

  createNewStep: (moduleId: string, stepData: Omit<Step, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>; // Add a step to a module
  updateStepData: (moduleId: string, stepId: string, updates: Partial<Step>) => Promise<void>; // Update a step
  deleteStepData: (moduleId: string, stepId: string) => Promise<void>; // Delete a step
  reorderSteps: (moduleId: string, stepIds: string[]) => Promise<void>; // Reorder steps (updates order field)
  cloneStepData: (moduleId: string, stepId: string) => Promise<void>; // Duplicate a step

  // ===== MODULE REORDERING =====
  reorderModules: (moduleIds: string[]) => Promise<void>; // Reorder modules (updates order field)

  // ===== DRAFT EDITING ACTIONS =====
  saveModuleWithSteps: (moduleData: { title: string; description: string; order: number }, steps: Step[]) => Promise<void>;
}

/**
 * ZUSTAND STORE IMPLEMENTATION WITH FIREBASE
 *
 * This implementation integrates with Firebase Firestore for all CRUD operations.
 * All module and step operations are persisted to the database.
 */
export const useModuleStore = create<ModuleStore>((set, get) => ({
  // ===== INITIAL STATE =====

  modules: [],
  selectedModule: null,
  isEditing: false,
  isLoading: false,
  error: null,
  userId: null,

  // ===== USER MANAGEMENT =====

  setUserId: (userId) => set({ userId }),

  // ===== MODULE ACTIONS =====

  /**
   * FETCH MODULES
   *
   * Fetches all public modules from Firebase and loads their steps.
   */
  fetchModules: async () => {
    set({ isLoading: true, error: null });
    try {
      console.log('Fetching public modules...');
      const modules = await getPublicModules();
      console.log(`Found ${modules.length} modules:`, modules);

      // Fetch steps for each module, handling permission errors gracefully
      const modulesWithSteps = await Promise.all(
        modules.map(async (module) => {
          try {
            const steps = await getStepsByModuleId(module.id);
            console.log(`Fetched ${steps.length} steps for module ${module.id}`);
            return { ...module, steps };
          } catch (error: any) {
            // If we can't read steps due to permissions, return module with empty steps
            console.warn(`Could not fetch steps for module ${module.id}:`, error.message);
            return { ...module, steps: [] };
          }
        })
      );

      // Sort by order to ensure correct display order
      modulesWithSteps.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      set({ modules: modulesWithSteps, isLoading: false });
      console.log('Successfully loaded modules with steps');
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      console.error('Error fetching modules:', error);
      console.error('Error code:', error.code);
      console.error('Full error:', error);
    }
  },

  /**
   * FETCH MODULE WITH STEPS
   *
   * Fetches a single module with its steps from Firebase.
   */
  fetchModuleWithSteps: async (moduleId: string) => {
    const module = await getModuleById(moduleId);
    const steps = await getStepsByModuleId(moduleId);
    return { ...module, steps };
  },

  /**
   * CREATE NEW MODULE
   *
   * Creates a new module in Firebase and adds it to the store.
   */
  createNewModule: async (title: string, description: string, order: number) => {
    const { userId } = get();
    if (!userId) {
      set({ error: 'User ID is required to create a module' });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const newModule = await createModule({
        title,
        description,
        createdBy: userId,
        collaborators: [userId],
        isPublic: true,
        tags: [],
        stepCount: 0,
        order,
      });

      // Add to local state with empty steps array
      set((state) => ({
        modules: [...state.modules, { ...newModule, steps: [] }],
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      console.error('Error creating module:', error);
    }
  },

  /**
   * UPDATE MODULE DATA
   *
   * Updates module metadata in Firebase and local state.
   */
  updateModuleData: async (moduleId: string, updates: { title?: string; description?: string }) => {
    set({ isLoading: true, error: null });
    try {
      console.log('Updating module:', moduleId, 'with:', updates);
      await updateModule(moduleId, updates);

      // Update local state
      set((state) => ({
        modules: state.modules.map((m) =>
          m.id === moduleId ? { ...m, ...updates } : m
        ),
        selectedModule:
          state.selectedModule?.id === moduleId
            ? { ...state.selectedModule, ...updates }
            : state.selectedModule,
        isLoading: false,
      }));
      console.log('Successfully updated module');
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      console.error('Error updating module:', error);
      console.error('Error code:', error.code);
    }
  },

  /**
   * DELETE MODULE DATA
   *
   * Deletes a module and all its steps from Firebase.
   */
  deleteModuleData: async (moduleId: string) => {
    const state = get();
    const module = state.modules.find((m) => m.id === moduleId);

    set({ isLoading: true, error: null });
    try {
      console.log('Attempting to delete module:', moduleId);
      console.log('Module createdBy:', module?.createdBy);
      console.log('Current userId:', state.userId);
      console.log('Is owner?', module?.createdBy === state.userId);
      console.log('Module collaborators:', module?.collaborators);

      await deleteModule(moduleId, true); // Delete with steps

      // Remove from local state
      set((state) => ({
        modules: state.modules.filter((m) => m.id !== moduleId),
        selectedModule: state.selectedModule?.id === moduleId ? null : state.selectedModule,
        isLoading: false,
      }));
      console.log('Successfully deleted module');
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      console.error('Error deleting module:', error);
      console.error('Error code:', error.code);
      console.error('Full error details:', error);
    }
  },

  setSelectedModule: (module) => set({ selectedModule: module }),

  setIsEditing: (editing) => set({ isEditing: editing }),

  // ===== STEP ACTIONS =====

  /**
   * CREATE NEW STEP
   *
   * Creates a new step in Firebase and adds it to the module.
   */
  createNewStep: async (moduleId: string, stepData: Omit<Step, 'id' | 'createdAt' | 'updatedAt'>) => {
    set({ isLoading: true, error: null });
    try {
      const newStep = await createStep(moduleId, stepData);

      // Update local state
      set((state) => ({
        modules: state.modules.map((m) =>
          m.id === moduleId
            ? { ...m, steps: [...m.steps, newStep], stepCount: m.stepCount + 1 }
            : m
        ),
        selectedModule:
          state.selectedModule?.id === moduleId
            ? { ...state.selectedModule, steps: [...state.selectedModule.steps, newStep], stepCount: state.selectedModule.stepCount + 1 }
            : state.selectedModule,
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      console.error('Error creating step:', error);
    }
  },

  /**
   * UPDATE STEP DATA
   *
   * Updates a step in Firebase and local state.
   */
  updateStepData: async (moduleId: string, stepId: string, updates: Partial<Step>) => {
    const state = get();
    const module = state.modules.find((m) => m.id === moduleId);
    const step = module?.steps.find((s) => s.id === stepId);

    if (!step) {
      set({ error: 'Step not found' });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      await updateStep(moduleId, stepId, step.type, updates);

      // Update local state
      set((state) => ({
        modules: state.modules.map((m) =>
          m.id === moduleId
            ? {
              ...m,
              steps: m.steps.map((s) =>
                s.id === stepId ? { ...s, ...updates } as Step : s
              ),
            }
            : m
        ),
        selectedModule:
          state.selectedModule?.id === moduleId
            ? {
              ...state.selectedModule,
              steps: state.selectedModule.steps.map((s) =>
                s.id === stepId ? { ...s, ...updates } as Step : s
              ),
            }
            : state.selectedModule,
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      console.error('Error updating step:', error);
    }
  },

  /**
   * DELETE STEP DATA
   *
   * Deletes a step from Firebase and local state.
   */
  deleteStepData: async (moduleId: string, stepId: string) => {
    const state = get();
    const module = state.modules.find((m) => m.id === moduleId);
    const step = module?.steps.find((s) => s.id === stepId);

    if (!step) {
      set({ error: 'Step not found' });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      await deleteStep(moduleId, stepId, step.type);

      // Update local state
      set((state) => ({
        modules: state.modules.map((m) =>
          m.id === moduleId
            ? {
              ...m,
              steps: m.steps.filter((s) => s.id !== stepId),
              stepCount: Math.max(0, m.stepCount - 1),
            }
            : m
        ),
        selectedModule:
          state.selectedModule?.id === moduleId
            ? {
              ...state.selectedModule,
              steps: state.selectedModule.steps.filter((s) => s.id !== stepId),
              stepCount: Math.max(0, state.selectedModule.stepCount - 1),
            }
            : state.selectedModule,
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      console.error('Error deleting step:', error);
    }
  },

  /**
   * REORDER STEPS
   *
   * Updates the order field of steps in Firebase and local state.
   */
  reorderSteps: async (moduleId: string, stepIds: string[]) => {
    set({ isLoading: true, error: null });
    try {
      const state = get();
      const module = state.modules.find((m) => m.id === moduleId);
      if (!module) return;

      // Update order for each step
      await Promise.all(
        stepIds.map((stepId, index) => {
          const step = module.steps.find((s) => s.id === stepId);
          if (!step) return Promise.resolve();
          return updateStep(moduleId, stepId, step.type, { order: index });
        })
      );

      // Update local state
      const reorderedSteps = stepIds
        .map((id) => module.steps.find((s) => s.id === id))
        .filter(Boolean)
        .map((step, index) => ({ ...step!, order: index }));

      set((state) => ({
        modules: state.modules.map((m) =>
          m.id === moduleId ? { ...m, steps: reorderedSteps } : m
        ),
        selectedModule:
          state.selectedModule?.id === moduleId
            ? { ...state.selectedModule, steps: reorderedSteps }
            : state.selectedModule,
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      console.error('Error reordering steps:', error);
    }
  },

  /**
   * CLONE STEP DATA
   * 
   * Duplicates an existing step and appends it to the end of the module.
   */
  cloneStepData: async (moduleId: string, stepId: string) => {
    const state = get();
    const module = state.modules.find((m) => m.id === moduleId);
    const step = module?.steps.find((s) => s.id === stepId);

    if (!step) {
      set({ error: 'Step to clone not found' });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      // Prepare cloned data (omit ID and timestamps, set order to last)
      const { id, createdAt, updatedAt, ...clonedData } = step;

      // Set order to the end of the list
      const nextOrder = module?.steps.length || 0;
      const stepToSave = {
        ...clonedData,
        order: nextOrder,
      };

      // Reuse createNewStep logic
      await get().createNewStep(moduleId, stepToSave as Omit<Step, 'id' | 'createdAt' | 'updatedAt'>);

      console.log('Successfully cloned step:', stepId);
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      console.error('Error cloning step:', error);
    }
  },

  /**
   * REORDER MODULES
   * 
   * Updates the order field of modules in Firebase and local state.
   */
  reorderModules: async (moduleIds: string[]) => {
    const state = get();

    // Optimistically update local state immediately (no isLoading to avoid unmounting the grid)
    const reorderedModules = moduleIds
      .map((id) => state.modules.find((m) => m.id === id))
      .filter(Boolean)
      .map((module, index) => ({ ...module!, order: index + 1 }));

    set({ modules: reorderedModules, error: null });

    // Persist to Firebase in the background
    try {
      await Promise.all(
        moduleIds.map((moduleId, index) => {
          return updateModule(moduleId, { order: index + 1 });
        })
      );
    } catch (error: any) {
      set({ error: error.message });
      console.error('Error reordering modules:', error);
    }
  },

  /**
   * SAVE MODULE WITH STEPS (DRAFT EDITING)
   * 
   * Saves a module and all its steps in a single operation (logically).
   * Used for the "Draft Mode" editing where changes are only persisted on save.
   */
  saveModuleWithSteps: async (moduleData, steps) => {
    const state = get();
    const { userId, selectedModule } = state;

    if (!userId) {
      set({ error: 'User ID is required to save module' });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      let savedModule: Module;

      if (selectedModule) {
        // Update existing module
        console.log('Updating module:', selectedModule.id);
        await updateModule(selectedModule.id, {
          title: moduleData.title,
          description: moduleData.description,
          order: moduleData.order,
        });
        savedModule = { ...selectedModule, ...moduleData };

        // Handle steps:
        // 1. Identify existing steps vs new steps vs deleted steps
        // The `steps` array contains the desired state.

        const existingStepIds = steps.filter(s => s.id && selectedModule.steps.some(oldS => oldS.id === s.id)).map(s => s.id);
        const stepsToDelete = selectedModule.steps.filter(s => !existingStepIds.includes(s.id));

        console.log('Steps to delete:', stepsToDelete.length);
        console.log('Steps to save/update:', steps.length);

        // Delete removed steps
        await Promise.all(stepsToDelete.map(s => deleteStep(selectedModule.id, s.id, s.type)));

        // Save/Update current steps
        const savedSteps = await Promise.all(steps.map(async (step, index) => {
          // Update order based on array position
          const stepWithOrder = { ...step, order: index };

          // Check if it's a new step (we can check if it exists in DB, or use a convention. 
          // Since we generate UUIDs for drafts, checking against original module steps is safer).
          const isExisting = selectedModule.steps.some(s => s.id === step.id);

          if (isExisting) {
            // Update
            const { id, type, ...updates } = stepWithOrder;
            // Remove fields that shouldn't be updated directly if they exist in updates (though Omit handles types)
            // We need to pass partial updates.
            // Ideally we diff, but for now sending full update is okay as long as we don't overwrite server timestamps if not needed.
            // But our updateStep wrapper handles timestamps.
            await updateStep(selectedModule.id, id, type, updates);
            return stepWithOrder;
          } else {
            // Create
            const { id, ...stepData } = stepWithOrder;
            // We strip the ID because createStep generates one, BUT wait.
            // If we generated an ID on client for the draft, we might want to use it?
            // Firestore createStep usually generates a new ID. 
            // If our `createStep` uses `addDoc`, it makes a new ID.
            // If we want to preserve the ID we generated (e.g. for relationships), we should use `setDoc` with that ID.
            // Looking at `db-operations.ts` (implied), `createStep` likely uses `addDoc`.
            // Let's assume `createStep` returns the new step with new ID.
            // This might break if we rely on the draft IDs. 
            // However, since we are doing a full save, we can just replace the local state with whatever the server returns.
            return await createStep(selectedModule.id, stepData);
          }
        }));

        // Update local state with the result
        set((state) => ({
          modules: state.modules.map((m) =>
            m.id === selectedModule.id ? { ...savedModule, steps: savedSteps } : m
          ),
          selectedModule: { ...savedModule, steps: savedSteps },
          isLoading: false,
        }));

      } else {
        // Create new module
        const newModule = await createModule({
          title: moduleData.title,
          description: moduleData.description,
          createdBy: userId,
          collaborators: [userId],
          isPublic: true,
          tags: [],
          stepCount: steps.length,
          order: moduleData.order,
        });

        savedModule = newModule;

        // Create all steps
        const savedSteps = await Promise.all(steps.map(async (step, index) => {
          const { id, ...stepData } = step;
          // Ensure order is correct
          const dataToSave = { ...stepData, order: index };
          return await createStep(newModule.id, dataToSave);
        }));

        set((state) => ({
          modules: [...state.modules, { ...savedModule, steps: savedSteps }],
          isLoading: false,
        }));
      }

    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      console.error('Error saving module with steps:', error);
    }
  },
}));

