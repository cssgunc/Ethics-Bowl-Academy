"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Force dynamic rendering to prevent static generation issues with Firebase Auth
export const dynamic = 'force-dynamic';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/homepage");
  }, [router]);

  return null;
}
