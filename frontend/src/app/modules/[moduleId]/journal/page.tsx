'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';

export default function ModuleJournalPage({
  params
}: {
  params: Promise<{ moduleId: string }>
}) {
  const router = useRouter();

  useEffect(() => {
    // Redirect to global journal page
    router.push('/journal');
  }, [router]);

  return null;
}
