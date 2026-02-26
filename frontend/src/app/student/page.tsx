"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import ModuleContentMUI from "@/components/ModuleContentMUI";
import AuthGate from "@/components/AuthGate";
import { auth } from "../../lib/firebase/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";

// Force dynamic rendering to prevent static generation issues with Firebase Auth
export const dynamic = "force-dynamic";

export default function StudentPage() {
  /**
   * SELECTED MODULE STATE
   *
   * Tracks which module is currently selected in the student portal
   */
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [index, setIndex] = useState<number>(0);
  const [userId, setUserId] = useState<string>("");

  // Listener that waits for firebase to check if user is in session
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <div>
      <AuthGate>
        {
          // ===== STUDENT PORTAL VIEW =====
          // This is the student-facing learning portal with module content
          //ProtectedRoute route will redirect to /login if user is not authenticated
          <div
            className="flex flex-col relative overflow-hidden"
            style={{
              background:
                "linear-gradient(to bottom, white 0%, white 15%, rgba(255, 255, 255, 0.95) 20%, rgba(255, 255, 255, 0.8) 30%, rgba(255, 255, 255, 0.5) 50%, #abd8ff 100%)",
            }}
          >
            {/* Background pattern with natural fade at edges - more visible */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `radial-gradient(circle at 2px 2px, rgba(171, 216, 255, 0.7) 2px, transparent 0)`,
                backgroundSize: "30px 30px",
                maskImage:
                  "radial-gradient(ellipse 100% 100% at center, black 40%, rgba(0, 0, 0, 0.8) 50%, rgba(0, 0, 0, 0.4) 65%, rgba(0, 0, 0, 0.1) 80%, transparent 100%)",
                WebkitMaskImage:
                  "radial-gradient(ellipse 100% 100% at center, black 40%, rgba(0, 0, 0, 0.8) 50%, rgba(0, 0, 0, 0.4) 65%, rgba(0, 0, 0, 0.1) 80%, transparent 100%)",
              }}
            />
            {/* Background accent shapes - hidden on mobile */}
            <div
              className="hidden md:block absolute top-20 right-10 w-96 h-96 bg-blue-300 rounded-full opacity-35 blur-3xl animate-pulse"
              style={{ animationDuration: "4s" }}
            ></div>
            <div
              className="hidden md:block absolute bottom-20 left-10 w-80 h-80 bg-blue-400 rounded-full opacity-30 blur-3xl animate-pulse"
              style={{ animationDuration: "6s", animationDelay: "1s" }}
            ></div>
            <div
              className="hidden md:block absolute top-1/2 right-1/4 w-64 h-64 bg-blue-200 rounded-full opacity-25 blur-3xl animate-pulse"
              style={{ animationDuration: "5s", animationDelay: "2s" }}
            ></div>

            <div className="flex flex-col md:flex-row flex-1 relative z-10 pt-0 md:pt-6 pl-0 md:pl-6 pb-0 md:pb-6">
              <Sidebar
                selectedModule={selectedModule}
                onSelect={setSelectedModule}
                onSelectIndex={setIndex}
              />
              <main className="flex-1 overflow-auto">
                <div className="">
                  <ModuleContentMUI
                    moduleId={selectedModule}
                    index={index}
                    userId={userId}
                  />
                </div>
              </main>
            </div>
          </div>
        }
      </AuthGate>
    </div>
  );
}
