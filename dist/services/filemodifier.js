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
const modification_1 = require("./filemodifier/modification");
const fs_1 = require("fs");
const path = __importStar(require("path"));
class StatelessIntelligentFileModifier {
    constructor(anthropic, reactBasePath, sessionId, redisUrl) {
        this.anthropic = anthropic;
        this.reactBasePath = reactBasePath;
        this.sessionId = sessionId;
        this.redis = new Redis_1.RedisService(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
        // Initialize early to avoid undefined issues
        this.streamCallback = undefined;
        // Initialize components
        this.initializeComponents();
        this.setupStreamCallbacks();
        // Log initialization
        this.streamUpdate(`🏗️ Stateless file modifier initialization:`);
        this.streamUpdate(`   React Base Path: ${reactBasePath}`);
        this.streamUpdate(`   Session ID: ${sessionId}`);
    }
    initializeComponents() {
        // Initialize original modules
        this.scopeAnalyzer = new scopeanalyzer_1.ScopeAnalyzer(this.anthropic);
        this.componentGenerationSystem = new component_1.ComponentGenerationSystem(this.anthropic, this.reactBasePath);
        this.dependencyManager = new dependancy_1.DependencyManager(new Map());
        this.fallbackMechanism = new fallback_1.FallbackMechanism(this.anthropic);
        // Initialize processors
        this.tokenTracker = new TokenTracer_1.TokenTracker();
        this.astAnalyzer = new Astanalyzer_1.ASTAnalyzer();
        this.projectAnalyzer = new projectanalyzer_1.ProjectAnalyzer(this.reactBasePath);
        // Initialize processors with fallback for constructor compatibility
        try {
            this.fullFileProcessor = new Fullfileprocessor_1.FullFileProcessor(this.anthropic, this.tokenTracker, this.astAnalyzer, this.reactBasePath);
        }
        catch (error) {
            this.fullFileProcessor = new Fullfileprocessor_1.FullFileProcessor(this.anthropic, this.tokenTracker, this.astAnalyzer);
            if ('reactBasePath' in this.fullFileProcessor) {
                this.fullFileProcessor.reactBasePath = this.reactBasePath;
            }
        }
        try {
            this.targetedNodesProcessor = new TargettedNodes_1.TargetedNodesProcessor(this.anthropic, this.tokenTracker, this.astAnalyzer, this.reactBasePath);
        }
        catch (error) {
            this.targetedNodesProcessor = new TargettedNodes_1.TargetedNodesProcessor(this.anthropic, this.tokenTracker, this.astAnalyzer);
            if ('reactBasePath' in this.targetedNodesProcessor) {
                this.targetedNodesProcessor.reactBasePath = this.reactBasePath;
            }
        }
        this.componentAdditionProcessor = new ComponentAddition_1.ComponentAdditionProcessor(this.anthropic, this.reactBasePath, this.tokenTracker);
    }
    setupStreamCallbacks() {
        const streamUpdate = (message) => this.streamUpdate(message);
        // Set callbacks with safety checks
        if (this.scopeAnalyzer && typeof this.scopeAnalyzer.setStreamCallback === 'function') {
            this.scopeAnalyzer.setStreamCallback(streamUpdate);
        }
        if (this.componentGenerationSystem && typeof this.componentGenerationSystem.setStreamCallback === 'function') {
            this.componentGenerationSystem.setStreamCallback(streamUpdate);
        }
        if (this.fallbackMechanism && typeof this.fallbackMechanism.setStreamCallback === 'function') {
            this.fallbackMechanism.setStreamCallback(streamUpdate);
        }
        if (this.astAnalyzer && typeof this.astAnalyzer.setStreamCallback === 'function') {
            this.astAnalyzer.setStreamCallback(streamUpdate);
        }
        if (this.projectAnalyzer && typeof this.projectAnalyzer.setStreamCallback === 'function') {
            this.projectAnalyzer.setStreamCallback(streamUpdate);
        }
        if (this.fullFileProcessor && typeof this.fullFileProcessor.setStreamCallback === 'function') {
            this.fullFileProcessor.setStreamCallback(streamUpdate);
        }
        if (this.targetedNodesProcessor && typeof this.targetedNodesProcessor.setStreamCallback === 'function') {
            this.targetedNodesProcessor.setStreamCallback(streamUpdate);
        }
        if (this.componentAdditionProcessor && typeof this.componentAdditionProcessor.setStreamCallback === 'function') {
            this.componentAdditionProcessor.setStreamCallback(streamUpdate);
        }
    }
    setStreamCallback(callback) {
        this.streamCallback = callback;
        this.setupStreamCallbacks();
    }
    streamUpdate(message) {
        if (this.streamCallback) {
            this.streamCallback(message);
        }
    }
    // ==============================================================
    // SESSION MANAGEMENT
    // ==============================================================
    initializeSession() {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('🚀 Initializing stateless session...');
            this.streamUpdate(`📍 React Base Path: ${this.reactBasePath}`);
            // Verify directory structure
            const structureValid = yield this.verifyDirectoryStructure();
            if (!structureValid) {
                throw new Error(`Directory structure is invalid: ${this.reactBasePath}`);
            }
            const existingStartTime = yield this.redis.getSessionStartTime(this.sessionId);
            if (!existingStartTime) {
                yield this.redis.setSessionStartTime(this.sessionId, new Date().toISOString());
            }
            // Build project tree
            this.streamUpdate('🔄 Building project tree...');
            yield this.buildProjectTree();
        });
    }
    verifyDirectoryStructure() {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('🏗️ Verifying directory structure...');
            try {
                yield fs_1.promises.access(this.reactBasePath);
                this.streamUpdate(`✅ Directory exists: ${this.reactBasePath}`);
                return true;
            }
            catch (error) {
                this.streamUpdate(`❌ Directory does not exist: ${this.reactBasePath}`);
                return false;
            }
        });
    }
    buildProjectTree() {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('📂 Analyzing React project structure...');
            try {
                let projectFiles = new Map();
                // Update dependency manager
                const currentProjectFiles = yield this.getProjectFiles();
                this.dependencyManager = new dependancy_1.DependencyManager(currentProjectFiles);
                // Use project analyzer
                yield this.projectAnalyzer.buildProjectTree(projectFiles, this.dependencyManager, (message) => this.streamUpdate(message));
                if (projectFiles.size === 0) {
                    throw new Error('No React files found in directory');
                }
                // CRITICAL: Update all file paths to current reactBasePath
                const fixedProjectFiles = new Map();
                for (const [relativePath, file] of projectFiles) {
                    const currentFilePath = this.resolveCurrentFilePath(relativePath);
                    const fixedFile = Object.assign(Object.assign({}, file), { path: currentFilePath // Use current build directory path
                     });
                    fixedProjectFiles.set(relativePath, fixedFile);
                    this.streamUpdate(`🔧 Fixed path: ${relativePath} → ${currentFilePath}`);
                }
                // Store fixed paths in Redis
                yield this.setProjectFiles(fixedProjectFiles);
                this.streamUpdate(`✅ Loaded ${fixedProjectFiles.size} React files with updated paths`);
            }
            catch (error) {
                console.error('Error building project tree:', error);
                throw error;
            }
        });
    }
    // ==============================================================
    // REDIS OPERATIONS (Simplified)
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
    getModificationSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            return new modification_1.RedisModificationSummary(this.redis, this.sessionId);
        });
    }
    getModificationContextualSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            const modificationSummary = yield this.getModificationSummary();
            return yield modificationSummary.getContextualSummary();
        });
    }
    getMostModifiedFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            const modificationSummary = yield this.getModificationSummary();
            return yield modificationSummary.getMostModifiedFiles();
        });
    }
    // ==============================================================
    // MODIFICATION HANDLERS
    // ==============================================================
    handleComponentAddition(prompt, scope, projectSummaryCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            const projectFiles = yield this.getProjectFiles();
            const modificationSummary = yield this.getModificationSummary();
            return yield this.componentAdditionProcessor.handleComponentAddition(prompt, scope, projectFiles, modificationSummary, this.componentGenerationSystem, projectSummaryCallback);
        });
    }
    handleFullFileModification(prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            const projectFiles = yield this.getProjectFiles();
            const modificationSummary = yield this.getModificationSummary();
            try {
                let result = false;
                if (this.fullFileProcessor && 'handleFullFileModification' in this.fullFileProcessor &&
                    typeof this.fullFileProcessor.handleFullFileModification === 'function') {
                    result = yield this.fullFileProcessor.handleFullFileModification(prompt, projectFiles, modificationSummary);
                }
                else {
                    this.streamUpdate('⚠️ Using fallback full file modification method');
                    this.streamUpdate('❌ Full file processor method not available - modification skipped');
                    return false;
                }
                if (result) {
                    yield this.setProjectFiles(projectFiles);
                }
                return result;
            }
            catch (error) {
                this.streamUpdate(`❌ Full file modification failed: ${error}`);
                return false;
            }
        });
    }
    handleTargetedModification(prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            const projectFiles = yield this.getProjectFiles();
            const modificationSummary = yield this.getModificationSummary();
            try {
                let result = false;
                if (this.targetedNodesProcessor && 'handleTargetedModification' in this.targetedNodesProcessor &&
                    typeof this.targetedNodesProcessor.handleTargetedModification === 'function') {
                    result = yield this.targetedNodesProcessor.handleTargetedModification(prompt, projectFiles, modificationSummary);
                }
                else {
                    this.streamUpdate('⚠️ Using fallback targeted modification method');
                    this.streamUpdate('❌ Targeted nodes processor method not available - modification skipped');
                    return false;
                }
                if (result) {
                    yield this.setProjectFiles(projectFiles);
                }
                return result;
            }
            catch (error) {
                this.streamUpdate(`❌ Targeted modification failed: ${error}`);
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
                this.streamUpdate('🚀 Starting stateless intelligent modification workflow...');
                yield this.initializeSession();
                const projectFiles = yield this.getProjectFiles();
                if (projectFiles.size === 0) {
                    return {
                        success: false,
                        error: 'No React files found in directory',
                        selectedFiles: [],
                        addedFiles: []
                    };
                }
                // Build project summary for scope analysis
                const projectSummary = dbSummary || this.projectAnalyzer.buildProjectSummary(projectFiles);
                const contextWithSummary = (conversationContext || '') + '\n\n' + (yield this.getModificationContextualSummary());
                // Analyze scope
                const scope = yield this.scopeAnalyzer.analyzeScope(prompt, projectSummary, contextWithSummary, dbSummary);
                this.streamUpdate(`📋 Modification method: ${scope.scope}`);
                // Prepare for component generation if needed
                if (scope.scope === 'COMPONENT_ADDITION') {
                    if (typeof this.componentGenerationSystem.refreshFileStructure === 'function') {
                        yield this.componentGenerationSystem.refreshFileStructure();
                    }
                    if (dbSummary && typeof this.componentGenerationSystem.setProjectSummary === 'function') {
                        this.componentGenerationSystem.setProjectSummary(dbSummary);
                    }
                }
                // Execute the chosen approach
                let success = false;
                let selectedFiles = [];
                let addedFiles = [];
                switch (scope.scope) {
                    case 'COMPONENT_ADDITION':
                        const componentResult = yield this.handleComponentAddition(prompt, scope, projectSummaryCallback);
                        // Write component addition changes to files
                        if (componentResult.success) {
                            yield this.writeChangesToFiles();
                        }
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
                // Return results
                if (success) {
                    const modificationSummary = yield this.getModificationContextualSummary();
                    // CRITICAL: Write Redis changes back to actual files
                    yield this.writeChangesToFiles();
                    return {
                        success: true,
                        selectedFiles,
                        addedFiles,
                        approach: scope.scope,
                        reasoning: `${scope.reasoning} Stateless AST analysis identified ${selectedFiles.length} files for modification.`,
                        modificationSummary,
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
                console.error('❌ Stateless modification process failed:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error occurred',
                    selectedFiles: [],
                    addedFiles: [],
                    tokenUsage: this.tokenTracker.getStats()
                };
            }
        });
    }
    // ==============================================================
    // UTILITY METHODS
    // ==============================================================
    /**
     * Write Redis cached changes back to actual files
     */
    writeChangesToFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            this.streamUpdate('💾 Starting to write Redis cached changes back to actual files...');
            this.streamUpdate(`📍 Base directory: ${this.reactBasePath}`);
            try {
                const projectFiles = yield this.getProjectFiles();
                this.streamUpdate(`📦 Found ${projectFiles.size} files in Redis cache`);
                if (projectFiles.size === 0) {
                    this.streamUpdate('⚠️ No files found in Redis cache to write');
                    return;
                }
                let filesWritten = 0;
                let filesSkipped = 0;
                for (const [relativePath, projectFile] of projectFiles.entries()) {
                    this.streamUpdate(`\n🔍 Processing: ${relativePath}`);
                    this.streamUpdate(`   Has content: ${!!projectFile.content}`);
                    this.streamUpdate(`   Content length: ${((_a = projectFile.content) === null || _a === void 0 ? void 0 : _a.length) || 0}`);
                    if (projectFile.content) {
                        try {
                            // CRITICAL FIX: Use current reactBasePath, not cached paths
                            const currentFilePath = this.resolveCurrentFilePath(relativePath);
                            // Debug: Log the path resolution
                            this.streamUpdate(`🔧 Path resolution:`);
                            this.streamUpdate(`   Input: ${relativePath}`);
                            this.streamUpdate(`   Output: ${currentFilePath}`);
                            this.streamUpdate(`   Base: ${this.reactBasePath}`);
                            // Ensure directory exists
                            const dir = path.dirname(currentFilePath);
                            this.streamUpdate(`📁 Ensuring directory exists: ${dir}`);
                            yield fs_1.promises.mkdir(dir, { recursive: true });
                            // Check if target file already exists
                            const existsBefore = yield fs_1.promises.access(currentFilePath).then(() => true).catch(() => false);
                            this.streamUpdate(`   File exists before write: ${existsBefore}`);
                            // Write the updated content to the actual file in current temp-build
                            this.streamUpdate(`💾 Writing ${projectFile.content.length} characters to file...`);
                            yield fs_1.promises.writeFile(currentFilePath, projectFile.content, 'utf8');
                            // Verify the file was written
                            const stats = yield fs_1.promises.stat(currentFilePath);
                            const existsAfter = yield fs_1.promises.access(currentFilePath).then(() => true).catch(() => false);
                            this.streamUpdate(`✅ SUCCESS: Written to ${currentFilePath}`);
                            this.streamUpdate(`   File size: ${stats.size} bytes`);
                            this.streamUpdate(`   Modified: ${stats.mtime}`);
                            this.streamUpdate(`   Exists after write: ${existsAfter}`);
                            filesWritten++;
                        }
                        catch (writeError) {
                            this.streamUpdate(`❌ FAILED to write ${relativePath}:`);
                            this.streamUpdate(`   Error: ${writeError}`);
                            console.error(`Failed to write file ${relativePath}:`, writeError);
                        }
                    }
                    else {
                        this.streamUpdate(`⚠️ SKIPPED ${relativePath}: No content`);
                        filesSkipped++;
                    }
                }
                this.streamUpdate(`\n📊 Write Summary:`);
                this.streamUpdate(`   Files written: ${filesWritten}`);
                this.streamUpdate(`   Files skipped: ${filesSkipped}`);
                this.streamUpdate(`   Total processed: ${projectFiles.size}`);
                // Additional verification: List what's actually in the temp directory
                try {
                    this.streamUpdate(`\n🔍 Verifying temp directory structure:`);
                    const srcPath = path.join(this.reactBasePath, 'src');
                    const srcExists = yield fs_1.promises.access(srcPath).then(() => true).catch(() => false);
                    this.streamUpdate(`   src/ exists: ${srcExists} at ${srcPath}`);
                    if (srcExists) {
                        const srcFiles = yield fs_1.promises.readdir(srcPath, { recursive: true });
                        this.streamUpdate(`   Files in src/: ${srcFiles.length}`);
                        this.streamUpdate(`   First 10 files: ${srcFiles.slice(0, 10).join(', ')}`);
                        // Check specific modified files
                        const modifiedFiles = ['pages/TodoApp.tsx', 'components/TodoFilters.tsx'];
                        for (const file of modifiedFiles) {
                            const filePath = path.join(srcPath, file);
                            const exists = yield fs_1.promises.access(filePath).then(() => true).catch(() => false);
                            if (exists) {
                                const stats = yield fs_1.promises.stat(filePath);
                                this.streamUpdate(`   ✅ ${file}: ${stats.size} bytes, modified ${stats.mtime}`);
                            }
                            else {
                                this.streamUpdate(`   ❌ ${file}: NOT FOUND at ${filePath}`);
                            }
                        }
                    }
                    else {
                        this.streamUpdate(`❌ src directory doesn't exist at: ${srcPath}`);
                        // Check what's in the base directory
                        const baseFiles = yield fs_1.promises.readdir(this.reactBasePath);
                        this.streamUpdate(`   Files in base directory: ${baseFiles.join(', ')}`);
                    }
                }
                catch (verifyError) {
                    this.streamUpdate(`⚠️ Could not verify directory structure: ${verifyError}`);
                }
            }
            catch (error) {
                this.streamUpdate(`❌ Error writing changes to files: ${error}`);
                console.error('Error writing changes to files:', error);
                throw error;
            }
        });
    }
    /**
     * Resolve file path to current build directory
     */
    resolveCurrentFilePath(relativePath) {
        // Clean the relative path and normalize separators
        const cleanPath = relativePath.replace(/^[\/\\]+/, '').replace(/\\/g, '/');
        // Handle different path patterns
        if (cleanPath.startsWith('src/')) {
            // Path already includes src, use directly
            return path.join(this.reactBasePath, cleanPath);
        }
        else {
            // Assume it's a file in src directory
            return path.join(this.reactBasePath, 'src', cleanPath);
        }
    }
    cleanup() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.redis.disconnect();
        });
    }
}
exports.StatelessIntelligentFileModifier = StatelessIntelligentFileModifier;
//# sourceMappingURL=filemodifier.js.map