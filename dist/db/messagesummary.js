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
exports.ConversationHelper = exports.IntelligentFileModifierWithDrizzle = exports.DrizzleMessageHistoryDB = void 0;
// db/Messagesummary.ts - Updated to use separate component integrator schema with ZIP URL support
const neon_http_1 = require("drizzle-orm/neon-http");
const serverless_1 = require("@neondatabase/serverless");
const drizzle_orm_1 = require("drizzle-orm");
// Import component integrator specific schema
const message_schema_1 = require("./message_schema");
// Import the modular file modifier with proper types
const filemodifier_1 = require("../services/filemodifier");
class DrizzleMessageHistoryDB {
    constructor(databaseUrl, anthropic) {
        this.defaultSessionId = 'default-session';
        const sqlConnection = (0, serverless_1.neon)(databaseUrl);
        this.db = (0, neon_http_1.drizzle)(sqlConnection);
        this.anthropic = anthropic;
    }
    /**
     * Save project summary to database with optional ZIP URL and buildId
     * Returns the ID of the newly created summary
     */
    saveProjectSummary(summary, prompt, zipUrl, buildId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // First, mark all existing summaries as inactive for the default session
                yield this.db.update(message_schema_1.projectSummaries)
                    .set({ isActive: false })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(message_schema_1.projectSummaries.sessionId, this.defaultSessionId), (0, drizzle_orm_1.eq)(message_schema_1.projectSummaries.isActive, true)));
                // Insert the new project summary with ZIP URL and buildId
                const [newSummary] = yield this.db.insert(message_schema_1.projectSummaries)
                    .values({
                    sessionId: this.defaultSessionId,
                    projectId: null,
                    summary,
                    originalPrompt: prompt,
                    zipUrl: zipUrl || null,
                    buildId: buildId || null,
                    isActive: true,
                    createdAt: new Date(),
                    lastUsedAt: new Date()
                })
                    .returning({ id: message_schema_1.projectSummaries.id });
                console.log(`💾 Saved new project summary with ZIP URL (${zipUrl}) and ID: ${newSummary === null || newSummary === void 0 ? void 0 : newSummary.id}`);
                // Return the ID of the new summary
                return ((_a = newSummary === null || newSummary === void 0 ? void 0 : newSummary.id) === null || _a === void 0 ? void 0 : _a.toString()) || null;
            }
            catch (error) {
                console.error('Error saving project summary:', error);
                return null;
            }
        });
    }
    /**
     * Update existing project summary with new ZIP URL and buildId
     */
    updateProjectSummary(summaryId, zipUrl, buildId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.db.update(message_schema_1.projectSummaries)
                    .set({
                    zipUrl: zipUrl,
                    buildId: buildId,
                    lastUsedAt: new Date()
                })
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projectSummaries.id, summaryId));
                console.log(`💾 Updated project summary ${summaryId} with new ZIP URL: ${zipUrl}`);
                return true;
            }
            catch (error) {
                console.error('Error updating project summary:', error);
                return false;
            }
        });
    }
    /**
     * Get the active project summary with ZIP URL and buildId
     */
    getActiveProjectSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.db.select({
                    id: message_schema_1.projectSummaries.id,
                    summary: message_schema_1.projectSummaries.summary,
                    zipUrl: message_schema_1.projectSummaries.zipUrl,
                    buildId: message_schema_1.projectSummaries.buildId
                })
                    .from(message_schema_1.projectSummaries)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(message_schema_1.projectSummaries.sessionId, this.defaultSessionId), (0, drizzle_orm_1.eq)(message_schema_1.projectSummaries.isActive, true)))
                    .limit(1);
                if (result.length === 0) {
                    console.log('No active project summary found');
                    return null;
                }
                // Update last used time
                yield this.db.update(message_schema_1.projectSummaries)
                    .set({ lastUsedAt: new Date() })
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projectSummaries.id, result[0].id));
                console.log(`📂 Retrieved active project summary (ID: ${result[0].id})`);
                return {
                    id: result[0].id.toString(),
                    summary: result[0].summary,
                    zipUrl: result[0].zipUrl || undefined,
                    buildId: result[0].buildId || undefined
                };
            }
            catch (error) {
                console.error('Error getting active project summary:', error);
                return null;
            }
        });
    }
    /**
     * Get project summary for scope analysis
     */
    getProjectSummaryForScope() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const activeSummary = yield this.getActiveProjectSummary();
                if (!activeSummary) {
                    console.log('No active project summary found for scope analysis');
                    return null;
                }
                console.log(`🔍 Retrieved project summary (ID: ${activeSummary.id}) for scope analysis`);
                return activeSummary.summary;
            }
            catch (error) {
                console.error('Error retrieving project summary for scope analysis:', error);
                return null;
            }
        });
    }
    /**
     * Override the getEnhancedContext method to include project summary
     */
    getEnhancedContext() {
        return __awaiter(this, void 0, void 0, function* () {
            // Get the original conversation context
            const conversationContext = yield this.getConversationContext();
            // Get project summary if available
            let projectSummaryContext = '';
            try {
                const projectSummary = yield this.getProjectSummaryForScope();
                if (projectSummary) {
                    projectSummaryContext = `\n\n**PROJECT SUMMARY:**\n${projectSummary}`;
                }
            }
            catch (error) {
                console.error('Error retrieving project summary for context:', error);
            }
            // Get recent modifications
            let modificationContext = '';
            try {
                const recentMods = yield this.getRecentModifications(3);
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
            }
            catch (error) {
                console.error('Error retrieving modification history for context:', error);
            }
            // Combine all contexts
            return conversationContext + projectSummaryContext + modificationContext;
        });
    }
    /**
     * Get all project summaries
     */
    getAllProjectSummaries() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const summaries = yield this.db.select()
                    .from(message_schema_1.projectSummaries)
                    .orderBy((0, drizzle_orm_1.desc)(message_schema_1.projectSummaries.lastUsedAt));
                return summaries;
            }
            catch (error) {
                console.error('Error retrieving all project summaries:', error);
                return [];
            }
        });
    }
    /**
     * Delete a project summary by ID
     */
    deleteProjectSummary(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.db.delete(message_schema_1.projectSummaries)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.projectSummaries.id, id));
                console.log(`🗑️ Deleted project summary with ID: ${id}`);
                return true;
            }
            catch (error) {
                console.error(`Error deleting project summary ${id}:`, error);
                return false;
            }
        });
    }
    initializeStats() {
        return __awaiter(this, void 0, void 0, function* () {
            // Initialize for default session
            const existing = yield this.db.select()
                .from(message_schema_1.conversationStats)
                .where((0, drizzle_orm_1.eq)(message_schema_1.conversationStats.sessionId, this.defaultSessionId));
            if (existing.length === 0) {
                yield this.db.insert(message_schema_1.conversationStats).values({
                    sessionId: this.defaultSessionId,
                    projectId: null,
                    totalMessageCount: 0,
                    summaryCount: 0,
                    lastMessageAt: null,
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }
        });
    }
    // Add a new message
    addMessage(content, messageType, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            const sessionId = (metadata === null || metadata === void 0 ? void 0 : metadata.sessionId) || this.defaultSessionId;
            const newMessage = {
                sessionId,
                projectId: null,
                content,
                messageType,
                fileModifications: (metadata === null || metadata === void 0 ? void 0 : metadata.fileModifications) || null,
                //@ts-ignore
                modificationApproach: (metadata === null || metadata === void 0 ? void 0 : metadata.modificationApproach) || null,
                modificationSuccess: (metadata === null || metadata === void 0 ? void 0 : metadata.modificationSuccess) || null,
                reasoning: JSON.stringify({
                    promptType: metadata === null || metadata === void 0 ? void 0 : metadata.promptType,
                    requestType: metadata === null || metadata === void 0 ? void 0 : metadata.requestType,
                    relatedUserMessageId: metadata === null || metadata === void 0 ? void 0 : metadata.relatedUserMessageId,
                    success: metadata === null || metadata === void 0 ? void 0 : metadata.success,
                    processingTimeMs: metadata === null || metadata === void 0 ? void 0 : metadata.processingTimeMs,
                    tokenUsage: metadata === null || metadata === void 0 ? void 0 : metadata.tokenUsage,
                    responseLength: metadata === null || metadata === void 0 ? void 0 : metadata.responseLength,
                    buildId: metadata === null || metadata === void 0 ? void 0 : metadata.buildId,
                    previewUrl: metadata === null || metadata === void 0 ? void 0 : metadata.previewUrl,
                    downloadUrl: metadata === null || metadata === void 0 ? void 0 : metadata.downloadUrl,
                    zipUrl: metadata === null || metadata === void 0 ? void 0 : metadata.zipUrl,
                    error: (metadata === null || metadata === void 0 ? void 0 : metadata.success) === false ? 'Generation failed' : undefined
                }),
                projectSummaryId: (metadata === null || metadata === void 0 ? void 0 : metadata.projectSummaryId) || null,
                createdAt: new Date()
            };
            const result = yield this.db.insert(message_schema_1.ciMessages).values(newMessage).returning({ id: message_schema_1.ciMessages.id });
            const messageId = result[0].id;
            yield this.db.update(message_schema_1.conversationStats)
                .set({
                totalMessageCount: (0, drizzle_orm_1.sql) `${message_schema_1.conversationStats.totalMessageCount} + 1`,
                lastMessageAt: new Date(),
                lastActivity: new Date(),
                updatedAt: new Date()
            })
                .where((0, drizzle_orm_1.eq)(message_schema_1.conversationStats.sessionId, sessionId));
            yield this.maintainRecentMessages(sessionId);
            return messageId;
        });
    }
    /**
     * Save modification details for future context
     */
    saveModification(modification) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Generate a detailed modification summary
                const summary = this.generateModificationSummary(modification);
                // Save as a system message with detailed metadata
                yield this.addMessage(summary, 'assistant', {
                    fileModifications: modification.filesModified,
                    modificationApproach: modification.approach,
                    modificationSuccess: modification.result.success,
                    createdFiles: modification.filesCreated,
                    addedFiles: modification.result.addedFiles || []
                });
                console.log('💾 Saved modification to conversation history');
            }
            catch (error) {
                console.error('Failed to save modification record:', error);
                throw error;
            }
        });
    }
    /**
     * Generate a comprehensive modification summary
     */
    generateModificationSummary(modification) {
        var _a;
        const { prompt, approach, filesModified, filesCreated, result } = modification;
        let summary = `MODIFICATION COMPLETED:\n`;
        summary += `Request: "${prompt}"\n`;
        summary += `Approach: ${approach}\n`;
        summary += `Success: ${result.success}\n`;
        // Handle both addedFiles and createdFiles for compatibility
        const newFiles = result.addedFiles || ((_a = result.createdFiles) === null || _a === void 0 ? void 0 : _a.map(f => f.path)) || filesCreated;
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
    getRecentModifications() {
        return __awaiter(this, arguments, void 0, function* (limit = 5) {
            try {
                // Get recent modification messages
                const recentModifications = yield this.db
                    .select()
                    .from(message_schema_1.ciMessages)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(message_schema_1.ciMessages.sessionId, this.defaultSessionId), (0, drizzle_orm_1.eq)(message_schema_1.ciMessages.messageType, 'assistant'), (0, drizzle_orm_1.like)(message_schema_1.ciMessages.content, 'MODIFICATION COMPLETED:%')))
                    .orderBy((0, drizzle_orm_1.desc)(message_schema_1.ciMessages.createdAt))
                    .limit(limit);
                return recentModifications.map(msg => ({
                    prompt: this.extractPromptFromSummary(msg.content),
                    result: { success: msg.modificationSuccess || false },
                    approach: msg.modificationApproach || 'UNKNOWN',
                    filesModified: msg.fileModifications || [],
                    filesCreated: [], // Would need to extend schema to store this separately
                    timestamp: msg.createdAt.toISOString()
                }));
            }
            catch (error) {
                console.error('Failed to get recent modifications:', error);
                return [];
            }
        });
    }
    extractPromptFromSummary(summary) {
        const match = summary.match(/Request: "(.+?)"/);
        return match ? match[1] : 'Unknown request';
    }
    // Maintain only 5 recent messages, summarize older ones
    maintainRecentMessages() {
        return __awaiter(this, arguments, void 0, function* (sessionId = this.defaultSessionId) {
            const allMessages = yield this.db.select()
                .from(message_schema_1.ciMessages)
                .where((0, drizzle_orm_1.eq)(message_schema_1.ciMessages.sessionId, sessionId))
                .orderBy((0, drizzle_orm_1.desc)(message_schema_1.ciMessages.createdAt));
            if (allMessages.length > 5) {
                const recentMessages = allMessages.slice(0, 5);
                const oldMessages = allMessages.slice(5);
                if (oldMessages.length > 0) {
                    // Update the single growing summary instead of creating new ones
                    yield this.updateGrowingSummary(oldMessages, sessionId);
                }
                // Delete old messages (keep only recent 5)
                const oldMessageIds = oldMessages.map(m => m.id);
                for (const id of oldMessageIds) {
                    yield this.db.delete(message_schema_1.ciMessages).where((0, drizzle_orm_1.eq)(message_schema_1.ciMessages.id, id));
                }
            }
        });
    }
    fixConversationStats() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Count actual messages for default session
                const allMessages = yield this.db.select()
                    .from(message_schema_1.ciMessages)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.ciMessages.sessionId, this.defaultSessionId));
                const messageCount = allMessages.length;
                // Count summaries for default session
                const summaries = yield this.db.select()
                    .from(message_schema_1.messageSummaries)
                    .where((0, drizzle_orm_1.eq)(message_schema_1.messageSummaries.sessionId, this.defaultSessionId));
                const summaryCount = summaries.length;
                // Get summary message count
                const latestSummary = summaries[0];
                const summarizedMessageCount = (latestSummary === null || latestSummary === void 0 ? void 0 : latestSummary.messageCount) || 0;
                // Calculate total messages
                const totalMessages = messageCount + summarizedMessageCount;
                // Update stats
                yield this.db.update(message_schema_1.conversationStats)
                    .set({
                    totalMessageCount: totalMessages,
                    summaryCount: summaryCount > 0 ? 1 : 0, // Since we only keep one summary
                    lastMessageAt: allMessages.length > 0 ? allMessages[allMessages.length - 1].createdAt : null,
                    updatedAt: new Date()
                })
                    .where((0, drizzle_orm_1.eq)(message_schema_1.conversationStats.sessionId, this.defaultSessionId));
                console.log(`✅ Fixed stats: ${totalMessages} total messages, ${summaryCount} summaries`);
            }
            catch (error) {
                console.error('Error fixing conversation stats:', error);
            }
        });
    }
    updateGrowingSummary(newMessages_1) {
        return __awaiter(this, arguments, void 0, function* (newMessages, sessionId = this.defaultSessionId) {
            // Get the existing summary
            const existingSummaries = yield this.db.select()
                .from(message_schema_1.messageSummaries)
                .where((0, drizzle_orm_1.eq)(message_schema_1.messageSummaries.sessionId, sessionId))
                .orderBy((0, drizzle_orm_1.desc)(message_schema_1.messageSummaries.createdAt))
                .limit(1);
            const existingSummary = existingSummaries[0];
            // Generate new content to add to summary
            const { summary: newContent } = yield this.generateSummaryUpdate(newMessages, existingSummary === null || existingSummary === void 0 ? void 0 : existingSummary.summary);
            if (existingSummary) {
                // Update existing summary by appending new content
                yield this.db.update(message_schema_1.messageSummaries)
                    .set({
                    summary: newContent,
                    messageCount: existingSummary.messageCount + newMessages.length,
                    endTime: newMessages[0].createdAt, // Most recent time
                    updatedAt: new Date()
                })
                    .where((0, drizzle_orm_1.eq)(message_schema_1.messageSummaries.id, existingSummary.id));
            }
            else {
                // Create first summary
                const newSummary = {
                    sessionId,
                    projectId: null,
                    summary: newContent,
                    messageCount: newMessages.length,
                    startTime: newMessages[newMessages.length - 1].createdAt, // Oldest
                    endTime: newMessages[0].createdAt, // Newest
                    keyTopics: ['react', 'file-modification'],
                    createdAt: new Date()
                };
                yield this.db.insert(message_schema_1.messageSummaries).values(newSummary);
            }
            // Update summary count in stats if this is the first summary
            if (!existingSummary) {
                yield this.db.update(message_schema_1.conversationStats)
                    .set({
                    summaryCount: 1,
                    updatedAt: new Date()
                })
                    .where((0, drizzle_orm_1.eq)(message_schema_1.conversationStats.sessionId, sessionId));
            }
        });
    }
    // Generate updated summary using Claude
    generateSummaryUpdate(newMessages, existingSummary) {
        return __awaiter(this, void 0, void 0, function* () {
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
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 800,
                    temperature: 0.2,
                    messages: [{ role: 'user', content: claudePrompt }],
                });
                const firstBlock = response.content[0];
                if ((firstBlock === null || firstBlock === void 0 ? void 0 : firstBlock.type) === 'text') {
                    return { summary: firstBlock.text.trim() };
                }
            }
            catch (error) {
                console.error('Error generating summary update:', error);
            }
            // Fallback
            const fallbackSummary = existingSummary
                ? `${existingSummary}\n\nAdditional changes: React modifications (${newMessages.length} more messages)`
                : `React development conversation with file modifications (${newMessages.length} messages)`;
            return { summary: fallbackSummary };
        });
    }
    // Get conversation context for file modification prompts
    getConversationContext() {
        return __awaiter(this, void 0, void 0, function* () {
            // Get the single summary for default session
            const summaries = yield this.db.select()
                .from(message_schema_1.messageSummaries)
                .where((0, drizzle_orm_1.eq)(message_schema_1.messageSummaries.sessionId, this.defaultSessionId))
                .orderBy((0, drizzle_orm_1.desc)(message_schema_1.messageSummaries.createdAt))
                .limit(1);
            // Get recent messages for default session
            const recentMessages = yield this.db.select()
                .from(message_schema_1.ciMessages)
                .where((0, drizzle_orm_1.eq)(message_schema_1.ciMessages.sessionId, this.defaultSessionId))
                .orderBy((0, drizzle_orm_1.desc)(message_schema_1.ciMessages.createdAt));
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
        });
    }
    // Get recent conversation for display
    getRecentConversation() {
        return __awaiter(this, void 0, void 0, function* () {
            // Get recent messages for default session
            const recentMessages = yield this.db.select()
                .from(message_schema_1.ciMessages)
                .where((0, drizzle_orm_1.eq)(message_schema_1.ciMessages.sessionId, this.defaultSessionId))
                .orderBy((0, drizzle_orm_1.desc)(message_schema_1.ciMessages.createdAt));
            // Get stats for default session
            const stats = yield this.db.select()
                .from(message_schema_1.conversationStats)
                .where((0, drizzle_orm_1.eq)(message_schema_1.conversationStats.sessionId, this.defaultSessionId));
            const currentStats = stats[0] || { totalMessageCount: 0, summaryCount: 0 };
            return {
                messages: recentMessages,
                summaryCount: currentStats.summaryCount || 0,
                totalMessages: currentStats.totalMessageCount || 0
            };
        });
    }
    // Get current summary for display
    getCurrentSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            const summaries = yield this.db.select()
                .from(message_schema_1.messageSummaries)
                .where((0, drizzle_orm_1.eq)(message_schema_1.messageSummaries.sessionId, this.defaultSessionId))
                .orderBy((0, drizzle_orm_1.desc)(message_schema_1.messageSummaries.createdAt))
                .limit(1);
            if (summaries.length > 0) {
                const summary = summaries[0];
                return {
                    summary: summary.summary,
                    messageCount: summary.messageCount
                };
            }
            return null;
        });
    }
    // Get conversation stats
    getConversationStats() {
        return __awaiter(this, void 0, void 0, function* () {
            const stats = yield this.db.select()
                .from(message_schema_1.conversationStats)
                .where((0, drizzle_orm_1.eq)(message_schema_1.conversationStats.sessionId, this.defaultSessionId));
            return stats[0] || null;
        });
    }
    // Get all summaries
    getAllSummaries() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.db.select()
                .from(message_schema_1.messageSummaries)
                .orderBy((0, drizzle_orm_1.desc)(message_schema_1.messageSummaries.createdAt));
        });
    }
    // Clear all conversation data (for testing/reset)
    clearAllData() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db.delete(message_schema_1.ciMessages);
            yield this.db.delete(message_schema_1.messageSummaries);
            yield this.db.delete(message_schema_1.projectSummaries);
            yield this.db.update(message_schema_1.conversationStats)
                .set({
                totalMessageCount: 0,
                summaryCount: 0,
                lastMessageAt: null,
                updatedAt: new Date()
            })
                .where((0, drizzle_orm_1.eq)(message_schema_1.conversationStats.sessionId, this.defaultSessionId));
        });
    }
    // Get modification statistics
    getModificationStats() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const modificationMessages = yield this.db
                    .select()
                    .from(message_schema_1.ciMessages)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(message_schema_1.ciMessages.sessionId, this.defaultSessionId), (0, drizzle_orm_1.eq)(message_schema_1.ciMessages.messageType, 'assistant'), (0, drizzle_orm_1.like)(message_schema_1.ciMessages.content, 'MODIFICATION COMPLETED:%')));
                const stats = {
                    totalModifications: modificationMessages.length,
                    successfulModifications: modificationMessages.filter(m => m.modificationSuccess === true).length,
                    failedModifications: modificationMessages.filter(m => m.modificationSuccess === false).length,
                    mostModifiedFiles: [],
                    approachUsage: {}
                };
                // Count file modifications
                const fileCount = {};
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
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10)
                    .map(([file, count]) => ({ file, count }));
                return stats;
            }
            catch (error) {
                console.error('Failed to get modification stats:', error);
                return {
                    totalModifications: 0,
                    successfulModifications: 0,
                    failedModifications: 0,
                    mostModifiedFiles: [],
                    approachUsage: {}
                };
            }
        });
    }
    // NEW SESSION-BASED METHODS (for future use)
    /**
     * Initialize stats for a specific session (new method)
     */
    initializeSessionStats(sessionId, projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            const existing = yield this.db.select()
                .from(message_schema_1.conversationStats)
                .where((0, drizzle_orm_1.eq)(message_schema_1.conversationStats.sessionId, sessionId));
            if (existing.length === 0) {
                yield this.db.insert(message_schema_1.conversationStats).values({
                    sessionId,
                    projectId: projectId || null,
                    totalMessageCount: 0,
                    summaryCount: 0,
                    lastMessageAt: null,
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }
        });
    }
    /**
     * Get project sessions (new method)
     */
    getProjectSessions(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sessions = yield this.db.select()
                    .from(message_schema_1.conversationStats)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(message_schema_1.conversationStats.projectId, projectId), (0, drizzle_orm_1.eq)(message_schema_1.conversationStats.isActive, true)))
                    .orderBy((0, drizzle_orm_1.desc)(message_schema_1.conversationStats.lastActivity));
                return sessions.map(session => {
                    var _a, _b, _c;
                    return ({
                        sessionId: session.sessionId,
                        projectId: session.projectId,
                        hasActiveConversation: ((_a = session.totalMessageCount) !== null && _a !== void 0 ? _a : 0) > 0,
                        messageCount: (_b = session.totalMessageCount) !== null && _b !== void 0 ? _b : 0,
                        lastActivity: session.lastActivity || session.createdAt,
                        summaryExists: ((_c = session.summaryCount) !== null && _c !== void 0 ? _c : 0) > 0
                    });
                });
            }
            catch (error) {
                console.error('Error getting project sessions:', error);
                return [];
            }
        });
    }
}
exports.DrizzleMessageHistoryDB = DrizzleMessageHistoryDB;
// Extended class for integration with file modifier
class IntelligentFileModifierWithDrizzle extends filemodifier_1.StatelessIntelligentFileModifier {
    constructor(anthropic, reactBasePath, databaseUrl, sessionId, redisUrl) {
        super(anthropic, reactBasePath, sessionId, redisUrl);
        this.messageDB = new DrizzleMessageHistoryDB(databaseUrl, anthropic);
    }
    // Initialize the database
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.messageDB.initializeStats();
        });
    }
    // Process modification with enhanced conversation history
    processModificationWithHistory(prompt) {
        const _super = Object.create(null, {
            processModification: { get: () => super.processModification }
        });
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Add user message
            yield this.messageDB.addMessage(prompt, 'user');
            // Get enhanced conversation context
            const context = yield this.messageDB.getEnhancedContext();
            // Process the modification with enhanced context
            const result = yield _super.processModification.call(this, prompt, context);
            const typedResult = Object.assign(Object.assign({}, result), { approach: result.approach });
            // Save the modification result
            yield this.messageDB.saveModification({
                prompt,
                result: typedResult,
                approach: typedResult.approach || 'TARGETED_NODES',
                filesModified: typedResult.selectedFiles || [],
                filesCreated: typedResult.addedFiles || ((_a = typedResult.createdFiles) === null || _a === void 0 ? void 0 : _a.map(f => f.path)) || [],
                timestamp: new Date().toISOString()
            });
            return typedResult;
        });
    }
    // Get the message database instance for direct access
    getMessageDB() {
        return this.messageDB;
    }
    // Get comprehensive conversation data
    getConversationData() {
        return __awaiter(this, void 0, void 0, function* () {
            const conversation = yield this.messageDB.getRecentConversation();
            const modificationStats = yield this.messageDB.getModificationStats();
            return Object.assign(Object.assign({}, conversation), { modificationStats });
        });
    }
    // Get conversation stats
    getStats() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.messageDB.getConversationStats();
        });
    }
}
exports.IntelligentFileModifierWithDrizzle = IntelligentFileModifierWithDrizzle;
// Create a simple wrapper for use in endpoints
class ConversationHelper {
    constructor(databaseUrl, anthropic) {
        this.messageDB = new DrizzleMessageHistoryDB(databaseUrl, anthropic);
    }
    // Initialize
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.messageDB.initializeStats();
        });
    }
    // Get enhanced context for use in endpoints
    getEnhancedContext() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.messageDB.getEnhancedContext();
        });
    }
    // Save modification
    saveModification(modification) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.messageDB.saveModification(modification);
        });
    }
    // Get conversation for display
    getConversation() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.messageDB.getRecentConversation();
        });
    }
    // Get modification statistics
    getModificationStats() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.messageDB.getModificationStats();
        });
    }
    // Get project summary for use in endpoints
    getProjectSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.messageDB.getProjectSummaryForScope();
        });
    }
    // Save project summary from endpoints (now supports ZIP URL and buildId)
    saveProjectSummary(summary, prompt, zipUrl, buildId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.messageDB.saveProjectSummary(summary, prompt, zipUrl, buildId);
        });
    }
    // Update project summary from endpoints
    updateProjectSummary(summaryId, zipUrl, buildId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.messageDB.updateProjectSummary(summaryId, zipUrl, buildId);
        });
    }
    // Get conversation with summary (keeping for backward compatibility)
    getConversationWithSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            const conversation = yield this.messageDB.getRecentConversation();
            return {
                messages: conversation.messages.map((msg) => ({
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
        });
    }
}
exports.ConversationHelper = ConversationHelper;
//# sourceMappingURL=messagesummary.js.map