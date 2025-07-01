// Enhanced Project URL Manager - Updated for better project identification and URL tracking
import { DrizzleMessageHistoryDB } from '../db/messagesummary';

export class EnhancedProjectUrlManager {
  constructor(private messageDB: DrizzleMessageHistoryDB) {}

  /**
   * Main method to save or update project URLs with comprehensive identification
   */
  async saveOrUpdateProjectUrls(
    sessionId: string,
    buildId: string,
    urls: {
      deploymentUrl: string;
      downloadUrl: string;
      zipUrl: string;
    },
    context: {
      projectId?: number;        // Explicit project ID from frontend
      userId?: number;           // User ID from auth/session
      isModification?: boolean;  // true = modify existing, false = create new
      prompt?: string;
      name?: string;
      description?: string;
      framework?: string;
      template?: string;
    }
  ): Promise<{ projectId: number; action: 'created' | 'updated' }> {
    try {
      console.log(`📊 Project URL Management - Session: ${sessionId}, Build: ${buildId}, IsModification: ${context.isModification}`);

      // STRATEGY 1: Use explicit projectId if provided (highest priority)
      if (context.projectId) {
        console.log(`📊 Using explicit project ID: ${context.projectId}`);
        const project = await this.getProjectById(context.projectId);
        
        if (project) {
          await this.updateExistingProject(project.id, buildId, urls, sessionId, context.prompt);
          return { projectId: project.id, action: 'updated' };
        } else {
          console.warn(`⚠️ Explicit project ID ${context.projectId} not found, falling back to other strategies`);
        }
      }

      // STRATEGY 2: For modifications, find existing project using multiple methods
      if (context.isModification) {
        const existingProject = await this.findProjectForModification(sessionId, context.userId);
        
        if (existingProject) {
          console.log(`📊 Found existing project ${existingProject.id} for modification`);
          await this.updateExistingProject(existingProject.id, buildId, urls, sessionId, context.prompt);
          return { projectId: existingProject.id, action: 'updated' };
        } else {
          console.log(`⚠️ No existing project found for modification despite isModification=true`);
          console.log(`📊 Creating new project instead`);
        }
      }

      // STRATEGY 3: Create new project
      const projectId = await this.createNewProject(sessionId, buildId, urls, context);
      return { projectId, action: 'created' };

    } catch (error) {
      console.error('❌ Failed to save/update project URLs:', error);
      throw error; // Re-throw to handle at calling level
    }
  }

  /**
   * Find project for modification with comprehensive fallback strategies
   */
  private async findProjectForModification(sessionId: string, userId?: number): Promise<any> {
    try {
      console.log(`🔍 Finding project for modification - Session: ${sessionId}, User: ${userId}`);

      // Priority 1: Find by sessionId (most recent session activity)
      let project = await this.messageDB.getProjectBySessionId(sessionId);
      if (project) {
        console.log(`✅ Found project by sessionId: ${project.id}`);
        return project;
      }

      // Priority 2: Find most recent project by userId
      if (userId) {
        const userProjects = await this.messageDB.getUserProjects(userId);
        if (userProjects.length > 0) {
          project = userProjects[0]; // Most recent by updatedAt
          console.log(`✅ Found most recent user project: ${project.id}`);
          return project;
        }
      }

      // Priority 3: Find any recent project (fallback for single-user scenarios)
      const recentProjects = await this.messageDB.getRecentProjects(1);
      if (recentProjects.length > 0) {
        project = recentProjects[0];
        console.log(`✅ Found most recent project: ${project.id}`);
        return project;
      }

      // Priority 4: Check for project with same buildId (edge case)
      project = await this.messageDB.getProjectByBuildId(sessionId);
      if (project) {
        console.log(`✅ Found project by buildId: ${project.id}`);
        return project;
      }

      console.log(`❌ No existing project found for modification`);
      return null;
    } catch (error) {
      console.error('Error finding project for modification:', error);
      return null;
    }
  }

  /**
   * Get project by ID with error handling
   */
  private async getProjectById(projectId: number): Promise<any> {
    try {
      // You might need to add this method to DrizzleMessageHistoryDB
      const projects = await this.messageDB.getUserProjects(1); // This is a fallback
      return projects.find(p => p.id === projectId) || null;
    } catch (error) {
      console.error(`Error getting project by ID ${projectId}:`, error);
      return null;
    }
  }

