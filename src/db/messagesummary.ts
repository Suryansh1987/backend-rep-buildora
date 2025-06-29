// db/Messagesummary.ts - Updated to use separate component integrator schema with ZIP URL support
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, desc, sql, and, like } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

// Import component integrator specific schema
import {
  ciMessages as messages,
  messageSummaries,
  conversationStats,
  projectSummaries,
  type CIMessage as Message,
  type NewCIMessage as NewMessage,
  type MessageSummary,
  type NewMessageSummary,
  type ConversationStats,
  type ProjectSummary,
  type NewProjectSummary
} from './message_schema';

// Import the modular file modifier with proper types
import { StatelessIntelligentFileModifier } from '../services/filemodifier';

// Updated interfaces to work with new modular system
interface ModificationResult {
  success: boolean;
  selectedFiles?: string[];
  approach?: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION';
  reasoning?: string;
  modifiedRanges?: Array<{
    file: string;
    range: {
      startLine: number;
      endLine: number;
      startColumn: number;
      endColumn: number;
      originalCode: string;
    };
    modifiedCode: string;
  }>;
  addedFiles?: string[];  // New component/page files
  createdFiles?: Array<{  // Legacy compatibility
    path: string;
    content: string;
    type: 'component' | 'page' | 'utility';
  }>;
  modificationSummary?: string;
  error?: string;
}

// Define modification record interface
interface ModificationRecord {
  prompt: string;
  result: ModificationResult;
  approach: string;
  filesModified: string[];
  filesCreated: string[];
  timestamp: string;
}

export class DrizzleMessageHistoryDB {
  private db: ReturnType<typeof drizzle>;
  private anthropic: Anthropic;

  constructor(databaseUrl: string, anthropic: Anthropic) {
    const sqlConnection = neon(databaseUrl);
    this.db = drizzle(sqlConnection);
    this.anthropic = anthropic;
  }

  /**
   * Save project summary to database with optional ZIP URL and buildId
   * Returns the ID of the newly created summary
   */
  async saveProjectSummary(
    summary: string, 
    prompt: string, 
    zipUrl?: string, 
    buildId?: string
  ): Promise<string | null> {
    try {
      // First, mark all existing summaries as inactive
      await this.db.update(projectSummaries)
        .set({ isActive: false })
        .where(eq(projectSummaries.isActive, true));
      
      // Insert the new project summary with ZIP URL and buildId
      const [newSummary] = await this.db.insert(projectSummaries)
        .values({
          summary,
          originalPrompt: prompt,
          zipUrl: zipUrl || null,
          buildId: buildId || null,
          isActive: true,
          createdAt: new Date(),
          lastUsedAt: new Date()
        })
        .returning({ id: projectSummaries.id });
      
      console.log(`💾 Saved new project summary with ZIP URL (${zipUrl}) and ID: ${newSummary?.id}`);
      
      // Return the ID of the new summary
      return newSummary?.id?.toString() || null;
    } catch (error) {
      console.error('Error saving project summary:', error);
      return null;
    }
  }

  /**
   * Update existing project summary with new ZIP URL and buildId
   */
  async updateProjectSummary(
    summaryId: string, 
    zipUrl: string, 
    buildId: string
  ): Promise<boolean> {
    try {
      await this.db.update(projectSummaries)
        .set({ 
          zipUrl: zipUrl,
          buildId: buildId,
          lastUsedAt: new Date()
        })
        .where(eq(projectSummaries.id, summaryId));
      
      console.log(`💾 Updated project summary ${summaryId} with new ZIP URL: ${zipUrl}`);
      return true;
    } catch (error) {
      console.error('Error updating project summary:', error);
      return false;
    }
  }

