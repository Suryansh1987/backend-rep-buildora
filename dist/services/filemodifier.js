"use strict";
// ============================================================================
// COMPLETELY UNRESTRICTED FILEMODIFIER - NO PATH RESTRICTIONS
// ============================================================================
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
exports.StatelessIntelligentFileModifier = exports.UnrestrictedIntelligentFileModifier = void 0;
const scopeanalyzer_1 = require("./filemodifier/scopeanalyzer");
const component_1 = require("./filemodifier/component");
const dependancy_1 = require("./filemodifier/dependancy");
const fallback_1 = require("./filemodifier/fallback");
// Import the unrestricted processor
const ComponentAddition_1 = require("./processor/ComponentAddition");
const Astanalyzer_1 = require("./processor/Astanalyzer");
const projectanalyzer_1 = require("./processor/projectanalyzer");
const Fullfileprocessor_1 = require("./processor/Fullfileprocessor");
const TargettedNodes_1 = require("./processor/TargettedNodes");
const TokenTracer_1 = require("../utils/TokenTracer");
const Redis_1 = require("./Redis");
class UnrestrictedIntelligentFileModifier {
    constructor(anthropic, reactBasePath, sessionId, redisUrl) {
        console.log('[DEBUG] UnrestrictedIntelligentFileModifier constructor starting...');
        console.log(`[DEBUG] reactBasePath: ${reactBasePath}`);
        this.anthropic = anthropic;
        this.reactBasePath = reactBasePath;
        this.sessionId = sessionId;
        this.redis = new Redis_1.RedisService(redisUrl);
        // Initialize original modules
        this.scopeAnalyzer = new scopeanalyzer_1.ScopeAnalyzer(anthropic);
        this.componentGenerationSystem = new component_1.ComponentGenerationSystem(anthropic, reactBasePath);
        this.dependencyManager = new dependancy_1.DependencyManager(new Map());
        this.fallbackMechanism = new fallback_1.FallbackMechanism(anthropic);
        // Initialize existing processors
        this.tokenTracker = new TokenTracer_1.TokenTracker();
        this.astAnalyzer = new Astanalyzer_1.ASTAnalyzer();
        this.projectAnalyzer = new projectanalyzer_1.ProjectAnalyzer(reactBasePath);
        console.log('[DEBUG] About to initialize FullFileProcessor...');
        this.fullFileProcessor = new Fullfileprocessor_1.FullFileProcessor(anthropic, this.tokenTracker, reactBasePath // FIXED: Add missing basePath parameter
        );
        console.log('[DEBUG] FullFileProcessor initialized');
        console.log('[DEBUG] About to initialize TargetedNodesProcessor...');
        // FIXED: Add missing reactBasePath parameter
        this.targetedNodesProcessor = new TargettedNodes_1.TargetedNodesProcessor(anthropic, this.tokenTracker, this.astAnalyzer, reactBasePath // ADD THIS MISSING PARAMETER
        );
        console.log('[DEBUG] TargetedNodesProcessor initialized with reactBasePath');
        console.log('[DEBUG] About to initialize EnhancedAtomicComponentProcessor...');
        this.unrestrictedProcessor = new ComponentAddition_1.EnhancedAtomicComponentProcessor(anthropic, reactBasePath);
        console.log('[DEBUG] All processors initialized');
    }
    // Also add a method to verify the setup
    verifyProcessorSetup() {
        console.log('[DEBUG] Verifying processor setup...');
        console.log(`[DEBUG] this.reactBasePath: ${this.reactBasePath}`);
        console.log(`[DEBUG] targetedNodesProcessor exists: ${!!this.targetedNodesProcessor}`);
        // Check if the processor has the right base path
        if (this.targetedNodesProcessor && this.targetedNodesProcessor.reactBasePath) {
            console.log(`[DEBUG] targetedNodesProcessor.reactBasePath: ${this.targetedNodesProcessor.reactBasePath}`);
        }
    }
    // ==============================================================
    // SESSION MANAGEMENT (simplified with error handling)
    // ==============================================================
    initializeSession() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
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
            }
            catch (error) {
                this.streamUpdate('⚠️ Redis not available, proceeding without cache...');
                yield this.buildProjectTree();
            }
        });
    }
    clearSession() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.redis.clearSession(this.sessionId);
            }
            catch (error) {
                // Ignore Redis errors silently
                console.log('Redis clear session failed:', error);
            }
        });
    }
    // ==============================================================
    // PROJECT FILES MANAGEMENT (with Redis fallbacks)
    // ==============================================================
    getProjectFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const projectFiles = yield this.redis.getProjectFiles(this.sessionId);
                return projectFiles || new Map();
            }
            catch (error) {
                this.streamUpdate('⚠️ Using fresh project scan...');
                return new Map();
            }
        });
    }
    setProjectFiles(projectFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.redis.setProjectFiles(this.sessionId, projectFiles);
            }
            catch (error) {
                // Ignore Redis errors silently
                console.log('Redis set project files failed:', error);
            }
        });
    }
    updateProjectFile(filePath, projectFile) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.redis.updateProjectFile(this.sessionId, filePath, projectFile);
            }
            catch (error) {
                // Ignore Redis errors silently
                console.log('Redis update project file failed:', error);
            }
        });
    }
    // ==============================================================
    // MODIFICATION SUMMARY (with Redis fallbacks)
    // ==============================================================
    addModificationChange(type, file, description, options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
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
            }
            catch (error) {
                // Ignore Redis errors silently
                console.log('Redis add modification change failed:', error);
            }
        });
    }
    getModificationContextualSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const changes = yield this.redis.getModificationChanges(this.sessionId);
                if (changes.length === 0) {
                    return "";
                }
                const recentChanges = changes.slice(-5);
                const uniqueFiles = new Set(changes.map(c => c.file));
                const sessionStartTime = yield this.redis.getSessionStartTime(this.sessionId);
                const durationMs = new Date().getTime() - new Date(sessionStartTime || new Date()).getTime();
                const minutes = Math.floor(durationMs / 60000);
                const seconds = Math.floor((durationMs % 60000) / 1000);
                const duration = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
                return `
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
            }
            catch (error) {
                return "";
            }
        });
    }
    getMostModifiedFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const changes = yield this.redis.getModificationChanges(this.sessionId);
                const fileStats = {};
                changes.forEach(change => {
                    fileStats[change.file] = (fileStats[change.file] || 0) + 1;
                });
                return Object.entries(fileStats)
                    .map(([file, count]) => ({ file, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10);
            }
            catch (error) {
                return [];
            }
        });
    }
    // ==============================================================
    // PROJECT TREE BUILDING (simplified with error handling)
    // ==============================================================
    buildProjectTree() {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('📂 Analyzing React project structure...');
            try {
                let projectFiles = new Map();
                const currentProjectFiles = yield this.getProjectFiles();
                this.dependencyManager = new dependancy_1.DependencyManager(currentProjectFiles);
                // Use the project analyzer
                const buildResult = yield this.projectAnalyzer.buildProjectTree(projectFiles, this.dependencyManager, (message) => this.streamUpdate(message));
                if (buildResult && buildResult.size > 0) {
                    projectFiles = buildResult;
                }
                if (projectFiles.size === 0) {
                    this.streamUpdate('⚠️ No React files found in project, creating basic structure...');
                    // Continue anyway, component creation will work
                }
                else {
                    yield this.setProjectFiles(projectFiles);
                    this.streamUpdate(`✅ Loaded ${projectFiles.size} React files into cache`);
                }
            }
            catch (error) {
                this.streamUpdate(`⚠️ Project tree building error: ${error}`);
                this.streamUpdate('Continuing with component creation anyway...');
            }
        });
    }
    // ==============================================================
    // STREAM UPDATES
    // ==============================================================
    setStreamCallback(callback) {
        this.streamCallback = callback;
        this.unrestrictedProcessor.setStreamCallback(callback);
    }
    streamUpdate(message) {
        if (this.streamCallback) {
            this.streamCallback(message);
        }
    }
    // ==============================================================
    // UNRESTRICTED COMPONENT ADDITION HANDLER
    // ==============================================================
    handleComponentAddition(prompt, scope, projectSummaryCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            this.streamUpdate(`🚀 UNRESTRICTED: Starting component addition workflow...`);
            try {
                const projectFiles = yield this.getProjectFiles();
                // Create modification summary interface
                const modificationSummary = {
                    addChange: (type, file, description, options) => __awaiter(this, void 0, void 0, function* () {
                        yield this.addModificationChange(type, file, description, {
                            approach: 'COMPONENT_ADDITION',
                            success: options === null || options === void 0 ? void 0 : options.success,
                            linesChanged: options === null || options === void 0 ? void 0 : options.linesChanged,
                            componentsAffected: options === null || options === void 0 ? void 0 : options.componentsAffected,
                            reasoning: options === null || options === void 0 ? void 0 : options.reasoning
                        });
                    }),
                    getSummary: () => __awaiter(this, void 0, void 0, function* () { return yield this.getModificationContextualSummary(); }),
                    getMostModifiedFiles: () => __awaiter(this, void 0, void 0, function* () { return yield this.getMostModifiedFiles(); })
                };
                // Use the unrestricted processor
                const result = yield this.unrestrictedProcessor.handleComponentAddition(prompt, scope, projectFiles, modificationSummary, this.componentGenerationSystem, projectSummaryCallback);
                // Update project files cache if successful
                if (result.success) {
                    this.streamUpdate(`✅ UNRESTRICTED: Component addition completed successfully!`);
                    this.streamUpdate(`   📁 Created: ${((_a = result.addedFiles) === null || _a === void 0 ? void 0 : _a.length) || 0} files`);
                    this.streamUpdate(`   📝 Updated: ${((_b = result.selectedFiles) === null || _b === void 0 ? void 0 : _b.length) || 0} files`);
                    // Try to refresh cache, but don't fail if it doesn't work
                    try {
                        yield this.buildProjectTree();
                    }
                    catch (error) {
                        this.streamUpdate('⚠️ Cache refresh failed, but operation succeeded');
                    }
                }
                return result;
            }
            catch (error) {
                this.streamUpdate(`❌ UNRESTRICTED: Component addition failed: ${error}`);
                // Try emergency fallback
                this.streamUpdate('🚨 Trying emergency component creation...');
                return yield this.createComponentEmergency(prompt);
            }
        });
    }
    handleFullFileModification(prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const projectFiles = yield this.getProjectFiles();
            try {
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
                    this.streamUpdate('⚠️ No suitable method found on FullFileProcessor');
                    return false;
                }
                if (result) {
                    if (result.updatedProjectFiles) {
                        yield this.setProjectFiles(result.updatedProjectFiles);
                    }
                    else if (result.projectFiles) {
                        yield this.setProjectFiles(result.projectFiles);
                    }
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
                this.streamUpdate(`❌ Full file modification failed: ${error}`);
                return false;
            }
        });
    }
    handleTargetedModification(prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            console.log('[DEBUG] handleTargetedModification: Starting...');
            try {
                console.log('[DEBUG] handleTargetedModification: Getting project files...');
                const projectFiles = yield this.getProjectFiles();
                console.log(`[DEBUG] handleTargetedModification: Got ${projectFiles.size} project files`);
                console.log('[DEBUG] handleTargetedModification: Getting processor reference...');
                const processor = this.targetedNodesProcessor;
                console.log('[DEBUG] handleTargetedModification: Processor type:', typeof processor);
                console.log('[DEBUG] handleTargetedModification: Processor methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(processor)));
                let result;
                console.log('[DEBUG] handleTargetedModification: Checking for processTargetedModification method...');
                if (processor.processTargetedModification) {
                    console.log('[DEBUG] handleTargetedModification: Calling processTargetedModification...');
                    result = yield processor.processTargetedModification(prompt, projectFiles, this.reactBasePath, (message) => {
                        console.log('[DEBUG] TargetedProcessor Stream:', message);
                        this.streamUpdate(message);
                    });
                    console.log('[DEBUG] handleTargetedModification: processTargetedModification completed with result:', result);
                }
                else if (processor.process) {
                    console.log('[DEBUG] handleTargetedModification: Calling process method...');
                    result = yield processor.process(prompt, projectFiles, this.reactBasePath, (message) => {
                        console.log('[DEBUG] TargetedProcessor Stream:', message);
                        this.streamUpdate(message);
                    });
                    console.log('[DEBUG] handleTargetedModification: process method completed with result:', result);
                }
                else if (processor.handleTargetedModification) {
                    console.log('[DEBUG] handleTargetedModification: Calling handleTargetedModification method...');
                    result = yield processor.handleTargetedModification(prompt, projectFiles, this.reactBasePath, (message) => {
                        console.log('[DEBUG] TargetedProcessor Stream:', message);
                        this.streamUpdate(message);
                    });
                    console.log('[DEBUG] handleTargetedModification: handleTargetedModification method completed with result:', result);
                }
                else {
                    console.log('[DEBUG] handleTargetedModification: No suitable method found');
                    this.streamUpdate('⚠️ No suitable method found on TargetedNodesProcessor');
                    return false;
                }
                console.log('[DEBUG] handleTargetedModification: Processing result...');
                if (result) {
                    console.log('[DEBUG] handleTargetedModification: Result exists, checking properties...');
                    console.log('[DEBUG] handleTargetedModification: Result keys:', Object.keys(result));
                    if (result.updatedProjectFiles) {
                        console.log('[DEBUG] handleTargetedModification: Updating project files with updatedProjectFiles...');
                        yield this.setProjectFiles(result.updatedProjectFiles);
                    }
                    else if (result.projectFiles) {
                        console.log('[DEBUG] handleTargetedModification: Updating project files with projectFiles...');
                        yield this.setProjectFiles(result.projectFiles);
                    }
                    if (result.changes && Array.isArray(result.changes)) {
                        console.log(`[DEBUG] handleTargetedModification: Processing ${result.changes.length} changes...`);
                        for (const change of result.changes) {
                            console.log('[DEBUG] handleTargetedModification: Processing change:', change);
                            yield this.addModificationChange(change.type || 'modified', change.file, change.description || 'File modified', {
                                approach: 'TARGETED_NODES',
                                success: change.success !== false,
                                linesChanged: (_a = change.details) === null || _a === void 0 ? void 0 : _a.linesChanged,
                                componentsAffected: (_b = change.details) === null || _b === void 0 ? void 0 : _b.componentsAffected,
                                reasoning: (_c = change.details) === null || _c === void 0 ? void 0 : _c.reasoning
                            });
                        }
                    }
                    else {
                        console.log('[DEBUG] handleTargetedModification: No changes array found in result');
                    }
                    const success = result.success !== false;
                    console.log(`[DEBUG] handleTargetedModification: Returning success: ${success}`);
                    return success;
                }
                else {
                    console.log('[DEBUG] handleTargetedModification: No result returned from processor');
                    return false;
                }
            }
            catch (error) {
                console.error('[DEBUG] handleTargetedModification: Error occurred:', error);
                this.streamUpdate(`❌ Targeted modification failed: ${error}`);
                return false;
            }
        });
    }
    // ==============================================================
    // MAIN PROCESSING METHOD (with comprehensive error handling)
    // ==============================================================
    processModification(prompt, conversationContext, dbSummary, projectSummaryCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.streamUpdate('🚀 Starting UNRESTRICTED intelligent modification workflow...');
                console.log(`[DEBUG] Starting processModification with prompt: "${prompt.substring(0, 100)}..."`);
                // Verify setup
                this.verifyProcessorSetup();
                // Initialize session (but don't fail if Redis is down)
                this.streamUpdate('🔧 Initializing session...');
                console.log('[DEBUG] About to call initializeSession()');
                yield this.initializeSession();
                console.log('[DEBUG] initializeSession() completed');
                this.streamUpdate('📁 Getting project files...');
                console.log('[DEBUG] About to call getProjectFiles()');
                const projectFiles = yield this.getProjectFiles();
                console.log(`[DEBUG] getProjectFiles() returned ${projectFiles.size} files`);
                if (projectFiles.size === 0) {
                    this.streamUpdate('⚠️ No project files found, but proceeding with component creation...');
                }
                // Build project summary
                this.streamUpdate('📊 Building project summary...');
                console.log('[DEBUG] About to build project summary');
                const projectSummary = dbSummary || this.projectAnalyzer.buildProjectSummary(projectFiles);
                console.log(`[DEBUG] Project summary length: ${projectSummary.length}`);
                const contextWithSummary = (conversationContext || '') + '\n\n' + (yield this.getModificationContextualSummary());
                console.log(`[DEBUG] Context with summary length: ${contextWithSummary.length}`);
                // Analyze scope
                this.streamUpdate('🔍 Analyzing scope...');
                console.log('[DEBUG] About to call analyzeScope()');
                const scope = yield this.scopeAnalyzer.analyzeScope(prompt, projectSummary, contextWithSummary, dbSummary);
                console.log(`[DEBUG] Scope analysis completed: ${scope.scope}`);
                this.streamUpdate(`📋 Modification method: ${scope.scope}`);
                // Prepare component generation system if needed
                if (scope.scope === 'COMPONENT_ADDITION') {
                    try {
                        this.streamUpdate('🔧 Setting up component generation system...');
                        console.log('[DEBUG] About to refresh component generation system');
                        yield this.componentGenerationSystem.refreshFileStructure();
                        if (dbSummary) {
                            this.componentGenerationSystem.setProjectSummary(dbSummary);
                        }
                        console.log('[DEBUG] Component generation system setup completed');
                    }
                    catch (error) {
                        console.log(`[DEBUG] Component system setup error: ${error}`);
                        this.streamUpdate(`⚠️ Component system setup warning: ${error}`);
                        // Continue anyway
                    }
                }
                let success = false;
                let selectedFiles = [];
                let addedFiles = [];
                // Execute based on scope
                console.log(`[DEBUG] About to execute scope: ${scope.scope}`);
                switch (scope.scope) {
                    case 'COMPONENT_ADDITION':
                        this.streamUpdate('🚀 Executing component addition...');
                        console.log('[DEBUG] About to call handleComponentAddition()');
                        // Use the UNRESTRICTED component addition workflow
                        const componentResult = yield this.handleComponentAddition(prompt, scope, projectSummaryCallback);
                        console.log(`[DEBUG] handleComponentAddition() completed with success: ${componentResult.success}`);
                        return componentResult;
                    case 'FULL_FILE':
                        this.streamUpdate('🚀 Executing full file modification...');
                        console.log('[DEBUG] About to call handleFullFileModification()');
                        success = yield this.handleFullFileModification(prompt);
                        console.log(`[DEBUG] handleFullFileModification() completed with success: ${success}`);
                        if (success) {
                            const fullFileModifications = yield this.getMostModifiedFiles();
                            selectedFiles = fullFileModifications.map(item => item.file);
                        }
                        break;
                    case 'TARGETED_NODES':
                        this.streamUpdate('🚀 Executing targeted modification...');
                        console.log('[DEBUG] About to call handleTargetedModification()');
                        success = yield this.handleTargetedModification(prompt);
                        console.log(`[DEBUG] handleTargetedModification() completed with success: ${success}`);
                        if (success) {
                            const targetedModifications = yield this.getMostModifiedFiles();
                            selectedFiles = targetedModifications.map(item => item.file);
                        }
                        break;
                    default:
                        this.streamUpdate(`⚠️ Unknown scope: ${scope.scope}, attempting component addition fallback...`);
                        console.log(`[DEBUG] Unknown scope: ${scope.scope}, using fallback`);
                        const fallbackResult = yield this.handleComponentAddition(prompt, scope, projectSummaryCallback);
                        console.log(`[DEBUG] Fallback completed with success: ${fallbackResult.success}`);
                        return fallbackResult;
                }
                // Return results
                console.log(`[DEBUG] About to return results. Success: ${success}`);
                if (success) {
                    return {
                        success: true,
                        selectedFiles,
                        addedFiles,
                        approach: scope.scope,
                        reasoning: `${scope.reasoning} Enhanced AST analysis identified ${selectedFiles.length} files for modification.`,
                        modificationSummary: yield this.getModificationContextualSummary(),
                        tokenUsage: this.tokenTracker.getStats()
                    };
                }
                else {
                    return {
                        success: false,
                        error: 'Modification process failed',
                        selectedFiles: [],
                        addedFiles: [],
                        approach: scope.scope,
                        reasoning: scope.reasoning,
                        tokenUsage: this.tokenTracker.getStats()
                    };
                }
            }
            catch (error) {
                console.error(`[DEBUG] processModification error:`, error);
                this.streamUpdate(`❌ Modification process failed: ${error}`);
                // Final fallback - try emergency component creation for any request
                this.streamUpdate('🚨 Final fallback: Emergency component creation...');
                console.log('[DEBUG] About to try emergency component creation');
                return yield this.createComponentEmergency(prompt);
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
            try {
                return yield this.redis.getStats();
            }
            catch (error) {
                return { error: 'Redis not available', message: error };
            }
        });
    }
    cleanup() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.redis.disconnect();
            }
            catch (error) {
                // Ignore cleanup errors
                console.log('Cleanup failed:', error);
            }
        });
    }
    // ==============================================================
    // DIRECT FILE OPERATIONS (Emergency methods)
    // ==============================================================
    createFileDirectly(filePath, content) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { promises: fs } = require('fs');
                const path = require('path');
                const fullPath = path.join(this.reactBasePath, filePath);
                const dir = path.dirname(fullPath);
                this.streamUpdate(`📁 Creating directory: ${dir}`);
                yield fs.mkdir(dir, { recursive: true });
                this.streamUpdate(`💾 Writing file: ${fullPath}`);
                yield fs.writeFile(fullPath, content, 'utf8');
                this.streamUpdate(`✅ File created directly: ${fullPath}`);
                return true;
            }
            catch (error) {
                this.streamUpdate(`❌ Direct file creation failed: ${error}`);
                return false;
            }
        });
    }
    updateFileDirectly(filePath, content) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { promises: fs } = require('fs');
                const path = require('path');
                const fullPath = path.join(this.reactBasePath, filePath);
                this.streamUpdate(`🔄 Updating file directly: ${fullPath}`);
                yield fs.writeFile(fullPath, content, 'utf8');
                this.streamUpdate(`✅ File updated directly: ${fullPath}`);
                return true;
            }
            catch (error) {
                this.streamUpdate(`❌ Direct file update failed: ${error}`);
                return false;
            }
        });
    }
    // ==============================================================
    // EMERGENCY COMPONENT CREATION (Final fallback)
    // ==============================================================
    createComponentEmergency(prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('🚨 EMERGENCY: Using direct component creation (final fallback)...');
            try {
                // Simple component name extraction
                const words = prompt.split(/\s+/);
                let componentName = 'NewComponent';
                for (const word of words) {
                    const clean = word.replace(/[^a-zA-Z]/g, '');
                    if (clean.length > 2 && !['the', 'and', 'create', 'add', 'make', 'new', 'for'].includes(clean.toLowerCase())) {
                        componentName = clean.charAt(0).toUpperCase() + clean.slice(1);
                        break;
                    }
                }
                // Determine if it's a page or component
                const promptLower = prompt.toLowerCase();
                const isPage = promptLower.includes('page') ||
                    promptLower.includes('about') ||
                    promptLower.includes('contact') ||
                    promptLower.includes('dashboard') ||
                    promptLower.includes('home');
                const type = isPage ? 'page' : 'component';
                const folder = isPage ? 'pages' : 'components';
                const filePath = `src/${folder}/${componentName}.tsx`;
                // Generate simple component content
                const content = this.generateSimpleComponent(componentName, type, prompt);
                // Create the file directly
                const success = yield this.createFileDirectly(filePath, content);
                if (success) {
                    // Log the change
                    yield this.addModificationChange('created', filePath, `Emergency created ${type}: ${componentName}`, {
                        approach: 'COMPONENT_ADDITION',
                        success: true,
                        reasoning: 'Emergency fallback component creation'
                    });
                    return {
                        success: true,
                        selectedFiles: [],
                        addedFiles: [filePath],
                        approach: 'COMPONENT_ADDITION',
                        reasoning: `Emergency component creation successful: Created ${componentName} ${type} using direct file operations.`,
                        modificationSummary: yield this.getModificationContextualSummary(),
                        componentGenerationResult: {
                            success: true,
                            generatedFile: filePath,
                            updatedFiles: [],
                            integrationPath: type,
                            projectSummary: ''
                        },
                        tokenUsage: this.tokenTracker.getStats()
                    };
                }
                else {
                    throw new Error('Direct file creation failed in emergency mode');
                }
            }
            catch (error) {
                this.streamUpdate(`❌ Emergency component creation failed: ${error}`);
                return {
                    success: false,
                    error: `All fallback methods failed. Original error: ${error}`,
                    selectedFiles: [],
                    addedFiles: [],
                    tokenUsage: this.tokenTracker.getStats()
                };
            }
        });
    }
    generateSimpleComponent(name, type, prompt) {
        if (type === 'page') {
            return `import React from 'react';

