'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { MessageSquare, Plus, Trash2 } from 'lucide-react';

interface ChatSidebarProps {
  currentSessionId?: string;
  currentSessionHasMessages?: boolean;
}

export function ChatSidebar({ currentSessionId, currentSessionHasMessages = false }: ChatSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: sessions, refetch } = trpc.chat.getSessions.useQuery();
  const createSessionMutation = trpc.chat.createSession.useMutation();
  const deleteSessionMutation = trpc.chat.deleteSession.useMutation();

  const handleNewChat = async () => {
    // If current session has no messages, just stay on it
    if (!currentSessionHasMessages && currentSessionId) {
      return;
    }

    try {
      const newSession = await createSessionMutation.mutateAsync({
        title: 'New Chat',
      });
      router.push(`/coach/${newSession.id}`);
      refetch();
    } catch (error) {
      console.error('Failed to create new chat:', error);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm('Are you sure you want to delete this chat?')) {
      return;
    }

    try {
      setDeletingId(sessionId);
      await deleteSessionMutation.mutateAsync({ sessionId });

      // If we deleted the current session, navigate to a new one
      if (sessionId === currentSessionId) {
        const remainingSessions = sessions?.filter((s) => s.id !== sessionId);
        if (remainingSessions && remainingSessions.length > 0) {
          router.push(`/coach/${remainingSessions[0].id}`);
        } else {
          // Create a new session if no sessions remain
          const newSession = await createSessionMutation.mutateAsync({
            title: 'New Chat',
          });
          router.push(`/coach/${newSession.id}`);
        }
      }

      refetch();
    } catch (error) {
      console.error('Failed to delete session:', error);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 border-r">
      {/* Header */}
      <div className="p-4">
        <Button
          onClick={handleNewChat}
          className="w-full"
          disabled={createSessionMutation.isPending || (!currentSessionHasMessages && !!currentSessionId)}
          title={!currentSessionHasMessages && currentSessionId ? 'Send a message first' : 'Create new chat'}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      <Separator />

      {/* Session List */}
      <div className="flex-1 overflow-y-auto p-2">
        {!sessions || sessions.length === 0 ? (
          <div className="text-center text-gray-500 text-sm p-4">
            No chats yet. Start a new conversation!
          </div>
        ) : (
          <div className="space-y-1">
            {sessions.map((session) => {
              const isActive = session.id === currentSessionId;
              const isDeleting = deletingId === session.id;

              return (
                <Link
                  key={session.id}
                  href={`/coach/${session.id}`}
                  className={`block group`}
                >
                  <Card
                    className={`p-3 cursor-pointer transition-colors hover:bg-gray-100 ${
                      isActive ? 'bg-blue-50 border-blue-300' : ''
                    } ${isDeleting ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <MessageSquare className="w-4 h-4 mt-0.5 shrink-0 text-gray-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {session.title || 'New Chat'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(session.lastMessageAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        disabled={isDeleting}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-opacity"
                        title="Delete chat"
                      >
                        <Trash2 className="w-3 h-3 text-red-600" />
                      </button>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