  /**
   * Get the active project summary with ZIP URL and buildId
   */
  async getActiveProjectSummary(): Promise<{ 
    id: string; 
    summary: string; 
    zipUrl?: string; 
    buildId?: string; 
  } | null> {
    try {
      const result = await this.db.select({
        id: projectSummaries.id,
        summary: projectSummaries.summary,
        zipUrl: projectSummaries.zipUrl,
        buildId: projectSummaries.buildId
      })
      .from(projectSummaries)
      .where(eq(projectSummaries.isActive, true))
      .limit(1);
      
      if (result.length === 0) {
        console.log('No active project summary found');
        return null;
      }
      
      // Update last used time
      await this.db.update(projectSummaries)
        .set({ lastUsedAt: new Date() })
        .where(eq(projectSummaries.id, result[0].id));
      
      console.log(`📂 Retrieved active project summary (ID: ${result[0].id})`);
      
      return {
        id: result[0].id.toString(),
        summary: result[0].summary,
        zipUrl: result[0].zipUrl || undefined,
        buildId: result[0].buildId || undefined
      };
    } catch (error) {
      console.error('Error getting active project summary:', error);
      return null;
    }
  }

  /**
   * Get project summary for scope analysis
   */
  async getProjectSummaryForScope(): Promise<string | null> {
    try {
      const activeSummary = await this.getActiveProjectSummary();
      
      if (!activeSummary) {
        console.log('No active project summary found for scope analysis');
        return null;
      }
      
      console.log(`🔍 Retrieved project summary (ID: ${activeSummary.id}) for scope analysis`);
      return activeSummary.summary;
    } catch (error) {
      console.error('Error retrieving project summary for scope analysis:', error);
      return null;
    }
  }

  /**
   * Override the getEnhancedContext method to include project summary
   */
  async getEnhancedContext(): Promise<string> {
    // Get the original conversation context
    const conversationContext = await this.getConversationContext();
    
    // Get project summary if available
    let projectSummaryContext = '';
    try {
      const projectSummary = await this.getProjectSummaryForScope();
      if (projectSummary) {
        projectSummaryContext = `\n\n**PROJECT SUMMARY:**\n${projectSummary}`;
      }
    } catch (error) {
      console.error('Error retrieving project summary for context:', error);
    }
    
    // Get recent modifications
    let modificationContext = '';
    try {
      const recentMods = await this.getRecentModifications(3);
      
      if (recentMods.length > 0) {
        modificationContext = '\n\n**RECENT MODIFICATIONS:**\n';
        recentMods.forEach((mod, index) => {
          modificationContext += `${index + 1}. ${mod.approach} modification:\n`;
          modificationContext += `   Request: "${mod.prompt}"\n`;
          if (mod.filesCreated.length > 0) {
            modificationContext += `   Created: ${mod.filesCreated.join(', ')}\n`;
          }
          if (mod.filesModified.length > 0) {
            modificationContext += `   Modified: ${mod.filesModified.join(', ')}\n`;
          }
          modificationContext += `   Success: ${mod.result.success}\n`;
          modificationContext += `   When: ${mod.timestamp}\n\n`;
        });
      }
    } catch (error) {
      console.error('Error retrieving modification history for context:', error);
    }
    
    // Combine all contexts
    return conversationContext + projectSummaryContext + modificationContext;
  }

  /**
   * Get all project summaries
   */
  async getAllProjectSummaries(): Promise<ProjectSummary[]> {
    try {
      const summaries = await this.db.select()
        .from(projectSummaries)
        .orderBy(desc(projectSummaries.lastUsedAt));
      
      return summaries;
    } catch (error) {
      console.error('Error retrieving all project summaries:', error);
      return [];
    }
  }

  /**
   * Delete a project summary by ID
   */
  async deleteProjectSummary(id: string): Promise<boolean> {
    try {
      await this.db.delete(projectSummaries)
        .where(eq(projectSummaries.id, id));
      
      console.log(`🗑️ Deleted project summary with ID: ${id}`);
      return true;
    } catch (error) {
      console.error(`Error deleting project summary ${id}:`, error);
      return false;
    }
  }

  async initializeStats(): Promise<void> {
    const existing = await this.db.select().from(conversationStats).where(eq(conversationStats.id, 1));
    
    if (existing.length === 0) {
      await this.db.insert(conversationStats).values({
        id: 1,
        totalMessageCount: 0,
        summaryCount: 0,
        lastMessageAt: null,
        updatedAt: new Date()
      });
    }
  }

