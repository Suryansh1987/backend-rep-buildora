"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedProjectUrlManager = void 0;
class EnhancedProjectUrlManager {
    constructor(messageDB) {
        this.messageDB = messageDB;
    }
    /**
     * Main method to save or update project URLs with comprehensive identification
     */
    saveOrUpdateProjectUrls(sessionId, buildId, urls, context) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`📊 Project URL Management - Session: ${sessionId}, Build: ${buildId}, IsModification: ${context.isModification}`);
                // STRATEGY 1: Use explicit projectId if provided (highest priority)
                if (context.projectId) {
                    console.log(`📊 Using explicit project ID: ${context.projectId}`);
                    const project = yield this.getProjectById(context.projectId);
                    if (project) {
                        yield this.updateExistingProject(project.id, buildId, urls, sessionId, context.prompt);
                        return { projectId: project.id, action: 'updated' };
                    }
                    else {
                        console.warn(`⚠️ Explicit project ID ${context.projectId} not found, falling back to other strategies`);
                    }
                }
                // STRATEGY 2: For modifications, find existing project using multiple methods
                if (context.isModification) {
                    const existingProject = yield this.findProjectForModification(sessionId, context.userId);
                    if (existingProject) {
                        console.log(`📊 Found existing project ${existingProject.id} for modification`);
                        yield this.updateExistingProject(existingProject.id, buildId, urls, sessionId, context.prompt);
                        return { projectId: existingProject.id, action: 'updated' };
                    }
                    else {
                        console.log(`⚠️ No existing project found for modification despite isModification=true`);
                        console.log(`📊 Creating new project instead`);
                    }
                }
                // STRATEGY 3: Create new project
                const projectId = yield this.createNewProject(sessionId, buildId, urls, context);
                return { projectId, action: 'created' };
            }
            catch (error) {
                console.error('❌ Failed to save/update project URLs:', error);
                throw error; // Re-throw to handle at calling level
            }
        });
    }
    /**
     * Find project for modification with comprehensive fallback strategies
     */
    findProjectForModification(sessionId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`🔍 Finding project for modification - Session: ${sessionId}, User: ${userId}`);
                // Priority 1: Find by sessionId (most recent session activity)
                let project = yield this.messageDB.getProjectBySessionId(sessionId);
                if (project) {
                    console.log(`✅ Found project by sessionId: ${project.id}`);
                    return project;
                }
                // Priority 2: Find most recent project by userId
                if (userId) {
                    const userProjects = yield this.messageDB.getUserProjects(userId);
                    if (userProjects.length > 0) {
                        project = userProjects[0]; // Most recent by updatedAt
                        console.log(`✅ Found most recent user project: ${project.id}`);
                        return project;
                    }
                }
                // Priority 3: Find any recent project (fallback for single-user scenarios)
                const recentProjects = yield this.messageDB.getRecentProjects(1);
                if (recentProjects.length > 0) {
                    project = recentProjects[0];
                    console.log(`✅ Found most recent project: ${project.id}`);
                    return project;
                }
                // Priority 4: Check for project with same buildId (edge case)
                project = yield this.messageDB.getProjectByBuildId(sessionId);
                if (project) {
                    console.log(`✅ Found project by buildId: ${project.id}`);
                    return project;
                }
                console.log(`❌ No existing project found for modification`);
                return null;
            }
            catch (error) {
                console.error('Error finding project for modification:', error);
                return null;
            }
        });
    }
    /**
     * Get project by ID with error handling
     */
    getProjectById(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // You might need to add this method to DrizzleMessageHistoryDB
                const projects = yield this.messageDB.getUserProjects(1); // This is a fallback
                return projects.find(p => p.id === projectId) || null;
            }
            catch (error) {
                console.error(`Error getting project by ID ${projectId}:`, error);
                return null;
            }
        });
    }
    /**
     * Update existing project with new URLs and metadata
     */
    updateExistingProject(projectId, buildId, urls, sessionId, prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`📊 Updating existing project ${projectId} with new URLs`);
                // Update project URLs and metadata
                yield this.messageDB.updateProjectUrls(projectId, {
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
                yield this.messageDB.incrementProjectMessageCount(sessionId);
                // Update conversation title if we have a new prompt
                if (prompt && prompt.length > 10) {
                    yield this.updateConversationTitle(projectId, prompt);
                }
                console.log(`✅ Successfully updated project ${projectId}`);
            }
            catch (error) {
                console.error(`Error updating project ${projectId}:`, error);
                throw error;
            }
        });
    }
    /**
     * Create new project with comprehensive metadata
     */
    createNewProject(sessionId, buildId, urls, context) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`📊 Creating new project for session: ${sessionId}`);
                const projectData = {
                    userId: context.userId || 1, // Default user if not provided
                    name: context.name || this.generateProjectName(context.prompt, buildId),
                    description: context.description || this.generateProjectDescription(context.prompt),
                    status: 'ready',
                    projectType: 'frontend',
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
                const projectId = yield this.messageDB.createProject(projectData);
                console.log(`✅ Created new project ${projectId}`);
                return projectId;
            }
            catch (error) {
                console.error('Error creating new project:', error);
                throw error;
            }
        });
    }
    /**
     * Generate a smart project name from prompt
     */
    generateProjectName(prompt, buildId) {
        if (!prompt) {
            return `Project ${(buildId === null || buildId === void 0 ? void 0 : buildId.slice(0, 8)) || 'Unknown'}`;
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
        return `Project ${(buildId === null || buildId === void 0 ? void 0 : buildId.slice(0, 8)) || 'Unknown'}`;
    }
    /**
     * Generate project description from prompt
     */
    generateProjectDescription(prompt) {
        if (!prompt) {
            return 'Auto-generated project';
        }
        // Truncate and clean the prompt for description
        return prompt.length > 200 ? prompt.substring(0, 197) + '...' : prompt;
    }
    /**
     * Update conversation title based on latest prompt
     */
    updateConversationTitle(projectId, prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const newTitle = this.generateProjectName(prompt);
                // You might need to add this method to DrizzleMessageHistoryDB
                // await this.messageDB.updateProjectConversationTitle(projectId, newTitle);
                console.log(`📝 Would update conversation title to: ${newTitle}`);
            }
            catch (error) {
                console.error('Error updating conversation title:', error);
                // Don't throw - this is not critical
            }
        });
    }
    /**
     * Get project URLs by various identifiers
     */
    getProjectUrls(identifier) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let project = null;
                if (identifier.projectId) {
                    project = yield this.getProjectById(identifier.projectId);
                }
                else if (identifier.sessionId) {
                    project = yield this.messageDB.getProjectBySessionId(identifier.sessionId);
                }
                else if (identifier.buildId) {
                    project = yield this.messageDB.getProjectByBuildId(identifier.buildId);
                }
                else if (identifier.userId) {
                    const userProjects = yield this.messageDB.getUserProjects(identifier.userId);
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
            }
            catch (error) {
                console.error('Error getting project URLs:', error);
                return null;
            }
        });
    }
    /**
     * Link a session to an existing project
     */
    linkSessionToProject(sessionId, projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.messageDB.linkSessionToProject(sessionId, projectId);
                console.log(`✅ Linked session ${sessionId} to project ${projectId}`);
            }
            catch (error) {
                console.error(`Error linking session to project:`, error);
                throw error;
            }
        });
    }
    /**
     * Get project deployment history
     */
    getProjectDeploymentHistory(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // This would need to be implemented in DrizzleMessageHistoryDB
                // For now, return basic project info
                const project = yield this.getProjectById(projectId);
                if (!project)
                    return [];
                return [{
                        buildId: project.buildId,
                        deploymentUrl: project.deploymentUrl,
                        downloadUrl: project.downloadUrl,
                        zipUrl: project.zipUrl,
                        createdAt: project.updatedAt,
                        status: project.status
                    }];
            }
            catch (error) {
                console.error('Error getting deployment history:', error);
                return [];
            }
        });
    }
}
exports.EnhancedProjectUrlManager = EnhancedProjectUrlManager;
//# sourceMappingURL=url-manager.js.map