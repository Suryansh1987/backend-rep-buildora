"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionModificationsRelations = exports.projectSummariesRelations = exports.ciMessagesRelations = exports.messageSummariesRelations = exports.sessionModifications = exports.projectSummaries = exports.conversationStats = exports.ciMessages = exports.messageSummaries = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
// Message summaries table for component integrator
exports.messageSummaries = (0, pg_core_1.pgTable)('ci_message_summaries', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    sessionId: (0, pg_core_1.text)('session_id').notNull(), // Link to Redis session
    projectId: (0, pg_core_1.integer)('project_id'), // Link to main project if available
    summary: (0, pg_core_1.text)('summary').notNull(),
    messageCount: (0, pg_core_1.integer)('message_count').notNull(),
    startTime: (0, pg_core_1.timestamp)('start_time', { withTimezone: true }).notNull(),
    endTime: (0, pg_core_1.timestamp)('end_time', { withTimezone: true }).notNull(),
    keyTopics: (0, pg_core_1.text)('key_topics').array(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    createdAtIdx: (0, pg_core_1.index)('idx_ci_summaries_created_at').on(table.createdAt),
    sessionIdIdx: (0, pg_core_1.index)('idx_ci_summaries_session_id').on(table.sessionId),
    projectIdIdx: (0, pg_core_1.index)('idx_ci_summaries_project_id').on(table.projectId),
}));
// Enhanced messages table for component integrator
exports.ciMessages = (0, pg_core_1.pgTable)('ci_messages', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    sessionId: (0, pg_core_1.text)('session_id').notNull(), // Link to Redis session
    projectId: (0, pg_core_1.integer)('project_id'), // Link to main project if available
    content: (0, pg_core_1.text)('content').notNull(),
    messageType: (0, pg_core_1.varchar)('message_type', { length: 20 }).notNull().$type(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow(),
    // Metadata for file modifications
    fileModifications: (0, pg_core_1.text)('file_modifications').array(),
    modificationApproach: (0, pg_core_1.varchar)('modification_approach', { length: 30 }).$type(),
    modificationSuccess: (0, pg_core_1.boolean)('modification_success'),
    // Enhanced reasoning and context fields
    reasoning: (0, pg_core_1.text)('reasoning'), // JSON string with metadata
    selectedFiles: (0, pg_core_1.text)('selected_files').array(),
    errorDetails: (0, pg_core_1.text)('error_details'),
    stepType: (0, pg_core_1.varchar)('step_type', { length: 50 }).$type(),
    // Modification details
    modificationRanges: (0, pg_core_1.text)('modification_ranges'), // JSON string
    // Reference to project summary
    projectSummaryId: (0, pg_core_1.uuid)('project_summary_id').references(() => exports.projectSummaries.id),
}, (table) => ({
    createdAtIdx: (0, pg_core_1.index)('idx_ci_messages_created_at').on(table.createdAt.desc()),
    sessionIdIdx: (0, pg_core_1.index)('idx_ci_messages_session_id').on(table.sessionId),
    projectIdIdx: (0, pg_core_1.index)('idx_ci_messages_project_id').on(table.projectId),
    stepTypeIdx: (0, pg_core_1.index)('idx_ci_messages_step_type').on(table.stepType),
    projectSummaryIdIdx: (0, pg_core_1.index)('idx_ci_messages_project_summary_id').on(table.projectSummaryId),
}));
// Conversation stats table - Per session basis
exports.conversationStats = (0, pg_core_1.pgTable)('ci_conversation_stats', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    sessionId: (0, pg_core_1.text)('session_id').notNull().unique(), // One stats record per session
    projectId: (0, pg_core_1.integer)('project_id'), // Link to main project if available
    totalMessageCount: (0, pg_core_1.integer)('total_message_count').default(0),
    summaryCount: (0, pg_core_1.integer)('summary_count').default(0),
    lastMessageAt: (0, pg_core_1.timestamp)('last_message_at', { withTimezone: true }),
    lastModificationAt: (0, pg_core_1.timestamp)('last_modification_at', { withTimezone: true }),
    totalModifications: (0, pg_core_1.integer)('total_modifications').default(0),
    successfulModifications: (0, pg_core_1.integer)('successful_modifications').default(0),
    failedModifications: (0, pg_core_1.integer)('failed_modifications').default(0),
    // Session metadata
    startedAt: (0, pg_core_1.timestamp)('started_at', { withTimezone: true }).defaultNow(),
    lastActivity: (0, pg_core_1.timestamp)('last_activity', { withTimezone: true }).defaultNow(),
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    sessionIdIdx: (0, pg_core_1.index)('idx_ci_stats_session_id').on(table.sessionId),
    projectIdIdx: (0, pg_core_1.index)('idx_ci_stats_project_id').on(table.projectId),
    isActiveIdx: (0, pg_core_1.index)('idx_ci_stats_is_active').on(table.isActive),
}));
// Enhanced project summaries table with ZIP URL support and session linking
exports.projectSummaries = (0, pg_core_1.pgTable)('ci_project_summaries', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    sessionId: (0, pg_core_1.text)('session_id').notNull(), // Link to Redis session
    projectId: (0, pg_core_1.integer)('project_id'), // Link to main project if available
    summary: (0, pg_core_1.text)('summary').notNull(),
    originalPrompt: (0, pg_core_1.text)('original_prompt').notNull(),
    // ZIP-based workflow fields
    zipUrl: (0, pg_core_1.text)('zip_url'), // Store the source ZIP URL
    buildId: (0, pg_core_1.text)('build_id'), // Store the build ID
    deploymentUrl: (0, pg_core_1.text)('deployment_url'), // Store deployment URL
    // Summary metadata
    fileCount: (0, pg_core_1.integer)('file_count').default(0),
    componentsCreated: (0, pg_core_1.text)('components_created').array(),
    pagesCreated: (0, pg_core_1.text)('pages_created').array(),
    technologiesUsed: (0, pg_core_1.text)('technologies_used').array(),
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow(),
    lastUsedAt: (0, pg_core_1.timestamp)('last_used_at', { withTimezone: true }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    createdAtIdx: (0, pg_core_1.index)('idx_ci_project_summaries_created_at').on(table.createdAt),
    sessionIdIdx: (0, pg_core_1.index)('idx_ci_project_summaries_session_id').on(table.sessionId),
    projectIdIdx: (0, pg_core_1.index)('idx_ci_project_summaries_project_id').on(table.projectId),
    isActiveIdx: (0, pg_core_1.index)('idx_ci_project_summaries_is_active').on(table.isActive),
    zipUrlIdx: (0, pg_core_1.index)('idx_ci_project_summaries_zip_url').on(table.zipUrl),
}));
// Session-based modification tracking
exports.sessionModifications = (0, pg_core_1.pgTable)('ci_session_modifications', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    sessionId: (0, pg_core_1.text)('session_id').notNull(),
    projectId: (0, pg_core_1.integer)('project_id'),
    messageId: (0, pg_core_1.uuid)('message_id').references(() => exports.ciMessages.id),
    // Modification details
    modificationPrompt: (0, pg_core_1.text)('modification_prompt').notNull(),
    approach: (0, pg_core_1.varchar)('approach', { length: 30 }).notNull(),
    filesModified: (0, pg_core_1.text)('files_modified').array(),
    filesCreated: (0, pg_core_1.text)('files_created').array(),
    // Results
    success: (0, pg_core_1.boolean)('success').notNull(),
    errorMessage: (0, pg_core_1.text)('error_message'),
    processingTime: (0, pg_core_1.integer)('processing_time'), // in milliseconds
    // Context
    hadConversationHistory: (0, pg_core_1.boolean)('had_conversation_history').default(false),
    hadProjectSummary: (0, pg_core_1.boolean)('had_project_summary').default(false),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    sessionIdIdx: (0, pg_core_1.index)('idx_ci_modifications_session_id').on(table.sessionId),
    projectIdIdx: (0, pg_core_1.index)('idx_ci_modifications_project_id').on(table.projectId),
    createdAtIdx: (0, pg_core_1.index)('idx_ci_modifications_created_at').on(table.createdAt),
    successIdx: (0, pg_core_1.index)('idx_ci_modifications_success').on(table.success),
}));
// Relations
exports.messageSummariesRelations = (0, drizzle_orm_1.relations)(exports.messageSummaries, ({ many }) => ({
    messages: many(exports.ciMessages),
}));
exports.ciMessagesRelations = (0, drizzle_orm_1.relations)(exports.ciMessages, ({ one }) => ({
    projectSummary: one(exports.projectSummaries, {
        fields: [exports.ciMessages.projectSummaryId],
        references: [exports.projectSummaries.id],
    }),
}));
exports.projectSummariesRelations = (0, drizzle_orm_1.relations)(exports.projectSummaries, ({ many }) => ({
    messages: many(exports.ciMessages),
}));
exports.sessionModificationsRelations = (0, drizzle_orm_1.relations)(exports.sessionModifications, ({ one }) => ({
    message: one(exports.ciMessages, {
        fields: [exports.sessionModifications.messageId],
        references: [exports.ciMessages.id],
    }),
}));
//# sourceMappingURL=message_schema.js.map