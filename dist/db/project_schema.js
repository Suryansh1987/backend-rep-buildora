"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectDeploymentsRelations = exports.projectSessionsRelations = exports.userUsageRelations = exports.projectFilesRelations = exports.projectsRelations = exports.usersRelations = exports.projectDeployments = exports.projectSessions = exports.userUsage = exports.projectFiles = exports.projects = exports.users = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
// Users table - Production ready with proper indexing
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    clerkId: (0, pg_core_1.varchar)('clerk_id', { length: 255 }).notNull().unique(),
    email: (0, pg_core_1.varchar)('email', { length: 255 }).notNull().unique(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    phoneNumber: (0, pg_core_1.varchar)('phone_number', { length: 20 }),
    profileImage: (0, pg_core_1.text)('profile_image'),
    plan: (0, pg_core_1.varchar)('plan', { length: 50 }).default('free').notNull(), // free, pro, enterprise
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    lastLoginAt: (0, pg_core_1.timestamp)('last_login_at'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
// Projects table - Enhanced for production with session tracking
exports.projects = (0, pg_core_1.pgTable)('projects', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.integer)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    status: (0, pg_core_1.varchar)('status', { length: 50 }).default('pending').notNull(), // pending, building, ready, error
    projectType: (0, pg_core_1.varchar)('project_type', { length: 100 }).default('frontend'),
    generatedCode: (0, pg_core_1.jsonb)('generated_code'),
    deploymentUrl: (0, pg_core_1.text)('deployment_url'),
    downloadUrl: (0, pg_core_1.text)('download_url'),
    zipUrl: (0, pg_core_1.text)('zip_url'), // Source ZIP URL for modifications
    buildId: (0, pg_core_1.text)('build_id'), // Azure build ID
    githubUrl: (0, pg_core_1.text)('github_url'),
    // Session and conversation tracking
    lastSessionId: (0, pg_core_1.text)('last_session_id'), // Track last active session
    conversationTitle: (0, pg_core_1.varchar)('conversation_title', { length: 255 }).default('Project Chat'),
    lastMessageAt: (0, pg_core_1.timestamp)('last_message_at'),
    messageCount: (0, pg_core_1.integer)('message_count').default(0),
    // Project metadata
    framework: (0, pg_core_1.varchar)('framework', { length: 50 }).default('react'),
    template: (0, pg_core_1.varchar)('template', { length: 100 }).default('vite-react-ts'),
    isPublic: (0, pg_core_1.boolean)('is_public').default(false),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
// Project files table - For tracking individual files
exports.projectFiles = (0, pg_core_1.pgTable)('project_files', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    projectId: (0, pg_core_1.integer)('project_id').references(() => exports.projects.id, { onDelete: 'cascade' }).notNull(),
    fileName: (0, pg_core_1.varchar)('file_name', { length: 255 }).notNull(),
    filePath: (0, pg_core_1.text)('file_path').notNull(),
    fileContent: (0, pg_core_1.text)('file_content'),
    fileType: (0, pg_core_1.varchar)('file_type', { length: 50 }),
    fileSize: (0, pg_core_1.integer)('file_size'), // in bytes
    lastModifiedAt: (0, pg_core_1.timestamp)('last_modified_at').defaultNow(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
// User usage tracking - Enhanced for production billing
exports.userUsage = (0, pg_core_1.pgTable)('user_usage', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.integer)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    month: (0, pg_core_1.varchar)('month', { length: 7 }).notNull(), // YYYY-MM format
    // Usage metrics
    tokensUsed: (0, pg_core_1.integer)('tokens_used').default(0).notNull(),
    projectsCreated: (0, pg_core_1.integer)('projects_created').default(0).notNull(),
    messagesCount: (0, pg_core_1.integer)('messages_count').default(0).notNull(),
    modificationsCount: (0, pg_core_1.integer)('modifications_count').default(0).notNull(),
    deploymentsCount: (0, pg_core_1.integer)('deployments_count').default(0).notNull(),
    // Limits and billing
    tokenLimit: (0, pg_core_1.integer)('token_limit').default(100000).notNull(), // Monthly token limit
    projectLimit: (0, pg_core_1.integer)('project_limit').default(5).notNull(), // Monthly project limit
    isOverLimit: (0, pg_core_1.boolean)('is_over_limit').default(false),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
// Project sessions table - Track active chat sessions
exports.projectSessions = (0, pg_core_1.pgTable)('project_sessions', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    projectId: (0, pg_core_1.integer)('project_id').references(() => exports.projects.id, { onDelete: 'cascade' }).notNull(),
    sessionId: (0, pg_core_1.text)('session_id').notNull().unique(),
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    lastActivity: (0, pg_core_1.timestamp)('last_activity').defaultNow(),
    messageCount: (0, pg_core_1.integer)('message_count').default(0),
    // Session metadata
    userAgent: (0, pg_core_1.text)('user_agent'),
    ipAddress: (0, pg_core_1.varchar)('ip_address', { length: 45 }),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
// Project deployments table - Track deployment history
exports.projectDeployments = (0, pg_core_1.pgTable)('project_deployments', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    projectId: (0, pg_core_1.integer)('project_id').references(() => exports.projects.id, { onDelete: 'cascade' }).notNull(),
    buildId: (0, pg_core_1.text)('build_id').notNull(),
    deploymentUrl: (0, pg_core_1.text)('deployment_url').notNull(),
    downloadUrl: (0, pg_core_1.text)('download_url'),
    zipUrl: (0, pg_core_1.text)('zip_url'),
    status: (0, pg_core_1.varchar)('status', { length: 50 }).default('pending').notNull(), // pending, building, deployed, failed
    buildTime: (0, pg_core_1.integer)('build_time'), // in milliseconds
    errorMessage: (0, pg_core_1.text)('error_message'),
    // Deployment metadata
    framework: (0, pg_core_1.varchar)('framework', { length: 50 }),
    nodeVersion: (0, pg_core_1.varchar)('node_version', { length: 20 }),
    packageManager: (0, pg_core_1.varchar)('package_manager', { length: 20 }),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
// Relations
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.users, ({ many }) => ({
    projects: many(exports.projects),
    usage: many(exports.userUsage),
}));
exports.projectsRelations = (0, drizzle_orm_1.relations)(exports.projects, ({ one, many }) => ({
    user: one(exports.users, {
        fields: [exports.projects.userId],
        references: [exports.users.id],
    }),
    files: many(exports.projectFiles),
    sessions: many(exports.projectSessions),
    deployments: many(exports.projectDeployments),
}));
exports.projectFilesRelations = (0, drizzle_orm_1.relations)(exports.projectFiles, ({ one }) => ({
    project: one(exports.projects, {
        fields: [exports.projectFiles.projectId],
        references: [exports.projects.id],
    }),
}));
exports.userUsageRelations = (0, drizzle_orm_1.relations)(exports.userUsage, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.userUsage.userId],
        references: [exports.users.id],
    }),
}));
exports.projectSessionsRelations = (0, drizzle_orm_1.relations)(exports.projectSessions, ({ one }) => ({
    project: one(exports.projects, {
        fields: [exports.projectSessions.projectId],
        references: [exports.projects.id],
    }),
}));
exports.projectDeploymentsRelations = (0, drizzle_orm_1.relations)(exports.projectDeployments, ({ one }) => ({
    project: one(exports.projects, {
        fields: [exports.projectDeployments.projectId],
        references: [exports.projects.id],
    }),
}));
//# sourceMappingURL=project_schema.js.map