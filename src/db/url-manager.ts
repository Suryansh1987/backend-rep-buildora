// Enhanced Project URL Manager - Fixed with proper duplicate prevention
import { DrizzleMessageHistoryDB } from '../db/messagesummary';

export class EnhancedProjectUrlManager {
  constructor(private messageDB: DrizzleMessageHistoryDB) {}

  /**
   * Main method to save or update project URLs with comprehensive identification and duplicate prevention
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

      // STEP 1: Ensure user exists if userId is provided
      if (context.userId) {
        try {
          await this.messageDB.ensureUserExists(context.userId);
          console.log(`✅ User ${context.userId} verified/created`);
        } catch (userError) {
          console.error(`❌ Failed to ensure user ${context.userId} exists:`, userError);
          throw new Error(`User validation failed: ${userError instanceof Error ? userError.message : 'Unknown error'}`);
        }
      }

      // STEP 2: Check for existing projects to prevent duplicates
      console.log(`🔍 Checking for existing projects to prevent duplicates...`);
      
      // Check by sessionId first
      let existingProject = await this.messageDB.getProjectBySessionId(sessionId);
      if (existingProject) {
        console.log(`📊 Found existing project by sessionId: ${existingProject.id} - updating instead of creating`);
        await this.updateExistingProject(existingProject.id, buildId, urls, sessionId, context.prompt);
        return { projectId: existingProject.id, action: 'updated' };
      }

      // Check by buildId to prevent duplicate builds
      existingProject = await this.messageDB.getProjectByBuildId(buildId);
      if (existingProject) {
        console.log(`📊 Found existing project by buildId: ${existingProject.id} - updating instead of creating`);
        await this.updateExistingProject(existingProject.id, buildId, urls, sessionId, context.prompt);
        return { projectId: existingProject.id, action: 'updated' };
      }

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

      // STRATEGY 3: Create new project (ONLY if no existing project found)
      console.log(`✨ No existing project found - creating new project...`);
      const projectId = await this.createNewProjectWithDuplicateCheck(sessionId, buildId, urls, context);
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
      const project = await this.messageDB.getProjectWithHistory(projectId);
      return project;
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
   * Create new project with comprehensive metadata, user validation, and duplicate checking
   */
  private async createNewProjectWithDuplicateCheck(
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
      console.log(`📊 Creating new project for session: ${sessionId} with duplicate checking...`);
      
      // Ensure we have a valid userId
      let validUserId = context.userId;
      
      if (!validUserId) {
        // Try to get most recent user if no userId provided
        const mostRecentUserId = await this.messageDB.getMostRecentUserId();
        if (mostRecentUserId) {
          validUserId = mostRecentUserId;
          console.log(`📊 Using most recent user ID: ${validUserId}`);
        } else {
          // Create a new user as last resort
          const newUserId = Date.now() % 1000000;
          await this.messageDB.ensureUserExists(newUserId, {
            email: `user${newUserId}@buildora.dev`,
            name: `User ${newUserId}`
          });
          validUserId = newUserId;
          console.log(`📊 Created new user: ${validUserId}`);
        }
      }

      // FINAL DUPLICATE CHECK: Check if a project with the same zipUrl already exists for this user
      const userProjects = await this.messageDB.getUserProjects(validUserId);
      const duplicateProject = userProjects.find(p => 
        p.zipUrl === urls.zipUrl || 
        p.buildId === buildId ||
        p.lastSessionId === sessionId
      );
      
      if (duplicateProject) {
        console.log(`🔄 Found duplicate project ${duplicateProject.id} - updating instead of creating new`);
        await this.updateExistingProject(duplicateProject.id, buildId, urls, sessionId, context.prompt);
        return duplicateProject.id;
      }

      const projectData = {
        userId: validUserId,
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
        framework: context.framework || 'react',
        template: context.template || 'vite-react-ts',
      };

      const projectId = await this.messageDB.createProject(projectData);
      console.log(`✅ Created new project ${projectId} for user ${validUserId}`);
      return projectId;
    } catch (error) {
      console.error('Error creating new project:', error);
      
      // If project creation fails due to user constraint, try to resolve and retry once
      if (error instanceof Error && error.message.includes('foreign key constraint')) {
        console.log(`🔄 Retrying project creation with user validation...`);
        
        try {
          // Ensure user exists and retry
          const fallbackUserId = context.userId || Date.now() % 1000000;
          await this.messageDB.ensureUserExists(fallbackUserId);
          
          const retryProjectData = {
            userId: fallbackUserId,
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
            framework: context.framework || 'react',
            template: context.template || 'vite-react-ts',
          };

          const projectId = await this.messageDB.createProject(retryProjectData);
          console.log(`✅ Retry successful - Created project ${projectId} for user ${fallbackUserId}`);
          return projectId;
        } catch (retryError) {
          console.error('Retry also failed:', retryError);
          throw retryError;
        }
      }
      
      throw error;
    }
  }

  /**
   * DEPRECATED: Use createNewProjectWithDuplicateCheck instead
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
    console.warn('⚠️ createNewProject is deprecated, using createNewProjectWithDuplicateCheck');
    return this.createNewProjectWithDuplicateCheck(sessionId, buildId, urls, context);
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
      console.log(`📝 Would update conversation title to: ${newTitle}`);
      // Implementation would depend on your schema having a conversation title field
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

  /**
   * Validate project ownership
   */
  async validateProjectOwnership(projectId: number, userId: number): Promise<boolean> {
    try {
      const project = await this.getProjectById(projectId);
      return project && project.userId === userId;
    } catch (error) {
      console.error('Error validating project ownership:', error);
      return false;
    }
  }

  /**
   * Get user's project statistics
   */
  async getUserProjectStats(userId: number): Promise<{
    totalProjects: number;
    activeProjects: number;
    totalDeployments: number;
    lastActivity: Date | null;
  }> {
    try {
      const userProjects = await this.messageDB.getUserProjects(userId);
      
      const stats = {
        totalProjects: userProjects.length,
        activeProjects: userProjects.filter(p => p.status === 'ready').length,
        totalDeployments: userProjects.filter(p => p.deploymentUrl).length,
        lastActivity: userProjects.length > 0 ? userProjects[0].lastMessageAt : null
      };

      return stats;
    } catch (error) {
      console.error('Error getting user project stats:', error);
      return {
        totalProjects: 0,
        activeProjects: 0,
        totalDeployments: 0,
        lastActivity: null
      };
    }
  }

  /**
   * Clean up old projects for a user (keep only latest N projects)
   */
  async cleanupUserProjects(userId: number, keepLatest: number = 10): Promise<number> {
    try {
      const userProjects = await this.messageDB.getUserProjects(userId);
      
      if (userProjects.length <= keepLatest) {
        return 0; // No cleanup needed
      }

      const projectsToDelete = userProjects.slice(keepLatest);
      let deletedCount = 0;

      for (const project of projectsToDelete) {
        try {
          // Update project status to 'archived' instead of deleting
          await this.messageDB.updateProjectStatus(project.id, 'archived');
          deletedCount++;
        } catch (deleteError) {
          console.error(`Failed to archive project ${project.id}:`, deleteError);
        }
      }

      console.log(`✅ Archived ${deletedCount} old projects for user ${userId}`);
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up user projects:', error);
      return 0;
    }
  }

  /**
   * Get projects by status
   */
  async getProjectsByStatus(status: string, limit: number = 50): Promise<any[]> {
    try {
      const projects = await this.messageDB.getAllProjectsWithUrls();
      return projects
        .filter(p => p.status === status)
        .slice(0, limit);
    } catch (error) {
      console.error(`Error getting projects by status ${status}:`, error);
      return [];
    }
  }

  /**
   * Search projects by name or description
   */
  async searchProjects(query: string, userId?: number): Promise<any[]> {
    try {
      const searchTerm = query.toLowerCase();
      let projects;

      if (userId) {
        projects = await this.messageDB.getUserProjects(userId);
      } else {
        projects = await this.messageDB.getAllProjectsWithUrls();
      }

      return projects.filter(project => 
        project.name.toLowerCase().includes(searchTerm) ||
        (project.description && project.description.toLowerCase().includes(searchTerm))
      );
    } catch (error) {
      console.error('Error searching projects:', error);
      return [];
    }
  }

  /**
   * Get project build history
   */
  async getProjectBuilds(projectId: number): Promise<any[]> {
    try {
      const project = await this.getProjectById(projectId);
      if (!project) return [];

      // For now, return the single current build
      // In a full implementation, you'd have a builds table
      return [{
        buildId: project.buildId,
        status: project.status,
        deploymentUrl: project.deploymentUrl,
        downloadUrl: project.downloadUrl,
        zipUrl: project.zipUrl,
        createdAt: project.updatedAt
      }];
    } catch (error) {
      console.error('Error getting project builds:', error);
      return [];
    }
  }

  /**
   * Check for duplicate projects before creation
   */
  async checkForDuplicates(sessionId: string, buildId: string, userId?: number): Promise<any> {
    try {
      // Check by sessionId
      let duplicate = await this.messageDB.getProjectBySessionId(sessionId);
      if (duplicate) {
        console.log(`🔍 Found duplicate by sessionId: ${duplicate.id}`);
        return duplicate;
      }

      // Check by buildId
      duplicate = await this.messageDB.getProjectByBuildId(buildId);
      if (duplicate) {
        console.log(`🔍 Found duplicate by buildId: ${duplicate.id}`);
        return duplicate;
      }

      // Check recent projects by user
      if (userId) {
        const userProjects = await this.messageDB.getUserProjects(userId);
        const recentProject = userProjects.find(p => 
          Math.abs(new Date().getTime() - new Date(p.createdAt).getTime()) < 60000 // Within 1 minute
        );
        
        if (recentProject) {
          console.log(`🔍 Found recent duplicate by user ${userId}: ${recentProject.id}`);
          return recentProject;
        }
      }

      return null;
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      return null;
    }
  }
}