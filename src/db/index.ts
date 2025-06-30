// db/index.ts - Clean database connection
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

// Import your existing project schema
import * as schema from "./project_schema";

// Create connection
const sql = neon(process.env.DATABASE_URL!);

// Create database instance with main schema
export const db = drizzle(sql, {
  schema: {
    ...schema
  }
});

// Export main project types
export type User = typeof schema.users.$inferSelect;
export type NewUser = typeof schema.users.$inferInsert;
export type Project = typeof schema.projects.$inferSelect;
export type NewProject = typeof schema.projects.$inferInsert;
export type ProjectFile = typeof schema.projectFiles.$inferSelect;
export type NewProjectFile = typeof schema.projectFiles.$inferInsert;
export type UserUsage = typeof schema.userUsage.$inferSelect;
export type NewUserUsage = typeof schema.userUsage.$inferInsert;
export type ProjectSession = typeof schema.projectSessions.$inferSelect;
export type NewProjectSession = typeof schema.projectSessions.$inferInsert;
export type ProjectDeployment = typeof schema.projectDeployments.$inferSelect;
export type NewProjectDeployment = typeof schema.projectDeployments.$inferInsert;

// Export schema for use in other files
export { schema };
export default db;