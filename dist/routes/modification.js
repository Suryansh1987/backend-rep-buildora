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
// routes/modification.ts - FIXED File modification routes with updated Azure deployment
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
                type: 'modified', // Use proper type from your ModificationChange interface
                file: 'session_modification', // Required field
                description: `${modification.approach}: ${modification.prompt.substring(0, 100)}...`, // Required field
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
// Utility functions
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
        var _a, _b, _c, _d, _e;
        const { prompt, sessionId: clientSessionId } = req.body;
        if (!prompt) {
            res.status(400).json({
                success: false,
                error: "Prompt is required"
            });
            return;
        }
        // Use provided session ID or generate new one
        const sessionId = clientSessionId || sessionManager.generateSessionId();
        const buildId = (0, uuid_1.v4)();
        console.log(`[${buildId}] Starting stateless streaming modification for session: ${sessionId}`);
        console.log(`[${buildId}] Prompt: "${prompt.substring(0, 100)}..."`);
        // Set up Server-Sent Events
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
            sendEvent('progress', {
                step: 1,
                total: 15,
                message: 'Initializing stateless modification system and checking Redis cache...',
                buildId: buildId,
                sessionId: sessionId
            });
            // Get project context from Redis OR database
            let sessionContext = yield sessionManager.getSessionContext(sessionId);
            let tempBuildDir;
            if (sessionContext && sessionContext.projectSummary && sessionContext.projectSummary.zipUrl) {
                sendEvent('progress', {
                    step: 2,
                    total: 15,
                    message: 'Found existing project in Redis cache! Downloading latest project ZIP...',
                    buildId: buildId,
                    sessionId: sessionId
                });
                tempBuildDir = yield downloadAndExtractProject(buildId, sessionContext.projectSummary.zipUrl);
                sendEvent('progress', {
                    step: 3,
                    total: 15,
                    message: 'Project downloaded! Loading cached files from Redis...',
                    buildId: buildId,
                    sessionId: sessionId
                });
                const cachedFiles = yield sessionManager.getCachedProjectFiles(sessionId);
                if (Object.keys(cachedFiles).length > 0) {
                    console.log(`📦 Found ${Object.keys(cachedFiles).length} cached files in Redis for session: ${sessionId}`);
                    sendEvent('progress', {
                        step: 4,
                        total: 15,
                        message: `Loaded ${Object.keys(cachedFiles).length} files from Redis cache! Proceeding with stateless modification...`,
                        buildId: buildId,
                        sessionId: sessionId
                    });
                }
            }
            else {
                // Fallback to database check
                sendEvent('progress', {
                    step: 2,
                    total: 15,
                    message: 'No Redis session found. Checking database for existing project...',
                    buildId: buildId,
                    sessionId: sessionId
                });
                const projectSummary = yield messageDB.getActiveProjectSummary();
                if (projectSummary && projectSummary.zipUrl) {
                    sendEvent('progress', {
                        step: 3,
                        total: 15,
                        message: 'Found existing project in database! Downloading and caching in Redis...',
                        buildId: buildId,
                        sessionId: sessionId
                    });
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
                    // Cache project files in Redis
                    const projectFiles = {};
                    const readProjectFiles = (dir_1, ...args_1) => __awaiter(this, [dir_1, ...args_1], void 0, function* (dir, baseDir = dir) {
                        const entries = yield fs.promises.readdir(dir, { withFileTypes: true });
                        for (const entry of entries) {
                            const fullPath = path_1.default.join(dir, entry.name);
                            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                                yield readProjectFiles(fullPath, baseDir);
                            }
                            else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts') || entry.name.endsWith('.jsx') || entry.name.endsWith('.js'))) {
                                const relativePath = path_1.default.relative(baseDir, fullPath).replace(/\\/g, '/');
                                const content = yield fs.promises.readFile(fullPath, 'utf8');
                                projectFiles[relativePath] = content;
                            }
                        }
                    });
                    yield readProjectFiles(tempBuildDir);
                    yield sessionManager.cacheProjectFiles(sessionId, projectFiles);
                    sendEvent('progress', {
                        step: 4,
                        total: 15,
                        message: `Cached ${Object.keys(projectFiles).length} files in Redis! Ready for stateless modification...`,
                        buildId: buildId,
                        sessionId: sessionId
                    });
                }
                else {
                    sendEvent('progress', {
                        step: 3,
                        total: 15,
                        message: 'No existing project found. Creating new project from template...',
                        buildId: buildId,
                        sessionId: sessionId
                    });
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
                    sendEvent('progress', {
                        step: 4,
                        total: 15,
                        message: 'New project template created successfully!',
                        buildId: buildId,
                        sessionId: sessionId
                    });
                }
            }
            // Update session context
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
                    sendEvent('progress', {
                        step: 5,
                        total: 15,
                        message: 'Successfully loaded conversation context from Redis! Using rich context for intelligent modification...',
                        buildId: buildId,
                        sessionId: sessionId
                    });
                }
                else {
                    sendEvent('progress', {
                        step: 5,
                        total: 15,
                        message: 'No previous conversation context found. Starting fresh stateless analysis...',
                        buildId: buildId,
                        sessionId: sessionId
                    });
                }
            }
            catch (contextError) {
                sendEvent('progress', {
                    step: 5,
                    total: 15,
                    message: 'Context loading encountered an issue, continuing with stateless modification...',
                    buildId: buildId,
                    sessionId: sessionId
                });
            }
            // Initialize stateless file modifier - FIXED CONSTRUCTOR
            const fileModifier = new filemodifier_1.StatelessIntelligentFileModifier(anthropic, tempBuildDir, sessionId);
            fileModifier.setStreamCallback((message) => {
                sendEvent('progress', {
                    step: 8,
                    total: 15,
                    message: message,
                    buildId: buildId,
                    sessionId: sessionId
                });
            });
            sendEvent('progress', {
                step: 6,
                total: 15,
                message: 'Stateless file modifier initialized with Redis backing! Analyzing project structure...',
                buildId: buildId,
                sessionId: sessionId
            });
            const startTime = Date.now();
            // Process modification
            const result = yield fileModifier.processModification(enhancedPrompt, undefined, (_a = sessionContext === null || sessionContext === void 0 ? void 0 : sessionContext.projectSummary) === null || _a === void 0 ? void 0 : _a.summary, (summary, prompt) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const summaryId = yield messageDB.saveProjectSummary(summary, prompt, "", buildId);
                    console.log(`💾 Saved project summary to database, ID: ${summaryId}`);
                    return summaryId;
                }
                catch (error) {
                    console.error('⚠️ Error saving project summary:', error);
                    return null;
                }
            }));
            const modificationDuration = Date.now() - startTime;
            if (result.success) {
                sendEvent('progress', {
                    step: 9,
                    total: 15,
                    message: `Stateless modification completed successfully in ${modificationDuration}ms! Applied ${result.approach} approach. Writing changes to files...`,
                    buildId: buildId,
                    sessionId: sessionId
                });
                // CRITICAL: Ensure changes are written to actual files before build
                try {
                    sendEvent('progress', {
                        step: 9.5,
                        total: 15,
                        message: 'Ensuring all Redis changes are written to temp files...',
                        buildId: buildId,
                        sessionId: sessionId
                    });
                    // The fileModifier.writeChangesToFiles() is already called inside processModification
                    sendEvent('progress', {
                        step: 9.7,
                        total: 15,
                        message: 'All changes written to temp files successfully',
                        buildId: buildId,
                        sessionId: sessionId
                    });
                }
                catch (writeError) {
                    console.error('Failed to write changes to files:', writeError);
                    sendEvent('error', {
                        success: false,
                        error: 'Failed to write modifications to files',
                        //@ts-ignore
                        details: writeError.message,
                        buildId: buildId,
                        sessionId: sessionId
                    });
                    return;
                }
                // Save modification
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
                // BUILD & DEPLOY PIPELINE - UPDATED
                try {
                    sendEvent('progress', {
                        step: 10,
                        total: 15,
                        message: 'Starting build & deploy pipeline with written changes...',
                        buildId: buildId,
                        sessionId: sessionId
                    });
                    // DEBUG: Check what files exist in tempBuildDir before zipping
                    console.log(`[${buildId}] DEBUG: Checking temp directory contents AFTER modification...`);
                    const files = yield fs.promises.readdir(tempBuildDir, { recursive: true });
                    console.log(`[${buildId}] Files in temp directory:`, files.slice(0, 20));
                    // Check if React files were actually modified
                    const srcDir = path_1.default.join(tempBuildDir, 'src');
                    if (yield fs.promises.access(srcDir).then(() => true).catch(() => false)) {
                        const srcFiles = yield fs.promises.readdir(srcDir, { recursive: true });
                        console.log(`[${buildId}] React files in src/:`, srcFiles);
                        // Check timestamps of modified files
                        for (const file of srcFiles.slice(0, 5)) {
                            const filePath = path_1.default.join(srcDir, file);
                            try {
                                const stats = yield fs.promises.stat(filePath);
                                console.log(`[${buildId}] ${file} modified: ${stats.mtime}`);
                            }
                            catch (e) {
                                //@ts-ignore
                                console.log(`[${buildId}] Could not check ${file}:`, e.message);
                            }
                        }
                    }
                    // Check for package.json
                    const packageJsonPath = path_1.default.join(tempBuildDir, 'package.json');
                    try {
                        const packageJson = JSON.parse(yield fs.promises.readFile(packageJsonPath, 'utf8'));
                        console.log(`[${buildId}] Package.json found with dependencies:`, Object.keys(packageJson.dependencies || {}));
                    }
                    catch (_f) {
                        console.log(`[${buildId}] ❌ No package.json found at: ${packageJsonPath}`);
                    }
                    const zip = new adm_zip_1.default();
                    zip.addLocalFolder(tempBuildDir);
                    const zipBuffer = zip.toBuffer();
                    const zipBlobName = `${buildId}/source.zip`;
                    const zipUrl = yield (0, azure_deploy_1.uploadToAzureBlob)(process.env.AZURE_STORAGE_CONNECTION_STRING, "source-zips", zipBlobName, zipBuffer);
                    sendEvent('progress', {
                        step: 11,
                        total: 15,
                        message: 'Source uploaded! Triggering containerized build process...',
                        buildId: buildId,
                        sessionId: sessionId
                    });
                    const DistUrl = yield (0, azure_deploy_1.triggerAzureContainerJob)(zipUrl, buildId, {
                        resourceGroup: process.env.AZURE_RESOURCE_GROUP,
                        containerAppEnv: process.env.AZURE_CONTAINER_APP_ENV,
                        acrName: process.env.AZURE_ACR_NAME,
                        storageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
                        storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
                    });
                    const urls = JSON.parse(DistUrl);
                    const builtZipUrl = urls.downloadUrl;
                    sendEvent('progress', {
                        step: 12,
                        total: 15,
                        message: 'Build completed! Deploying with new Azure method...',
                        buildId: buildId,
                        sessionId: sessionId
                    });
                    // Use the new deployment method
                    const previewUrl = yield (0, azure_deploy_1.runBuildAndDeploy)(builtZipUrl, buildId);
                    sendEvent('progress', {
                        step: 13,
                        total: 15,
                        message: 'Updating Redis session and project summary with latest changes...',
                        buildId: buildId,
                        sessionId: sessionId
                    });
                    // Update session context
                    yield sessionManager.updateSessionContext(sessionId, {
                        projectSummary: Object.assign(Object.assign({}, sessionContext === null || sessionContext === void 0 ? void 0 : sessionContext.projectSummary), { zipUrl: zipUrl, buildId: buildId })
                    });
                    // Update database
                    if (sessionContext === null || sessionContext === void 0 ? void 0 : sessionContext.projectSummary) {
                        const projectSummary = yield messageDB.getActiveProjectSummary();
                        if (projectSummary) {
                            yield messageDB.updateProjectSummary(projectSummary.id, zipUrl, buildId);
                        }
                    }
                    sendEvent('progress', {
                        step: 14,
                        total: 15,
                        message: 'Cleaning up temporary files...',
                        buildId: buildId,
                        sessionId: sessionId
                    });
                    clearTimeout(cleanupTimer);
                    yield cleanupTempDirectory(buildId);
                    sendEvent('progress', {
                        step: 15,
                        total: 15,
                        message: `🎉 Complete stateless pipeline finished! Your updated application is live at: ${previewUrl}`,
                        buildId: buildId,
                        sessionId: sessionId
                    });
                    const totalDuration = Date.now() - startTime;
                    // Send final result
                    sendEvent('complete', {
                        success: true,
                        data: {
                            workflow: "stateless-modification-system-with-redis-build",
                            approach: result.approach || 'UNKNOWN',
                            selectedFiles: result.selectedFiles || [],
                            addedFiles: result.addedFiles || [],
                            modifiedRanges: typeof result.modifiedRanges === 'number' ? result.modifiedRanges : (((_b = result.modifiedRanges) === null || _b === void 0 ? void 0 : _b.length) || 0),
                            conversationContext: "Enhanced context with Redis-backed stateless modification history",
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
                            hosting: "Azure Static Web Apps",
                            features: [
                                "Global CDN",
                                "Auto SSL/HTTPS",
                                "Custom domains support",
                                "Staging environments",
                            ]
                        }
                    });
                }
                catch (buildError) {
                    console.error(`[${buildId}] Build pipeline failed:`, buildError);
                    clearTimeout(cleanupTimer);
                    yield cleanupTempDirectory(buildId);
                    sendEvent('complete', {
                        success: true,
                        data: {
                            workflow: "stateless-modification-system-with-redis-build-error",
                            approach: result.approach || 'UNKNOWN',
                            selectedFiles: result.selectedFiles || [],
                            addedFiles: result.addedFiles || [],
                            modifiedRanges: typeof result.modifiedRanges === 'number' ? result.modifiedRanges : (((_e = result.modifiedRanges) === null || _e === void 0 ? void 0 : _e.length) || 0),
                            buildError: buildError instanceof Error ? buildError.message : 'Build failed',
                            buildId: buildId,
                            sessionId: sessionId,
                            message: "Stateless modification completed successfully, but build/deploy failed"
                        }
                    });
                }
                yield fileModifier.cleanup();
            }
            else {
                sendEvent('error', {
                    success: false,
                    error: result.error || 'Stateless modification failed',
                    approach: result.approach,
                    reasoning: result.reasoning,
                    buildId: buildId,
                    sessionId: sessionId
                });
                clearTimeout(cleanupTimer);
                yield cleanupTempDirectory(buildId);
                yield fileModifier.cleanup();
            }
        }
        catch (error) {
            console.error(`[${buildId}] ❌ Stateless streaming error:`, error);
            clearTimeout(cleanupTimer);
            yield cleanupTempDirectory(buildId);
            sendEvent('error', {
                success: false,
                error: 'Internal server error during stateless modification',
                details: error.message,
                buildId: buildId,
                sessionId: sessionId
            });
        }
        finally {
            res.end();
        }
    }));
    // NON-STREAMING STATELESS MODIFICATION - UPDATED
    router.post("/", (req, res) => __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        try {
            const { prompt, sessionId: clientSessionId } = req.body;
            if (!prompt) {
                res.status(400).json({
                    success: false,
                    error: "Prompt is required"
                });
                return;
            }
            const sessionId = clientSessionId || sessionManager.generateSessionId();
            const buildId = (0, uuid_1.v4)();
            console.log(`[${buildId}] Starting stateless non-streaming modification for session: ${sessionId}`);
            const cleanupTimer = setTimeout(() => {
                cleanupTempDirectory(buildId);
                sessionManager.cleanup(sessionId);
            }, 5 * 60 * 1000);
            try {
                // Get project context from Redis OR database
                let sessionContext = yield sessionManager.getSessionContext(sessionId);
                let tempBuildDir;
                if (sessionContext && sessionContext.projectSummary && sessionContext.projectSummary.zipUrl) {
                    console.log(`[${buildId}] Found existing project in Redis, downloading ZIP...`);
                    tempBuildDir = yield downloadAndExtractProject(buildId, sessionContext.projectSummary.zipUrl);
                }
                else {
                    console.log(`[${buildId}] No Redis session, checking database...`);
                    const projectSummary = yield messageDB.getActiveProjectSummary();
                    if (projectSummary && projectSummary.zipUrl) {
                        console.log(`[${buildId}] Found existing project in database, downloading and caching...`);
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
                        console.log(`[${buildId}] No existing project, creating from template...`);
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
                // Initialize stateless file modifier - FIXED CONSTRUCTOR
                const fileModifier = new filemodifier_1.StatelessIntelligentFileModifier(anthropic, tempBuildDir, sessionId);
                // Start timing
                const startTime = Date.now();
                // Process modification using stateless system
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
                    // Save modification to conversation history AND Redis
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
                    // BUILD & DEPLOY PIPELINE - UPDATED
                    try {
                        console.log(`[${buildId}] Starting build pipeline after successful stateless modification...`);
                        // DEBUG: Check what files exist in tempBuildDir before zipping
                        console.log(`[${buildId}] DEBUG: Checking temp directory contents...`);
                        const files = yield fs.promises.readdir(tempBuildDir, { recursive: true });
                        console.log(`[${buildId}] Files in temp directory:`, files.slice(0, 20));
                        // Check for package.json
                        const packageJsonPath = path_1.default.join(tempBuildDir, 'package.json');
                        try {
                            const packageJson = JSON.parse(yield fs.promises.readFile(packageJsonPath, 'utf8'));
                            console.log(`[${buildId}] Package.json found with dependencies:`, Object.keys(packageJson.dependencies || {}));
                        }
                        catch (_f) {
                            console.log(`[${buildId}] ❌ No package.json found at: ${packageJsonPath}`);
                        }
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
                        // Deploy using the new deployment method
                        const previewUrl = yield (0, azure_deploy_1.runBuildAndDeploy)(builtZipUrl, buildId);
                        // Update session context with new ZIP URL
                        yield sessionManager.updateSessionContext(sessionId, {
                            projectSummary: Object.assign(Object.assign({}, sessionContext === null || sessionContext === void 0 ? void 0 : sessionContext.projectSummary), { zipUrl: zipUrl, buildId: buildId })
                        });
                        // Update database project summary with new ZIP URL
                        if (sessionContext === null || sessionContext === void 0 ? void 0 : sessionContext.projectSummary) {
                            const projectSummary = yield messageDB.getActiveProjectSummary();
                            if (projectSummary) {
                                yield messageDB.updateProjectSummary(projectSummary.id, zipUrl, buildId);
                            }
                        }
                        console.log(`[${buildId}] ✅ Stateless Build & Deploy completed successfully!`);
                        // Clear cleanup timer and cleanup temp directory (keep Redis session)
                        clearTimeout(cleanupTimer);
                        yield cleanupTempDirectory(buildId);
                        yield fileModifier.cleanup();
                        const totalDuration = Date.now() - startTime;
                        res.json({
                            success: true,
                            data: {
                                workflow: "stateless-modification-system-with-redis-build",
                                approach: result.approach || 'UNKNOWN',
                                selectedFiles: result.selectedFiles || [],
                                addedFiles: result.addedFiles || [],
                                modifiedRanges: typeof result.modifiedRanges === 'number' ? result.modifiedRanges : (((_b = result.modifiedRanges) === null || _b === void 0 ? void 0 : _b.length) || 0),
                                conversationContext: "Enhanced context with Redis-backed stateless modification history",
                                reasoning: result.reasoning,
                                modificationSummary: result.modificationSummary,
                                modificationDuration: modificationDuration,
                                totalDuration: totalDuration,
                                totalFilesAffected: (((_c = result.selectedFiles) === null || _c === void 0 ? void 0 : _c.length) || 0) + (((_d = result.addedFiles) === null || _d === void 0 ? void 0 : _d.length) || 0),
                                // BUILD & DEPLOY RESULTS - UPDATED
                                previewUrl: previewUrl,
                                downloadUrl: urls.downloadUrl,
                                zipUrl: zipUrl, // New ZIP URL for future modifications
                                buildId: buildId,
                                sessionId: sessionId,
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
                                workflow: "stateless-modification-system-with-redis-build-error",
                                approach: result.approach || 'UNKNOWN',
                                selectedFiles: result.selectedFiles || [],
                                addedFiles: result.addedFiles || [],
                                modifiedRanges: typeof result.modifiedRanges === 'number' ? result.modifiedRanges : (((_e = result.modifiedRanges) === null || _e === void 0 ? void 0 : _e.length) || 0),
                                buildError: buildError instanceof Error ? buildError.message : 'Build failed',
                                buildId: buildId,
                                sessionId: sessionId,
                                message: "Stateless modification completed successfully, but build/deploy failed",
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
                        error: result.error || 'Stateless modification failed',
                        approach: result.approach,
                        reasoning: result.reasoning,
                        selectedFiles: result.selectedFiles || [],
                        workflow: "stateless-modification-system-with-redis-build",
                        buildId: buildId,
                        sessionId: sessionId,
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
                    workflow: "stateless-modification-system-with-redis-build",
                    buildId: buildId,
                    sessionId: sessionId
                });
            }
        }
        catch (error) {
            const buildId = (0, uuid_1.v4)();
            const sessionId = sessionManager.generateSessionId();
            console.error(`[${buildId}] ❌ Stateless non-streaming modification error:`, error);
            res.status(500).json({
                success: false,
                error: 'Internal server error during stateless modification',
                details: error.message,
                workflow: "stateless-modification-system-with-redis-build",
                buildId: buildId,
                sessionId: sessionId
            });
        }
    }));
    return router;
}
//# sourceMappingURL=modification.js.map