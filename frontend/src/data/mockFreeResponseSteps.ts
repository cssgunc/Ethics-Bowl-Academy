import { FreeResponseStep } from "@/lib/firebase/types";

/**
 * Mock data for FreeResponseStep components
 * Used for testing and development of the journal entry component
 */
export const mockFreeResponseSteps: FreeResponseStep[] = [
  {
    id: "step-1",
    moduleId: "mock-module",
    type: "freeResponse",
    title: "Post-Reflection Journal Entry",
    order: 1,
    prompt:
      "After learning about different ethical perspectives, which ship would you choose to save and why? Did your position or reasoning change?",
    estimatedMinutes: 10,
    maxLength: 30,
    isOptional: false,
    createdBy: "mock-user-id",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

/**
 * Get a mock FreeResponseStep by ID
 * @param stepId - The ID of the step to retrieve
 * @returns The FreeResponseStep or undefined if not found
 */
export const getMockFreeResponseStep = (
  stepId: string
): FreeResponseStep | undefined => {
  return mockFreeResponseSteps.find((step) => step.id === stepId);
};

/**
 * Get the first mock FreeResponseStep (for testing)
 * @returns The first FreeResponseStep or undefined if array is empty
 */
export const getFirstMockFreeResponseStep = (): FreeResponseStep | undefined => {
  return mockFreeResponseSteps[0];
};
