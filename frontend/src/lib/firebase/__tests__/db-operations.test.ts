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
} from "../db-operations";

describe("Module CRUD Operations", () => {
  beforeEach(() => {
    jest.clearAllMocks();

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
        .mockResolvedValueOnce({ docs: mockFreeResponseSteps });

      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);
      (deleteDoc as jest.Mock).mockResolvedValue(undefined);

      await deleteModule("module123", true);

      // The four populated fixtures plus the sorting and poll collections.
      expect(getDocs).toHaveBeenCalledTimes(6);
      // Should delete 4 steps total (1 from each subcollection)
      expect(mockBatch.delete).toHaveBeenCalledTimes(4);
      expect(mockBatch.commit).toHaveBeenCalled();
      expect(deleteDoc).toHaveBeenCalled();
    });
  });
});

describe("Step CRUD Operations", () => {
  beforeEach(() => {
    jest.clearAllMocks();

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
        .mockResolvedValueOnce({ docs: mockFreeResponseSteps });

      const result = await getStepsByModuleId("module123");

      // The four populated fixtures plus the sorting and poll collections.
      expect(getDocs).toHaveBeenCalledTimes(6);
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
