import { pgTable, serial, varchar, text, timestamp, integer, jsonb, boolean, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table - Production ready with proper indexing
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  clerkId: varchar('clerk_id', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 20 }),
  profileImage: text('profile_image'),
  plan: varchar('plan', { length: 50 }).default('free').notNull(), // free, pro, enterprise
  isActive: boolean('is_active').default(true).notNull(),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Projects table - Enhanced for production with session tracking
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).default('pending').notNull(), // pending, building, ready, error
  projectType: varchar('project_type', { length: 100 }).default('frontend'),
  generatedCode: jsonb('generated_code'),
  deploymentUrl: text('deployment_url'),
  downloadUrl: text('download_url'),
  zipUrl: text('zip_url'), // Source ZIP URL for modifications
  buildId: text('build_id'), // Azure build ID
  githubUrl: text('github_url'),
  
  // Session and conversation tracking
  lastSessionId: text('last_session_id'), // Track last active session
  conversationTitle: varchar('conversation_title', { length: 255 }).default('Project Chat'),
  lastMessageAt: timestamp('last_message_at'),
  messageCount: integer('message_count').default(0),
  
  // Project metadata
  framework: varchar('framework', { length: 50 }).default('react'),
  template: varchar('template', { length: 100 }).default('vite-react-ts'),
  isPublic: boolean('is_public').default(false),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Project files table - For tracking individual files
export const projectFiles = pgTable('project_files', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  filePath: text('file_path').notNull(),
  fileContent: text('file_content'),
  fileType: varchar('file_type', { length: 50 }),
  fileSize: integer('file_size'), // in bytes
  lastModifiedAt: timestamp('last_modified_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// User usage tracking - Enhanced for production billing
export const userUsage = pgTable('user_usage', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  month: varchar('month', { length: 7 }).notNull(), // YYYY-MM format
  
  // Usage metrics
  tokensUsed: integer('tokens_used').default(0).notNull(),
  projectsCreated: integer('projects_created').default(0).notNull(),
  messagesCount: integer('messages_count').default(0).notNull(),
  modificationsCount: integer('modifications_count').default(0).notNull(),
  deploymentsCount: integer('deployments_count').default(0).notNull(),
  
  // Limits and billing
  tokenLimit: integer('token_limit').default(100000).notNull(), // Monthly token limit
  projectLimit: integer('project_limit').default(5).notNull(), // Monthly project limit
  isOverLimit: boolean('is_over_limit').default(false),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Project sessions table - Track active chat sessions
export const projectSessions = pgTable('project_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  sessionId: text('session_id').notNull().unique(),
  isActive: boolean('is_active').default(true),
  lastActivity: timestamp('last_activity').defaultNow(),
  messageCount: integer('message_count').default(0),
  
  // Session metadata
  userAgent: text('user_agent'),
  ipAddress: varchar('ip_address', { length: 45 }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Project deployments table - Track deployment history
export const projectDeployments = pgTable('project_deployments', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  buildId: text('build_id').notNull(),
  deploymentUrl: text('deployment_url').notNull(),
  downloadUrl: text('download_url'),
  zipUrl: text('zip_url'),
  
  status: varchar('status', { length: 50 }).default('pending').notNull(), // pending, building, deployed, failed
  buildTime: integer('build_time'), // in milliseconds
  errorMessage: text('error_message'),
  
  // Deployment metadata
  framework: varchar('framework', { length: 50 }),
  nodeVersion: varchar('node_version', { length: 20 }),
  packageManager: varchar('package_manager', { length: 20 }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  usage: many(userUsage),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  files: many(projectFiles),
  sessions: many(projectSessions),
  deployments: many(projectDeployments),
}));

export const projectFilesRelations = relations(projectFiles, ({ one }) => ({
  project: one(projects, {
    fields: [projectFiles.projectId],
    references: [projects.id],
  }),
}));

export const userUsageRelations = relations(userUsage, ({ one }) => ({
  user: one(users, {
    fields: [userUsage.userId],
    references: [users.id],
  }),
}));

export const projectSessionsRelations = relations(projectSessions, ({ one }) => ({
  project: one(projects, {
    fields: [projectSessions.projectId],
    references: [projects.id],
  }),
}));

export const projectDeploymentsRelations = relations(projectDeployments, ({ one }) => ({
  project: one(projects, {
    fields: [projectDeployments.projectId],
    references: [projects.id],
  }),
}));

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectFile = typeof projectFiles.$inferSelect;
export type NewProjectFile = typeof projectFiles.$inferInsert;
export type UserUsage = typeof userUsage.$inferSelect;
export type NewUserUsage = typeof userUsage.$inferInsert;
export type ProjectSession = typeof projectSessions.$inferSelect;
export type NewProjectSession = typeof projectSessions.$inferInsert;
export type ProjectDeployment = typeof projectDeployments.$inferSelect;
export type NewProjectDeployment = typeof projectDeployments.$inferInsert;