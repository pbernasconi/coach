/**
 * Chat Persister
 * Database operations for chat sessions and messages
 */

import { db } from '@/db';
import { chatSessions, chatMessages, type ChatSession, type ChatMessage, type NewChatSession, type NewChatMessage } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';

/**
 * Chat Session Persister
 */
export namespace ChatSessionPersister {
  /**
   * Create a new chat session
   */
  export async function create(input: Omit<NewChatSession, 'id' | 'createdAt' | 'updatedAt' | 'lastMessageAt'>): Promise<ChatSession> {
    const [session] = await db
      .insert(chatSessions)
      .values(input)
      .returning();
    return session;
  }

  /**
   * Get session by ID
   */
  export async function findById(sessionId: string): Promise<ChatSession | null> {
    const [session] = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.id, sessionId))
      .limit(1);
    return session ?? null;
  }

  /**
   * Get all sessions for a user
   */
  export async function findByUserId(userId: string): Promise<ChatSession[]> {
    return db
      .select()
      .from(chatSessions)
      .where(and(eq(chatSessions.userId, userId), eq(chatSessions.isActive, true)))
      .orderBy(desc(chatSessions.lastMessageAt));
  }

  /**
   * Update session title
   */
  export async function updateTitle(sessionId: string, title: string): Promise<ChatSession> {
    const [session] = await db
      .update(chatSessions)
      .set({ title, updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId))
      .returning();
    return session;
  }

  /**
   * Update last message timestamp
   */
  export async function updateLastMessageAt(sessionId: string): Promise<void> {
    await db
      .update(chatSessions)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId));
  }

  /**
   * Soft delete session
   */
  export async function deactivate(sessionId: string): Promise<void> {
    await db
      .update(chatSessions)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId));
  }

  /**
   * Hard delete session (will cascade to messages)
   */
  export async function deleteById(sessionId: string): Promise<void> {
    await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));
  }
}

/**
 * Chat Message Persister
 */
export namespace ChatMessagePersister {
  /**
   * Create a new message
   */
  export async function create(input: Omit<NewChatMessage, 'id' | 'createdAt'>): Promise<ChatMessage> {
    const [message] = await db
      .insert(chatMessages)
      .values(input)
      .returning();

    // Update session's last message timestamp
    await ChatSessionPersister.updateLastMessageAt(input.sessionId);

    return message;
  }

  /**
   * Get all messages for a session
   */
  export async function findBySessionId(sessionId: string): Promise<ChatMessage[]> {
    return db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.createdAt);
  }

  /**
   * Get recent messages for a session (for context)
   */
  export async function findRecentBySessionId(sessionId: string, limit: number = 10): Promise<ChatMessage[]> {
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    // Return in chronological order
    return messages.reverse();
  }

  /**
   * Delete message
   */
  export async function deleteById(messageId: string): Promise<void> {
    await db.delete(chatMessages).where(eq(chatMessages.id, messageId));
  }

  /**
   * Delete all messages in a session
   */
  export async function deleteBySessionId(sessionId: string): Promise<void> {
    await db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId));
  }
}
