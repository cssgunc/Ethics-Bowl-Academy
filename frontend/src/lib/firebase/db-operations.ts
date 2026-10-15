// Client-side db operations

import { db } from "./firebaseConfig";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  writeBatch,
  orderBy,
  arrayRemove,
} from "firebase/firestore";

import {
  User,
  Module,
  Step,
  UserProgress,
  StepType,
  STEP_COLLECTIONS,
  JournalEntry,
  PollStep,
} from "./types";

// ✅ Helper: normalize any step coming from Firestore
function normalizeStepFromFirestore(id: string, data: any): Step {
  if (data?.type === "sorting") {
    return {
      id,
      ...data,
      answerKey: data.answerKey ?? {},
    } as Step;
  }
  return { id, ...data } as Step;
}

// Module CRUD operations

// get module by ID - DOES NOT include steps subcollection
export const getModuleById = async (moduleId: string): Promise<Module> => {
  if (!db) {
    throw new Error(
      "Firebase database not initialized. Check environment variables.",
    );
  }
  const moduleDocRef = doc(db!, "modules", moduleId);
  const moduleDoc = await getDoc(moduleDocRef);

  if (moduleDoc.exists()) {
    return { id: moduleDoc.id, ...moduleDoc.data() } as Module;
  } else {
    throw new Error("Module not found");
  }
};

