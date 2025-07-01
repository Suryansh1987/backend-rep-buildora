import { DrizzleMessageHistoryDB } from '../db/messagesummary';
export declare class EnhancedProjectUrlManager {
    private messageDB;
    constructor(messageDB: DrizzleMessageHistoryDB);
    /**
     * Main method to save or update project URLs with comprehensive identification and duplicate prevention
     */
    saveOrUpdateProjectUrls(sessionId: string, buildId: string, urls: {
        deploymentUrl: string;
        downloadUrl: string;
        zipUrl: string;
    }, context: {
        projectId?: number;
        userId?: number;
        isModification?: boolean;
        prompt?: string;
        name?: string;
        description?: string;
        framework?: string;
        template?: string;
    }): Promise<{
        projectId: number;
        action: 'created' | 'updated';
    }>;
    /**
     * Find project for modification with comprehensive fallback strategies
     */
    private findProjectForModification;
    /**
     * Get project by ID with error handling
     */
    private getProjectById;
    /**
     * Update existing project with new URLs and metadata
     */
    private updateExistingProject;
    /**
     * Create new project with comprehensive metadata, user validation, and duplicate checking
     */
    private createNewProjectWithDuplicateCheck;
    /**
     * DEPRECATED: Use createNewProjectWithDuplicateCheck instead
     */
    private createNewProject;
    /**
     * Generate a smart project name from prompt
     */
    private generateProjectName;
    /**
     * Generate project description from prompt
     */
    private generateProjectDescription;
    /**
     * Update conversation title based on latest prompt
     */
    private updateConversationTitle;
    /**
     * Get project URLs by various identifiers
     */
    getProjectUrls(identifier: {
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
    } | null>;
    /**
     * Link a session to an existing project
     */
    linkSessionToProject(sessionId: string, projectId: number): Promise<void>;
    /**
     * Get project deployment history
     */
    getProjectDeploymentHistory(projectId: number): Promise<any[]>;
    /**
     * Validate project ownership
     */
    validateProjectOwnership(projectId: number, userId: number): Promise<boolean>;
    /**
     * Get user's project statistics
     */
    getUserProjectStats(userId: number): Promise<{
        totalProjects: number;
        activeProjects: number;
        totalDeployments: number;
        lastActivity: Date | null;
    }>;
    /**
     * Clean up old projects for a user (keep only latest N projects)
     */
    cleanupUserProjects(userId: number, keepLatest?: number): Promise<number>;
    /**
     * Get projects by status
     */
    getProjectsByStatus(status: string, limit?: number): Promise<any[]>;
    /**
     * Search projects by name or description
     */
    searchProjects(query: string, userId?: number): Promise<any[]>;
    /**
     * Get project build history
     */
    getProjectBuilds(projectId: number): Promise<any[]>;
    /**
     * Check for duplicate projects before creation
     */
    checkForDuplicates(sessionId: string, buildId: string, userId?: number): Promise<any>;
}
