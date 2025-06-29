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
exports.StatelessIntelligentFileModifier = void 0;
const scopeanalyzer_1 = require("./filemodifier/scopeanalyzer");
const component_1 = require("./filemodifier/component");
const dependancy_1 = require("./filemodifier/dependancy");
const fallback_1 = require("./filemodifier/fallback");
// Import modular processors
const Astanalyzer_1 = require("./processor/Astanalyzer");
const projectanalyzer_1 = require("./processor/projectanalyzer");
const Fullfileprocessor_1 = require("./processor/Fullfileprocessor");
const TargettedNodes_1 = require("./processor/TargettedNodes");
const ComponentAddition_1 = require("./processor/ComponentAddition");
const TokenTracer_1 = require("../utils/TokenTracer");
const Redis_1 = require("./Redis");
class StatelessIntelligentFileModifier {
    constructor(anthropic, reactBasePath, sessionId, redisUrl) {
        this.anthropic = anthropic;
        this.reactBasePath = reactBasePath;
        this.sessionId = sessionId;
        this.redis = new Redis_1.RedisService(redisUrl);
        // Initialize original modules
        this.scopeAnalyzer = new scopeanalyzer_1.ScopeAnalyzer(anthropic);
        this.componentGenerationSystem = new component_1.ComponentGenerationSystem(anthropic, reactBasePath);
        this.dependencyManager = new dependancy_1.DependencyManager(new Map()); // Will be populated from Redis
        this.fallbackMechanism = new fallback_1.FallbackMechanism(anthropic);
        // Initialize new modular processors with proper arguments
        this.tokenTracker = new TokenTracer_1.TokenTracker();
        this.astAnalyzer = new Astanalyzer_1.ASTAnalyzer();
        this.projectAnalyzer = new projectanalyzer_1.ProjectAnalyzer(reactBasePath);
        this.fullFileProcessor = new Fullfileprocessor_1.FullFileProcessor(anthropic, this.tokenTracker, this.astAnalyzer);
        this.targetedNodesProcessor = new TargettedNodes_1.TargetedNodesProcessor(anthropic, this.tokenTracker, this.astAnalyzer);
        this.componentAdditionProcessor = new ComponentAddition_1.ComponentAdditionProcessor(anthropic, reactBasePath, this.tokenTracker);
    }
    // ==============================================================
    // SESSION MANAGEMENT
    // ==============================================================
    initializeSession() {
        return __awaiter(this, void 0, void 0, function* () {
            const existingStartTime = yield this.redis.getSessionStartTime(this.sessionId);
            if (!existingStartTime) {
                yield this.redis.setSessionStartTime(this.sessionId, new Date().toISOString());
            }
            const hasCache = yield this.redis.hasProjectFiles(this.sessionId);
            if (!hasCache) {
                this.streamUpdate('🔄 Building project tree (first time for this session)...');
                yield this.buildProjectTree();
            }
            else {
                this.streamUpdate('📁 Loading cached project files from Redis...');
            }
        });
    }
    clearSession() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.redis.clearSession(this.sessionId);
        });
    }
    // ==============================================================
    // PROJECT FILES MANAGEMENT (Redis-backed)
    // ==============================================================
    getProjectFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            const projectFiles = yield this.redis.getProjectFiles(this.sessionId);
            return projectFiles || new Map();
        });
    }
    setProjectFiles(projectFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.redis.setProjectFiles(this.sessionId, projectFiles);
        });
    }
    updateProjectFile(filePath, projectFile) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.redis.updateProjectFile(this.sessionId, filePath, projectFile);
        });
    }
    // ==============================================================
    // MODIFICATION SUMMARY (Redis-backed)
    // ==============================================================
    addModificationChange(type, file, description, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const change = {
                type,
                file,
                description,
                timestamp: new Date().toISOString(),
                approach: options === null || options === void 0 ? void 0 : options.approach,
                success: options === null || options === void 0 ? void 0 : options.success,
                details: {
                    linesChanged: options === null || options === void 0 ? void 0 : options.linesChanged,
                    componentsAffected: options === null || options === void 0 ? void 0 : options.componentsAffected,
                    reasoning: options === null || options === void 0 ? void 0 : options.reasoning
                }
            };
            yield this.redis.addModificationChange(this.sessionId, change);
        });
    }
    getModificationContextualSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            const changes = yield this.redis.getModificationChanges(this.sessionId);
            if (changes.length === 0) {
                return "";
            }
            const recentChanges = changes.slice(-5);
            const uniqueFiles = new Set(changes.map(c => c.file));
            const sessionStartTime = yield this.redis.getSessionStartTime(this.sessionId);
            const durationMs = new Date().getTime() - new Date(sessionStartTime).getTime();
            const minutes = Math.floor(durationMs / 60000);
            const seconds = Math.floor((durationMs % 60000) / 1000);
            const duration = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
            let summary = `
**RECENT MODIFICATIONS IN THIS SESSION:**
${recentChanges.map(change => {
                const icon = this.getChangeIcon(change);
                const status = change.success === false ? ' (failed)' : '';
                return `• ${icon} ${change.file}${status}: ${change.description}`;
            }).join('\n')}

**Session Context:**
• Total files modified: ${uniqueFiles.size}
• Session duration: ${duration}
    `.trim();
            return summary;
        });
    }
    getMostModifiedFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            const changes = yield this.redis.getModificationChanges(this.sessionId);
            const fileStats = {};
            changes.forEach(change => {
                fileStats[change.file] = (fileStats[change.file] || 0) + 1;
            });
            return Object.entries(fileStats)
                .map(([file, count]) => ({ file, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);
        });
    }
    // ==============================================================
    // PROJECT TREE BUILDING - Compatible with your existing interface
    // ==============================================================
    buildProjectTree() {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('📂 Analyzing React project structure...');
            try {
                // Try to use your existing buildProjectTree method signature
                let projectFiles = new Map();
                // Update dependency manager with current Redis data
                const currentProjectFiles = yield this.getProjectFiles();
                this.dependencyManager = new dependancy_1.DependencyManager(currentProjectFiles);
                // Call buildProjectTree with the signature your class expects
                const buildResult = yield this.projectAnalyzer.buildProjectTree(projectFiles, this.dependencyManager, (message) => this.streamUpdate(message));
                // If buildProjectTree returns the files instead of mutating the parameter
                if (buildResult && buildResult.size > 0) {
                    projectFiles = buildResult;
                }
                if (projectFiles.size === 0) {
                    throw new Error('No React files found in project');
                }
                // Store in Redis
                yield this.setProjectFiles(projectFiles);
                this.streamUpdate(`✅ Loaded ${projectFiles.size} React files into cache`);
            }
            catch (error) {
                console.error('Error building project tree:', error);
                throw error;
            }
        });
    }
    // ==============================================================
    // STREAM UPDATES
    // ==============================================================
    setStreamCallback(callback) {
        this.streamCallback = callback;
    }
    streamUpdate(message) {
        if (this.streamCallback) {
            this.streamCallback(message);
        }
    }
    // ==============================================================
    // COMPONENT ADDITION HANDLER
    // ==============================================================
    handleComponentAddition(prompt, scope, projectSummaryCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            const projectFiles = yield this.getProjectFiles();
            const modificationSummary = {
                addChange: (type, file, description, options) => __awaiter(this, void 0, void 0, function* () { return yield this.addModificationChange(type, file, description, options); }),
                getContextualSummary: () => __awaiter(this, void 0, void 0, function* () { return yield this.getModificationContextualSummary(); }),
                getMostModifiedFiles: () => __awaiter(this, void 0, void 0, function* () { return yield this.getMostModifiedFiles(); })
            };
            return yield this.componentAdditionProcessor.handleComponentAddition(prompt, scope, projectFiles, modificationSummary, this.componentGenerationSystem, projectSummaryCallback);
        });
    }
    // ==============================================================
    // MODIFICATION HANDLERS - Compatible with your existing processors
    // ==============================================================
    handleFullFileModification(prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const projectFiles = yield this.getProjectFiles();
            try {
                // Try different method names your processor might have
                const processor = this.fullFileProcessor;
                let result;
                if (processor.processFullFileModification) {
                    result = yield processor.processFullFileModification(prompt, projectFiles, this.reactBasePath, (message) => this.streamUpdate(message));
                }
                else if (processor.process) {
                    result = yield processor.process(prompt, projectFiles, this.reactBasePath, (message) => this.streamUpdate(message));
                }
                else if (processor.handleFullFileModification) {
                    result = yield processor.handleFullFileModification(prompt, projectFiles, this.reactBasePath, (message) => this.streamUpdate(message));
                }
                else {
                    console.warn('No suitable method found on FullFileProcessor');
                    return false;
                }
                if (result) {
                    // Update project files in Redis if result contains updated files
                    if (result.updatedProjectFiles) {
                        yield this.setProjectFiles(result.updatedProjectFiles);
                    }
                    else if (result.projectFiles) {
                        yield this.setProjectFiles(result.projectFiles);
                    }
                    // Add modification changes if available
                    if (result.changes && Array.isArray(result.changes)) {
                        for (const change of result.changes) {
                            yield this.addModificationChange(change.type || 'modified', change.file, change.description || 'File modified', {
                                approach: 'FULL_FILE',
                                success: change.success !== false,
                                linesChanged: (_a = change.details) === null || _a === void 0 ? void 0 : _a.linesChanged,
                                componentsAffected: (_b = change.details) === null || _b === void 0 ? void 0 : _b.componentsAffected,
                                reasoning: (_c = change.details) === null || _c === void 0 ? void 0 : _c.reasoning
                            });
                        }
                    }
                    return result.success !== false;
                }
                return false;
            }
            catch (error) {
                console.error('Full file modification failed:', error);
                return false;
            }
        });
    }
    handleTargetedModification(prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const projectFiles = yield this.getProjectFiles();
            try {
                // Try different method names your processor might have
                const processor = this.targetedNodesProcessor;
                let result;
                if (processor.processTargetedModification) {
                    result = yield processor.processTargetedModification(prompt, projectFiles, this.reactBasePath, (message) => this.streamUpdate(message));
                }
                else if (processor.process) {
                    result = yield processor.process(prompt, projectFiles, this.reactBasePath, (message) => this.streamUpdate(message));
                }
                else if (processor.handleTargetedModification) {
                    result = yield processor.handleTargetedModification(prompt, projectFiles, this.reactBasePath, (message) => this.streamUpdate(message));
                }
                else {
                    console.warn('No suitable method found on TargetedNodesProcessor');
                    return false;
                }
                if (result) {
                    // Update project files in Redis if result contains updated files
                    if (result.updatedProjectFiles) {
                        yield this.setProjectFiles(result.updatedProjectFiles);
                    }
                    else if (result.projectFiles) {
                        yield this.setProjectFiles(result.projectFiles);
                    }
                    // Add modification changes if available
                    if (result.changes && Array.isArray(result.changes)) {
                        for (const change of result.changes) {
                            yield this.addModificationChange(change.type || 'modified', change.file, change.description || 'File modified', {
                                approach: 'TARGETED_NODES',
                                success: change.success !== false,
                                linesChanged: (_a = change.details) === null || _a === void 0 ? void 0 : _a.linesChanged,
                                componentsAffected: (_b = change.details) === null || _b === void 0 ? void 0 : _b.componentsAffected,
                                reasoning: (_c = change.details) === null || _c === void 0 ? void 0 : _c.reasoning
                            });
                        }
                    }
                    return result.success !== false;
                }
                return false;
            }
            catch (error) {
                console.error('Targeted modification failed:', error);
                return false;
            }
        });
    }
    // ==============================================================
    // MAIN PROCESSING METHOD
    // ==============================================================
    processModification(prompt, conversationContext, dbSummary, projectSummaryCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.streamUpdate('🚀 Starting STATELESS intelligent modification workflow...');
                yield this.initializeSession();
                const projectFiles = yield this.getProjectFiles();
                if (projectFiles.size === 0) {
                    return {
                        success: false,
                        error: 'No React files found in project',
                        selectedFiles: [],
                        addedFiles: []
                    };
                }
                const projectSummary = dbSummary || this.projectAnalyzer.buildProjectSummary(projectFiles);
                const contextWithSummary = (conversationContext || '') + '\n\n' + (yield this.getModificationContextualSummary());
                const scope = yield this.scopeAnalyzer.analyzeScope(prompt, projectSummary, contextWithSummary, dbSummary);
                this.streamUpdate(`📋 Modification method: ${scope.scope}`);
                if (scope.scope === 'COMPONENT_ADDITION') {
                    yield this.componentGenerationSystem.refreshFileStructure();
                    if (dbSummary) {
                        this.componentGenerationSystem.setProjectSummary(dbSummary);
                    }
                }
                let success = false;
                let selectedFiles = [];
                let addedFiles = [];
                switch (scope.scope) {
                    case 'COMPONENT_ADDITION':
                        const componentResult = yield this.handleComponentAddition(prompt, scope, projectSummaryCallback);
                        return componentResult;
                    case 'FULL_FILE':
                        success = yield this.handleFullFileModification(prompt);
                        const fullFileModifications = yield this.getMostModifiedFiles();
                        selectedFiles = fullFileModifications.map(item => item.file);
                        break;
                    case 'TARGETED_NODES':
                        success = yield this.handleTargetedModification(prompt);
                        const targetedModifications = yield this.getMostModifiedFiles();
                        selectedFiles = targetedModifications.map(item => item.file);
                        break;
                    default:
                        return {
                            success: false,
                            error: 'Unknown modification scope',
                            selectedFiles: [],
                            addedFiles: []
                        };
                }
                if (success) {
                    return {
                        success: true,
                        selectedFiles,
                        addedFiles,
                        approach: scope.scope,
                        reasoning: `${scope.reasoning} Enhanced AST analysis identified ${selectedFiles.length} files for modification.`,
                        modificationSummary: yield this.getModificationContextualSummary()
                    };
                }
                else {
                    return {
                        success: false,
                        error: 'Modification process failed',
                        selectedFiles: [],
                        addedFiles: [],
                        approach: scope.scope,
                        reasoning: scope.reasoning
                    };
                }
            }
            catch (error) {
                console.error('❌ Modification process failed:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error occurred',
                    selectedFiles: [],
                    addedFiles: []
                };
            }
        });
    }
    // ==============================================================
    // UTILITY METHODS
    // ==============================================================
    getChangeIcon(change) {
        switch (change.type) {
            case 'created': return '📝';
            case 'modified': return '🔄';
            case 'updated': return '⚡';
            default: return '🔧';
        }
    }
    getRedisStats() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.redis.getStats();
        });
    }
    cleanup() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.redis.disconnect();
        });
    }
}
exports.StatelessIntelligentFileModifier = StatelessIntelligentFileModifier;
//# sourceMappingURL=filemodifier.js.map