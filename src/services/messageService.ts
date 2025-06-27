import { db } from '../db';
import { messages, projects, type Message, type NewMessage } from '../db/project_schema';
import { eq } from 'drizzle-orm';

class MessageService {
  async createMessage(messageData: NewMessage): Promise<Message> {
    try {
      const newMessage = await db
        .insert(messages)
        .values(messageData)
        .returning();

      // Update project's lastMessageAt
      await db
        .update(projects)
        .set({ 
          lastMessageAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(projects.id, messageData.projectId));

      return newMessage[0];
    } catch (error) {
      console.error('Error creating message:', error);
      throw error;
    }
  }

  async getMessagesByProjectId(projectId: number): Promise<Message[]> {
    try {
      const projectMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.projectId, projectId))
        .orderBy(messages.createdAt);

      return projectMessages;
    } catch (error) {
      console.error('Error getting messages:', error);
      throw error;
    }
  }

  async deleteMessagesByProjectId(projectId: number): Promise<boolean> {
    try {
      await db
        .delete(messages)
        .where(eq(messages.projectId, projectId));

      return true;
    } catch (error) {
      console.error('Error deleting messages:', error);
      throw error;
    }
  }
}

export default new MessageService();