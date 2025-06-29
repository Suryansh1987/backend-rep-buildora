"use strict";
// ============================================================================
// FIXED TARGETED NODES PROCESSOR: processors/TargetedNodesProcessor.ts
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
exports.TargetedNodesProcessor = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const Structurevalidator_1 = require("../../utils/Structurevalidator");
const template_1 = require("../filemodifier/template");
class TargetedNodesProcessor {
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
    /**
     * FIXED: Resolve the correct file path for saving
     */
    resolveFilePath(projectFile) {
        // If the file already has an absolute path, use it
        if ((0, path_1.isAbsolute)(projectFile.path)) {
            return projectFile.path;
        }
        // Try to construct the path from relativePath
        if (projectFile.relativePath) {
            // Remove 'src/' prefix if present in relativePath since we add it in join
            const cleanRelativePath = projectFile.relativePath.replace(/^src[\/\\]/, '');
            const constructedPath = (0, path_1.join)(this.reactBasePath, 'src', cleanRelativePath);
            return constructedPath;
        }
        // Fallback: use the path as provided
        return projectFile.path;
    }
    /**
     * FIXED: Verify file exists before attempting modifications
     */
    verifyFileExists(filePath, actualPath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield fs_1.promises.access(actualPath);
                return true;
            }
            catch (error) {
                this.streamUpdate(`❌ File not found at expected path: ${actualPath}`);
                this.streamUpdate(`🔍 Original file path: ${filePath}`);
                // Try alternative paths
                const alternatives = [
                    (0, path_1.join)(this.reactBasePath, filePath),
                    (0, path_1.join)(this.reactBasePath, 'src', filePath),
                    (0, path_1.join)(this.reactBasePath, filePath.replace(/^src[\/\\]/, '')),
                ];
                for (const altPath of alternatives) {
                    try {
                        yield fs_1.promises.access(altPath);
                        this.streamUpdate(`✅ Found file at alternative path: ${altPath}`);
                        return true;
                    }
                    catch (_a) {
                        // Continue trying
                    }
                }
                this.streamUpdate(`❌ File not found at any expected location. Checked paths:`);
                this.streamUpdate(`   - ${actualPath}`);
                alternatives.forEach(alt => this.streamUpdate(`   - ${alt}`));
                return false;
            }
        });
    }
    handleTargetedModification(prompt, projectFiles, modificationSummary) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate(`🎯 Starting ENHANCED TARGETED_NODES modification workflow with template prompts...`);
            let successCount = 0;
            const RELEVANCE_THRESHOLD = 70;
            const relevantFiles = [];
            // Step 1: Analyze ALL files for relevant nodes
            for (const [filePath] of projectFiles) {
                const astNodes = this.astAnalyzer.parseFileWithAST(filePath, projectFiles);
                if (astNodes.length === 0)
                    continue;
                const relevanceResult = yield this.astAnalyzer.analyzeFileRelevance(prompt, filePath, astNodes, 'TARGETED_NODES', projectFiles, this.anthropic, this.tokenTracker);
                if (relevanceResult.isRelevant &&
                    relevanceResult.targetNodes &&
                    relevanceResult.targetNodes.length > 0 &&
                    relevanceResult.relevanceScore >= RELEVANCE_THRESHOLD) {
                    const projectFile = projectFiles.get(filePath);
                    if (projectFile) {
                        const actualPath = this.resolveFilePath(projectFile);
                        // FIXED: Verify file exists before adding to processing queue
                        if (yield this.verifyFileExists(filePath, actualPath)) {
                            relevantFiles.push({
                                filePath,
                                score: relevanceResult.relevanceScore,
                                targetNodes: relevanceResult.targetNodes,
                                actualPath
                            });
                        }
                        else {
                            this.streamUpdate(`⚠️ Skipping ${filePath} - file not found on filesystem`);
                        }
                    }
                }
            }
            // Step 2: Process ALL files that meet the threshold (sorted by score)
            relevantFiles.sort((a, b) => b.score - a.score);
            this.streamUpdate(`🎯 Processing ${relevantFiles.length} files with target elements using enhanced templates (score >= ${RELEVANCE_THRESHOLD})`);
            // Step 3: Apply modifications to ALL relevant files using templates
            for (const { filePath, targetNodes, score, actualPath } of relevantFiles) {
                this.streamUpdate(`🎯 Processing ${filePath} (score: ${score}) with template prompts...`);
                const modifications = yield this.modifyCodeSnippetsWithTemplate(prompt, targetNodes, filePath, projectFiles);
                if (modifications.size > 0) {
                    const success = yield this.applyModifications(filePath, targetNodes, modifications, projectFiles, actualPath);
                    if (success) {
                        successCount++;
                        yield modificationSummary.addChange('modified', filePath, `Enhanced AST targeted modifications: ${modifications.size} nodes updated with templates`);
                        this.streamUpdate(`✅ Modified ${filePath} using templates (${modifications.size} nodes updated)`);
                    }
                }
            }
            this.streamUpdate(`📊 ENHANCED TARGETED modification complete: ${successCount} files modified using template prompts`);
            const tokenStats = this.tokenTracker.getStats();
            this.streamUpdate(`💰 Session Total - ${tokenStats.totalTokens} tokens ($${tokenStats.estimatedCost.toFixed(4)})`);
            return successCount > 0;
        });
    }
    modifyCodeSnippetsWithTemplate(prompt, targetNodes, filePath, projectFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            // Analyze file for template context
            const fileAnalysis = this.analyzeFileForTemplate(projectFiles.get(filePath));
            const projectSummary = this.generateProjectSummary(projectFiles);
            // Format target nodes for the template
            const targetNodesFormatted = targetNodes.map(node => `**${node.id}:** (lines ${node.startLine}-${node.endLine})
\`\`\`jsx
${node.codeSnippet}
\`\`\`
`).join('\n\n');
            // Prepare template variables
            const templateVariables = (0, template_1.prepareTargetedNodesVariables)(prompt, filePath, fileAnalysis.componentName, fileAnalysis.componentPurpose, targetNodesFormatted, projectSummary);
            // Generate the enhanced prompt using template
            const enhancedPrompt = (0, template_1.replaceTemplateVariables)(template_1.targetedNodesPrompt, templateVariables);
            try {
                this.streamUpdate(`🚀 Using enhanced template for targeted nodes in ${filePath}...`);
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 6000,
                    temperature: 0,
                    messages: [{ role: 'user', content: enhancedPrompt }],
                });
                this.tokenTracker.logUsage(response.usage, `Enhanced Template Targeted Nodes: ${targetNodes.length} nodes in ${filePath}`);
                const firstBlock = response.content[0];
                if ((firstBlock === null || firstBlock === void 0 ? void 0 : firstBlock.type) === 'text') {
                    const text = firstBlock.text;
                    const jsonMatch = text.match(/```json\n([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const jsonText = jsonMatch[1] || jsonMatch[0];
                        const modifications = JSON.parse(jsonText);
                        const modMap = new Map();
                        // Handle both old format and new template format with requiredImports
                        for (const [nodeId, nodeData] of Object.entries(modifications)) {
                            let modifiedCode;
                            let requiredImports = [];
                            if (typeof nodeData === 'string') {
                                // Old format: direct string
                                modifiedCode = nodeData;
                            }
                            else if (typeof nodeData === 'object' && nodeData !== null) {
                                // New template format: object with modifiedCode and requiredImports
                                const data = nodeData;
                                modifiedCode = data.modifiedCode || '';
                                requiredImports = data.requiredImports || [];
                                // Log required imports for potential future use
                                if (requiredImports.length > 0) {
                                    this.streamUpdate(`📦 Node ${nodeId} requires imports: ${requiredImports.join(', ')}`);
                                }
                            }
                            else {
                                continue;
                            }
                            if (modifiedCode && modifiedCode.trim()) {
                                modMap.set(nodeId, modifiedCode);
                            }
                        }
                        this.streamUpdate(`✅ Template processed ${modMap.size} modifications for ${filePath}`);
                        return modMap;
                    }
                    else {
                        this.streamUpdate(`⚠️ Could not parse JSON response from template for ${filePath}`);
                    }
                }
                return new Map();
            }
            catch (error) {
                this.streamUpdate(`❌ Error modifying code snippets with template for ${filePath}: ${error}`);
                return new Map();
            }
        });
    }
    /**
     * FIXED: Apply modifications with correct path resolution
     */
    applyModifications(filePath, targetNodes, modifications, projectFiles, actualPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const file = projectFiles.get(filePath);
            if (!file) {
                this.streamUpdate(`❌ File not found in project files: ${filePath}`);
                return false;
            }
            // FIXED: Double-check file exists at actual path
            try {
                yield fs_1.promises.access(actualPath);
            }
            catch (error) {
                this.streamUpdate(`❌ Cannot access file for writing: ${actualPath}`);
                return false;
            }
            const structure = this.structureValidator.extractFileStructure(file.content);
            let modifiedContent = file.content;
            const lines = modifiedContent.split('\n');
            // Sort nodes by line number (descending) to avoid offset issues
            const sortedNodes = targetNodes
                .filter(node => modifications.has(node.id))
                .sort((a, b) => b.startLine - a.startLine);
            this.streamUpdate(`🔧 Applying ${sortedNodes.length} template-generated modifications to ${filePath}...`);
            for (const node of sortedNodes) {
                const modifiedCode = modifications.get(node.id);
                if (modifiedCode) {
                    const startIndex = node.startLine - 1;
                    const endIndex = node.endLine - 1;
                    const newLines = modifiedCode.split('\n');
                    // Replace the original node lines with the modified code
                    lines.splice(startIndex, endIndex - startIndex + 1, ...newLines);
                    this.streamUpdate(`✅ Applied template modification to node ${node.id} (lines ${node.startLine}-${node.endLine})`);
                }
            }
            modifiedContent = lines.join('\n');
            // Validate structure preservation
            const validation = this.structureValidator.validateStructurePreservation(modifiedContent, structure);
            if (!validation.isValid) {
                this.streamUpdate(`⚠️ Structure validation failed for ${filePath}, attempting repair...`);
                const repairedContent = this.structureValidator.repairFileStructure(modifiedContent, structure, file.content);
                if (repairedContent) {
                    modifiedContent = repairedContent;
                    this.streamUpdate(`✅ Successfully repaired structure for ${filePath}`);
                }
                else {
                    this.streamUpdate(`❌ Could not repair structure for ${filePath}`);
                    return false;
                }
            }
            try {
                // FIXED: Use the resolved actual path for writing
                yield fs_1.promises.writeFile(actualPath, modifiedContent, 'utf8');
                this.streamUpdate(`💾 Successfully saved template modifications to ${filePath}`);
                // Update the project file content in memory
                file.content = modifiedContent;
                file.lines = modifiedContent.split('\n').length;
                return true;
            }
            catch (error) {
                this.streamUpdate(`❌ Failed to save ${filePath}: ${error}`);
                return false;
            }
        });
    }
    analyzeFileForTemplate(file) {
        if (!file) {
            return {
                componentName: 'Unknown',
                componentPurpose: 'React component'
            };
        }
        const content = file.content;
        // Extract component name
        let componentName = 'Component';
        const componentMatch = content.match(/(?:export\s+(?:default\s+)?(?:function|const)\s+(\w+)|(?:function|const)\s+(\w+)\s*[=:])/);
        if (componentMatch) {
            componentName = componentMatch[1] || componentMatch[2];
        }
        // Determine component purpose based on content analysis
        let componentPurpose = 'React component';
        if (content.includes('useState') && content.includes('useEffect')) {
            componentPurpose = 'Interactive React component with state management and side effects';
        }
        else if (content.includes('useState')) {
            componentPurpose = 'Interactive React component with state management';
        }
        else if (content.includes('useEffect')) {
            componentPurpose = 'React component with side effects and lifecycle management';
        }
        else if (content.includes('Router') || content.includes('Route')) {
            componentPurpose = 'React routing component for navigation';
        }
        else if (content.includes('nav') || content.includes('Nav') || content.includes('header') || content.includes('Header')) {
            componentPurpose = 'Navigation or header component';
        }
        else if (content.includes('form') || content.includes('Form') || content.includes('input') || content.includes('Input')) {
            componentPurpose = 'Form or input component for user interaction';
        }
        else if (content.includes('card') || content.includes('Card') || content.includes('modal') || content.includes('Modal')) {
            componentPurpose = 'UI display component (card, modal, or layout element)';
        }
        else if (content.includes('button') || content.includes('Button')) {
            componentPurpose = 'Interactive button or action component';
        }
        else if (content.includes('list') || content.includes('List') || content.includes('map(')) {
            componentPurpose = 'List or data display component';
        }
        else if (file.path.includes('page') || file.path.includes('Page')) {
            componentPurpose = 'Full page component with multiple sections';
        }
        else if (file.path.includes('layout') || file.path.includes('Layout')) {
            componentPurpose = 'Layout wrapper component';
        }
        return {
            componentName,
            componentPurpose
        };
    }
    generateProjectSummary(projectFiles) {
        const totalFiles = projectFiles.size;
        const componentFiles = Array.from(projectFiles.keys()).filter(path => path.includes('.tsx') || path.includes('.jsx')).length;
        const pageFiles = Array.from(projectFiles.keys()).filter(path => path.toLowerCase().includes('page')).length;
        const hasRouting = Array.from(projectFiles.values()).some(file => file.content.includes('Router') || file.content.includes('Route'));
        const hasStateManagement = Array.from(projectFiles.values()).some(file => file.content.includes('useState') || file.content.includes('useContext'));
        const keyFiles = Array.from(projectFiles.keys())
            .filter(path => path.includes('App.') ||
            path.includes('index.') ||
            path.includes('main.') ||
            path.toLowerCase().includes('nav'))
            .slice(0, 5);
        let summary = `React TypeScript project with ${totalFiles} files (${componentFiles} components`;
        if (pageFiles > 0) {
            summary += `, ${pageFiles} pages`;
        }
        summary += `). `;
        if (hasRouting) {
            summary += `Features: React Router navigation, `;
        }
        if (hasStateManagement) {
            summary += `state management, `;
        }
        summary += `modern UI components. `;
        if (keyFiles.length > 0) {
            summary += `Key files: ${keyFiles.join(', ')}.`;
        }
        return summary;
    }
}
exports.TargetedNodesProcessor = TargetedNodesProcessor;
//# sourceMappingURL=TargettedNodes.js.map