export const createModule = async (
  moduleData: Partial<Module>,
): Promise<Module> => {
  // If no order is provided, find the next available order
  let order = moduleData.order;
  if (order === undefined || order === null) {
    const existingModules = await getPublicModules();
    order = existingModules.length + 1;
  }

  const newModule = {
    ...moduleData,
    stepCount: moduleData.stepCount || 0,
    order,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const moduleDocRef = await addDoc(collection(db!, "modules"), newModule);
  return {
    id: moduleDocRef.id,
    ...moduleData,
    order,
    stepCount: moduleData.stepCount || 0,
  } as Module;
};

export const updateModule = async (moduleId: string, moduleData: any) => {
  const moduleDocRef = doc(db!, "modules", moduleId);
  await updateDoc(moduleDocRef, {
    ...moduleData,
    updatedAt: serverTimestamp(),
  });
  return { id: moduleId, ...moduleData };
};

export const deleteModule = async (
  moduleId: string,
  deleteSteps: boolean = true,
) => {
  const moduleDocRef = doc(db!, "modules", moduleId);

  if (deleteSteps) {
    // Delete from all step subcollections
    const batch = writeBatch(db!);
    const collectionNames: StepType[] = [
      "video",
      "quiz",
      "flashcards",
      "freeResponse",
      "sorting",
      "poll",
      "debate",
      "additionalResources",
    ];

    await Promise.all(
      collectionNames.map(async (type) => {
        const collectionName = STEP_COLLECTIONS[type];
        const stepsRef = collection(db!, "modules", moduleId, collectionName);
        const stepsSnapshot = await getDocs(stepsRef);

        stepsSnapshot.docs.forEach((stepDoc) => {
          batch.delete(stepDoc.ref);
        });
      }),
    );

    await batch.commit();
  }

  await deleteDoc(moduleDocRef);
};

// Step CRUD operations
export const getStepById = async (
  moduleId: string,
  stepId: string,
  type: StepType,
): Promise<Step> => {
  const collectionName = STEP_COLLECTIONS[type];
  const stepDocRef = doc(db!, "modules", moduleId, collectionName, stepId);
  const stepDoc = await getDoc(stepDocRef);

  if (!stepDoc.exists()) throw new Error("Step not found");

  const data = stepDoc.data() as any;
  return normalizeStepFromFirestore(stepDoc.id, data);
};

// Get steps by module ID (queries all step subcollections)
export const getStepsByModuleId = async (moduleId: string): Promise<Step[]> => {
  const allSteps: Step[] = [];

  const collectionNames: StepType[] = [
    "video",
    "quiz",
    "flashcards",
    "freeResponse",
    "sorting",
    "poll",
    "debate",
    "additionalResources",
  ];

  await Promise.all(
    collectionNames.map(async (type) => {
      const collectionName = STEP_COLLECTIONS[type];
      const stepsRef = collection(db!, "modules", moduleId, collectionName);
      const stepsQuery = query(stepsRef, orderBy("order", "asc"));
      const stepsSnapshot = await getDocs(stepsQuery);

      const steps = stepsSnapshot.docs.map((d) => {
        const data = d.data() as any;
        return normalizeStepFromFirestore(d.id, data);
      });

      allSteps.push(...steps);
    }),
  );

  return allSteps.sort((a, b) => a.order - b.order);
};

export const createStep = async (
  moduleId: string,
  stepData: Partial<Step>,
): Promise<Step> => {
  if (!stepData.type) {
    throw new Error("Step type is required");
  }

  const newStep = {
    ...stepData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const collectionName = STEP_COLLECTIONS[stepData.type];
  const stepsRef = collection(db!, "modules", moduleId, collectionName);
  const stepDocRef = await addDoc(stepsRef, newStep);

  // Update Parent Module's step count
  const moduleDocRef = doc(db!, "modules", moduleId);
  const moduleDoc = await getDoc(moduleDocRef);
  if (moduleDoc.exists()) {
    const currentCount = moduleDoc.data().stepCount || 0;
    await updateDoc(moduleDocRef, {
      stepCount: currentCount + 1,
      updatedAt: serverTimestamp(),
    });
  }

  return { id: stepDocRef.id, ...stepData } as Step;
};

export const updateStep = async (
  moduleId: string,
  stepId: string,
  type: StepType,
  stepData: Partial<Step>,
) => {
  const { createdAt, createdBy, id: _id, moduleId: _mid, ...safeData } =
    stepData as Record<string, unknown>;

  const collectionName = STEP_COLLECTIONS[type];
  const stepDocRef = doc(db!, "modules", moduleId, collectionName, stepId);

  await updateDoc(stepDocRef, {
    ...safeData,
    updatedAt: serverTimestamp(),
  });

  // Update parent module's updatedAt
  const moduleDocRef = doc(db!, "modules", moduleId);
  await updateDoc(moduleDocRef, { updatedAt: serverTimestamp() });
};

export const deleteStep = async (
  moduleId: string,
  stepId: string,
  type: StepType,
) => {
  const collectionName = STEP_COLLECTIONS[type];
  const stepDocRef = doc(db!, "modules", moduleId, collectionName, stepId);
  await deleteDoc(stepDocRef);

  // Update parent module's stepCount (decrement)
  const moduleDocRef = doc(db!, "modules", moduleId);
  const moduleDoc = await getDoc(moduleDocRef);
  if (moduleDoc.exists()) {
    const currentCount = moduleDoc.data().stepCount || 0;
    await updateDoc(moduleDocRef, {
      stepCount: Math.max(0, currentCount - 1),
      updatedAt: serverTimestamp(),
    });
  }

  // Remove stepId from all users' progress
  try {
    const usersRef = collection(db!, "users");
    const usersSnapshot = await getDocs(usersRef);

    await Promise.all(
      usersSnapshot.docs.map(async (userDoc) => {
        const progressRef = doc(db!, "users", userDoc.id, "progress", moduleId);
        try {
          await updateDoc(progressRef, {
            completedStepIds: arrayRemove(stepId),
          });
        } catch (e) {
          // Ignore if progress doc doesn't exist for this user
        }
      }),
    );
  } catch (error) {
    console.error("Error cleaning up user progress:", error);
  }
};

// User progress operations

export const userSignupCheck = async (userId: string) => {
  const userDocRef = doc(db!, "users", userId);
  const userDoc = await getDoc(userDocRef);
  return userDoc.exists();
};

export const createUser = async (userData: Partial<User>) => {
  const userDocRef = doc(db!, "users", userData.id!);
  await setDoc(
    userDocRef,
    {
      ...userData,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      isAdmin: false,
    },
    { merge: true },
  );

  // Create journal entries for all public modules
  const publicModules = await getPublicModules();
  await Promise.all(
    publicModules.map(async (module) => {
      const journalRef = doc(db!, "users", userData.id!, "journal", module.id);
      await setDoc(journalRef, {
        title: module.title,
        body: {},
        moduleId: module.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }),
  );

  return { id: userData.id, ...userData } as User;
};

export const isAdminUser = async (userId: string) => {
  const userDocRef = doc(db!, "users", userId);
  const userDoc = await getDoc(userDocRef);
  if (userDoc.exists()) {
    const userData = userDoc.data();
    return userData.isAdmin === true;
  }
  return false;
};

export const startUserProgress = async (userId: string, moduleId: string) => {
  const progressRef = doc(db!, "users", userId, "progress", moduleId);

  const progressData = {
    completedStepIds: [],
    lastViewedAt: serverTimestamp(),
    quizScores: {},
    pollVotes: {},
    startedAt: serverTimestamp(),
    completedAt: null,
  };

  await setDoc(progressRef, progressData);
  return { id: progressRef.id, ...progressData };
};

export const getUserProgress = async (userId: string, moduleId: string) => {
  const progressRef = doc(db!, "users", userId, "progress", moduleId);
  const progressDoc = await getDoc(progressRef);
  if (!progressDoc.exists()) {
    return null;
  }
  const progressData = progressDoc.data();
  return {
    id: progressDoc.id,
    completedStepIds: progressData.completedStepIds || [],
    lastViewedAt: progressData.lastViewedAt || null,
    quizScores: progressData.quizScores || {},
    pollVotes: progressData.pollVotes || {},
    startedAt: progressData.startedAt || null,
    completedAt: progressData.completedAt || null,
  } as UserProgress;
};

export const markStepCompleted = async (
  userId: string,
  moduleId: string,
  stepId: string,
) => {
  const progressRef = doc(db!, "users", userId, "progress", moduleId);
  const progressDoc = await getDoc(progressRef);

  if (progressDoc.exists()) {
    const progressData = progressDoc.data();
    if (!progressData.completedStepIds.includes(stepId)) {
      await updateDoc(progressRef, {
        completedStepIds: [...progressData.completedStepIds, stepId],
        lastViewedAt: serverTimestamp(),
      });
    }
  } else {
    await setDoc(progressRef, {
      completedStepIds: [stepId],
      lastViewedAt: serverTimestamp(),
      quizScores: {},
      pollVotes: {},
      startedAt: serverTimestamp(),
      completedAt: null,
    });
  }
};

export const updateQuizScore = async (
  userId: string,
  moduleId: string,
  stepId: string,
  score: number,
) => {
  const progressRef = doc(db!, "users", userId, "progress", moduleId);
  const progressDoc = await getDoc(progressRef);

  if (progressDoc.exists()) {
    const progressData = progressDoc.data();
    const currentScores = progressData.quizScores || {};
    if (currentScores[stepId] === undefined || score > currentScores[stepId]) {
      currentScores[stepId] = score;
    }

    await updateDoc(progressRef, {
      quizScores: currentScores,
      lastViewedAt: serverTimestamp(),
    });
  } else {
    const quizScores: { [stepId: string]: number } = {};
    quizScores[stepId] = score;

    await setDoc(progressRef, {
      completedStepIds: [],
      lastViewedAt: serverTimestamp(),
      quizScores,
      pollVotes: {},
      startedAt: serverTimestamp(),
      completedAt: null,
    });
  }
};

export const completeModule = async (userId: string, moduleId: string) => {
  const progressRef = doc(db!, "users", userId, "progress", moduleId);
  await updateDoc(progressRef, {
    completedAt: serverTimestamp(),
    lastViewedAt: serverTimestamp(),
  });
};

// Query helpers

export const getPublicModules = async (): Promise<Module[]> => {
  const modulesRef = collection(db!, "modules");
  const publicModulesQuery = query(
    modulesRef,
    where("isPublic", "==", true),
    orderBy("order", "asc"),
  );
  const publicModulesSnapshot = await getDocs(publicModulesQuery);

  return publicModulesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Module[];
};

export const getUserModules = async (userId: string) => {
  const modulesRef = collection(db!, "modules");
  const collaboratoryQuery = query(
    modulesRef,
    where("collaborators", "array-contains", userId),
    orderBy("updatedAt", "desc"),
  );

  const collaboratorSnapshot = await getDocs(collaboratoryQuery);
  return collaboratorSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Module[];
};

// Journal CRUD operations

export const getJournalEntries = async (
  userId: string,
): Promise<JournalEntry[]> => {
  try {
    const journalRef = collection(db!, "users", userId, "journal");
    const journalQuery = query(journalRef, orderBy("updatedAt", "desc"));
    const journalSnapshot = await getDocs(journalQuery);

    return journalSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as JournalEntry[];
  } catch (error) {
    console.log("Journal collection does not exist yet for user:", userId);
    return [];
  }
};

export const getJournalEntryByStepId = async (
  userId: string,
  stepId: string,
): Promise<JournalEntry | null> => {
  try {
    const journalRef = collection(db!, "users", userId, "journal");
    const snapshot = await getDocs(journalRef);

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const bodyMap = data.body as Record<string, [string, string]> | undefined;

      if (!bodyMap) continue;

      if (bodyMap[stepId]) {
        return {
          id: docSnap.id,
          ...data,
        } as JournalEntry;
      }
    }

    return null;
  } catch (error) {
    console.error("Error fetching journal entry by stepId:", error);
    return null;
  }
};

export const createJournalEntry = async (
  userId: string,
  entryData: Partial<JournalEntry>,
): Promise<JournalEntry> => {
  try {
    const userDocRef = doc(db!, "users", userId);
    await getDoc(userDocRef);

    const newEntry = {
      ...entryData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const journalRef = collection(db!, "users", userId, "journal");
    const entryDocRef = await addDoc(journalRef, newEntry);

    return {
      id: entryDocRef.id,
      ...entryData,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as JournalEntry;
  } catch (error) {
    console.error("Failed to create journal entry:", error);
    throw new Error("Failed to create journal entry");
  }
};

export const updateJournalEntry = async (
  userId: string,
  entryId: string,
  updates: Partial<Omit<JournalEntry, "id">>,
): Promise<void> => {
  try {
    const entryRef = doc(db!, "users", userId, "journal", entryId);
    await updateDoc(entryRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to update journal entry:", error);
    throw new Error("Failed to update journal entry");
  }
};

export const deleteJournalEntry = async (
  userId: string,
  entryId: string,
): Promise<void> => {
  try {
    const entryRef = doc(db!, "users", userId, "journal", entryId);
    await deleteDoc(entryRef);
  } catch (error) {
    console.error("Failed to delete journal entry:", error);
    throw new Error("Failed to delete journal entry");
  }
};

// Save a free response to the module's journal entry
export const saveFreeResponseToJournal = async (
  userId: string,
  moduleId: string,
  moduleTitle: string,
  prompt: string,
  answer: string,
  stepId: string,
): Promise<void> => {
  try {
    const journalRef = doc(db!, "users", userId, "journal", moduleId);
    const journalDoc = await getDoc(journalRef);

    const newEntry: [string, string] = [prompt, answer];

    if (journalDoc.exists()) {
      const data = journalDoc.data();
      let body: Record<string, [string, string]>;

      if (typeof data.body === "string") {
        body = {};
      } else if (typeof data.body === "object" && data.body !== null) {
        body = data.body as Record<string, [string, string]>;
      } else {
        body = {};
      }

      body[stepId] = newEntry;

      await updateDoc(journalRef, {
        body,
        moduleId,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(journalRef, {
        title: moduleTitle,
        moduleId,
        body: {
          [stepId]: newEntry,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Failed to save free response to journal:", error);
    throw new Error("Failed to save free response to journal");
  }
};

// Poll voting operations

export const submitPollVote = async (
  moduleId: string,
  stepId: string,
  userId: string,
  selectedOptionIds: string[],
): Promise<void> => {
  if (!db) {
    throw new Error(
      "Firebase database not initialized. Check environment variables.",
    );
  }

  try {
    const pollRef = doc(db!, "modules", moduleId, "polls", stepId);
    const pollDoc = await getDoc(pollRef);

    if (!pollDoc.exists()) {
      throw new Error("Poll not found");
    }

    const pollData = pollDoc.data() as PollStep;

    const progressRef = doc(db!, "users", userId, "progress", moduleId);
    const progressDoc = await getDoc(progressRef);

    let progressData: any;
    let previousVoteIds: string[] = [];

    if (progressDoc.exists()) {
      progressData = progressDoc.data();
      if (progressData.pollVotes && progressData.pollVotes[stepId]) {
        previousVoteIds = progressData.pollVotes[stepId];
      }
    } else {
      progressData = {
        completedStepIds: [],
        lastViewedAt: serverTimestamp(),
        quizScores: {},
        pollVotes: {},
        startedAt: serverTimestamp(),
        completedAt: null,
      };
    }

    const currentPollVotes = progressData.pollVotes || {};
    currentPollVotes[stepId] = selectedOptionIds;

    const updatedOptions = pollData.options.map((option) => {
      let voteChange = 0;

      if (previousVoteIds.includes(option.id)) voteChange -= 1;
      if (selectedOptionIds.includes(option.id)) voteChange += 1;

      return { ...option, votes: Math.max(0, option.votes + voteChange) };
    });

    await Promise.all([
      updateDoc(pollRef, {
        options: updatedOptions,
        updatedAt: serverTimestamp(),
      }),
      setDoc(
        progressRef,
        {
          ...progressData,
          pollVotes: currentPollVotes,
          lastViewedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    ]);
  } catch (error) {
    console.error("Failed to submit poll vote:", error);
    throw new Error("Failed to submit vote");
  }
};

export const getUserPollVote = async (
  moduleId: string,
  stepId: string,
  userId: string,
): Promise<{ optionIds: string[]; votedAt: any } | null> => {
  if (!db) {
    throw new Error(
      "Firebase database not initialized. Check environment variables.",
    );
  }

  try {
    const progressRef = doc(db!, "users", userId, "progress", moduleId);
    const progressDoc = await getDoc(progressRef);

    if (progressDoc.exists()) {
      const progressData = progressDoc.data();
      const pollVotes = progressData.pollVotes || {};
      const userVote = pollVotes[stepId];

      if (userVote) {
        return { optionIds: userVote, votedAt: progressData.lastViewedAt };
      }
    }

    return null;
  } catch (error) {
    console.error("Failed to get user poll vote:", error);
    throw new Error("Failed to get vote");
  }
};

export const getPollResults = async (
  moduleId: string,
  stepId: string,
): Promise<PollStep> => {
  if (!db) {
    throw new Error(
      "Firebase database not initialized. Check environment variables.",
    );
  }

  try {
    const pollRef = doc(db!, "modules", moduleId, "polls", stepId);
    const pollDoc = await getDoc(pollRef);

    if (!pollDoc.exists()) {
      throw new Error("Poll not found");
    }

    return { id: pollDoc.id, ...pollDoc.data() } as PollStep;
  } catch (error) {
    console.error("Failed to get poll results:", error);
    throw new Error("Failed to get poll results");
  }
};
