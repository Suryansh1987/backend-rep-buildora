import { db } from '../db';
import { sql } from 'drizzle-orm';
import { projects, type Project } from '../db/project_schema';
import { 
  ciMessages, 
  conversationStats,
  type CIMessage, 
  type NewCIMessage,
  type ConversationStats 
} from '../db/message_schema';
import { eq, desc, and } from 'drizzle-orm';

// Legacy support - if you still have messages table in project schema
// import { messages, type Message, type NewMessage } from '../db/project_schema';

interface CreateMessageData {
  projectId: number;
  sessionId?: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: any;
}

interface MessageResponse {
  id: string;
  projectId: number | null;
  sessionId: string;
  content: string;
  role: 'user' | 'assistant';
  metadata?: any;
  createdAt: Date;
}

class MessageService {
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a message using the new CI schema
   */
  async createMessage(messageData: CreateMessageData): Promise<MessageResponse> {
    try {
      // Generate session ID if not provided
      const sessionId = messageData.sessionId || this.generateSessionId();

      // Ensure session stats exist
      await this.ensureSessionStats(sessionId, messageData.projectId);

      // Create message in CI schema
      const newCIMessage: NewCIMessage = {
        sessionId,
        projectId: messageData.projectId,
        content: messageData.content,
        messageType: messageData.role,
        reasoning: messageData.metadata ? JSON.stringify(messageData.metadata) : null,
        createdAt: new Date()
      };

      const [createdMessage] = await db
        .insert(ciMessages)
        .values(newCIMessage)
        .returning();

      // Update project's lastMessageAt and messageCount
 await db
  .update(projects)
  .set({ 
    lastMessageAt: new Date(),
    lastSessionId: sessionId,
    messageCount: sql`${projects.messageCount} + 1`,
    updatedAt: new Date()
  })
  .where(eq(projects.id, messageData.projectId));

      // Update session stats
      await this.updateSessionStats(sessionId);

      // Return formatted response
      return {
        id: createdMessage.id,
        projectId: createdMessage.projectId,
        sessionId: createdMessage.sessionId,
        content: createdMessage.content,
        role: createdMessage.messageType as 'user' | 'assistant',
        metadata: createdMessage.reasoning ? JSON.parse(createdMessage.reasoning) : undefined,
        createdAt: createdMessage.createdAt!
      };
    } catch (error) {
      console.error('Error creating message:', error);
      throw error;
    }
  }

  /**
   * Get messages by project ID (from all sessions)
   */
  async getMessagesByProjectId(projectId: number): Promise<MessageResponse[]> {
    try {
      const projectMessages = await db
        .select()
        .from(ciMessages)
        .where(eq(ciMessages.projectId, projectId))
        .orderBy(ciMessages.createdAt);

      return projectMessages.map(msg => ({
        id: msg.id,
        projectId: msg.projectId,
        sessionId: msg.sessionId,
        content: msg.content,
        role: msg.messageType as 'user' | 'assistant',
        metadata: msg.reasoning ? JSON.parse(msg.reasoning) : undefined,
        createdAt: msg.createdAt!
      }));
    } catch (error) {
      console.error('Error getting messages by project ID:', error);
      throw error;
    }
  }

  /**
   * Get messages by session ID
   */
  async getMessagesBySessionId(sessionId: string): Promise<MessageResponse[]> {
    try {
      const sessionMessages = await db
        .select()
        .from(ciMessages)
        .where(eq(ciMessages.sessionId, sessionId))
        .orderBy(ciMessages.createdAt);

      return sessionMessages.map(msg => ({
        id: msg.id,
        projectId: msg.projectId,
        sessionId: msg.sessionId,
        content: msg.content,
        role: msg.messageType as 'user' | 'assistant',
        metadata: msg.reasoning ? JSON.parse(msg.reasoning) : undefined,
        createdAt: msg.createdAt!
      }));
    } catch (error) {
      console.error('Error getting messages by session ID:', error);
      throw error;
    }
  }

  /**
   * Get messages by project ID and session ID
   */
  async getMessagesByProjectAndSession(projectId: number, sessionId: string): Promise<MessageResponse[]> {
    try {
      const messages = await db
        .select()
        .from(ciMessages)
        .where(and(
          eq(ciMessages.projectId, projectId),
          eq(ciMessages.sessionId, sessionId)
        ))
        .orderBy(ciMessages.createdAt);

      return messages.map(msg => ({
        id: msg.id,
        projectId: msg.projectId,
        sessionId: msg.sessionId,
        content: msg.content,
        role: msg.messageType as 'user' | 'assistant',
        metadata: msg.reasoning ? JSON.parse(msg.reasoning) : undefined,
        createdAt: msg.createdAt!
      }));
    } catch (error) {
      console.error('Error getting messages by project and session:', error);
      throw error;
    }
  }

  /**
   * Get recent messages for a project (latest session)
   */
  async getRecentMessagesByProjectId(projectId: number, limit: number = 10): Promise<MessageResponse[]> {
    try {
      const messages = await db
        .select()
        .from(ciMessages)
        .where(eq(ciMessages.projectId, projectId))
        .orderBy(desc(ciMessages.createdAt))
        .limit(limit);

      return messages.reverse().map(msg => ({
        id: msg.id,
        projectId: msg.projectId,
        sessionId: msg.sessionId,
        content: msg.content,
        role: msg.messageType as 'user' | 'assistant',
        metadata: msg.reasoning ? JSON.parse(msg.reasoning) : undefined,
        createdAt: msg.createdAt!
      }));
    } catch (error) {
      console.error('Error getting recent messages:', error);
      throw error;
    }
  }

