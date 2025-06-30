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
declare class MessageService {
    private generateSessionId;
    /**
     * Create a message using the new CI schema
     */
    createMessage(messageData: CreateMessageData): Promise<MessageResponse>;
    /**
     * Get messages by project ID (from all sessions)
     */
    getMessagesByProjectId(projectId: number): Promise<MessageResponse[]>;
    /**
     * Get messages by session ID
     */
    getMessagesBySessionId(sessionId: string): Promise<MessageResponse[]>;
    /**
     * Get messages by project ID and session ID
     */
    getMessagesByProjectAndSession(projectId: number, sessionId: string): Promise<MessageResponse[]>;
    /**
     * Get recent messages for a project (latest session)
     */
    getRecentMessagesByProjectId(projectId: number, limit?: number): Promise<MessageResponse[]>;
    /**
     * Delete messages by project ID (all sessions)
     */
    deleteMessagesByProjectId(projectId: number): Promise<boolean>;
    /**
     * Delete messages by session ID
     */
    deleteMessagesBySessionId(sessionId: string): Promise<boolean>;
    /**
     * Get session information for a project
     */
    getProjectSessions(projectId: number): Promise<Array<{
        sessionId: string;
        messageCount: number;
        lastActivity: Date;
        isActive: boolean;
    }>>;
    /**
     * Get message count for a project
     */
    getProjectMessageCount(projectId: number): Promise<number>;
    /**
     * Get message count for a session
     */
    getSessionMessageCount(sessionId: string): Promise<number>;
    /**
     * Create a new session for a project
     */
    createSession(projectId: number): Promise<string>;
    /**
     * Get active session for a project (latest session with activity)
     */
    getActiveProjectSession(projectId: number): Promise<string | null>;
    private ensureSessionStats;
    private updateSessionStats;
    /**
     * @deprecated Use createMessage with explicit session management
     * Legacy method for backward compatibility
     */
    createLegacyMessage(messageData: {
        projectId: number;
        role: 'user' | 'assistant';
        content: string;
        metadata?: any;
    }): Promise<MessageResponse>;
    /**
     * Get conversation context for a project (combines recent messages)
     */
    getProjectConversationContext(projectId: number): Promise<string>;
}
declare const _default: MessageService;
export default _default;