const ${name} = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          ${name}
        </h1>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-lg text-gray-600 mb-4">
            Welcome to the ${name} page.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h2 className="text-xl font-semibold text-blue-900 mb-2">Section 1</h2>
              <p className="text-blue-700">This is the first section of your ${name.toLowerCase()} page.</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h2 className="text-xl font-semibold text-green-900 mb-2">Section 2</h2>
              <p className="text-green-700">This is the second section of your ${name.toLowerCase()} page.</p>
            </div>
          </div>
        </div>
        <div className="mt-8 text-center">
          <button className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
            Get Started
          </button>
        </div>
        <div className="mt-8 text-sm text-gray-400 text-center">
          Generated from prompt: "${prompt}"
        </div>
      </div>
    </div>
  );
};

export default ${name};`;
        }
        else {
            return `import React from 'react';

interface ${name}Props {
  title?: string;
  className?: string;
  children?: React.ReactNode;
}

const ${name}: React.FC<${name}Props> = ({ 
  title = '${name}',
  className = '',
  children 
}) => {
  return (
    <div className={\`${name.toLowerCase()} bg-white border border-gray-200 rounded-lg shadow-sm p-6 \${className}\`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
      </div>
      <div className="space-y-4">
        <p className="text-gray-600">
          This is the ${name} component. It's ready to be customized for your needs.
        </p>
        {children && (
          <div className="mt-4">
            {children}
          </div>
        )}
        <div className="flex gap-2 mt-4">
          <button className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200">
            Action 1
          </button>
          <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">
            Action 2
          </button>
        </div>
      </div>
      <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-400">
        Generated from: "${prompt}"
      </div>
    </div>
  )
};

export default ${name};`;
        }
    }
}
exports.UnrestrictedIntelligentFileModifier = UnrestrictedIntelligentFileModifier;
exports.StatelessIntelligentFileModifier = UnrestrictedIntelligentFileModifier;
//# sourceMappingURL=filemodifier.js.map