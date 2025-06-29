"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userUsageRelations = exports.projectFilesRelations = exports.messagesRelations = exports.projectsRelations = exports.usersRelations = exports.userUsage = exports.projectFiles = exports.messages = exports.projects = exports.users = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
// Users table
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    clerkId: (0, pg_core_1.varchar)('clerk_id', { length: 255 }).notNull().unique(),
    email: (0, pg_core_1.varchar)('email', { length: 255 }).notNull().unique(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    phoneNumber: (0, pg_core_1.varchar)('phone_number', { length: 20 }),
    profileImage: (0, pg_core_1.text)('profile_image'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
// Projects table
exports.projects = (0, pg_core_1.pgTable)('projects', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.integer)('user_id').references(() => exports.users.id).notNull(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    status: (0, pg_core_1.varchar)('status', { length: 50 }).default('active').notNull(),
    projectType: (0, pg_core_1.varchar)('project_type', { length: 100 }),
    generatedCode: (0, pg_core_1.jsonb)('generated_code'),
    deploymentUrl: (0, pg_core_1.text)('deployment_url'),
    githubUrl: (0, pg_core_1.text)('github_url'),
    conversationTitle: (0, pg_core_1.varchar)('conversation_title', { length: 255 }).default('Project Chat'),
    lastMessageAt: (0, pg_core_1.timestamp)('last_message_at'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
// Messages table
exports.messages = (0, pg_core_1.pgTable)('messages', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    projectId: (0, pg_core_1.integer)('project_id').references(() => exports.projects.id).notNull(),
    role: (0, pg_core_1.varchar)('role', { length: 20 }).notNull(),
    content: (0, pg_core_1.text)('content').notNull(),
    metadata: (0, pg_core_1.jsonb)('metadata'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
// Project files table
exports.projectFiles = (0, pg_core_1.pgTable)('project_files', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    projectId: (0, pg_core_1.integer)('project_id').references(() => exports.projects.id).notNull(),
    fileName: (0, pg_core_1.varchar)('file_name', { length: 255 }).notNull(),
    filePath: (0, pg_core_1.text)('file_path').notNull(),
    fileContent: (0, pg_core_1.text)('file_content'),
    fileType: (0, pg_core_1.varchar)('file_type', { length: 50 }),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
// User usage tracking
exports.userUsage = (0, pg_core_1.pgTable)('user_usage', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.integer)('user_id').references(() => exports.users.id).notNull(),
    month: (0, pg_core_1.varchar)('month', { length: 7 }).notNull(),
    tokensUsed: (0, pg_core_1.integer)('tokens_used').default(0).notNull(),
    projectsCreated: (0, pg_core_1.integer)('projects_created').default(0).notNull(),
    messagesCount: (0, pg_core_1.integer)('messages_count').default(0).notNull(),
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
    messages: many(exports.messages),
    files: many(exports.projectFiles),
}));
exports.messagesRelations = (0, drizzle_orm_1.relations)(exports.messages, ({ one }) => ({
    project: one(exports.projects, {
        fields: [exports.messages.projectId],
        references: [exports.projects.id],
    }),
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
//# sourceMappingURL=project_schema.js.map