  // Add a new message
  async addMessage(
    content: string,
    messageType: 'user' | 'assistant',
    metadata?: {
      fileModifications?: string[];
      modificationApproach?: 
        'FULL_FILE' 
        | 'TARGETED_NODES' 
        | 'COMPONENT_ADDITION' 
        | 'FULL_FILE_GENERATION' 
        | null;
      modificationSuccess?: boolean;
      createdFiles?: string[];
      addedFiles?: string[];
      duration?: number;
      projectSummaryId?: string;
      promptType?: string;
      requestType?: string;
      relatedUserMessageId?: string;
      success?: boolean;
      processingTimeMs?: number;
      tokenUsage?: any;
      responseLength?: number;
      buildId?: string;
      previewUrl?: string;
      downloadUrl?: string;
      zipUrl?: string;
    }
  ): Promise<string> {
    const newMessage: NewMessage = {
      content,
      messageType,
      fileModifications: metadata?.fileModifications || null,
      //@ts-ignore
      modificationApproach: metadata?.modificationApproach || null,
      modificationSuccess: metadata?.modificationSuccess || null,
      reasoning: JSON.stringify({
        promptType: metadata?.promptType,
        requestType: metadata?.requestType,
        relatedUserMessageId: metadata?.relatedUserMessageId,
        success: metadata?.success,
        processingTimeMs: metadata?.processingTimeMs,
        tokenUsage: metadata?.tokenUsage,
        responseLength: metadata?.responseLength,
        buildId: metadata?.buildId,
        previewUrl: metadata?.previewUrl,
        downloadUrl: metadata?.downloadUrl,
        zipUrl: metadata?.zipUrl,
        error: metadata?.success === false ? 'Generation failed' : undefined
      }),
      projectSummaryId: metadata?.projectSummaryId || null,
      createdAt: new Date()
    };

    const result = await this.db.insert(messages).values(newMessage).returning({ id: messages.id });
    const messageId = result[0].id;

    await this.db.update(conversationStats)
      .set({
        totalMessageCount: sql`${conversationStats.totalMessageCount} + 1`,
        lastMessageAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(conversationStats.id, 1));

    await this.maintainRecentMessages();

    return messageId;
  }

  /**
   * Save modification details for future context
   */
  async saveModification(modification: ModificationRecord): Promise<void> {
    try {
      // Generate a detailed modification summary
      const summary = this.generateModificationSummary(modification);
      
      // Save as a system message with detailed metadata
      await this.addMessage(
        summary,
        'assistant',
        {
          fileModifications: modification.filesModified,
          modificationApproach: modification.approach as 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION',
          modificationSuccess: modification.result.success,
          createdFiles: modification.filesCreated,
          addedFiles: modification.result.addedFiles || []
        }
      );

      console.log('💾 Saved modification to conversation history');
    } catch (error) {
      console.error('Failed to save modification record:', error);
      throw error;
    }
  }

  /**
   * Generate a comprehensive modification summary
   */
  private generateModificationSummary(modification: ModificationRecord): string {
    const { prompt, approach, filesModified, filesCreated, result } = modification;
    
    let summary = `MODIFICATION COMPLETED:\n`;
    summary += `Request: "${prompt}"\n`;
    summary += `Approach: ${approach}\n`;
    summary += `Success: ${result.success}\n`;
    
    // Handle both addedFiles and createdFiles for compatibility
    const newFiles = result.addedFiles || result.createdFiles?.map(f => f.path) || filesCreated;
    if (newFiles.length > 0) {
      summary += `Created files:\n`;
      newFiles.forEach(file => {
        summary += `  - ${file}\n`;
      });
    }
    
    if (filesModified.length > 0) {
      summary += `Modified files:\n`;
      filesModified.forEach(file => {
        summary += `  - ${file}\n`;
      });
    }

    if (result.reasoning) {
      summary += `Reasoning: ${result.reasoning}\n`;
    }

    if (result.modificationSummary) {
      summary += `Summary: ${result.modificationSummary}\n`;
    }

    if (!result.success && result.error) {
      summary += `Error: ${result.error}\n`;
    }
    
    summary += `Timestamp: ${modification.timestamp}`;
    
    return summary;
  }

  /**
   * Get recent modifications for context
   */
  async getRecentModifications(limit: number = 5): Promise<ModificationRecord[]> {
    try {
      // Get recent modification messages
      const recentModifications = await this.db
        .select()
        .from(messages)
        .where(and(
          eq(messages.messageType, 'assistant'),
          like(messages.content, 'MODIFICATION COMPLETED:%')
        ))
        .orderBy(desc(messages.createdAt))
        .limit(limit);
      
      return recentModifications.map(msg => ({
        prompt: this.extractPromptFromSummary(msg.content),
        result: { success: msg.modificationSuccess || false },
        approach: msg.modificationApproach || 'UNKNOWN',
        filesModified: msg.fileModifications || [],
        filesCreated: [], // Would need to extend schema to store this separately
        timestamp: msg.createdAt!.toISOString()
      }));
    } catch (error) {
      console.error('Failed to get recent modifications:', error);
      return [];
    }
  }

  private extractPromptFromSummary(summary: string): string {
    const match = summary.match(/Request: "(.+?)"/);
    return match ? match[1] : 'Unknown request';
  }

  // Maintain only 5 recent messages, summarize older ones
  private async maintainRecentMessages(): Promise<void> {
    const allMessages = await this.db.select().from(messages).orderBy(desc(messages.createdAt));

    if (allMessages.length > 5) {
      const recentMessages = allMessages.slice(0, 5);
      const oldMessages = allMessages.slice(5);

      if (oldMessages.length > 0) {
        // Update the single growing summary instead of creating new ones
        await this.updateGrowingSummary(oldMessages);
      }

      // Delete old messages (keep only recent 5)
      const oldMessageIds = oldMessages.map(m => m.id);
      for (const id of oldMessageIds) {
        await this.db.delete(messages).where(eq(messages.id, id));
      }
    }
  }

  async fixConversationStats(): Promise<void> {
    try {
      // Count actual messages
      const allMessages = await this.db.select().from(messages);
      const messageCount = allMessages.length;
      
      // Count summaries
      const summaries = await this.db.select().from(messageSummaries);
      const summaryCount = summaries.length;
      
      // Get summary message count
      const latestSummary = summaries[0];
      const summarizedMessageCount = latestSummary?.messageCount || 0;
      
      // Calculate total messages
      const totalMessages = messageCount + summarizedMessageCount;
      
      // Update stats
      await this.db.update(conversationStats)
        .set({
          totalMessageCount: totalMessages,
          summaryCount: summaryCount > 0 ? 1 : 0, // Since we only keep one summary
          lastMessageAt: allMessages.length > 0 ? allMessages[allMessages.length - 1].createdAt : null,
          updatedAt: new Date()
        })
        .where(eq(conversationStats.id, 1));
        
      console.log(`✅ Fixed stats: ${totalMessages} total messages, ${summaryCount} summaries`);
    } catch (error) {
      console.error('Error fixing conversation stats:', error);
    }
  }

  private async updateGrowingSummary(newMessages: Message[]): Promise<void> {
    // Get the existing summary
    const existingSummaries = await this.db.select().from(messageSummaries).orderBy(desc(messageSummaries.createdAt)).limit(1);
    const existingSummary = existingSummaries[0];

    // Generate new content to add to summary
    const { summary: newContent } = await this.generateSummaryUpdate(newMessages, existingSummary?.summary);

    if (existingSummary) {
      // Update existing summary by appending new content
      await this.db.update(messageSummaries)
        .set({
          summary: newContent,
          messageCount: existingSummary.messageCount + newMessages.length,
          endTime: newMessages[0].createdAt!, // Most recent time
          //@ts-ignore
          updatedAt: new Date()
        })
        .where(eq(messageSummaries.id, existingSummary.id));
    } else {
      // Create first summary
      const newSummary: NewMessageSummary = {
        summary: newContent,
        messageCount: newMessages.length,
        startTime: newMessages[newMessages.length - 1].createdAt!, // Oldest
        endTime: newMessages[0].createdAt!, // Newest
        keyTopics: ['react', 'file-modification'],
        createdAt: new Date()
      };
      await this.db.insert(messageSummaries).values(newSummary);
    }

    // Update summary count in stats if this is the first summary
    if (!existingSummary) {
      await this.db.update(conversationStats)
        .set({
          summaryCount: 1,
          updatedAt: new Date()
        })
        .where(eq(conversationStats.id, 1));
    }
  }

  // Generate updated summary using Claude
  private async generateSummaryUpdate(newMessages: Message[], existingSummary?: string): Promise<{summary: string}> {
    const newMessagesText = newMessages.reverse().map(msg => {
      let text = `[${msg.messageType.toUpperCase()}]: ${msg.content}`;
      if (msg.fileModifications && msg.fileModifications.length > 0) {
        text += ` (Modified: ${msg.fileModifications.join(', ')})`;
      }
      return text;
    }).join('\n\n');

    const claudePrompt = existingSummary 
      ? `Update this existing conversation summary by incorporating the new messages:

**EXISTING SUMMARY:**
${existingSummary}

**NEW MESSAGES TO ADD:**
${newMessagesText}

**Instructions:**
- Merge the new information into the existing summary
- Keep the summary concise but comprehensive
- Focus on: what was built/modified, key changes made, approaches used, files affected
- Include component/page creation patterns and modification strategies
- Return only the updated summary text, no JSON`
      : `Create a concise summary of this React development conversation:

**MESSAGES:**
${newMessagesText}

**Instructions:**
- Focus on: what was built/modified, key changes made, approaches used, files affected
- Include component/page creation patterns and modification strategies
- Keep it concise but informative for future context
- Return only the summary text, no JSON`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 800,
        temperature: 0,
        messages: [{ role: 'user', content: claudePrompt }],
      });

