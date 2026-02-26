"use client";
import { ReactNode, useEffect, useRef, useState } from "react";
import { getUserRole } from "@/lib/firebase/Authentication/GetUserRole/index";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "@/lib/firebase/firebaseConfig";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

type AuthGateProps = {
  children: ReactNode;
  requireAdmin?: boolean;
  redirectRoute?: boolean;
  adminPath?: string;
  studentPath?: string;
};

/**
 * Redeidrects to login if user is not loggedin
 * If user is admin then allows access to /admin otherwise to student
 **/
export default function AuthGate({
  children,
  requireAdmin,
  redirectRoute = false,
  adminPath = "/admin",
  studentPath = "/homepage",
}: AuthGateProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const navigating = useRef(false);

  useEffect(() => {
    if (!app) {
      console.error(
        "Firebase app not initialized. Check environment variables.",
      );
      router.replace("/login");
      return;
    }

    const auth = getAuth(app);

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (navigating.current) return;
      try {
        //Not loggedin
        if (!user) {
          navigating.current = true;
          router.replace("/login");
          return;
        }

        const isAdmin = await getUserRole(user.uid);

        //Makes sure that admin screen doesn't flash on direct route to /admin and
        if (requireAdmin) {
          if (isAdmin) {
            setReady(true);
            return;
          } else {
            navigating.current = true;
            router.replace(studentPath);
            return;
          }
        }

        navigating.current = true;
        if (redirectRoute) {
          router.replace(isAdmin ? adminPath : studentPath);
        }
        setReady(true);
      } catch (error) {
        navigating.current = true;
        router.replace("/login");
      }
    });

    return () => unsub();
  }, [router, requireAdmin]);

  if (!ready) {
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
  return <>{children}</>;
}
