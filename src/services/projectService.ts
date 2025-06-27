import { db } from "../db";
import { projects, type Project, type NewProject } from "../db/project_schema";
import { eq, desc, and } from "drizzle-orm";

class ProjectService {
  async createProject(projectData: NewProject): Promise<Project> {
    try {
      const newProject = await db
        .insert(projects)
        .values({
          ...projectData,
          conversationTitle:
            projectData.conversationTitle || `${projectData.name} Chat`,
        })
        .returning();

      return newProject[0];
    } catch (error) {
      console.error("Error creating project:", error);
      throw error;
    }
  }

  async getProjectsByUserId(userId: number): Promise<Project[]> {
    try {
      const userProjects = await db
        .select()
        .from(projects)
        .where(and(eq(projects.userId, userId), eq(projects.status, "ready")))
        .orderBy(desc(projects.updatedAt));

      return userProjects;
    } catch (error) {
      console.error("Error getting projects:", error);
      throw error;
    }
  }

  async getProjectById(projectId: number): Promise<Project | null> {
    try {
      const project = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      return project[0] || null;
    } catch (error) {
      console.error("Error getting project:", error);
      throw error;
    }
  }

  async updateProject(
    projectId: number,
    updates: Partial<Project>
  ): Promise<Project> {
    try {
      const updatedProject = await db
        .update(projects)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(projects.id, projectId))
        .returning();

      return updatedProject[0];
    } catch (error) {
      console.error("Error updating project:", error);
      throw error;
    }
  }

  async deleteProject(projectId: number): Promise<boolean> {
    try {
      await db
        .update(projects)
        .set({ status: "deleted", updatedAt: new Date() })
        .where(eq(projects.id, projectId));

      return true;
    } catch (error) {
      console.error("Error deleting project:", error);
      throw error;
    }
  }
}

export default new ProjectService();