      const firstBlock = response.content[0];
      if (firstBlock?.type === 'text') {
        return { summary: firstBlock.text.trim() };
      }
    } catch (error) {
      console.error('Error generating summary update:', error);
    }

    // Fallback
    const fallbackSummary = existingSummary 
      ? `${existingSummary}\n\nAdditional changes: React modifications (${newMessages.length} more messages)`
      : `React development conversation with file modifications (${newMessages.length} messages)`;
      
    return { summary: fallbackSummary };
  }

  // Get conversation context for file modification prompts
  async getConversationContext(): Promise<string> {
    // Get the single summary
    const summaries = await this.db.select().from(messageSummaries).orderBy(desc(messageSummaries.createdAt)).limit(1);
    
    // Get recent messages
    const recentMessages = await this.db.select().from(messages).orderBy(desc(messages.createdAt));

    let context = '';

    // Add the single growing summary
    if (summaries.length > 0) {
      const summary = summaries[0];
      context += `**CONVERSATION SUMMARY (${summary.messageCount} previous messages):**\n`;
      context += `${summary.summary}\n\n`;
    }

    // Add recent messages with enhanced formatting
    if (recentMessages.length > 0) {
      context += '**RECENT MESSAGES:**\n';
      recentMessages.reverse().forEach((msg, index) => {
        context += `${index + 1}. [${msg.messageType.toUpperCase()}]: ${msg.content}\n`;
        if (msg.fileModifications && msg.fileModifications.length > 0) {
          context += `   Modified: ${msg.fileModifications.join(', ')}\n`;
        }
        if (msg.modificationApproach) {
          context += `   Approach: ${msg.modificationApproach}\n`;
        }
        if (msg.modificationSuccess !== null) {
          context += `   Success: ${msg.modificationSuccess}\n`;
        }
      });
    }

    return context;
  }

  // Get recent conversation for display
  async getRecentConversation(): Promise<{
    messages: Message[];
    summaryCount: number;
    totalMessages: number;
  }> {
    // Get recent messages
    const recentMessages = await this.db.select().from(messages).orderBy(desc(messages.createdAt));

    // Get stats
    const stats = await this.db.select().from(conversationStats).where(eq(conversationStats.id, 1));
    const currentStats = stats[0] || { totalMessageCount: 0, summaryCount: 0 };

    return {
      messages: recentMessages,
      summaryCount: currentStats.summaryCount || 0,
      totalMessages: currentStats.totalMessageCount || 0
    };
  }

  // Get current summary for display
  async getCurrentSummary(): Promise<{summary: string; messageCount: number} | null> {
    const summaries = await this.db.select().from(messageSummaries).orderBy(desc(messageSummaries.createdAt)).limit(1);
    
    if (summaries.length > 0) {
      const summary = summaries[0];
      return {
        summary: summary.summary,
        messageCount: summary.messageCount
      };
    }
    
    return null;
  }

  // Get conversation stats
  async getConversationStats(): Promise<ConversationStats | null> {
    const stats = await this.db.select().from(conversationStats).where(eq(conversationStats.id, 1));
    return stats[0] || null;
  }

  // Get all summaries
  async getAllSummaries(): Promise<MessageSummary[]> {
    return await this.db.select().from(messageSummaries).orderBy(desc(messageSummaries.createdAt));
  }

  // Clear all conversation data (for testing/reset)
  async clearAllData(): Promise<void> {
    await this.db.delete(messages);
    await this.db.delete(messageSummaries);
    await this.db.delete(projectSummaries);
    await this.db.update(conversationStats)
      .set({
        totalMessageCount: 0,
        summaryCount: 0,
        lastMessageAt: null,
        updatedAt: new Date()
      })
      .where(eq(conversationStats.id, 1));
  }

  // Get modification statistics
  async getModificationStats(): Promise<{
    totalModifications: number;
    successfulModifications: number;
    failedModifications: number;
    mostModifiedFiles: Array<{ file: string; count: number }>;
    approachUsage: Record<string, number>;
  }> {
    try {
      const modificationMessages = await this.db
        .select()
        .from(messages)
        .where(and(
          eq(messages.messageType, 'assistant'),
          like(messages.content, 'MODIFICATION COMPLETED:%')
        ));

      const stats = {
        totalModifications: modificationMessages.length,
        successfulModifications: modificationMessages.filter(m => m.modificationSuccess === true).length,
        failedModifications: modificationMessages.filter(m => m.modificationSuccess === false).length,
        mostModifiedFiles: [] as Array<{ file: string; count: number }>,
        approachUsage: {} as Record<string, number>
      };

      // Count file modifications
      const fileCount: Record<string, number> = {};
      modificationMessages.forEach(msg => {
        if (msg.fileModifications) {
          msg.fileModifications.forEach(file => {
            fileCount[file] = (fileCount[file] || 0) + 1;
          });
        }
        
        // Count approach usage
        if (msg.modificationApproach) {
          stats.approachUsage[msg.modificationApproach] = (stats.approachUsage[msg.modificationApproach] || 0) + 1;
        }
      });

      // Get top 10 most modified files
      stats.mostModifiedFiles = Object.entries(fileCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([file, count]) => ({ file, count }));

      return stats;
    } catch (error) {
      console.error('Failed to get modification stats:', error);
      return {
        totalModifications: 0,
        successfulModifications: 0,
        failedModifications: 0,
        mostModifiedFiles: [],
        approachUsage: {}
      };
    }
  }

  // Expose the db instance for external use (needed for reset-project endpoint)
  
}