  /**
   * Delete messages by project ID (all sessions)
   */
  async deleteMessagesByProjectId(projectId: number): Promise<boolean> {
    try {
      // Delete all messages for the project
      await db
        .delete(ciMessages)
        .where(eq(ciMessages.projectId, projectId));

      // Reset project message count
      await db
        .update(projects)
        .set({ 
          messageCount: 0,
          lastMessageAt: null,
          lastSessionId: null,
          updatedAt: new Date()
        })
        .where(eq(projects.id, projectId));

      return true;
    } catch (error) {
      console.error('Error deleting messages by project ID:', error);
      throw error;
    }
  }

  /**
   * Delete messages by session ID
   */
  async deleteMessagesBySessionId(sessionId: string): Promise<boolean> {
    try {
      await db
        .delete(ciMessages)
        .where(eq(ciMessages.sessionId, sessionId));

      // Delete session stats
      await db
        .delete(conversationStats)
        .where(eq(conversationStats.sessionId, sessionId));

      return true;
    } catch (error) {
      console.error('Error deleting messages by session ID:', error);
      throw error;
    }
  }

  /**
   * Get session information for a project
   */
  async getProjectSessions(projectId: number): Promise<Array<{
    sessionId: string;
    messageCount: number;
    lastActivity: Date;
    isActive: boolean;
  }>> {
    try {
      const sessions = await db
        .select()
        .from(conversationStats)
        .where(and(
          eq(conversationStats.projectId, projectId),
          eq(conversationStats.isActive, true)
        ))
        .orderBy(desc(conversationStats.lastActivity));

     return sessions.map(session => ({
  sessionId: session.sessionId,
  messageCount: session.totalMessageCount ?? 0,
  lastActivity: session.lastActivity || session.createdAt!,
  isActive: session.isActive ?? false
}));

    } catch (error) {
      console.error('Error getting project sessions:', error);
      return [];
    }
  }

  /**
   * Get message count for a project
   */
  async getProjectMessageCount(projectId: number): Promise<number> {
    try {
      const result = await db
        .select({ count: ciMessages.id })
        .from(ciMessages)
        .where(eq(ciMessages.projectId, projectId));

      return result.length;
    } catch (error) {
      console.error('Error getting project message count:', error);
      return 0;
    }
  }

  /**
   * Get message count for a session
   */
  async getSessionMessageCount(sessionId: string): Promise<number> {
    try {
      const result = await db
        .select({ count: ciMessages.id })
        .from(ciMessages)
        .where(eq(ciMessages.sessionId, sessionId));

      return result.length;
    } catch (error) {
      console.error('Error getting session message count:', error);
      return 0;
    }
  }

  /**
   * Create a new session for a project
   */
  async createSession(projectId: number): Promise<string> {
    const sessionId = this.generateSessionId();
    await this.ensureSessionStats(sessionId, projectId);
    return sessionId;
  }

  /**
   * Get active session for a project (latest session with activity)
   */
  async getActiveProjectSession(projectId: number): Promise<string | null> {
    try {
      const sessions = await db
        .select()
        .from(conversationStats)
        .where(and(
          eq(conversationStats.projectId, projectId),
          eq(conversationStats.isActive, true)
        ))
        .orderBy(desc(conversationStats.lastActivity))
        .limit(1);

      return sessions.length > 0 ? sessions[0].sessionId : null;
    } catch (error) {
      console.error('Error getting active project session:', error);
      return null;
    }
  }

  // Private helper methods

  private async ensureSessionStats(sessionId: string, projectId: number): Promise<void> {
    try {
      const existing = await db
        .select()
        .from(conversationStats)
        .where(eq(conversationStats.sessionId, sessionId));

      if (existing.length === 0) {
        await db
          .insert(conversationStats)
          .values({
            sessionId,
            projectId,
            totalMessageCount: 0,
            summaryCount: 0,
            isActive: true,
            startedAt: new Date(),
            lastActivity: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          });
      }
    } catch (error) {
      console.error('Error ensuring session stats:', error);
    }
  }

  private async updateSessionStats(sessionId: string): Promise<void> {
    try {
      await db
  .update(conversationStats)
  .set({
    totalMessageCount: sql`${conversationStats.totalMessageCount} + 1`,
    lastActivity: new Date(),
    updatedAt: new Date()
  })
  .where(eq(conversationStats.sessionId, sessionId));
    } catch (error) {
      console.error('Error updating session stats:', error);
    }
  }

  // Legacy compatibility methods (if you need to maintain backward compatibility)

  /**
   * @deprecated Use createMessage with explicit session management
   * Legacy method for backward compatibility
   */
  async createLegacyMessage(messageData: {
    projectId: number;
    role: 'user' | 'assistant';
    content: string;
    metadata?: any;
  }): Promise<MessageResponse> {
    console.warn('⚠️ Using deprecated createLegacyMessage - consider upgrading to session-based createMessage');
    
    // Get or create active session for project
    let sessionId = await this.getActiveProjectSession(messageData.projectId);
    if (!sessionId) {
      sessionId = await this.createSession(messageData.projectId);
    }

    return this.createMessage({
      ...messageData,
      sessionId
    });
  }

  /**
   * Get conversation context for a project (combines recent messages)
   */
  async getProjectConversationContext(projectId: number): Promise<string> {
    try {
      const recentMessages = await this.getRecentMessagesByProjectId(projectId, 10);
      
      if (recentMessages.length === 0) {
        return '';
      }

      let context = '**RECENT CONVERSATION:**\n';
      recentMessages.forEach((msg, index) => {
        context += `${index + 1}. [${msg.role.toUpperCase()}]: ${msg.content}\n`;
      });

      return context;
    } catch (error) {
      console.error('Error getting project conversation context:', error);
      return '';
    }
  }
}

export default new MessageService();