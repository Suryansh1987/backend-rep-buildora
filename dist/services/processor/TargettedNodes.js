"use strict";
// ============================================================================
// FIXED TARGETED NODES PROCESSOR - PROPER COMPONENT HANDLING
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
exports.TargetedNodesProcessor = exports.FixedTargetedNodesProcessor = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const Structurevalidator_1 = require("../../utils/Structurevalidator");
const template_1 = require("../filemodifier/template");
class FixedTargetedNodesProcessor {
    constructor(anthropic, tokenTracker, astAnalyzer, reactBasePath) {
        this.anthropic = anthropic;
        this.tokenTracker = tokenTracker;
        this.astAnalyzer = astAnalyzer;
        this.structureValidator = new Structurevalidator_1.StructureValidator();
        this.reactBasePath = reactBasePath || process.cwd();
    }
    setStreamCallback(callback) {
        this.streamCallback = callback;
    }
    streamUpdate(message) {
        if (this.streamCallback) {
            this.streamCallback(message);
        }
    }
    resolveFilePath(projectFile) {
        if ((0, path_1.isAbsolute)(projectFile.path)) {
            return projectFile.path;
        }
        if (projectFile.relativePath) {
            return (0, path_1.join)(this.reactBasePath, projectFile.relativePath);
        }
        return projectFile.path;
    }
    /**
     * FIXED: Only skip actual styling files, NOT component directories
     */
    shouldSkipFile(filePath, content) {
        // ONLY skip these specific file types - NOT directories
        const skipFileTypes = [
            /\.css$/i, // Pure CSS files
            /\.scss$/i, // SCSS files
            /\.sass$/i, // SASS files
            /\.less$/i, // LESS files
            /\.styl$/i, // Stylus files
            /\.module\.css$/i, // CSS modules
            /\.module\.scss$/i, // SCSS modules
            /package\.json$/i, // Package files
            /yarn\.lock$/i, // Lock files
            /package-lock\.json$/i,
            /\.gitignore$/i, // Git files
            /\.env$/i, // Environment files
            /\.md$/i, // Markdown files
            /\.txt$/i, // Text files
            /\.log$/i, // Log files
            /\.(png|jpg|jpeg|gif|svg|ico|webp)$/i, // Image files
            /\.(mp4|mp3|wav|avi)$/i, // Media files
            /dist\//i, // Distribution directories
            /build\//i, // Build directories
            /node_modules\//i, // Node modules
            /\.next\//i, // Next.js build
            /\.git\//i // Git directory
        ];
        // Check if file matches skip patterns
        const shouldSkipByPath = skipFileTypes.some(pattern => pattern.test(filePath));
        if (shouldSkipByPath) {
            this.streamUpdate(`⏭️ Skipping non-code file: ${filePath}`);
            return true;
        }
        // FIXED: Don't skip component directories - process ALL .tsx/.jsx/.ts/.js files
        if (filePath.match(/\.(tsx?|jsx?)$/i)) {
            this.streamUpdate(`✅ Processing React/JS file: ${filePath}`);
            return false; // Never skip React/JS files
        }
        // Only skip if file has ZERO business logic (very conservative)
        const hasBusinessLogic = this.hasBusinessLogic(content);
        if (!hasBusinessLogic) {
            this.streamUpdate(`⏭️ Skipping file with no business logic: ${filePath}`);
            return true;
        }
        return false;
    }
    /**
     * Check if file contains actual business logic (not just styling)
     */
    hasBusinessLogic(content) {
        // Business logic indicators
        const businessLogicPatterns = [
            // React patterns
            /import.*React/i,
            /useState\(/i,
            /useEffect\(/i,
            /useCallback\(/i,
            /useMemo\(/i,
            /useContext\(/i,
            /useReducer\(/i,
            // Function definitions
            /function\s+\w+/i,
            /const\s+\w+\s*=\s*\([^)]*\)\s*=>/i,
            /export\s+(default\s+)?function/i,
            /export\s+(default\s+)?(class|const)/i,
            // Control flow
            /if\s*\(/i,
            /for\s*\(/i,
            /while\s*\(/i,
            /switch\s*\(/i,
            /try\s*{/i,
            /catch\s*\(/i,
            // Data operations
            /\.map\(/i,
            /\.filter\(/i,
            /\.reduce\(/i,
            /\.find\(/i,
            /\.some\(/i,
            /\.every\(/i,
            // API calls
            /fetch\(/i,
            /axios\./i,
            /api\./i,
            /await\s+/i,
            /\.then\(/i,
            /\.catch\(/i,
            // JSX/TSX
            /return\s*\(/i,
            /<\w+/i,
            /jsx/i,
            /tsx/i,
            // TypeScript
            /interface\s+\w+/i,
            /type\s+\w+/i,
            /:\s*\w+/i,
            // Props and state
            /props\./i,
            /this\.state/i,
            /this\.props/i,
            // Event handlers
            /onClick/i,
            /onChange/i,
            /onSubmit/i,
            /handle\w+/i,
            // Imports/exports
            /import.*from/i,
            /export\s+/i,
            /module\.exports/i,
            /require\(/i,
            // Variables and constants
            /const\s+\w+/i,
            /let\s+\w+/i,
            /var\s+\w+/i,
        ];
        // Count business logic patterns
        const logicCount = businessLogicPatterns.reduce((count, pattern) => {
            return count + (content.match(pattern) ? 1 : 0);
        }, 0);
        // File has business logic if it contains at least 2 patterns
        return logicCount >= 2;
    }
    /**
     * FIXED: Don't filter out UI nodes - process ALL nodes in component files
     */
    shouldProcessNode(node, filePath) {
        // ALWAYS process nodes in component files
        if (filePath.match(/src\/(components|pages)\//i)) {
            return true;
        }
        // For other files, check if node has meaningful content
        const meaningfulPatterns = [
            /function\s+\w+/i,
            /const\s+\w+\s*=/i,
            /class\s+\w+/i,
            /interface\s+\w+/i,
            /type\s+\w+/i,
            /export/i,
            /import/i,
            /if\s*\(/i,
            /for\s*\(/i,
            /while\s*\(/i,
            /return/i,
            /useState/i,
            /useEffect/i,
            /handle\w+/i,
            /onClick/i,
            /onChange/i,
        ];
        return meaningfulPatterns.some(pattern => pattern.test(node.codeSnippet));
    }
    /**
     * Main entry point matching the expected interface
     */
    processTargetedModification(prompt, projectFiles, reactBasePath, streamCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            this.setStreamCallback(streamCallback);
            if (reactBasePath) {
                this.reactBasePath = reactBasePath;
            }
            try {
                this.streamUpdate(`🎯 FIXED: Starting targeted modification (processing ALL component files)...`);
                let successCount = 0;
                const changes = [];
                const relevantFiles = [];
                // Step 1: Process ALL files, only skip actual non-code files
                for (const [filePath] of projectFiles) {
                    const projectFile = projectFiles.get(filePath);
                    if (!projectFile)
                        continue;
                    // FIXED: Only skip actual non-code files
                    if (this.shouldSkipFile(filePath, projectFile.content)) {
                        continue; // Skip message already logged in shouldSkipFile
                    }
                    // Parse AST nodes
                    const astNodes = this.astAnalyzer.parseFileWithAST(filePath, projectFiles);
                    // FIXED: Process ALL nodes in component files
                    const processableNodes = astNodes.filter(node => this.shouldProcessNode(node, filePath));
                    if (processableNodes.length === 0) {
                        this.streamUpdate(`⏭️ Skipping ${filePath} - no processable nodes found`);
                        continue;
                    }
                    // Get file relevance
                    const relevanceResult = yield this.astAnalyzer.analyzeFileRelevance(prompt, filePath, processableNodes, 'TARGETED_NODES', projectFiles, this.anthropic, this.tokenTracker);
                    const actualPath = this.resolveFilePath(projectFile);
                    relevantFiles.push({
                        filePath,
                        score: relevanceResult.relevanceScore || 0,
                        targetNodes: processableNodes,
                        actualPath
                    });
                    this.streamUpdate(`✅ Added ${processableNodes.length} nodes from ${filePath} (score: ${relevanceResult.relevanceScore || 0})`);
                }
                // Step 2: Sort by relevance but process ALL files
                relevantFiles.sort((a, b) => b.score - a.score);
                this.streamUpdate(`🎯 Processing ${relevantFiles.length} files with nodes...`);
                // Step 3: Apply modifications
                for (const { filePath, targetNodes, score, actualPath } of relevantFiles) {
                    this.streamUpdate(`🔧 Processing ${filePath} (score: ${score}, ${targetNodes.length} nodes)...`);
                    const modifications = yield this.modifyCodeSnippetsWithTemplate(prompt, targetNodes, filePath, projectFiles);
                    const success = yield this.applyModifications(filePath, targetNodes, modifications, projectFiles, actualPath);
                    const change = {
                        type: 'modified',
                        file: filePath,
                        description: `Processed ${modifications.size} code modifications`,
                        success: success,
                        details: {
                            linesChanged: modifications.size,
                            componentsAffected: targetNodes.map(n => n.id),
                            reasoning: `Processed ${targetNodes.length} nodes in ${filePath}`
                        }
                    };
                    changes.push(change);
                    if (success) {
                        successCount++;
                        this.streamUpdate(`✅ Successfully modified ${filePath} (${modifications.size} nodes updated)`);
                    }
                    else {
                        this.streamUpdate(`❌ Failed to modify ${filePath}`);
                    }
                }
                this.streamUpdate(`📊 FIXED modification complete: ${successCount}/${relevantFiles.length} files modified`);
                const tokenStats = this.tokenTracker.getStats();
                this.streamUpdate(`💰 Token usage: ${tokenStats.totalTokens} total`);
                return {
                    success: successCount > 0,
                    updatedProjectFiles: projectFiles,
                    projectFiles: projectFiles,
                    changes: changes
                };
            }
            catch (error) {
                this.streamUpdate(`❌ Error in processTargetedModification: ${error}`);
                return {
                    success: false,
                    changes: [{
                            type: 'error',
                            file: 'system',
                            description: `Processing failed: ${error}`,
                            success: false
                        }]
                };
            }
        });
    }
    /**
     * Alternative method name for compatibility
     */
    process(prompt, projectFiles, reactBasePath, streamCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.processTargetedModification(prompt, projectFiles, reactBasePath, streamCallback);
        });
    }
    /**
     * Legacy method - now calls the main processor
     */
    handleTargetedModification(prompt, projectFiles, modificationSummary) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.processTargetedModification(prompt, projectFiles, this.reactBasePath, (message) => this.streamUpdate(message));
            return result.success;
        });
    }
    modifyCodeSnippetsWithTemplate(prompt, targetNodes, filePath, projectFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            const fileAnalysis = this.analyzeFileForTemplate(projectFiles.get(filePath));
            const projectSummary = this.generateProjectSummary(projectFiles);
            const targetNodesFormatted = targetNodes.map(node => `**${node.id}:** (lines ${node.startLine}-${node.endLine})
\`\`\`jsx
${node.codeSnippet}
\`\`\`
`).join('\n\n');
            const templateVariables = (0, template_1.prepareTargetedNodesVariables)(prompt, filePath, fileAnalysis.componentName, fileAnalysis.componentPurpose, targetNodesFormatted, projectSummary);
            const enhancedPrompt = (0, template_1.replaceTemplateVariables)(template_1.targetedNodesPrompt, templateVariables);
            try {
                this.streamUpdate(`🤖 Generating modifications for ${targetNodes.length} nodes in ${filePath}...`);
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 6000,
                    temperature: 0,
                    messages: [{ role: 'user', content: enhancedPrompt }],
                });
                this.tokenTracker.logUsage(response.usage, `Processing: ${targetNodes.length} nodes in ${filePath}`);
                const firstBlock = response.content[0];
                if ((firstBlock === null || firstBlock === void 0 ? void 0 : firstBlock.type) === 'text') {
                    const text = firstBlock.text;
                    const jsonMatch = text.match(/```json\n([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const jsonText = jsonMatch[1] || jsonMatch[0];
                        try {
                            const modifications = JSON.parse(jsonText);
                            const modMap = new Map();
                            for (const [nodeId, nodeData] of Object.entries(modifications)) {
                                let modifiedCode;
                                if (typeof nodeData === 'string') {
                                    modifiedCode = nodeData;
                                }
                                else if (typeof nodeData === 'object' && nodeData !== null) {
                                    const data = nodeData;
                                    modifiedCode = data.modifiedCode || '';
                                }
                                else {
                                    continue;
                                }
                                if (modifiedCode !== undefined && modifiedCode.trim() !== '') {
                                    modMap.set(nodeId, modifiedCode);
                                    this.streamUpdate(`✅ Generated modification for node ${nodeId}`);
                                }
                            }
                            this.streamUpdate(`📝 Generated ${modMap.size} modifications for ${filePath}`);
                            return modMap;
                        }
                        catch (parseError) {
                            this.streamUpdate(`❌ JSON parse error for ${filePath}: ${parseError}`);
                            return new Map();
                        }
                    }
                    else {
                        this.streamUpdate(`⚠️ No JSON found in response for ${filePath}`);
                    }
                }
                return new Map();
            }
            catch (error) {
                this.streamUpdate(`❌ Error processing ${filePath}: ${error}`);
                return new Map();
            }
        });
    }
    applyModifications(filePath, targetNodes, modifications, projectFiles, actualPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const file = projectFiles.get(filePath);
            if (!file) {
                this.streamUpdate(`❌ File not found in project files: ${filePath}`);
                return false;
            }
            if (modifications.size === 0) {
                this.streamUpdate(`⚠️ No modifications to apply for ${filePath}`);
                return true; // Not an error if no modifications needed
            }
            let modifiedContent = file.content;
            const lines = modifiedContent.split('\n');
            // Sort nodes by line number (descending) to avoid offset issues
            const sortedNodes = targetNodes
                .filter(node => modifications.has(node.id))
                .sort((a, b) => b.startLine - a.startLine);
            this.streamUpdate(`🔧 Applying ${sortedNodes.length} modifications to ${filePath}...`);
            for (const node of sortedNodes) {
                const modifiedCode = modifications.get(node.id);
                if (modifiedCode !== undefined) {
                    const startIndex = Math.max(0, node.startLine - 1);
                    const endIndex = Math.max(startIndex, node.endLine - 1);
                    const newLines = modifiedCode.split('\n');
                    lines.splice(startIndex, endIndex - startIndex + 1, ...newLines);
                    this.streamUpdate(`✅ Applied modification to node ${node.id} (lines ${node.startLine}-${node.endLine})`);
                }
            }
            modifiedContent = lines.join('\n');
            try {
                yield fs_1.promises.writeFile(actualPath, modifiedContent, 'utf8');
                this.streamUpdate(`💾 Successfully saved modifications to ${actualPath}`);
                // Update the project file content in memory
                file.content = modifiedContent;
                file.lines = modifiedContent.split('\n').length;
                return true;
            }
            catch (error) {
                this.streamUpdate(`❌ Failed to save ${filePath}: ${error}`);
                // Try alternative paths
                const alternativePaths = [
                    filePath,
                    (0, path_1.join)(process.cwd(), filePath),
                    (0, path_1.join)(this.reactBasePath, filePath)
                ];
                for (const altPath of alternativePaths) {
                    try {
                        yield fs_1.promises.writeFile(altPath, modifiedContent, 'utf8');
                        this.streamUpdate(`💾 Successfully saved to alternative path: ${altPath}`);
                        file.content = modifiedContent;
                        file.lines = modifiedContent.split('\n').length;
                        return true;
                    }
                    catch (altError) {
                        continue;
                    }
                }
                return false;
            }
        });
    }
    analyzeFileForTemplate(file) {
        if (!file) {
            return {
                componentName: 'Unknown',
                componentPurpose: 'File component'
            };
        }
        const content = file.content;
        // Extract component name
        let componentName = 'Component';
        const componentMatch = content.match(/(?:export\s+(?:default\s+)?(?:function|const|class)\s+(\w+)|(?:function|const|class)\s+(\w+)\s*[=:])/);
        if (componentMatch) {
            componentName = componentMatch[1] || componentMatch[2];
        }
        // Determine component purpose
        let componentPurpose = 'React component';
        if (content.includes('useState') && content.includes('useEffect')) {
            componentPurpose = 'Interactive component with state management and side effects';
        }
        else if (content.includes('useState')) {
            componentPurpose = 'Interactive component with state management';
        }
        else if (content.includes('useEffect')) {
            componentPurpose = 'Component with side effects and lifecycle management';
        }
        else if (content.includes('Router') || content.includes('Route')) {
            componentPurpose = 'Routing component for navigation';
        }
        else if (content.includes('class ') && content.includes('extends')) {
            componentPurpose = 'Class-based component';
        }
        else if (content.includes('function') || content.includes('=>')) {
            componentPurpose = 'Functional component';
        }
        return {
            componentName,
            componentPurpose
        };
    }
    generateProjectSummary(projectFiles) {
        const totalFiles = projectFiles.size;
        const componentFiles = Array.from(projectFiles.keys()).filter(path => path.match(/\.(tsx?|jsx?)$/i)).length;
        const componentPaths = Array.from(projectFiles.keys())
            .filter(path => path.includes('/components/'))
            .slice(0, 5);
        let summary = `React project with ${totalFiles} files (${componentFiles} component/JS files). `;
        if (componentPaths.length > 0) {
            summary += `Components: ${componentPaths.join(', ')}.`;
        }
        return summary;
    }
}
exports.FixedTargetedNodesProcessor = FixedTargetedNodesProcessor;
exports.TargetedNodesProcessor = FixedTargetedNodesProcessor;
//# sourceMappingURL=TargettedNodes.js.map