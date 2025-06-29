"use strict";
// ============================================================================
// SECURE FILE MODIFIER SERVICE - Enhanced with Strict src/ Path Restrictions
// ============================================================================
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
// Import secure processors with path restriction
const pathrestrictor_1 = require("./pathrestrictor");
const Astanalyzer_1 = require("./processor/Astanalyzer");
const TokenTracer_1 = require("../utils/TokenTracer");
const Redis_1 = require("./Redis");
const modification_1 = require("./filemodifier/modification");
const fs_1 = require("fs");
const path = __importStar(require("path"));
class StatelessIntelligentFileModifier {
    constructor(anthropic, reactBasePath, sessionId, redisUrl) {
        this.anthropic = anthropic;
        this.reactBasePath = path.resolve(reactBasePath);
        this.sessionId = sessionId;
        this.redis = new Redis_1.RedisService(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
        // Initialize security manager FIRST
        this.pathManager = new pathrestrictor_1.PathRestrictionManager(this.reactBasePath);
        // Initialize components
        this.initializeSecureComponents();
        this.setupStreamCallbacks();
        // Log initialization with security info
        this.streamUpdate(`🔒 SECURE file modifier initialization:`);
        this.streamUpdate(`   React Base Path: ${this.reactBasePath}`);
        this.streamUpdate(`   Secure src Path: ${path.join(this.reactBasePath, 'src')}`);
        this.streamUpdate(`   Session ID: ${sessionId}`);
        this.streamUpdate(`   Security: Path restrictions ENABLED`);
    }
    initializeSecureComponents() {
        // Initialize original modules
        this.scopeAnalyzer = new scopeanalyzer_1.ScopeAnalyzer(this.anthropic);
        this.componentGenerationSystem = new component_1.ComponentGenerationSystem(this.anthropic, this.reactBasePath);
        this.dependencyManager = new dependancy_1.DependencyManager(new Map());
        this.fallbackMechanism = new fallback_1.FallbackMechanism(this.anthropic);
        // Initialize secure processors
        this.tokenTracker = new TokenTracer_1.TokenTracker();
        this.astAnalyzer = new Astanalyzer_1.ASTAnalyzer();
        // Use SECURE versions of processors
        this.safeProjectAnalyzer = new pathrestrictor_1.SafeProjectAnalyzer(this.reactBasePath);
        this.safeFullFileProcessor = new pathrestrictor_1.SafeFullFileProcessor(this.anthropic, this.tokenTracker, this.reactBasePath);
        this.safeComponentAdditionProcessor = new pathrestrictor_1.SafeComponentAdditionProcessor(this.anthropic, this.reactBasePath, this.tokenTracker);
    }
    setupStreamCallbacks() {
        const streamUpdate = (message) => this.streamUpdate(message);
        // Set callbacks with safety checks
        this.pathManager.setStreamCallback(streamUpdate);
        this.safeProjectAnalyzer.setStreamCallback(streamUpdate);
        this.safeFullFileProcessor.setStreamCallback(streamUpdate);
        this.safeComponentAdditionProcessor.setStreamCallback(streamUpdate);
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
    // SECURE SESSION MANAGEMENT
    // ==============================================================
    initializeSession() {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('🔒 Initializing SECURE session...');
            // Security check: Verify src directory exists and is accessible
            const srcPath = path.join(this.reactBasePath, 'src');
            try {
                yield fs_1.promises.access(srcPath, fs_1.promises.constants.R_OK | fs_1.promises.constants.W_OK);
                this.streamUpdate(`✅ SECURE: src directory verified at ${srcPath}`);
            }
            catch (error) {
                throw new Error(`SECURITY: src directory not accessible: ${srcPath}`);
            }
            // Verify no path traversal in base path
            const resolvedBase = path.resolve(this.reactBasePath);
            if (resolvedBase !== this.reactBasePath) {
                this.streamUpdate(`🔧 Path normalized: ${this.reactBasePath} → ${resolvedBase}`);
                this.reactBasePath = resolvedBase;
            }
            const existingStartTime = yield this.redis.getSessionStartTime(this.sessionId);
            if (!existingStartTime) {
                yield this.redis.setSessionStartTime(this.sessionId, new Date().toISOString());
            }
            // Build project tree with security
            this.streamUpdate('🔄 Building SECURE project tree (src only)...');
            yield this.buildSecureProjectTree();
        });
    }
    buildSecureProjectTree() {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('📂 Analyzing React project structure with security restrictions...');
            try {
                let projectFiles = new Map();
                // Use SECURE project analyzer - only scans src folder
                yield this.safeProjectAnalyzer.buildProjectTreeSafely(projectFiles);
                if (projectFiles.size === 0) {
                    throw new Error('No valid React files found in src directory');
                }
                // SECURITY: Clean and validate all file paths
                const secureProjectFiles = this.pathManager.cleanProjectFilePaths(projectFiles);
                // Update dependency manager with secure files
                this.dependencyManager = new dependancy_1.DependencyManager(secureProjectFiles);
                // Store secure paths in Redis
                yield this.setProjectFiles(secureProjectFiles);
                this.streamUpdate(`✅ SECURE: Loaded ${secureProjectFiles.size} validated React files from src/`);
                this.streamUpdate(`🔒 All file paths verified to be within src/ directory only`);
            }
            catch (error) {
                console.error('Error building secure project tree:', error);
                throw error;
            }
        });
    }
    // ==============================================================
    // SECURE REDIS OPERATIONS
    // ==============================================================
    getProjectFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            const projectFiles = yield this.redis.getProjectFiles(this.sessionId);
            if (projectFiles && projectFiles.size > 0) {
                // SECURITY: Re-validate all cached paths
                return this.pathManager.cleanProjectFilePaths(projectFiles);
            }
            return new Map();
        });
    }
    setProjectFiles(projectFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            // SECURITY: Clean paths before storing
            const secureFiles = this.pathManager.cleanProjectFilePaths(projectFiles);
            yield this.redis.setProjectFiles(this.sessionId, secureFiles);
        });
    }
    getModificationSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            return new modification_1.RedisModificationSummary(this.redis, this.sessionId);
        });
    }
    // ==============================================================
    // SECURE MODIFICATION HANDLERS
    // ==============================================================
    handleSecureComponentAddition(prompt, scope, projectSummaryCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('🔒 SECURE component addition workflow...');
            const projectFiles = yield this.getProjectFiles();
            const modificationSummary = yield this.getModificationSummary();
            // Extract component name and type
            const componentName = yield this.extractComponentNameSecurely(prompt);
            const componentType = this.determineComponentType(prompt);
            this.streamUpdate(`🔒 Creating SECURE ${componentType}: ${componentName}`);
            // Generate component content (this is safe as it's just text generation)
            const componentContent = yield this.generateComponentContentSecurely(componentName, componentType, prompt);
            if (!componentContent) {
                return {
                    success: false,
                    error: 'Failed to generate component content',
                    selectedFiles: [],
                    addedFiles: []
                };
            }
            // SECURE file creation
            const createResult = yield this.safeComponentAdditionProcessor.createComponentSafely(componentName, componentType, componentContent);
            if (!createResult.success) {
                return {
                    success: false,
                    error: createResult.error,
                    selectedFiles: [],
                    addedFiles: []
                };
            }
            let updatedFiles = [];
            // For pages, update App.tsx securely
            if (componentType === 'page') {
                this.streamUpdate('🔒 Updating App.tsx securely...');
                const appContent = yield this.generateAppUpdateContentSecurely(componentName, projectFiles);
                if (appContent) {
                    const appUpdateResult = yield this.safeComponentAdditionProcessor.updateAppSafely(projectFiles, componentName, appContent);
                    if (appUpdateResult.success && appUpdateResult.updatedFiles) {
                        updatedFiles = appUpdateResult.updatedFiles;
                    }
                }
            }
            // Update modification summary
            const relativePath = `src/${componentType === 'page' ? 'pages' : 'components'}/${componentName}.tsx`;
            modificationSummary.addChange('created', relativePath, `Created secure ${componentType}: ${componentName}`);
            updatedFiles.forEach(file => {
                modificationSummary.addChange('updated', file, `Updated for ${componentName} integration`);
            });
            return {
                success: true,
                selectedFiles: updatedFiles,
                addedFiles: [relativePath],
                approach: 'COMPONENT_ADDITION',
                reasoning: `Successfully created ${componentName} ${componentType} with secure path validation`,
                modificationSummary: yield modificationSummary.getSummary(),
                tokenUsage: this.tokenTracker.getStats()
            };
        });
    }
    handleSecureFullFileModification(prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('🔒 SECURE full file modification workflow...');
            const projectFiles = yield this.getProjectFiles();
            const modificationSummary = yield this.getModificationSummary();
            if (projectFiles.size === 0) {
                this.streamUpdate('❌ No secure files available for modification');
                return false;
            }
            try {
                let modifiedCount = 0;
                const RELEVANCE_THRESHOLD = 70;
                // Analyze each file for relevance (already secure files)
                for (const [relativePath, file] of projectFiles) {
                    // Double-check security for each file
                    const verification = yield this.pathManager.verifyFileInSrc(relativePath);
                    if (!verification.isValid) {
                        this.streamUpdate(`🚨 SECURITY: Skipping invalid path ${relativePath}`);
                        continue;
                    }
                    // Get AST nodes for analysis
                    const astNodes = this.astAnalyzer.parseFileWithAST(relativePath, projectFiles);
                    if (astNodes.length === 0) {
                        continue;
                    }
                    // Analyze relevance
                    const relevanceResult = yield this.astAnalyzer.analyzeFileRelevance(prompt, relativePath, astNodes, 'FULL_FILE', projectFiles, this.anthropic, this.tokenTracker);
                    if (relevanceResult.isRelevant && relevanceResult.relevanceScore >= RELEVANCE_THRESHOLD) {
                        this.streamUpdate(`✅ SECURE: Modifying ${relativePath} (score: ${relevanceResult.relevanceScore})`);
                        // Generate modified content
                        const modifiedContent = yield this.generateModifiedContentSecurely(file, prompt, relevanceResult.reasoning);
                        if (modifiedContent) {
                            // SECURE file modification
                            const modifyResult = yield this.safeFullFileProcessor.modifyFileSafely(relativePath, modifiedContent, projectFiles);
                            if (modifyResult.success) {
                                modifiedCount++;
                                yield modificationSummary.addChange('modified', relativePath, `Secure modification: ${prompt.substring(0, 50)}...`);
                                this.streamUpdate(`✅ SECURE: Modified ${relativePath}`);
                            }
                            else {
                                this.streamUpdate(`❌ SECURE: Failed to modify ${relativePath}: ${modifyResult.error}`);
                            }
                        }
                    }
                }
                // Update project files cache
                if (modifiedCount > 0) {
                    yield this.setProjectFiles(projectFiles);
                }
                this.streamUpdate(`🔒 SECURE full file modification complete: ${modifiedCount} files modified`);
                return modifiedCount > 0;
            }
            catch (error) {
                this.streamUpdate(`❌ SECURE full file modification failed: ${error}`);
                return false;
            }
        });
    }
    // ==============================================================
    // SECURE CONTENT GENERATION HELPERS
    // ==============================================================
    extractComponentNameSecurely(prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            // Safe AI extraction - no file system operations
            const extractionPrompt = `Extract component name from: "${prompt}". Return only the PascalCase name, nothing else.`;
            try {
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 30,
                    temperature: 0,
                    messages: [{ role: 'user', content: extractionPrompt }],
                });
                this.tokenTracker.logUsage(response.usage, 'Secure Component Name Extraction');
                const firstBlock = response.content[0];
                if ((firstBlock === null || firstBlock === void 0 ? void 0 : firstBlock.type) === 'text') {
                    let name = firstBlock.text.trim().replace(/[^a-zA-Z]/g, '');
                    if (name && name.length > 0) {
                        return name.charAt(0).toUpperCase() + name.slice(1);
                    }
                }
            }
            catch (error) {
                this.streamUpdate(`⚠️ AI extraction failed: ${error}`);
            }
            // Fallback pattern matching
            return this.fallbackExtractComponentName(prompt);
        });
    }
    fallbackExtractComponentName(prompt) {
        const patterns = [
            /create.*?([A-Za-z]+).*?page/i,
            /add.*?([A-Za-z]+).*?component/i,
            /make.*?([A-Za-z]+)/i,
            /([A-Za-z]+).*?page/i,
            /([A-Za-z]+).*?component/i
        ];
        for (const pattern of patterns) {
            const match = prompt.match(pattern);
            if (match && match[1] && match[1].length > 2) {
                return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
            }
        }
        return 'NewComponent';
    }
    determineComponentType(prompt) {
        return /page|route|screen|view/i.test(prompt) ? 'page' : 'component';
    }
    generateComponentContentSecurely(componentName, componentType, prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            // Safe content generation - no file operations
            const generationPrompt = `
Create a React TypeScript ${componentType} named ${componentName}.

Requirements:
- Use TypeScript (.tsx)
- Export as default
- Include basic functionality based on: "${prompt}"
- Use modern React with hooks
- Include basic styling with Tailwind classes
- Keep it simple and functional

Return ONLY the complete component code:
`;
            try {
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 2000,
                    temperature: 0,
                    messages: [{ role: 'user', content: generationPrompt }],
                });
                this.tokenTracker.logUsage(response.usage, `Secure Component Generation: ${componentName}`);
                const firstBlock = response.content[0];
                if ((firstBlock === null || firstBlock === void 0 ? void 0 : firstBlock.type) === 'text') {
                    const text = firstBlock.text;
                    const codeMatch = text.match(/```(?:tsx|typescript|jsx|javascript)\n([\s\S]*?)```/);
                    return codeMatch ? codeMatch[1].trim() : text.trim();
                }
            }
            catch (error) {
                this.streamUpdate(`❌ Component generation failed: ${error}`);
            }
            return null;
        });
    }
    generateAppUpdateContentSecurely(componentName, projectFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            // Find App.tsx safely
            const appFile = projectFiles.get('src/App.tsx') || projectFiles.get('src/App.jsx');
            if (!appFile) {
                return null;
            }
            const updatePrompt = `
Update this App.tsx file to include routing for new page component ${componentName}:

Current App.tsx:
\`\`\`tsx
${appFile.content}
\`\`\`

Requirements:
1. Add import for ${componentName} from './pages/${componentName}'
2. Add route for /${componentName.toLowerCase()} 
3. Add React Router imports if not present
4. Wrap in BrowserRouter if needed
5. Preserve all existing functionality

Return ONLY the complete updated App.tsx:
`;
            try {
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 3000,
                    temperature: 0,
                    messages: [{ role: 'user', content: updatePrompt }],
                });
                this.tokenTracker.logUsage(response.usage, 'Secure App.tsx Update');
                const firstBlock = response.content[0];
                if ((firstBlock === null || firstBlock === void 0 ? void 0 : firstBlock.type) === 'text') {
                    const text = firstBlock.text;
                    const codeMatch = text.match(/```(?:tsx|typescript|jsx|javascript)\n([\s\S]*?)```/);
                    return codeMatch ? codeMatch[1].trim() : null;
                }
            }
            catch (error) {
                this.streamUpdate(`❌ App.tsx update generation failed: ${error}`);
            }
            return null;
        });
    }
    generateModifiedContentSecurely(file, prompt, reasoning) {
        return __awaiter(this, void 0, void 0, function* () {
            const modificationPrompt = `
Modify this React file based on the user request:

USER REQUEST: "${prompt}"
WHY THIS FILE: ${reasoning}

CURRENT FILE (${file.relativePath}):
\`\`\`tsx
${file.content}
\`\`\`

Requirements:
1. Preserve ALL imports and exports exactly
2. Keep component structure intact
3. Only modify what's necessary for the request
4. Maintain TypeScript types
5. Keep existing functionality

Return ONLY the complete modified file:
`;
            try {
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 4000,
                    temperature: 0,
                    messages: [{ role: 'user', content: modificationPrompt }],
                });
                this.tokenTracker.logUsage(response.usage, `Secure File Modification: ${file.relativePath}`);
                const firstBlock = response.content[0];
                if ((firstBlock === null || firstBlock === void 0 ? void 0 : firstBlock.type) === 'text') {
                    const text = firstBlock.text;
                    const codeMatch = text.match(/```(?:tsx|typescript|jsx|javascript)\n([\s\S]*?)```/);
                    return codeMatch ? codeMatch[1].trim() : null;
                }
            }
            catch (error) {
                this.streamUpdate(`❌ Content modification failed: ${error}`);
            }
            return null;
        });
    }
    // ==============================================================
    // MAIN SECURE PROCESSING METHOD
    // ==============================================================
    processModification(prompt, conversationContext, dbSummary, projectSummaryCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.streamUpdate('🔒 Starting SECURE intelligent modification workflow...');
                yield this.initializeSession();
                const projectFiles = yield this.getProjectFiles();
                if (projectFiles.size === 0) {
                    return {
                        success: false,
                        error: 'No secure React files found in src directory',
                        selectedFiles: [],
                        addedFiles: []
                    };
                }
                // Build project summary for scope analysis
                const projectSummary = dbSummary || this.buildProjectSummary(projectFiles);
                const contextWithSummary = (conversationContext || '') + '\n\n' + (yield this.getModificationContextualSummary());
                // Analyze scope
                const scope = yield this.scopeAnalyzer.analyzeScope(prompt, projectSummary, contextWithSummary, dbSummary);
                this.streamUpdate(`📋 SECURE modification method: ${scope.scope}`);
                // Execute the chosen approach securely
                switch (scope.scope) {
                    case 'COMPONENT_ADDITION':
                        const componentResult = yield this.handleSecureComponentAddition(prompt, scope, projectSummaryCallback);
                        return componentResult;
                    case 'FULL_FILE':
                        const success = yield this.handleSecureFullFileModification(prompt);
                        if (success) {
                            const modificationSummary = yield this.getModificationContextualSummary();
                            const mostModified = yield this.getMostModifiedFiles();
                            return {
                                success: true,
                                selectedFiles: mostModified.map(item => item.file),
                                addedFiles: [],
                                approach: 'FULL_FILE',
                                reasoning: `${scope.reasoning} Secure modification of files within src/ only.`,
                                modificationSummary,
                                tokenUsage: this.tokenTracker.getStats()
                            };
                        }
                        else {
                            return {
                                success: false,
                                error: 'Secure full file modification failed',
                                selectedFiles: [],
                                addedFiles: [],
                                approach: 'FULL_FILE',
                                reasoning: scope.reasoning,
                                tokenUsage: this.tokenTracker.getStats()
                            };
                        }
                    case 'TARGETED_NODES':
                        // For now, fall back to full file for targeted modifications
                        this.streamUpdate('🔒 Using secure full file modification for targeted changes...');
                        const targetedSuccess = yield this.handleSecureFullFileModification(prompt);
                        if (targetedSuccess) {
                            const modificationSummary = yield this.getModificationContextualSummary();
                            const mostModified = yield this.getMostModifiedFiles();
                            return {
                                success: true,
                                selectedFiles: mostModified.map(item => item.file),
                                addedFiles: [],
                                approach: 'TARGETED_NODES',
                                reasoning: `${scope.reasoning} Secure targeted modification within src/ only.`,
                                modificationSummary,
                                tokenUsage: this.tokenTracker.getStats()
                            };
                        }
                        else {
                            return {
                                success: false,
                                error: 'Secure targeted modification failed',
                                selectedFiles: [],
                                addedFiles: [],
                                approach: 'TARGETED_NODES',
                                reasoning: scope.reasoning,
                                tokenUsage: this.tokenTracker.getStats()
                            };
                        }
                    default:
                        return {
                            success: false,
                            error: 'Unknown modification scope',
                            selectedFiles: [],
                            addedFiles: []
                        };
                }
            }
            catch (error) {
                console.error('❌ SECURE modification process failed:', error);
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
    buildProjectSummary(projectFiles) {
        const totalFiles = projectFiles.size;
        const componentFiles = Array.from(projectFiles.keys()).filter(path => path.includes('.tsx') || path.includes('.jsx')).length;
        const keyFiles = Array.from(projectFiles.keys())
            .filter(path => path.includes('App.') || path.includes('index.') || path.includes('main.'))
            .slice(0, 3);
        return `Secure React TypeScript project with ${totalFiles} files (${componentFiles} components) in src/ directory. Key files: ${keyFiles.join(', ')}.`;
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
    cleanup() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.redis.disconnect();
        });
    }
}
exports.StatelessIntelligentFileModifier = StatelessIntelligentFileModifier;
//# sourceMappingURL=filemodifier.js.map