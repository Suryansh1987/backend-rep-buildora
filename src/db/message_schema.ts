import { pgTable, uuid, text, integer, timestamp, boolean, varchar, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Message summaries table for component integrator
export const messageSummaries = pgTable('ci_message_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: text('session_id').notNull(), // Link to Redis session
  projectId: integer('project_id'), // Link to main project if available
  summary: text('summary').notNull(),
  messageCount: integer('message_count').notNull(),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }).notNull(),
  keyTopics: text('key_topics').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  createdAtIdx: index('idx_ci_summaries_created_at').on(table.createdAt),
  sessionIdIdx: index('idx_ci_summaries_session_id').on(table.sessionId),
  projectIdIdx: index('idx_ci_summaries_project_id').on(table.projectId),
}));

// Enhanced messages table for component integrator
export const ciMessages = pgTable('ci_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: text('session_id').notNull(), // Link to Redis session
  projectId: integer('project_id'), // Link to main project if available
  content: text('content').notNull(),
  messageType: varchar('message_type', { length: 20 }).notNull().$type<'user' | 'assistant' | 'system'>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  
  // Metadata for file modifications
  fileModifications: text('file_modifications').array(),
  modificationApproach: varchar('modification_approach', { length: 30 }).$type<'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | 'FULL_FILE_GENERATION'>(),
  modificationSuccess: boolean('modification_success'),
  
  // Enhanced reasoning and context fields
  reasoning: text('reasoning'), // JSON string with metadata
  selectedFiles: text('selected_files').array(),
  errorDetails: text('error_details'),
  stepType: varchar('step_type', { length: 50 }).$type<'analysis' | 'modification' | 'result' | 'fallback' | 'user_request'>(),
  
  // Modification details
  modificationRanges: text('modification_ranges'), // JSON string
  
  // Reference to project summary
  projectSummaryId: uuid('project_summary_id').references(() => projectSummaries.id),
}, (table) => ({
  createdAtIdx: index('idx_ci_messages_created_at').on(table.createdAt.desc()),
  sessionIdIdx: index('idx_ci_messages_session_id').on(table.sessionId),
  projectIdIdx: index('idx_ci_messages_project_id').on(table.projectId),
  stepTypeIdx: index('idx_ci_messages_step_type').on(table.stepType),
  projectSummaryIdIdx: index('idx_ci_messages_project_summary_id').on(table.projectSummaryId),
}));

// Conversation stats table - Per session basis
export const conversationStats = pgTable('ci_conversation_stats', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: text('session_id').notNull().unique(), // One stats record per session
  projectId: integer('project_id'), // Link to main project if available
  totalMessageCount: integer('total_message_count').default(0),
  summaryCount: integer('summary_count').default(0),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  lastModificationAt: timestamp('last_modification_at', { withTimezone: true }),
  totalModifications: integer('total_modifications').default(0),
  successfulModifications: integer('successful_modifications').default(0),
  failedModifications: integer('failed_modifications').default(0),
  
  // Session metadata
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
  lastActivity: timestamp('last_activity', { withTimezone: true }).defaultNow(),
  isActive: boolean('is_active').default(true),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  sessionIdIdx: index('idx_ci_stats_session_id').on(table.sessionId),
  projectIdIdx: index('idx_ci_stats_project_id').on(table.projectId),
  isActiveIdx: index('idx_ci_stats_is_active').on(table.isActive),
}));

// Enhanced project summaries table with ZIP URL support and session linking
export const projectSummaries = pgTable('ci_project_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: text('session_id').notNull(), // Link to Redis session
  projectId: integer('project_id'), // Link to main project if available
  summary: text('summary').notNull(),
  originalPrompt: text('original_prompt').notNull(),
  
  // ZIP-based workflow fields
  zipUrl: text('zip_url'), // Store the source ZIP URL
  buildId: text('build_id'), // Store the build ID
  deploymentUrl: text('deployment_url'), // Store deployment URL
  
  // Summary metadata
  fileCount: integer('file_count').default(0),
  componentsCreated: text('components_created').array(),
  pagesCreated: text('pages_created').array(),
  technologiesUsed: text('technologies_used').array(),
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  createdAtIdx: index('idx_ci_project_summaries_created_at').on(table.createdAt),
  sessionIdIdx: index('idx_ci_project_summaries_session_id').on(table.sessionId),
  projectIdIdx: index('idx_ci_project_summaries_project_id').on(table.projectId),
  isActiveIdx: index('idx_ci_project_summaries_is_active').on(table.isActive),
  zipUrlIdx: index('idx_ci_project_summaries_zip_url').on(table.zipUrl),
}));

// Session-based modification tracking
export const sessionModifications = pgTable('ci_session_modifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: text('session_id').notNull(),
  projectId: integer('project_id'),
  messageId: uuid('message_id').references(() => ciMessages.id),
  
  // Modification details
  modificationPrompt: text('modification_prompt').notNull(),
  approach: varchar('approach', { length: 30 }).notNull(),
  filesModified: text('files_modified').array(),
  filesCreated: text('files_created').array(),
  
  // Results
  success: boolean('success').notNull(),
  errorMessage: text('error_message'),
  processingTime: integer('processing_time'), // in milliseconds
  
  // Context
  hadConversationHistory: boolean('had_conversation_history').default(false),
  hadProjectSummary: boolean('had_project_summary').default(false),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  sessionIdIdx: index('idx_ci_modifications_session_id').on(table.sessionId),
  projectIdIdx: index('idx_ci_modifications_project_id').on(table.projectId),
  createdAtIdx: index('idx_ci_modifications_created_at').on(table.createdAt),
  successIdx: index('idx_ci_modifications_success').on(table.success),
}));

// Relations
export const messageSummariesRelations = relations(messageSummaries, ({ many }) => ({
  messages: many(ciMessages),
}));

export const ciMessagesRelations = relations(ciMessages, ({ one }) => ({
  projectSummary: one(projectSummaries, {
    fields: [ciMessages.projectSummaryId],
    references: [projectSummaries.id],
  }),
}));

export const projectSummariesRelations = relations(projectSummaries, ({ many }) => ({
  messages: many(ciMessages),
}));

export const sessionModificationsRelations = relations(sessionModifications, ({ one }) => ({
  message: one(ciMessages, {
    fields: [sessionModifications.messageId],
    references: [ciMessages.id],
  }),
}));

// Types for component integrator
export type CIMessage = typeof ciMessages.$inferSelect;
export type NewCIMessage = typeof ciMessages.$inferInsert;
export type MessageSummary = typeof messageSummaries.$inferSelect;
export type NewMessageSummary = typeof messageSummaries.$inferInsert;
export type ConversationStats = typeof conversationStats.$inferSelect;
export type NewConversationStats = typeof conversationStats.$inferInsert;
export type ProjectSummary = typeof projectSummaries.$inferSelect;
export type NewProjectSummary = typeof projectSummaries.$inferInsert;
export type SessionModification = typeof sessionModifications.$inferSelect;
export type NewSessionModification = typeof sessionModifications.$inferInsert;

// Enhanced type for modification details
export interface ModificationDetails {
  file: string;
  range: {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
    originalCode: string;
  };
  modifiedCode: string;
}

// Session-based context interface
export interface SessionContext {
  sessionId: string;
  projectId?: number;
  hasActiveConversation: boolean;
  messageCount: number;
  lastActivity: Date;
  summaryExists: boolean;
}