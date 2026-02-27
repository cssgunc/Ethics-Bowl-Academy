"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { User, UserProgress } from "../../lib/firebase/types";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase/firebaseConfig";
import {
  getPublicModules,
  getUserProgress,
  isAdminUser,
} from "../../lib/firebase/db-operations";
import {
  SectionHeader,
  OverallProgressBar,
  ModuleProgressList,
  type ModuleItem,
} from "../../components/progress";
import Image from "next/image";

// Force dynamic rendering to prevent static generation issues with Firebase Auth
export const dynamic = 'force-dynamic';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [progressData, setProgressData] = useState<
    Record<string, UserProgress>
  >({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1️⃣ Watch for Auth state (get current user)
    if (!auth) {
      setLoading(false);
      router.push("/login");
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }
      // Set the authenticated user
      setUser({
        id: currentUser.uid,
        email: currentUser.email || "",
        displayName: currentUser.displayName || "",
        photoURL: currentUser.photoURL || "",
        createdAt: currentUser.metadata.creationTime
          ? new Date(currentUser.metadata.creationTime)
          : new Date(),
        lastLoginAt: currentUser.metadata.lastSignInTime
          ? new Date(currentUser.metadata.lastSignInTime)
          : new Date(),
        isAdmin: await isAdminUser(currentUser.uid).then((isAdmin) => {
          return isAdmin;
        }),
      });
      // 2️⃣ Fetch available modules
      const fetchedModules = await getPublicModules();

      // 3️⃣ Fetch progress for each module
      const progressMap: Record<string, UserProgress> = {};
      for (const mod of fetchedModules) {
        const progress = await getUserProgress(currentUser.uid, mod.id);
        if (progress) {
          progressMap[mod.id] = progress;
        }
      }
      setModules(fetchedModules);
      setProgressData(progressMap);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          backgroundColor: "#f9fafb",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // ===== Overall progress calculation (weighted by step counts) =====
  const totalCompleted = modules.reduce((sum, mod) => {
    const progress = progressData[mod.id];
    return sum + (progress?.completedStepIds.length || 0);
  }, 0);
  const totalSteps = modules.reduce(
    (sum, mod) => sum + (mod.stepCount || 0),
    0
  );
  const overallPercent =
    totalSteps > 0 ? Math.round((totalCompleted / totalSteps) * 100) : 0;

  const completedModulesCount = modules.filter((m) => {
    const p = progressData[m.id];
    return (p?.completedStepIds.length || 0) >= (m.stepCount || 0);
  }).length;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="shadow-lg rounded-2xl p-10 max-w-2xl w-full" style={{ background: "linear-gradient(to bottom, white 0%, white 20%, #d5eaff 100%)" }}>
        {/* HEADER */}
        <SectionHeader
          title="Your Profile"
          subtitle="Your learning journey across Parr Center modules"
        />

        {/* USER INFO */}
        {user && (
          <div className="border border-gray-200 rounded-xl p-6 mb-8">
            <div className="flex items-center mb-4">
              <Image
                src={user.photoURL ? user.photoURL : ""}
                alt={user.displayName}
                width={64}
                height={64}
                className="w-16 h-16 rounded-full mr-4 border border-gray-300"
              />
              <div className="text-left">
                <h2 className="text-2xl font-semibold text-gray-800">
                  {user.displayName}{" "}
                  {user.isAdmin && (
                    <span className="text-sm font-medium text-white bg-blue-600 px-2 py-1 rounded-lg ml-2">
                      Admin
                    </span>
                  )}
                </h2>
                <p className="text-gray-600">{user.email}</p>
              </div>
            </div>

            <div className="text-left space-y-2 text-sm">
              <p>
                <span className="font-medium text-gray-700">User ID:</span>{" "}
                {user.id}
              </p>
              <p>
                <span className="font-medium text-gray-700">Joined:</span>{" "}
                {(user.createdAt instanceof Date
                  ? user.createdAt
                  : user.createdAt.toDate()
                ).toLocaleDateString()}
              </p>
              <p>
                <span className="font-medium text-gray-700">Last Login:</span>{" "}
                {(user.lastLoginAt instanceof Date
                  ? user.lastLoginAt
                  : user.lastLoginAt.toDate()
                ).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}

        {/* MODULE PROGRESS */}
        <Box>
          <Box
            component="h2"
            sx={{ fontSize: "1.5rem", fontWeight: 600, mb: 2 }}
          >
            Module Progress
          </Box>

          {modules.length > 0 && (
            <OverallProgressBar
              value={overallPercent}
              label="Overall Progress"
              totalCompleted={totalCompleted}
              totalSteps={totalSteps}
              completedModulesCount={completedModulesCount}
              totalModulesCount={modules.length}
            />
          )}

          <div className="max-h-[60vh] overflow-y-auto mt-4">
            <ModuleProgressList
              modules={modules}
              progressData={progressData}
              quizzesLeftCalculator={(moduleId, completedSteps, totalSteps) =>
                Math.max(0, totalSteps - completedSteps)
              }
            />
          </div>
        </Box>

        {/* FOOTER BUTTONS */}
        <div className="text-center mt-10 flex flex-col md:flex-row items-center justify-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="bg-carolina-blue hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors duration-200"
          >
            ← Back to Home
          </button>

          <button
            onClick={() => {
              if (!auth) {
                router.push("/login");
                return;
              }
              signOut(auth)
                .then(() => {
                  router.push("/login");
                })
                .catch((error) => {
                  console.error("❌ Error signing out:", error);
                });
            }}
            className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-lg font-medium transition-colors duration-200"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
