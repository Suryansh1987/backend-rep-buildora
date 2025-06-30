"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../db");
const drizzle_orm_1 = require("drizzle-orm");
const project_schema_1 = require("../db/project_schema");
const message_schema_1 = require("../db/message_schema");
const drizzle_orm_2 = require("drizzle-orm");
class MessageService {
    generateSessionId() {
        return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Create a message using the new CI schema
     */
    createMessage(messageData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Generate session ID if not provided
                const sessionId = messageData.sessionId || this.generateSessionId();
                // Ensure session stats exist
                yield this.ensureSessionStats(sessionId, messageData.projectId);
                // Create message in CI schema
                const newCIMessage = {
                    sessionId,
                    projectId: messageData.projectId,
                    content: messageData.content,
                    messageType: messageData.role,
                    reasoning: messageData.metadata ? JSON.stringify(messageData.metadata) : null,
                    createdAt: new Date()
                };
                const [createdMessage] = yield db_1.db
                    .insert(message_schema_1.ciMessages)
                    .values(newCIMessage)
                    .returning();
                // Update project's lastMessageAt and messageCount
                yield db_1.db
                    .update(project_schema_1.projects)
                    .set({
                    lastMessageAt: new Date(),
                    lastSessionId: sessionId,
                    messageCount: (0, drizzle_orm_1.sql) `${project_schema_1.projects.messageCount} + 1`,
                    updatedAt: new Date()
                })
                    .where((0, drizzle_orm_2.eq)(project_schema_1.projects.id, messageData.projectId));
                // Update session stats
                yield this.updateSessionStats(sessionId);
                // Return formatted response
                return {
                    id: createdMessage.id,
                    projectId: createdMessage.projectId,
                    sessionId: createdMessage.sessionId,
                    content: createdMessage.content,
                    role: createdMessage.messageType,
                    metadata: createdMessage.reasoning ? JSON.parse(createdMessage.reasoning) : undefined,
                    createdAt: createdMessage.createdAt
                };
            }
            catch (error) {
                console.error('Error creating message:', error);
                throw error;
            }
        });
    }
    /**
     * Get messages by project ID (from all sessions)
     */
    getMessagesByProjectId(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const projectMessages = yield db_1.db
                    .select()
                    .from(message_schema_1.ciMessages)
                    .where((0, drizzle_orm_2.eq)(message_schema_1.ciMessages.projectId, projectId))
                    .orderBy(message_schema_1.ciMessages.createdAt);
                return projectMessages.map(msg => ({
                    id: msg.id,
                    projectId: msg.projectId,
                    sessionId: msg.sessionId,
                    content: msg.content,
                    role: msg.messageType,
                    metadata: msg.reasoning ? JSON.parse(msg.reasoning) : undefined,
                    createdAt: msg.createdAt
                }));
            }
            catch (error) {
                console.error('Error getting messages by project ID:', error);
                throw error;
            }
        });
    }
    /**
     * Get messages by session ID
     */
    getMessagesBySessionId(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sessionMessages = yield db_1.db
                    .select()
                    .from(message_schema_1.ciMessages)
                    .where((0, drizzle_orm_2.eq)(message_schema_1.ciMessages.sessionId, sessionId))
                    .orderBy(message_schema_1.ciMessages.createdAt);
                return sessionMessages.map(msg => ({
                    id: msg.id,
                    projectId: msg.projectId,
                    sessionId: msg.sessionId,
                    content: msg.content,
                    role: msg.messageType,
                    metadata: msg.reasoning ? JSON.parse(msg.reasoning) : undefined,
                    createdAt: msg.createdAt
                }));
            }
            catch (error) {
                console.error('Error getting messages by session ID:', error);
                throw error;
            }
        });
    }
    /**
     * Get messages by project ID and session ID
     */
    getMessagesByProjectAndSession(projectId, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const messages = yield db_1.db
                    .select()
                    .from(message_schema_1.ciMessages)
                    .where((0, drizzle_orm_2.and)((0, drizzle_orm_2.eq)(message_schema_1.ciMessages.projectId, projectId), (0, drizzle_orm_2.eq)(message_schema_1.ciMessages.sessionId, sessionId)))
                    .orderBy(message_schema_1.ciMessages.createdAt);
                return messages.map(msg => ({
                    id: msg.id,
                    projectId: msg.projectId,
                    sessionId: msg.sessionId,
                    content: msg.content,
                    role: msg.messageType,
                    metadata: msg.reasoning ? JSON.parse(msg.reasoning) : undefined,
                    createdAt: msg.createdAt
                }));
            }
            catch (error) {
                console.error('Error getting messages by project and session:', error);
                throw error;
            }
        });
    }
    /**
     * Get recent messages for a project (latest session)
     */
    getRecentMessagesByProjectId(projectId_1) {
        return __awaiter(this, arguments, void 0, function* (projectId, limit = 10) {
            try {
                const messages = yield db_1.db
                    .select()
                    .from(message_schema_1.ciMessages)
                    .where((0, drizzle_orm_2.eq)(message_schema_1.ciMessages.projectId, projectId))
                    .orderBy((0, drizzle_orm_2.desc)(message_schema_1.ciMessages.createdAt))
                    .limit(limit);
                return messages.reverse().map(msg => ({
                    id: msg.id,
                    projectId: msg.projectId,
                    sessionId: msg.sessionId,
                    content: msg.content,
                    role: msg.messageType,
                    metadata: msg.reasoning ? JSON.parse(msg.reasoning) : undefined,
                    createdAt: msg.createdAt
                }));
            }
            catch (error) {
                console.error('Error getting recent messages:', error);
                throw error;
            }
        });
    }
    /**
     * Delete messages by project ID (all sessions)
     */
    deleteMessagesByProjectId(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Delete all messages for the project
                yield db_1.db
                    .delete(message_schema_1.ciMessages)
                    .where((0, drizzle_orm_2.eq)(message_schema_1.ciMessages.projectId, projectId));
                // Reset project message count
                yield db_1.db
                    .update(project_schema_1.projects)
                    .set({
                    messageCount: 0,
                    lastMessageAt: null,
                    lastSessionId: null,
                    updatedAt: new Date()
                })
                    .where((0, drizzle_orm_2.eq)(project_schema_1.projects.id, projectId));
                return true;
            }
            catch (error) {
                console.error('Error deleting messages by project ID:', error);
                throw error;
            }
        });
    }
    /**
     * Delete messages by session ID
     */
    deleteMessagesBySessionId(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield db_1.db
                    .delete(message_schema_1.ciMessages)
                    .where((0, drizzle_orm_2.eq)(message_schema_1.ciMessages.sessionId, sessionId));
                // Delete session stats
                yield db_1.db
                    .delete(message_schema_1.conversationStats)
                    .where((0, drizzle_orm_2.eq)(message_schema_1.conversationStats.sessionId, sessionId));
                return true;
            }
            catch (error) {
                console.error('Error deleting messages by session ID:', error);
                throw error;
            }
        });
    }
    /**
     * Get session information for a project
     */
    getProjectSessions(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sessions = yield db_1.db
                    .select()
                    .from(message_schema_1.conversationStats)
                    .where((0, drizzle_orm_2.and)((0, drizzle_orm_2.eq)(message_schema_1.conversationStats.projectId, projectId), (0, drizzle_orm_2.eq)(message_schema_1.conversationStats.isActive, true)))
                    .orderBy((0, drizzle_orm_2.desc)(message_schema_1.conversationStats.lastActivity));
                return sessions.map(session => {
                    var _a, _b;
                    return ({
                        sessionId: session.sessionId,
                        messageCount: (_a = session.totalMessageCount) !== null && _a !== void 0 ? _a : 0,
                        lastActivity: session.lastActivity || session.createdAt,
                        isActive: (_b = session.isActive) !== null && _b !== void 0 ? _b : false
                    });
                });
            }
            catch (error) {
                console.error('Error getting project sessions:', error);
                return [];
            }
        });
    }
    /**
     * Get message count for a project
     */
    getProjectMessageCount(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield db_1.db
                    .select({ count: message_schema_1.ciMessages.id })
                    .from(message_schema_1.ciMessages)
                    .where((0, drizzle_orm_2.eq)(message_schema_1.ciMessages.projectId, projectId));
                return result.length;
            }
            catch (error) {
                console.error('Error getting project message count:', error);
                return 0;
            }
        });
    }
    /**
     * Get message count for a session
     */
    getSessionMessageCount(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield db_1.db
                    .select({ count: message_schema_1.ciMessages.id })
                    .from(message_schema_1.ciMessages)
                    .where((0, drizzle_orm_2.eq)(message_schema_1.ciMessages.sessionId, sessionId));
                return result.length;
            }
            catch (error) {
                console.error('Error getting session message count:', error);
                return 0;
            }
        });
    }
    /**
     * Create a new session for a project
     */
    createSession(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            const sessionId = this.generateSessionId();
            yield this.ensureSessionStats(sessionId, projectId);
            return sessionId;
        });
    }
    /**
     * Get active session for a project (latest session with activity)
     */
    getActiveProjectSession(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sessions = yield db_1.db
                    .select()
                    .from(message_schema_1.conversationStats)
                    .where((0, drizzle_orm_2.and)((0, drizzle_orm_2.eq)(message_schema_1.conversationStats.projectId, projectId), (0, drizzle_orm_2.eq)(message_schema_1.conversationStats.isActive, true)))
                    .orderBy((0, drizzle_orm_2.desc)(message_schema_1.conversationStats.lastActivity))
                    .limit(1);
                return sessions.length > 0 ? sessions[0].sessionId : null;
            }
            catch (error) {
                console.error('Error getting active project session:', error);
                return null;
            }
        });
    }
    // Private helper methods
    ensureSessionStats(sessionId, projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const existing = yield db_1.db
                    .select()
                    .from(message_schema_1.conversationStats)
                    .where((0, drizzle_orm_2.eq)(message_schema_1.conversationStats.sessionId, sessionId));
                if (existing.length === 0) {
                    yield db_1.db
                        .insert(message_schema_1.conversationStats)
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
            }
            catch (error) {
                console.error('Error ensuring session stats:', error);
            }
        });
    }
    updateSessionStats(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield db_1.db
                    .update(message_schema_1.conversationStats)
                    .set({
                    totalMessageCount: (0, drizzle_orm_1.sql) `${message_schema_1.conversationStats.totalMessageCount} + 1`,
                    lastActivity: new Date(),
                    updatedAt: new Date()
                })
                    .where((0, drizzle_orm_2.eq)(message_schema_1.conversationStats.sessionId, sessionId));
            }
            catch (error) {
                console.error('Error updating session stats:', error);
            }
        });
    }
    // Legacy compatibility methods (if you need to maintain backward compatibility)
    /**
     * @deprecated Use createMessage with explicit session management
     * Legacy method for backward compatibility
     */
    createLegacyMessage(messageData) {
        return __awaiter(this, void 0, void 0, function* () {
            console.warn('⚠️ Using deprecated createLegacyMessage - consider upgrading to session-based createMessage');
            // Get or create active session for project
            let sessionId = yield this.getActiveProjectSession(messageData.projectId);
            if (!sessionId) {
                sessionId = yield this.createSession(messageData.projectId);
            }
            return this.createMessage(Object.assign(Object.assign({}, messageData), { sessionId }));
        });
    }
    /**
     * Get conversation context for a project (combines recent messages)
     */
    getProjectConversationContext(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const recentMessages = yield this.getRecentMessagesByProjectId(projectId, 10);
                if (recentMessages.length === 0) {
                    return '';
                }
                let context = '**RECENT CONVERSATION:**\n';
                recentMessages.forEach((msg, index) => {
                    context += `${index + 1}. [${msg.role.toUpperCase()}]: ${msg.content}\n`;
                });
                return context;
            }
            catch (error) {
                console.error('Error getting project conversation context:', error);
                return '';
            }
        });
    }
}
exports.default = new MessageService();
//# sourceMappingURL=messageService.js.map