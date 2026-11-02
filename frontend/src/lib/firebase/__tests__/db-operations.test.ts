// Mock firebaseConfig BEFORE any imports that use it
jest.mock("../firebaseConfig", () => ({
  db: {},
  auth: {},
  app: {},
  googleAuthProvider: {},
}));

// Mock Firebase modules
jest.mock("firebase/firestore");

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

import {
  createModule,
  getModuleById,
  updateModule,
  deleteModule,
  createStep,
  getStepsByModuleId,
  deleteStep,
  getStepById,
  updateStep,
} from "../db-operations";

import { STEP_COLLECTIONS } from "../types";

describe("Module CRUD Operations", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getDocs as jest.Mock).mockResolvedValue({ docs: [] });

    (collection as jest.Mock).mockReturnValue({ type: "CollectionReference" });
    (doc as jest.Mock).mockReturnValue({ type: "DocumentReference" });
    (query as jest.Mock).mockReturnValue({ type: "Query" });
    (orderBy as jest.Mock).mockReturnValue({ type: "OrderBy" });
    (getDocs as jest.Mock).mockResolvedValue({ docs: [] });
  });
  describe("createModule", () => {
    it("should create a module with correct data", async () => {
      const mockDocRef = { id: "module123" };
      (addDoc as jest.Mock).mockResolvedValue(mockDocRef);
      (serverTimestamp as jest.Mock).mockReturnValue("TIMESTAMP");

      const moduleData = {
        title: "Test Module",
        description: "Test Description",
        createdBy: "user123",
        isPublic: true,
        tags: ["test"],
      };

      const result = await createModule(moduleData);

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          title: "Test Module",
          description: "Test Description",
          createdBy: "user123",
          isPublic: true,
          tags: ["test"],
          stepCount: 0,
          createdAt: "TIMESTAMP",
          updatedAt: "TIMESTAMP",
        })
      );
      expect(result.id).toBe("module123");
    });
  });

  describe("getModuleById", () => {
    it("should retrieve a module by id", async () => {
      const mockData = {
        title: "Test Module",
        description: "Test",
        createdBy: "user123",
      };

      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        id: "module123",
        data: () => mockData,
      });

      const result = await getModuleById("module123");

      expect(doc).toHaveBeenCalled();
      expect(getDoc).toHaveBeenCalled();
      expect(result.id).toBe("module123");
      expect(result.title).toBe("Test Module");
    });

    it("should throw error if module not found", async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => false,
      });

      await expect(getModuleById("nonexistent")).rejects.toThrow(
        "Module not found"
      );
    });
  });

  describe("updateModule", () => {
    it("should update module with new data", async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);
      (serverTimestamp as jest.Mock).mockReturnValue("TIMESTAMP");

      await updateModule("module123", { title: "Updated Title" });

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          title: "Updated Title",
          updatedAt: "TIMESTAMP",
        })
      );
    });
  });

  describe("deleteModule", () => {
    it("should delete module and all its steps from all subcollections", async () => {
      const mockVideoSteps = [{ ref: "videoRef1" }];
      const mockQuizSteps = [{ ref: "quizRef1" }];
      const mockFlashcardsSteps = [{ ref: "flashcardsRef1" }];
      const mockFreeResponseSteps = [{ ref: "freeResponseRef1" }];

      // Mock getDocs to return different results for different subcollections
      (getDocs as jest.Mock)
        .mockResolvedValueOnce({ docs: mockVideoSteps })
        .mockResolvedValueOnce({ docs: mockQuizSteps })
        .mockResolvedValueOnce({ docs: mockFlashcardsSteps })
        .mockResolvedValueOnce({ docs: mockFreeResponseSteps })
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] });

      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);
      (deleteDoc as jest.Mock).mockResolvedValue(undefined);

      await deleteModule("module123", true);

      // Query every registered step subcollection
      expect(getDocs).toHaveBeenCalledTimes(Object.keys(STEP_COLLECTIONS).length);
      // Should delete 4 steps total (1 from each subcollection)
      expect(mockBatch.delete).toHaveBeenCalledTimes(4);
      expect(mockBatch.commit).toHaveBeenCalled();
      expect(deleteDoc).toHaveBeenCalled();
    });
  });
});

