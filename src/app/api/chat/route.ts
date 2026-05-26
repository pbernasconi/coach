/**
 * Chat API Route
 * Streaming endpoint for AI chat responses
 */

import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { auth } from '@clerk/nextjs/server';
import chatService from '@/modules/chat/chat-service';
import { buildSystemPrompt } from '@/modules/chat/chat-config';

export async function POST(req: Request) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { message, sessionId } = body;

    if (!message || !sessionId) {
      return new Response('Missing message or sessionId', { status: 400 });
    }

    // Verify the session belongs to this user before reading/writing anything.
    const { session } = await chatService.getSessionWithMessages(sessionId);
    if (session.userId !== userId) {
      return new Response('Forbidden', { status: 403 });
    }

    // Get context (recent activities, calendar events, goals)
    const context = await chatService.getContextForUser(userId);

    // Get recent conversation history
    const recentMessages = await chatService.getRecentMessages(sessionId, 10);

    // Save user message to database
    await chatService.saveUserMessage(sessionId, message, context);

    // Build conversation history for AI
    const messages = [
      ...recentMessages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      {
        role: 'user' as const,
        content: message,
      },
    ];

    // Build system prompt with context
    const systemPrompt = buildSystemPrompt() + chatService.formatContextForPrompt(context);

    // Stream AI response
    const result = streamText({
      model: openai('gpt-4o'),
      system: systemPrompt,
      messages,
      temperature: 0.7,
      onFinish: async ({ text }) => {
        // Save assistant response to database after streaming completes
        await chatService.saveAssistantMessage(sessionId, text, context);
      },
    });

    // Return streaming response using the proper method
    return result.toTextStreamResponse();
  } catch (error) {
    // Log details server-side; return a generic message to avoid leaking internals.
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
