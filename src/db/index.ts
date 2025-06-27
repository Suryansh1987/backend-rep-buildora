// db/index.ts - Updated database connection with both schemas
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

// Import your existing schema
import * as schema from "./project_schema";
// Import component integrator schema
import * as ciSchema from "./message_schema";

// Create connection
const sql = neon(process.env.DATABASE_URL!);

// Create database instance with combined schemas
export const db = drizzle(sql, { 
  schema: {
    ...schema,
    ...ciSchema
  }
});

// Export your existing types
export type User = typeof schema.users.$inferSelect;
export type NewUser = typeof schema.users.$inferInsert;
export type Project = typeof schema.projects.$inferSelect;
export type NewProject = typeof schema.projects.$inferInsert;
export type Message = typeof schema.messages.$inferSelect;
export type NewMessage = typeof schema.messages.$inferInsert;
export type ProjectFile = typeof schema.projectFiles.$inferSelect;
export type NewProjectFile = typeof schema.projectFiles.$inferInsert;
export type UserUsage = typeof schema.userUsage.$inferSelect;
export type NewUserUsage = typeof schema.userUsage.$inferInsert;

// Export component integrator types
export type CIMessage = typeof ciSchema.ciMessages.$inferSelect;
export type NewCIMessage = typeof ciSchema.ciMessages.$inferInsert;
export type MessageSummary = typeof ciSchema.messageSummaries.$inferSelect;
export type NewMessageSummary = typeof ciSchema.messageSummaries.$inferInsert;
export type ConversationStats = typeof ciSchema.conversationStats.$inferSelect;
export type ProjectSummary = typeof ciSchema.projectSummaries.$inferSelect;
export type NewProjectSummary = typeof ciSchema.projectSummaries.$inferInsert;

// Export schemas for use in other files
export * as mainSchema from "./project_schema";
export * as componentIntegratorSchema from "./message_schema";