describe("Step CRUD Operations", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getDocs as jest.Mock).mockResolvedValue({ docs: [] });

    (collection as jest.Mock).mockReturnValue({ type: "CollectionReference" });
    (doc as jest.Mock).mockReturnValue({ type: "DocumentReference" });
    (query as jest.Mock).mockReturnValue({ type: "Query" });
    (orderBy as jest.Mock).mockReturnValue({ type: "OrderBy" });
    (getDocs as jest.Mock).mockResolvedValue({ docs: [] });
  });

  describe("createStep", () => {
    it("should create step and increment module stepCount", async () => {
      const mockStepRef = { id: "step123" };
      (addDoc as jest.Mock).mockResolvedValue(mockStepRef);
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ stepCount: 5 }),
      });
      (updateDoc as jest.Mock).mockResolvedValue(undefined);
      (serverTimestamp as jest.Mock).mockReturnValue("TIMESTAMP");

      const stepData = {
        type: "video" as const,
        title: "Video Step",
        order: 10,
        isOptional: false,
        createdBy: "user123",
        youtubeUrl: "https://youtube.com/watch?v=test",
        thumbnailUrl: "https://example.com/thumb.jpg",
        durationSec: 300,
      };

      const result = await createStep("module123", stepData);

      expect(addDoc).toHaveBeenCalled();
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          stepCount: 6,
          updatedAt: "TIMESTAMP",
        })
      );
      expect(result.id).toBe("step123");
    });
  });

  describe("getStepsByModuleId", () => {
    it("should return steps from all subcollections ordered by order field", async () => {
      const mockVideoSteps = [
        { id: "video1", data: () => ({ title: "Video 1", type: "video", order: 10, youtubeUrl: "https://youtube.com/test" }) },
      ];
      const mockQuizSteps = [
        { id: "quiz1", data: () => ({ title: "Quiz 1", type: "quiz", order: 5, questions: [], shuffle: false, passingScore: 70 }) },
      ];
      const mockFlashcardsSteps = [
        { id: "flashcards1", data: () => ({ title: "Flashcards 1", type: "flashcards", order: 15, cards: [] }) },
      ];
      const mockFreeResponseSteps = [
        { id: "freeResponse1", data: () => ({ title: "Free Response 1", type: "freeResponse", order: 20, prompt: "Test prompt" }) },
      ];

      // Mock getDocs to return different results for different subcollections
      (getDocs as jest.Mock)
        .mockResolvedValueOnce({ docs: mockVideoSteps })
        .mockResolvedValueOnce({ docs: mockQuizSteps })
        .mockResolvedValueOnce({ docs: mockFlashcardsSteps })
        .mockResolvedValueOnce({ docs: mockFreeResponseSteps })
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] });

      const result = await getStepsByModuleId("module123");

      // Query every registered step subcollection
      expect(getDocs).toHaveBeenCalledTimes(Object.keys(STEP_COLLECTIONS).length);
      expect(query).toHaveBeenCalled();
      expect(orderBy).toHaveBeenCalledWith("order", "asc");

      // Should return all 4 steps sorted by order
      expect(result).toHaveLength(4);
      expect(result[0].id).toBe("quiz1"); // order: 5
      expect(result[1].id).toBe("video1"); // order: 10
      expect(result[2].id).toBe("flashcards1"); // order: 15
      expect(result[3].id).toBe("freeResponse1"); // order: 20
    });
  });

  describe("deleteStep", () => {
    it("should delete step from correct subcollection and decrement stepCount", async () => {
      (deleteDoc as jest.Mock).mockResolvedValue(undefined);
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ stepCount: 5 }),
      });
      (updateDoc as jest.Mock).mockResolvedValue(undefined);
      (serverTimestamp as jest.Mock).mockReturnValue("TIMESTAMP");

      await deleteStep("module123", "step123", "video");

      expect(deleteDoc).toHaveBeenCalled();
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          stepCount: 4,
          updatedAt: "TIMESTAMP",
        })
      );
    });
  });
});