// Extended class for integration with file modifier
export class IntelligentFileModifierWithDrizzle extends StatelessIntelligentFileModifier {
  protected messageDB: DrizzleMessageHistoryDB;

 constructor(
  anthropic: Anthropic,
  reactBasePath: string,
  databaseUrl: string,
  sessionId: string,
  redisUrl?: string  
) {
  super(anthropic, reactBasePath, sessionId, redisUrl); 
  this.messageDB = new DrizzleMessageHistoryDB(databaseUrl, anthropic);
}

  // Initialize the database
  async initialize(): Promise<void> {
    await this.messageDB.initializeStats();
  }

  // Process modification with enhanced conversation history
  async processModificationWithHistory(prompt: string): Promise<ModificationResult> {
    // Add user message
    await this.messageDB.addMessage(prompt, 'user');

    // Get enhanced conversation context
    const context = await this.messageDB.getEnhancedContext();

    // Process the modification with enhanced context
    const result = await super.processModification(prompt, context);

    const typedResult: ModificationResult = {
      ...result,
      approach: result.approach as 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | undefined
    };

    // Save the modification result
    await this.messageDB.saveModification({
      prompt,
      result: typedResult,
      approach: typedResult.approach || 'TARGETED_NODES',
      filesModified: typedResult.selectedFiles || [],
      filesCreated: typedResult.addedFiles || typedResult.createdFiles?.map(f => f.path) || [],
      timestamp: new Date().toISOString()
    });

    return typedResult;
  }