  /**
   * Update existing project with new URLs and metadata
   */
  private async updateExistingProject(
    projectId: number,
    buildId: string,
    urls: { deploymentUrl: string; downloadUrl: string; zipUrl: string },
    sessionId: string,
    prompt?: string
  ): Promise<void> {
    try {
      console.log(`📊 Updating existing project ${projectId} with new URLs`);

      // Update project URLs and metadata
      await this.messageDB.updateProjectUrls(projectId, {
        deploymentUrl: urls.deploymentUrl,
        downloadUrl: urls.downloadUrl,
        zipUrl: urls.zipUrl,
        buildId: buildId,
        status: 'ready',
        lastSessionId: sessionId,
        lastMessageAt: new Date(),
        updatedAt: new Date()
      });

      // Increment message count for this session
      await this.messageDB.incrementProjectMessageCount(sessionId);

      // Update conversation title if we have a new prompt
      if (prompt && prompt.length > 10) {
        await this.updateConversationTitle(projectId, prompt);
      }

      console.log(`✅ Successfully updated project ${projectId}`);
    } catch (error) {
      console.error(`Error updating project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Create new project with comprehensive metadata
   */
  private async createNewProject(
    sessionId: string,
    buildId: string,
    urls: { deploymentUrl: string; downloadUrl: string; zipUrl: string },
    context: {
      userId?: number;
      prompt?: string;
      name?: string;
      description?: string;
      framework?: string;
      template?: string;
    }
  ): Promise<number> {
    try {
      console.log(`📊 Creating new project for session: ${sessionId}`);
const projectData = {
  userId: context.userId || 1, // Default user if not provided
  name: context.name || this.generateProjectName(context.prompt, buildId),
  description: context.description || this.generateProjectDescription(context.prompt),
  status: 'ready' as const,
  projectType: 'frontend' as const,
  deploymentUrl: urls.deploymentUrl,
  downloadUrl: urls.downloadUrl,
  zipUrl: urls.zipUrl,
  buildId: buildId,
  lastSessionId: sessionId,
  lastMessageAt: new Date(),
  messageCount: 1,
  conversationTitle: context.name || this.generateProjectName(context.prompt, buildId),
  framework: 'react',
  template: 'vite-react-ts',
};


      const projectId = await this.messageDB.createProject(projectData);
      console.log(`✅ Created new project ${projectId}`);
      return projectId;
    } catch (error) {
      console.error('Error creating new project:', error);
      throw error;
    }
  }

  /**
   * Generate a smart project name from prompt
   */
  private generateProjectName(prompt?: string, buildId?: string): string {
    if (!prompt) {
      return `Project ${buildId?.slice(0, 8) || 'Unknown'}`;
    }

    // Extract meaningful words from prompt
    const words = prompt
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !['create', 'build', 'make', 'generate', 'website', 'app', 'application'].includes(word))
      .slice(0, 3);

    if (words.length > 0) {
      return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }

    return `Project ${buildId?.slice(0, 8) || 'Unknown'}`;
  }

  /**
   * Generate project description from prompt
   */
  private generateProjectDescription(prompt?: string): string {
    if (!prompt) {
      return 'Auto-generated project';
    }

    // Truncate and clean the prompt for description
    return prompt.length > 200 ? prompt.substring(0, 197) + '...' : prompt;
  }

  /**
   * Update conversation title based on latest prompt
   */
  private async updateConversationTitle(projectId: number, prompt: string): Promise<void> {
    try {
      const newTitle = this.generateProjectName(prompt);
      // You might need to add this method to DrizzleMessageHistoryDB
      // await this.messageDB.updateProjectConversationTitle(projectId, newTitle);
      console.log(`📝 Would update conversation title to: ${newTitle}`);
    } catch (error) {
      console.error('Error updating conversation title:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Get project URLs by various identifiers
   */
  async getProjectUrls(identifier: {
    projectId?: number;
    sessionId?: string;
    buildId?: string;
    userId?: number;
  }): Promise<{
    projectId: number;
    deploymentUrl: string;
    downloadUrl: string;
    zipUrl: string;
    buildId: string;
    lastSessionId: string;
  } | null> {
    try {
      let project = null;

      if (identifier.projectId) {
        project = await this.getProjectById(identifier.projectId);
      } else if (identifier.sessionId) {
        project = await this.messageDB.getProjectBySessionId(identifier.sessionId);
      } else if (identifier.buildId) {
        project = await this.messageDB.getProjectByBuildId(identifier.buildId);
      } else if (identifier.userId) {
        const userProjects = await this.messageDB.getUserProjects(identifier.userId);
        project = userProjects[0] || null;
      }

      if (!project) {
        return null;
      }

      return {
        projectId: project.id,
        deploymentUrl: project.deploymentUrl,
        downloadUrl: project.downloadUrl,
        zipUrl: project.zipUrl,
        buildId: project.buildId,
        lastSessionId: project.lastSessionId
      };
    } catch (error) {
      console.error('Error getting project URLs:', error);
      return null;
    }
  }

  /**
   * Link a session to an existing project
   */
  async linkSessionToProject(sessionId: string, projectId: number): Promise<void> {
    try {
      await this.messageDB.linkSessionToProject(sessionId, projectId);
      console.log(`✅ Linked session ${sessionId} to project ${projectId}`);
    } catch (error) {
      console.error(`Error linking session to project:`, error);
      throw error;
    }
  }

  /**
   * Get project deployment history
   */
  async getProjectDeploymentHistory(projectId: number): Promise<any[]> {
    try {
      // This would need to be implemented in DrizzleMessageHistoryDB
      // For now, return basic project info
      const project = await this.getProjectById(projectId);
      if (!project) return [];

      return [{
        buildId: project.buildId,
        deploymentUrl: project.deploymentUrl,
        downloadUrl: project.downloadUrl,
        zipUrl: project.zipUrl,
        createdAt: project.updatedAt,
        status: project.status
      }];
    } catch (error) {
      console.error('Error getting deployment history:', error);
      return [];
    }
  }
}