describe("Debate persistence", () => {
  const debate = {
    type: "debate" as const, title: "Debate", order: 0,
    isOptional: false, createdBy: "owner",
    modulePrompt: "Discuss ethics.", startQuestion: "What is fair?", maxStudentTurns: 5,
  };
  beforeEach(() => {
    jest.resetAllMocks();
    (collection as jest.Mock).mockImplementation((_db, ...path) => path.join("/"));
    (doc as jest.Mock).mockImplementation((_db, ...path) => path.join("/"));
    (query as jest.Mock).mockImplementation((ref) => ref);
    (serverTimestamp as jest.Mock).mockReturnValue("TIMESTAMP");
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, id: "debate1", data: () => ({ ...debate, stepCount: 1 }) });
    (getDocs as jest.Mock).mockResolvedValue({ docs: [] });
    (addDoc as jest.Mock).mockResolvedValue({ id: "new-debate" });
  });
  it("creates a debate and increments the module count", async () => {
    expect(await createStep("module1", debate)).toEqual({ id: "new-debate", ...debate });
    expect(addDoc).toHaveBeenCalledWith("modules/module1/debates", { ...debate, createdAt: "TIMESTAMP", updatedAt: "TIMESTAMP" });
    expect(updateDoc).toHaveBeenCalledWith("modules/module1", expect.objectContaining({ stepCount: 2 }));
  });
  it("loads a debate by ID and with its module, including additional resources", async () => {
    expect(await getStepById("module1", "debate1", "debate")).toMatchObject({ id: "debate1", ...debate });
    expect(getDoc).toHaveBeenCalledWith("modules/module1/debates/debate1");
    (getDocs as jest.Mock).mockImplementation(async (path) => ({ docs:
      path.endsWith("/debates") ? [{ id: "debate1", data: () => debate }] :
      path.endsWith("/additionalResources") ? [{ id: "resources1", data: () => ({ type: "additionalResources", order: 2 }) }] : []
    }));
    const steps = await getStepsByModuleId("module1");
    expect(steps.map((step) => step.id)).toEqual(["debate1", "resources1"]);
    expect(steps[0]).toMatchObject(debate);
  });
  it("edits payloads and reorders debates without changing their creator", async () => {
    await updateStep("module1", "debate1", "debate", { ...debate, maxStudentTurns: 10, order: 3 });
    const { createdBy, ...editable } = debate;
    expect(updateDoc).toHaveBeenCalledWith("modules/module1/debates/debate1", { ...editable, maxStudentTurns: 10, order: 3, updatedAt: "TIMESTAMP" });
  });
  it("deletes a debate and decrements the count", async () => {
    await deleteStep("module1", "debate1", "debate");
    expect(deleteDoc).toHaveBeenCalledWith("modules/module1/debates/debate1");
    expect(updateDoc).toHaveBeenCalledWith("modules/module1", expect.objectContaining({ stepCount: 0 }));
  });
  it("includes debates and additional resources when deleting a module", async () => {
    (getDocs as jest.Mock).mockImplementation(async (path) => ({ docs: [{ ref: `${path}/step1` }] }));
    const batch = { delete: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
    (writeBatch as jest.Mock).mockReturnValue(batch);
    await deleteModule("module1");
    expect(batch.delete).toHaveBeenCalledWith("modules/module1/debates/step1");
    expect(batch.delete).toHaveBeenCalledWith("modules/module1/additionalResources/step1");
    expect(batch.delete).toHaveBeenCalledTimes(Object.keys(STEP_COLLECTIONS).length);
  });
});