  // Get the message database instance for direct access
  getMessageDB(): DrizzleMessageHistoryDB {
    return this.messageDB;
  }

  // Get comprehensive conversation data
  async getConversationData(): Promise<{
    messages: Message[];
    summaryCount: number;
    totalMessages: number;
    modificationStats: any;
  }> {
    const conversation = await this.messageDB.getRecentConversation();
    const modificationStats = await this.messageDB.getModificationStats();
    
    return {
      ...conversation,
      modificationStats
    };
  }

  // Get conversation stats
  async getStats(): Promise<ConversationStats | null> {
    return await this.messageDB.getConversationStats();
  }
}

// Create a simple wrapper for use in endpoints
export class ConversationHelper {
  private messageDB: DrizzleMessageHistoryDB;

  constructor(databaseUrl: string, anthropic: Anthropic) {
    this.messageDB = new DrizzleMessageHistoryDB(databaseUrl, anthropic);
  }

  // Initialize
  async initialize(): Promise<void> {
    await this.messageDB.initializeStats();
  }

  // Get enhanced context for use in endpoints
  async getEnhancedContext(): Promise<string> {
    return await this.messageDB.getEnhancedContext();
  }

  // Save modification
  async saveModification(modification: ModificationRecord): Promise<void> {
    await this.messageDB.saveModification(modification);
  }

