"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectSummaries = exports.conversationStats = exports.ciMessages = exports.messageSummaries = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
// Message summaries table for component integrator
exports.messageSummaries = (0, pg_core_1.pgTable)('ci_message_summaries', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    summary: (0, pg_core_1.text)('summary').notNull(),
    messageCount: (0, pg_core_1.integer)('message_count').notNull(),
    startTime: (0, pg_core_1.timestamp)('start_time', { withTimezone: true }).notNull(),
    endTime: (0, pg_core_1.timestamp)('end_time', { withTimezone: true }).notNull(),
    keyTopics: (0, pg_core_1.text)('key_topics').array(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    createdAtIdx: (0, pg_core_1.index)('idx_ci_summaries_created_at').on(table.createdAt),
}));
// Enhanced messages table for component integrator
exports.ciMessages = (0, pg_core_1.pgTable)('ci_messages', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
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
    stepTypeIdx: (0, pg_core_1.index)('idx_ci_messages_step_type').on(table.stepType),
    projectSummaryIdIdx: (0, pg_core_1.index)('idx_ci_messages_project_summary_id').on(table.projectSummaryId),
}));
// ✅ FIXED: Conversation stats table - NO SERIAL TYPE
exports.conversationStats = (0, pg_core_1.pgTable)('ci_conversation_stats', {
    id: (0, pg_core_1.integer)('id').primaryKey().default(1), // ✅ Using integer instead of serial
    totalMessageCount: (0, pg_core_1.integer)('total_message_count').default(0),
    summaryCount: (0, pg_core_1.integer)('summary_count').default(0),
    lastMessageAt: (0, pg_core_1.timestamp)('last_message_at', { withTimezone: true }),
    lastModificationAt: (0, pg_core_1.timestamp)('last_modification_at', { withTimezone: true }),
    totalModifications: (0, pg_core_1.integer)('total_modifications').default(0),
    successfulModifications: (0, pg_core_1.integer)('successful_modifications').default(0),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow(),
});
// ✅ ENHANCED: Project summaries table with ZIP URL support
exports.projectSummaries = (0, pg_core_1.pgTable)('ci_project_summaries', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    summary: (0, pg_core_1.text)('summary').notNull(),
    originalPrompt: (0, pg_core_1.text)('original_prompt').notNull(),
    // NEW FIELDS for ZIP-based workflow
    zipUrl: (0, pg_core_1.text)('zip_url'), // Store the source ZIP URL
    buildId: (0, pg_core_1.text)('build_id'), // Store the build ID
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow(),
    lastUsedAt: (0, pg_core_1.timestamp)('last_used_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    createdAtIdx: (0, pg_core_1.index)('idx_ci_project_summaries_created_at').on(table.createdAt),
    isActiveIdx: (0, pg_core_1.index)('idx_ci_project_summaries_is_active').on(table.isActive),
    zipUrlIdx: (0, pg_core_1.index)('idx_ci_project_summaries_zip_url').on(table.zipUrl),
}));
//# sourceMappingURL=message_schema.js.map