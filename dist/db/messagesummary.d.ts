import Anthropic from '@anthropic-ai/sdk';
import { type CIMessage as Message, type MessageSummary, type ConversationStats, type ProjectSummary } from './message_schema';
import { StatelessIntelligentFileModifier } from '../services/filemodifier';
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
    addedFiles?: string[];
    createdFiles?: Array<{
        path: string;
        content: string;
        type: 'component' | 'page' | 'utility';
    }>;
    modificationSummary?: string;
    error?: string;
}
interface ModificationRecord {
    prompt: string;
    result: ModificationResult;
    approach: string;
    filesModified: string[];
    filesCreated: string[];
    timestamp: string;
}
export declare class DrizzleMessageHistoryDB {
    private db;
    private anthropic;
    private defaultSessionId;
    constructor(databaseUrl: string, anthropic: Anthropic);
    getRecentProjects(limit?: number): Promise<any[]>;
    getUserProjects(userId: number): Promise<any[]>;
    getAllProjectsWithUrls(): Promise<any[]>;
    getProjectBySessionId(sessionId: string): Promise<any>;
    getProjectByBuildId(buildId: string): Promise<any>;
    updateProjectUrls(projectId: number, updateData: {
        deploymentUrl: string;
        downloadUrl: string;
        zipUrl: string;
        buildId: string;
        status: string;
        lastSessionId: string;
        lastMessageAt: Date;
        updatedAt: Date;
    }): Promise<void>;
    createProject(projectData: {
        userId: number;
        name: string;
        description: string;
        status: string;
        projectType: string;
        deploymentUrl: string;
        downloadUrl: string;
        zipUrl: string;
        buildId: string;
        lastSessionId: string;
        framework: string;
        template: string;
        lastMessageAt: Date;
        messageCount: number;
    }): Promise<number>;
    getProjectWithHistory(projectId: number): Promise<any>;
    updateProjectStatus(projectId: number, status: string): Promise<void>;
    linkSessionToProject(sessionId: string, projectId: number): Promise<void>;
    incrementProjectMessageCount(sessionId: string): Promise<void>;
    saveProjectSummary(summary: string, prompt: string, zipUrl?: string, buildId?: string): Promise<string | null>;
    /**
     * Update existing project summary with new ZIP URL and buildId
     */
    updateProjectSummary(summaryId: string, zipUrl: string, buildId: string): Promise<boolean>;
    /**
     * Get the active project summary with ZIP URL and buildId
     */
    getActiveProjectSummary(): Promise<{
        id: string;
        summary: string;
        zipUrl?: string;
        buildId?: string;
    } | null>;
    /**
     * Get project summary for scope analysis
     */
    getProjectSummaryForScope(): Promise<string | null>;
    /**
     * Override the getEnhancedContext method to include project summary
     */
    getEnhancedContext(): Promise<string>;
    /**
     * Get all project summaries
     */
    getAllProjectSummaries(): Promise<ProjectSummary[]>;
    /**
     * Delete a project summary by ID
     */
    deleteProjectSummary(id: string): Promise<boolean>;
    initializeStats(): Promise<void>;
    addMessage(content: string, messageType: 'user' | 'assistant', metadata?: {
        fileModifications?: string[];
        modificationApproach?: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | 'FULL_FILE_GENERATION' | null;
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
        sessionId?: string;
    }): Promise<string>;
    /**
     * Save modification details for future context
     */
    saveModification(modification: ModificationRecord): Promise<void>;
    /**
     * Generate a comprehensive modification summary
     */
    private generateModificationSummary;
    /**
     * Get recent modifications for context
     */
    getRecentModifications(limit?: number): Promise<ModificationRecord[]>;
    private extractPromptFromSummary;
    private maintainRecentMessages;
    fixConversationStats(): Promise<void>;
    private updateGrowingSummary;
    private generateSummaryUpdate;
    getConversationContext(): Promise<string>;
    getRecentConversation(): Promise<{
        messages: Message[];
        summaryCount: number;
        totalMessages: number;
    }>;
    getCurrentSummary(): Promise<{
        summary: string;
        messageCount: number;
    } | null>;
    getConversationStats(): Promise<ConversationStats | null>;
    getAllSummaries(): Promise<MessageSummary[]>;
    clearAllData(): Promise<void>;
    getModificationStats(): Promise<{
        totalModifications: number;
        successfulModifications: number;
        failedModifications: number;
        mostModifiedFiles: Array<{
            file: string;
            count: number;
        }>;
        approachUsage: Record<string, number>;
    }>;
    /**
     * Initialize stats for a specific session (new method)
     */
    initializeSessionStats(sessionId: string, projectId?: number): Promise<void>;
    /**
     * Get project sessions (new method)
     */
    getProjectSessions(projectId: number): Promise<any[]>;
}
export declare class IntelligentFileModifierWithDrizzle extends StatelessIntelligentFileModifier {
    protected messageDB: DrizzleMessageHistoryDB;
    constructor(anthropic: Anthropic, reactBasePath: string, databaseUrl: string, sessionId: string, redisUrl?: string);
    initialize(): Promise<void>;
    processModificationWithHistory(prompt: string): Promise<ModificationResult>;
    getMessageDB(): DrizzleMessageHistoryDB;
    getConversationData(): Promise<{
        messages: Message[];
        summaryCount: number;
        totalMessages: number;
        modificationStats: any;
    }>;
    getStats(): Promise<ConversationStats | null>;
}
export declare class ConversationHelper {
    private messageDB;
    constructor(databaseUrl: string, anthropic: Anthropic);
    initialize(): Promise<void>;
    getEnhancedContext(): Promise<string>;
    saveModification(modification: ModificationRecord): Promise<void>;
    getConversation(): Promise<{
        messages: Message[];
        summaryCount: number;
        totalMessages: number;
    }>;
    getModificationStats(): Promise<any>;
    getProjectSummary(): Promise<string | null>;
    saveProjectSummary(summary: string, prompt: string, zipUrl?: string, buildId?: string): Promise<string | null>;
    updateProjectSummary(summaryId: string, zipUrl: string, buildId: string): Promise<boolean>;
    getConversationWithSummary(): Promise<{
        messages: any[];
        summaryCount: number;
        totalMessages: number;
    }>;
}
export {};
