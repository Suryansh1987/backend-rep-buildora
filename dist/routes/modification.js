"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeModificationRoutes = initializeModificationRoutes;
// routes/modification.ts - Updated with simple URL management by userId
const express_1 = __importDefault(require("express"));
const filemodifier_1 = require("../services/filemodifier");
const uuid_1 = require("uuid");
const adm_zip_1 = __importDefault(require("adm-zip"));
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const azure_deploy_1 = require("../services/azure-deploy");
const router = express_1.default.Router();
// Enhanced Conversation Helper using existing services + Redis state
class StatelessConversationHelper {
    constructor(messageDB, redis) {
        this.messageDB = messageDB;
        this.redis = redis;
    }
    saveModification(sessionId, modification) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Save to database (persistent)
            yield this.messageDB.saveModification(modification);
            // Save to Redis session state (fast access) - using proper ModificationChange interface
            const change = {
                type: 'modified',
                file: 'session_modification',
                description: `${modification.approach}: ${modification.prompt.substring(0, 100)}...`,
                timestamp: new Date().toISOString(),
                prompt: modification.prompt,
                approach: modification.approach,
                filesModified: modification.filesModified || [],
                filesCreated: modification.filesCreated || [],
                success: ((_a = modification.result) === null || _a === void 0 ? void 0 : _a.success) || false
            };
            yield this.redis.addModificationChange(sessionId, change);
        });
    }
    getEnhancedContext(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Try Redis first for fast access
            const cachedContext = yield this.redis.getSessionState(sessionId, 'conversation_context');
            if (cachedContext) {
                return cachedContext;
            }
            // Fall back to database
            const dbContext = yield this.messageDB.getConversationContext();
            if (dbContext) {
                // Cache for next time
                yield this.redis.setSessionState(sessionId, 'conversation_context', dbContext);
                return dbContext;
            }
            return '';
        });
    }
    getConversationWithSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            const conversation = yield this.messageDB.getRecentConversation();
            return {
                messages: conversation.messages.map((msg) => ({
                    id: msg.id,
                    content: msg.content,
                    messageType: msg.messageType,
                    metadata: {
                        fileModifications: msg.fileModifications,
                        modificationApproach: msg.modificationApproach,
                        modificationSuccess: msg.modificationSuccess
                    },
                    createdAt: msg.createdAt
                })),
                summaryCount: conversation.summaryCount,
                totalMessages: conversation.totalMessages
            };
        });
    }
}
// SIMPLE URL MANAGEMENT FUNCTION
function saveProjectUrlsByUserId(messageDB, userId, buildId, urls, sessionId, prompt) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(`📊 Simple URL Management - User: ${userId}, Build: ${buildId}`);
            // Get user's most recent project
            const userProjects = yield messageDB.getUserProjects(userId);
            if (userProjects.length > 0) {
                // Update the most recent project
                const project = userProjects[0]; // Most recent project
                yield messageDB.updateProjectUrls(project.id, {
                    deploymentUrl: urls.deploymentUrl,
                    downloadUrl: urls.downloadUrl,
                    zipUrl: urls.zipUrl,
                    buildId: buildId,
                    status: 'ready',
                    lastSessionId: sessionId,
                    lastMessageAt: new Date(),
                    updatedAt: new Date()
                });
                console.log(`✅ Updated existing project ${project.id} for user ${userId}`);
                return { projectId: project.id, action: 'updated' };
            }
            else {
                // Create new project for user
                const projectId = yield messageDB.createProject({
                    userId: userId,
                    name: `Project ${buildId.slice(0, 8)}`,
                    description: (prompt === null || prompt === void 0 ? void 0 : prompt.substring(0, 200)) || 'Auto-generated from modification',
                    status: 'ready',
                    projectType: 'frontend',
                    deploymentUrl: urls.deploymentUrl,
                    downloadUrl: urls.downloadUrl,
                    zipUrl: urls.zipUrl,
                    buildId: buildId,
                    lastSessionId: sessionId,
                    framework: 'react',
                    template: 'vite-react-ts',
                    lastMessageAt: new Date(),
                    messageCount: 1
                });
                console.log(`✅ Created new project ${projectId} for user ${userId}`);
                return { projectId, action: 'created' };
            }
        }
        catch (error) {
            console.error('❌ Failed to save project URLs:', error);
            throw error;
        }
    });
}
// Utility functions (unchanged)
function downloadAndExtractProject(buildId, zipUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        const tempBuildDir = path_1.default.join(__dirname, "../../temp-builds", buildId);
        try {
            console.log(`[${buildId}] Downloading project from: ${zipUrl}`);
            const response = yield axios_1.default.get(zipUrl, { responseType: 'stream' });
            const zipPath = path_1.default.join(__dirname, "../../temp-builds", `${buildId}-download.zip`);
            yield fs.promises.mkdir(path_1.default.dirname(zipPath), { recursive: true });
            const writer = fs.createWriteStream(zipPath);
            response.data.pipe(writer);
            yield new Promise((resolve, reject) => {
                writer.on('finish', () => resolve());
                writer.on('error', (err) => reject(err));
            });
            console.log(`[${buildId}] ZIP downloaded successfully`);
            const zip = new adm_zip_1.default(zipPath);
            yield fs.promises.mkdir(tempBuildDir, { recursive: true });
            zip.extractAllTo(tempBuildDir, true);
            console.log(`[${buildId}] Project extracted to: ${tempBuildDir}`);
            yield fs.promises.unlink(zipPath);
            return tempBuildDir;
        }
        catch (error) {
            console.error(`[${buildId}] Failed to download and extract project:`, error);
            throw new Error(`Failed to download project: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
}
function cleanupTempDirectory(buildId) {
    return __awaiter(this, void 0, void 0, function* () {
        const tempBuildDir = path_1.default.join(__dirname, "../../temp-builds", buildId);
        try {
            yield fs.promises.rm(tempBuildDir, { recursive: true, force: true });
            console.log(`[${buildId}] 🧹 Temp directory cleaned up`);
        }
        catch (error) {
            console.warn(`[${buildId}] ⚠️ Failed to cleanup temp directory:`, error);
        }
    });
}
// Initialize routes with dependencies
function initializeModificationRoutes(anthropic, messageDB, redis, sessionManager) {
    const conversationHelper = new StatelessConversationHelper(messageDB, redis);
    // STATELESS STREAMING MODIFICATION ENDPOINT
    router.post("/stream", (req, res) => __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        const { prompt, sessionId: clientSessionId, userId = 1 // Default userId, should come from authentication
         } = req.body;
        if (!prompt) {
            res.status(400).json({
                success: false,
                error: "Prompt is required"
            });
            return;
        }
        const sessionId = clientSessionId || sessionManager.generateSessionId();
        const buildId = (0, uuid_1.v4)();
        console.log(`[${buildId}] Starting modification for user: ${userId}, session: ${sessionId}`);
        console.log(`[${buildId}] Prompt: "${prompt.substring(0, 100)}..."`);
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': 'http://localhost:5173',
            'Access-Control-Allow-Credentials': 'true'
        });
        const sendEvent = (type, data) => {
            console.log(`📤 Sending ${type} event:`, data);
            res.write(`event: ${type}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };
        const cleanupTimer = setTimeout(() => {
            cleanupTempDirectory(buildId);
            sessionManager.cleanup(sessionId);
        }, 5 * 60 * 1000);
        try {
            sendEvent('progress', { step: 1, total: 16, message: 'Initializing modification system...', buildId, sessionId, userId });
            let sessionContext = yield sessionManager.getSessionContext(sessionId);
            let tempBuildDir = '';
            let userProject = null;
            const userProjects = yield messageDB.getUserProjects(userId);
            if (userProjects.length > 0) {
                userProject = userProjects[0];
                if (userProject.zipUrl) {
                    sendEvent('progress', { step: 2, total: 16, message: `Found user's project: ${userProject.name}. Downloading...`, buildId, sessionId });
                    tempBuildDir = yield downloadAndExtractProject(buildId, userProject.zipUrl);
                    sessionContext = {
                        buildId,
                        tempBuildDir,
                        projectSummary: {
                            summary: userProject.description || 'User project',
                            zipUrl: userProject.zipUrl,
                            buildId: userProject.buildId
                        },
                        lastActivity: Date.now()
                    };
                    yield sessionManager.saveSessionContext(sessionId, sessionContext);
                }
            }
            if (!sessionContext || !((_a = sessionContext.projectSummary) === null || _a === void 0 ? void 0 : _a.zipUrl)) {
                sendEvent('progress', { step: 2, total: 16, message: 'No user project found. Checking Redis...', buildId, sessionId });
                sessionContext = yield sessionManager.getSessionContext(sessionId);
                if ((_b = sessionContext === null || sessionContext === void 0 ? void 0 : sessionContext.projectSummary) === null || _b === void 0 ? void 0 : _b.zipUrl) {
                    tempBuildDir = yield downloadAndExtractProject(buildId, sessionContext.projectSummary.zipUrl);
                }
                else {
                    const projectSummary = yield messageDB.getActiveProjectSummary();
                    if (projectSummary === null || projectSummary === void 0 ? void 0 : projectSummary.zipUrl) {
                        tempBuildDir = yield downloadAndExtractProject(buildId, projectSummary.zipUrl);
                        sessionContext = {
                            buildId,
                            tempBuildDir,
                            projectSummary: {
                                summary: projectSummary.summary,
                                zipUrl: projectSummary.zipUrl,
                                buildId: projectSummary.buildId
                            },
                            lastActivity: Date.now()
                        };
                        yield sessionManager.saveSessionContext(sessionId, sessionContext);
                    }
                    else {
                        const sourceTemplateDir = path_1.default.join(__dirname, "../../react-base");
                        tempBuildDir = path_1.default.join(__dirname, "../../temp-builds", buildId);
                        yield fs.promises.mkdir(tempBuildDir, { recursive: true });
                        yield fs.promises.cp(sourceTemplateDir, tempBuildDir, { recursive: true });
                        sessionContext = {
                            buildId,
                            tempBuildDir,
                            lastActivity: Date.now()
                        };
                        yield sessionManager.saveSessionContext(sessionId, sessionContext);
                    }
                }
            }
            // ✅ Now tempBuildDir is guaranteed to be defined
            sendEvent('progress', { step: 3, total: 16, message: 'Project environment ready!', buildId, sessionId });
            yield sessionManager.updateSessionContext(sessionId, {
                buildId,
                tempBuildDir,
                lastActivity: Date.now()
            });
            let enhancedPrompt = prompt;
            try {
                const context = yield conversationHelper.getEnhancedContext(sessionId);
                if (context) {
                    enhancedPrompt = `${context}\n\n--- CURRENT REQUEST ---\n${prompt}`;
                    sendEvent('progress', { step: 4, total: 16, message: 'Loaded conversation context!', buildId, sessionId });
                }
            }
            catch (_g) {
                sendEvent('progress', { step: 4, total: 16, message: 'Continuing with fresh modification...', buildId, sessionId });
            }
            const fileModifier = new filemodifier_1.StatelessIntelligentFileModifier(anthropic, tempBuildDir, sessionId);
            fileModifier.setStreamCallback((message) => sendEvent('progress', { step: 7, total: 16, message, buildId, sessionId }));
            sendEvent('progress', { step: 5, total: 16, message: 'Starting intelligent modification...', buildId, sessionId });
            const startTime = Date.now();
            const result = yield fileModifier.processModification(enhancedPrompt, undefined, (_c = sessionContext === null || sessionContext === void 0 ? void 0 : sessionContext.projectSummary) === null || _c === void 0 ? void 0 : _c.summary, (summary, prompt) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const summaryId = yield messageDB.saveProjectSummary(summary, prompt, "", buildId);
                    console.log(`💾 Saved project summary, ID: ${summaryId}`);
                    return summaryId;
                }
                catch (err) {
                    console.error('⚠️ Error saving summary:', err);
                    return null;
                }
            }));
            const modificationDuration = Date.now() - startTime;
            if (result.success) {
                sendEvent('progress', { step: 8, total: 16, message: 'Modification complete! Building...', buildId, sessionId });
                try {
                    const zip = new adm_zip_1.default();
                    zip.addLocalFolder(tempBuildDir);
                    const zipBuffer = zip.toBuffer();
                    const zipBlobName = `${buildId}/source.zip`;
                    const zipUrl = yield (0, azure_deploy_1.uploadToAzureBlob)(process.env.AZURE_STORAGE_CONNECTION_STRING, "source-zips", zipBlobName, zipBuffer);
                    sendEvent('progress', { step: 10, total: 16, message: 'Building app...', buildId, sessionId });
                    const DistUrl = yield (0, azure_deploy_1.triggerAzureContainerJob)(zipUrl, buildId, {
                        resourceGroup: process.env.AZURE_RESOURCE_GROUP,
                        containerAppEnv: process.env.AZURE_CONTAINER_APP_ENV,
                        acrName: process.env.AZURE_ACR_NAME,
                        storageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
                        storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
                    });
                    const urls = JSON.parse(DistUrl);
                    const builtZipUrl = urls.downloadUrl;
                    sendEvent('progress', { step: 11, total: 16, message: 'Deploying...', buildId, sessionId });
                    const previewUrl = yield (0, azure_deploy_1.runBuildAndDeploy)(builtZipUrl, buildId);
                    sendEvent('progress', { step: 12, total: 16, message: 'Updating database...', buildId, sessionId });
                    yield sessionManager.updateSessionContext(sessionId, {
                        projectSummary: Object.assign(Object.assign({}, sessionContext === null || sessionContext === void 0 ? void 0 : sessionContext.projectSummary), { zipUrl,
                            buildId })
                    });
                    if (sessionContext === null || sessionContext === void 0 ? void 0 : sessionContext.projectSummary) {
                        const projectSummary = yield messageDB.getActiveProjectSummary();
                        if (projectSummary) {
                            yield messageDB.updateProjectSummary(projectSummary.id, zipUrl, buildId);
                        }
                    }
                    sendEvent('progress', { step: 13, total: 16, message: 'Saving URLs...', buildId, sessionId });
                    const urlResult = yield saveProjectUrlsByUserId(messageDB, userId, buildId, {
                        deploymentUrl: previewUrl,
                        downloadUrl: urls.downloadUrl,
                        zipUrl
                    }, sessionId, prompt);
                    sendEvent('progress', { step: 14, total: 16, message: 'Cleaning up...', buildId, sessionId });
                    clearTimeout(cleanupTimer);
                    yield cleanupTempDirectory(buildId);
                    sendEvent('progress', { step: 15, total: 16, message: `🎉 Live at: ${previewUrl}`, buildId, sessionId });
                    const totalDuration = Date.now() - startTime;
                    sendEvent('complete', {
                        success: true,
                        data: {
                            workflow: "simple-user-based-modification",
                            approach: result.approach || 'UNKNOWN',
                            selectedFiles: result.selectedFiles || [],
                            addedFiles: result.addedFiles || [],
                            modifiedRanges: typeof result.modifiedRanges === 'number' ? result.modifiedRanges : (((_d = result.modifiedRanges) === null || _d === void 0 ? void 0 : _d.length) || 0),
                            reasoning: result.reasoning,
                            modificationSummary: result.modificationSummary,
                            modificationDuration,
                            totalDuration,
                            totalFilesAffected: (((_e = result.selectedFiles) === null || _e === void 0 ? void 0 : _e.length) || 0) + (((_f = result.addedFiles) === null || _f === void 0 ? void 0 : _f.length) || 0),
                            previewUrl,
                            downloadUrl: urls.downloadUrl,
                            zipUrl,
                            buildId,
                            sessionId,
                            userId,
                            projectId: urlResult.projectId,
                            projectAction: urlResult.action,
                            hosting: "Azure Static Web Apps",
                            features: [
                                "Global CDN",
                                "Auto SSL/HTTPS",
                                "Custom domains support",
                                "Staging environments",
                            ]
                        }
                    });
                    yield fileModifier.cleanup();
                }
                catch (buildError) {
                    console.error(`[${buildId}] Build pipeline failed:`, buildError);
                    clearTimeout(cleanupTimer);
                    yield cleanupTempDirectory(buildId);
                    sendEvent('complete', {
                        success: true,
                        data: {
                            workflow: "simple-user-based-modification-error",
                            approach: result.approach || 'UNKNOWN',
                            buildError: buildError instanceof Error ? buildError.message : 'Build failed',
                            buildId,
                            sessionId,
                            userId,
                            message: "Modification completed, but build/deploy failed"
                        }
                    });
                }
            }
            else {
                sendEvent('error', {
                    success: false,
                    error: result.error || 'Modification failed',
                    approach: result.approach,
                    reasoning: result.reasoning,
                    buildId,
                    sessionId,
                    userId
                });
                clearTimeout(cleanupTimer);
                yield cleanupTempDirectory(buildId);
                yield fileModifier.cleanup();
            }
        }
        catch (error) {
            console.error(`[${buildId}] ❌ Error:`, error);
            clearTimeout(cleanupTimer);
            yield cleanupTempDirectory(buildId);
            sendEvent('error', {
                success: false,
                error: 'Internal server error during modification',
                details: error.message,
                buildId,
                sessionId,
                userId
            });
        }
        finally {
            res.end();
        }
    }));
    // NON-STREAMING MODIFICATION ENDPOINT
    router.post("/", (req, res) => __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        try {
            const { prompt, sessionId: clientSessionId, userId = 1 // Default userId, should come from authentication
             } = req.body;
            if (!prompt) {
                res.status(400).json({
                    success: false,
                    error: "Prompt is required"
                });
                return;
            }
            const sessionId = clientSessionId || sessionManager.generateSessionId();
            const buildId = (0, uuid_1.v4)();
            console.log(`[${buildId}] Starting non-streaming modification for user: ${userId}`);
            const cleanupTimer = setTimeout(() => {
                cleanupTempDirectory(buildId);
                sessionManager.cleanup(sessionId);
            }, 5 * 60 * 1000);
            try {
                // Get user's most recent project
                let sessionContext = yield sessionManager.getSessionContext(sessionId);
                let tempBuildDir;
                const userProjects = yield messageDB.getUserProjects(userId);
                if (userProjects.length > 0 && userProjects[0].zipUrl) {
                    console.log(`[${buildId}] Found user's project: ${userProjects[0].name}`);
                    tempBuildDir = yield downloadAndExtractProject(buildId, userProjects[0].zipUrl);
                    sessionContext = {
                        buildId,
                        tempBuildDir,
                        projectSummary: {
                            summary: userProjects[0].description || 'User project',
                            zipUrl: userProjects[0].zipUrl,
                            buildId: userProjects[0].buildId
                        },
                        lastActivity: Date.now()
                    };
                    yield sessionManager.saveSessionContext(sessionId, sessionContext);
                }
                else {
                    // Fallback to existing logic
                    sessionContext = yield sessionManager.getSessionContext(sessionId);
                    if (sessionContext && sessionContext.projectSummary && sessionContext.projectSummary.zipUrl) {
                        tempBuildDir = yield downloadAndExtractProject(buildId, sessionContext.projectSummary.zipUrl);
                    }
                    else {
                        const projectSummary = yield messageDB.getActiveProjectSummary();
                        if (projectSummary && projectSummary.zipUrl) {
                            tempBuildDir = yield downloadAndExtractProject(buildId, projectSummary.zipUrl);
                            sessionContext = {
                                buildId,
                                tempBuildDir,
                                projectSummary: {
                                    summary: projectSummary.summary,
                                    zipUrl: projectSummary.zipUrl,
                                    buildId: projectSummary.buildId
                                },
                                lastActivity: Date.now()
                            };
                            yield sessionManager.saveSessionContext(sessionId, sessionContext);
                        }
                        else {
                            const sourceTemplateDir = path_1.default.join(__dirname, "../../react-base");
                            tempBuildDir = path_1.default.join(__dirname, "../../temp-builds", buildId);
                            yield fs.promises.mkdir(tempBuildDir, { recursive: true });
                            yield fs.promises.cp(sourceTemplateDir, tempBuildDir, { recursive: true });
                            sessionContext = {
                                buildId,
                                tempBuildDir,
                                lastActivity: Date.now()
                            };
                            yield sessionManager.saveSessionContext(sessionId, sessionContext);
                        }
                    }
                }
                // Update session
                yield sessionManager.updateSessionContext(sessionId, {
                    buildId,
                    tempBuildDir,
                    lastActivity: Date.now()
                });
                // Get enhanced context
                let enhancedPrompt = prompt;
                try {
                    const context = yield conversationHelper.getEnhancedContext(sessionId);
                    if (context) {
                        enhancedPrompt = `${context}\n\n--- CURRENT REQUEST ---\n${prompt}`;
                    }
                }
                catch (contextError) {
                    console.error('Context loading error:', contextError);
                }
                // Initialize stateless file modifier
                const fileModifier = new filemodifier_1.StatelessIntelligentFileModifier(anthropic, tempBuildDir, sessionId);
                const startTime = Date.now();
                // Process modification
                const result = yield fileModifier.processModification(enhancedPrompt, undefined, (_a = sessionContext === null || sessionContext === void 0 ? void 0 : sessionContext.projectSummary) === null || _a === void 0 ? void 0 : _a.summary, (summary, prompt) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const summaryId = yield messageDB.saveProjectSummary(summary, prompt, "", buildId);
                        console.log(`💾 Saved project summary, ID: ${summaryId}`);
                        return summaryId;
                    }
                    catch (error) {
                        console.error('⚠️ Error saving project summary:', error);
                        return null;
                    }
                }));
                const modificationDuration = Date.now() - startTime;
                if (result.success) {
                    // Save modification to conversation history
                    try {
                        yield conversationHelper.saveModification(sessionId, {
                            prompt,
                            result,
                            approach: result.approach || 'UNKNOWN',
                            filesModified: result.selectedFiles || [],
                            filesCreated: result.addedFiles || [],
                            timestamp: new Date().toISOString()
                        });
                    }
                    catch (saveError) {
                        console.error('Failed to save modification to history:', saveError);
                    }
                    // BUILD & DEPLOY PIPELINE
                    try {
                        console.log(`[${buildId}] Starting build pipeline...`);
                        // Create zip and upload to Azure
                        const zip = new adm_zip_1.default();
                        zip.addLocalFolder(tempBuildDir);
                        const zipBuffer = zip.toBuffer();
                        const zipBlobName = `${buildId}/source.zip`;
                        const zipUrl = yield (0, azure_deploy_1.uploadToAzureBlob)(process.env.AZURE_STORAGE_CONNECTION_STRING, "source-zips", zipBlobName, zipBuffer);
                        // Trigger Azure Container Job
                        const DistUrl = yield (0, azure_deploy_1.triggerAzureContainerJob)(zipUrl, buildId, {
                            resourceGroup: process.env.AZURE_RESOURCE_GROUP,
                            containerAppEnv: process.env.AZURE_CONTAINER_APP_ENV,
                            acrName: process.env.AZURE_ACR_NAME,
                            storageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
                            storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
                        });
                        const urls = JSON.parse(DistUrl);
                        const builtZipUrl = urls.downloadUrl;
                        // Deploy
                        const previewUrl = yield (0, azure_deploy_1.runBuildAndDeploy)(builtZipUrl, buildId);
                        // Update session context with new ZIP URL
                        yield sessionManager.updateSessionContext(sessionId, {
                            projectSummary: Object.assign(Object.assign({}, sessionContext === null || sessionContext === void 0 ? void 0 : sessionContext.projectSummary), { zipUrl: zipUrl, buildId: buildId })
                        });
                        // Update database project summary
                        if (sessionContext === null || sessionContext === void 0 ? void 0 : sessionContext.projectSummary) {
                            const projectSummary = yield messageDB.getActiveProjectSummary();
                            if (projectSummary) {
                                yield messageDB.updateProjectSummary(projectSummary.id, zipUrl, buildId);
                            }
                        }
                        // SIMPLE URL SAVING BY USER ID
                        console.log(`[${buildId}] 💾 Saving deployment URLs for user ${userId}...`);
                        const urlResult = yield saveProjectUrlsByUserId(messageDB, userId, buildId, {
                            deploymentUrl: previewUrl,
                            downloadUrl: urls.downloadUrl,
                            zipUrl: zipUrl
                        }, sessionId, prompt);
                        console.log(`[${buildId}] ✅ URLs ${urlResult.action} - Project ID: ${urlResult.projectId}`);
                        // Cleanup
                        clearTimeout(cleanupTimer);
                        yield cleanupTempDirectory(buildId);
                        yield fileModifier.cleanup();
                        const totalDuration = Date.now() - startTime;
                        res.json({
                            success: true,
                            data: {
                                workflow: "simple-user-based-modification",
                                approach: result.approach || 'UNKNOWN',
                                selectedFiles: result.selectedFiles || [],
                                addedFiles: result.addedFiles || [],
                                modifiedRanges: typeof result.modifiedRanges === 'number' ? result.modifiedRanges : (((_b = result.modifiedRanges) === null || _b === void 0 ? void 0 : _b.length) || 0),
                                conversationContext: "Enhanced context with Redis-backed modification history",
                                reasoning: result.reasoning,
                                modificationSummary: result.modificationSummary,
                                modificationDuration: modificationDuration,
                                totalDuration: totalDuration,
                                totalFilesAffected: (((_c = result.selectedFiles) === null || _c === void 0 ? void 0 : _c.length) || 0) + (((_d = result.addedFiles) === null || _d === void 0 ? void 0 : _d.length) || 0),
                                previewUrl: previewUrl,
                                downloadUrl: urls.downloadUrl,
                                zipUrl: zipUrl,
                                buildId: buildId,
                                sessionId: sessionId,
                                userId: userId,
                                projectId: urlResult.projectId,
                                projectAction: urlResult.action,
                                hosting: "Azure Static Web Apps",
                                features: [
                                    "Global CDN",
                                    "Auto SSL/HTTPS",
                                    "Custom domains support",
                                    "Staging environments",
                                ],
                                projectState: (sessionContext === null || sessionContext === void 0 ? void 0 : sessionContext.projectSummary) ? 'existing_project_modified' : 'new_project_created'
                            }
                        });
                    }
                    catch (buildError) {
                        console.error(`[${buildId}] Build pipeline failed:`, buildError);
                        clearTimeout(cleanupTimer);
                        yield cleanupTempDirectory(buildId);
                        yield fileModifier.cleanup();
                        res.json({
                            success: true,
                            data: {
                                workflow: "simple-user-based-modification-error",
                                approach: result.approach || 'UNKNOWN',
                                selectedFiles: result.selectedFiles || [],
                                addedFiles: result.addedFiles || [],
                                modifiedRanges: typeof result.modifiedRanges === 'number' ? result.modifiedRanges : (((_e = result.modifiedRanges) === null || _e === void 0 ? void 0 : _e.length) || 0),
                                buildError: buildError instanceof Error ? buildError.message : 'Build failed',
                                buildId: buildId,
                                sessionId: sessionId,
                                userId: userId,
                                message: "Modification completed successfully, but build/deploy failed",
                                projectState: (sessionContext === null || sessionContext === void 0 ? void 0 : sessionContext.projectSummary) ? 'existing_project_modified' : 'new_project_created'
                            }
                        });
                    }
                }
                else {
                    // Save failed attempts for learning
                    try {
                        yield conversationHelper.saveModification(sessionId, {
                            prompt,
                            result,
                            approach: result.approach || 'UNKNOWN',
                            filesModified: result.selectedFiles || [],
                            filesCreated: result.addedFiles || [],
                            timestamp: new Date().toISOString()
                        });
                    }
                    catch (saveError) {
                        console.error('Failed to save failed modification to history:', saveError);
                    }
                    clearTimeout(cleanupTimer);
                    yield cleanupTempDirectory(buildId);
                    yield fileModifier.cleanup();
                    res.status(400).json({
                        success: false,
                        error: result.error || 'Modification failed',
                        approach: result.approach,
                        reasoning: result.reasoning,
                        selectedFiles: result.selectedFiles || [],
                        workflow: "simple-user-based-modification",
                        buildId: buildId,
                        sessionId: sessionId,
                        userId: userId,
                        projectState: (sessionContext === null || sessionContext === void 0 ? void 0 : sessionContext.projectSummary) ? 'existing_project_failed' : 'new_project_failed'
                    });
                }
            }
            catch (downloadError) {
                clearTimeout(cleanupTimer);
                yield cleanupTempDirectory(buildId);
                yield sessionManager.cleanup(sessionId);
                res.status(500).json({
                    success: false,
                    error: 'Failed to setup project environment',
                    details: downloadError instanceof Error ? downloadError.message : 'Unknown error',
                    workflow: "simple-user-based-modification",
                    buildId: buildId,
                    sessionId: sessionId,
                    userId: userId
                });
            }
        }
        catch (error) {
            const buildId = (0, uuid_1.v4)();
            const sessionId = sessionManager.generateSessionId();
            console.error(`[${buildId}] ❌ Non-streaming modification error:`, error);
            res.status(500).json({
                success: false,
                error: 'Internal server error during modification',
                details: error.message,
                workflow: "simple-user-based-modification",
                buildId: buildId,
                sessionId: sessionId,
                userId: req.body.userId || 1
            });
        }
    }));
    // SIMPLE ENDPOINT TO GET USER'S PROJECTS
    router.get("/user/:userId/projects", (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const { userId } = req.params;
            const projects = yield messageDB.getUserProjects(parseInt(userId));
            res.json({
                success: true,
                data: projects.map(project => ({
                    id: project.id,
                    name: project.name,
                    description: project.description,
                    status: project.status,
                    deploymentUrl: project.deploymentUrl,
                    downloadUrl: project.downloadUrl,
                    zipUrl: project.zipUrl,
                    buildId: project.buildId,
                    framework: project.framework,
                    template: project.template,
                    messageCount: project.messageCount,
                    lastMessageAt: project.lastMessageAt,
                    createdAt: project.createdAt,
                    updatedAt: project.updatedAt
                }))
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to get user projects',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }));
    return router;
}
//# sourceMappingURL=modification.js.map