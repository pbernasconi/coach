'use client';

import { useState, useRef, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useParams, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ChatSidebar } from '@/components/chat-sidebar';
import { MemoizedMarkdown } from '@/components/markdown';
import type { ChatMessage } from '@/modules/chat/chat-types';

export default function ChatPage() {
  const { isLoaded, user } = useUser();
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch messages for current session
  const { data: sessionData, isError } = trpc.chat.getSession.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  // Redirect to new session if invalid ID
  const createSessionMutation = trpc.chat.createSession.useMutation();
  const hasHandledErrorRef = useRef(false);

  useEffect(() => {
    if (isError && isLoaded && !hasHandledErrorRef.current && !createSessionMutation.isPending) {
      // Session doesn't exist, create a new one
      hasHandledErrorRef.current = true;
      createSessionMutation.mutate(
        { title: 'New Chat' },
        {
          onSuccess: (newSession) => {
            router.replace(`/coach/${newSession.id}`);
          },
        }
      );
    }
  }, [isError, isLoaded, createSessionMutation, router]);

  useEffect(() => {
    if (sessionData?.messages) {
      setMessages(sessionData.messages);
    }
  }, [sessionData]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Keep input focused at all times
  useEffect(() => {
    const focusInput = () => {
      if (inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }
    };

    // Focus immediately
    focusInput();

    // Re-focus after any message changes
    const timer = setTimeout(focusInput, 100);

    return () => clearTimeout(timer);
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || !sessionId || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Optimistically add user message
    const optimisticUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      sessionId,
      role: 'user',
      content: userMessage,
      contextData: null,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, optimisticUserMessage]);

    try {
      // Call streaming API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      // Read streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      let assistantMessage = '';
      const assistantMessageId = `temp-assistant-${Date.now()}`;

      // Add empty assistant message
      const optimisticAssistantMessage: ChatMessage = {
        id: assistantMessageId,
        sessionId,
        role: 'assistant',
        content: '',
        contextData: null,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, optimisticAssistantMessage]);

      // Stream response (handling data stream format from AI SDK)
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);

        // Parse data stream format (e.g., "0:"text"\n")
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('0:')) {
            try {
              // Extract the JSON string
              const jsonStr = line.slice(2);
              const text = JSON.parse(jsonStr);
              assistantMessage += text;
            } catch (e) {
              // If parsing fails, just append the raw text
              assistantMessage += line.slice(2);
            }
          }
        }

        // Update message in place
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId ? { ...msg, content: assistantMessage } : msg
          )
        );
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove optimistic messages on error
      setMessages((prev) => prev.filter((msg) => !msg.id.startsWith('temp-')));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0">
      {/* Sidebar */}
      <div className="w-64 shrink-0">
        <ChatSidebar currentSessionId={sessionId} currentSessionHasMessages={messages.length > 0} />
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-3 border-b bg-white shrink-0">
          <h1 className="text-xl font-bold">AI Coach</h1>
          <p className="text-xs text-gray-600">
            Personalized training advice
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white min-h-0">
          {messages.length === 0 && (
            <Card className="p-4 text-center">
              <h2 className="text-base font-semibold mb-1">Welcome to your AI Coach!</h2>
              <p className="text-sm text-gray-600">
                Ask me anything about your training, workouts, or race preparation. I can see your
                recent Strava activities and calendar events to give you personalized advice.
              </p>
            </Card>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <Card
                className={`max-w-[75%] p-3 ${
                  message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100'
                }`}
              >
                {message.role === 'assistant' && message.content === '' ? (
                  <div className="flex items-center gap-1 py-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                ) : (
                  <>
                    <div className="text-sm prose prose-sm max-w-none">
                      {message.role === 'assistant' ? (
                        <MemoizedMarkdown content={message.content} id={message.id} />
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>
                    <p className="text-xs mt-1 opacity-70">
                      {message.createdAt.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </>
                )}
              </Card>
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>

        <Separator />

        {/* Input */}
        <div className="p-3 border-t bg-white shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask your coach anything..."
              className="flex-1 resize-none border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-24"
              rows={2}
              disabled={!sessionId}
              autoFocus
            />
            <Button
              onClick={handleSend}
              disabled={isLoading || !input.trim() || !sessionId}
              className="shrink-0 h-9"
              size="sm"
            >
              {isLoading ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
