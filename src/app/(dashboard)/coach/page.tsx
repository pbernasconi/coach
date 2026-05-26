'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';

export default function CoachPage() {
  const router = useRouter();
  const { isLoaded } = useUser();
  const { data: sessions } = trpc.chat.getSessions.useQuery(undefined, {
    enabled: isLoaded,
  });
  const createSessionMutation = trpc.chat.createSession.useMutation();
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || hasRedirectedRef.current) return;

    if (sessions && sessions.length > 0) {
      // Redirect to most recent session
      hasRedirectedRef.current = true;
      router.replace(`/coach/${sessions[0].id}`);
    } else if (sessions && sessions.length === 0 && !createSessionMutation.isPending) {
      // Create new session and redirect
      hasRedirectedRef.current = true;
      createSessionMutation.mutate(
        { title: 'New Chat' },
        {
          onSuccess: (newSession) => {
            router.replace(`/coach/${newSession.id}`);
          },
        }
      );
    }
  }, [sessions, isLoaded, router, createSessionMutation]);

  return (
    <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
      <p>Loading chat...</p>
    </div>
  );
}