  // Get conversation for display
  async getConversation(): Promise<{
    messages: Message[];
    summaryCount: number;
    totalMessages: number;
  }> {
    return await this.messageDB.getRecentConversation();
  }

  // Get modification statistics
  async getModificationStats(): Promise<any> {
    return await this.messageDB.getModificationStats();
  }

  // Get project summary for use in endpoints
  async getProjectSummary(): Promise<string | null> {
    return await this.messageDB.getProjectSummaryForScope();
  }

  // Save project summary from endpoints (now supports ZIP URL and buildId)
  async saveProjectSummary(
    summary: string, 
    prompt: string, 
    zipUrl?: string, 
    buildId?: string
  ): Promise<string | null> {
    return await this.messageDB.saveProjectSummary(summary, prompt, zipUrl, buildId);
  }

  // Update project summary from endpoints
  async updateProjectSummary(
    summaryId: string, 
    zipUrl: string, 
    buildId: string
  ): Promise<boolean> {
    return await this.messageDB.updateProjectSummary(summaryId, zipUrl, buildId);
  }

  // Get conversation with summary (keeping for backward compatibility)
  async getConversationWithSummary(): Promise<{
    messages: any[];
    summaryCount: number;
    totalMessages: number;
  }> {
    const conversation = await this.messageDB.getRecentConversation();

    return {
      messages: conversation.messages.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        messageType: msg.messageType,
        metadata: {
          fileModifications: msg.fileModifications,
          modificationApproach: msg.modificationApproach,
          modificationSuccess: msg.modificationSuccess
        },
        createdAt: msg.createdAt
      })),
      summaryCount: conversation.summaryCount,
      totalMessages: conversation.totalMessages
    };
  }
}