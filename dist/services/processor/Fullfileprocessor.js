"use strict";
// ============================================================================
// FIXED FULL FILE PROCESSOR: processors/FullFileProcessor.ts - Path Resolution
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
exports.FullFileProcessor = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const Structurevalidator_1 = require("../../utils/Structurevalidator");
const template_1 = require("../filemodifier/template");
class FullFileProcessor {
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
                return actualPath;
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
                        return altPath;
                    }
                    catch (_a) {
                        // Continue trying
                    }
                }
                this.streamUpdate(`❌ File not found at any expected location. Checked paths:`);
                this.streamUpdate(`   - ${actualPath}`);
                alternatives.forEach(alt => this.streamUpdate(`   - ${alt}`));
                return null;
            }
        });
    }
    handleFullFileModification(prompt, projectFiles, modificationSummary) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate(`🔧 Starting ENHANCED FULL_FILE modification workflow with template prompts...`);
            let successCount = 0;
            const filesToCheck = [];
            const RELEVANCE_THRESHOLD = 70;
            const isNavigationRequest = /navigation|nav|menu|highlight.*current|active.*page/i.test(prompt);
            const isLayoutChange = /layout|ui|color|theme|design|appearance|visual|style/i.test(prompt);
            // Step 1: Filter relevant files
            for (const [filePath, file] of projectFiles) {
                if (this.shouldSkipFile(filePath, file)) {
                    continue;
                }
                filesToCheck.push(filePath);
            }
            this.streamUpdate(`📊 Analyzing ${filesToCheck.length} files for relevance (threshold: ${RELEVANCE_THRESHOLD})...`);
            if (isNavigationRequest) {
                this.streamUpdate(`🧭 Detected navigation request - using specialized navigation modification`);
            }
            if (isLayoutChange) {
                this.streamUpdate(`🎨 Detected layout/design change - using enhanced template prompts`);
            }
            // Step 2: Check ALL files for relevance
            for (const filePath of filesToCheck) {
                const file = projectFiles.get(filePath);
                if (!file)
                    continue;
                // FIXED: Resolve and verify file path
                const actualPath = this.resolveFilePath(file);
                const verifiedPath = yield this.verifyFileExists(filePath, actualPath);
                if (!verifiedPath) {
                    this.streamUpdate(`⚠️ Skipping ${filePath} - file not found on filesystem`);
                    continue;
                }
                const astNodes = this.astAnalyzer.parseFileWithAST(filePath, projectFiles);
                if (astNodes.length === 0 && !file.isMainFile) {
                    continue;
                }
                const relevanceResult = yield this.astAnalyzer.analyzeFileRelevance(prompt, filePath, astNodes, 'FULL_FILE', projectFiles, this.anthropic, this.tokenTracker);
                if (relevanceResult.isRelevant && relevanceResult.relevanceScore >= RELEVANCE_THRESHOLD) {
                    this.streamUpdate(`✅ ${filePath} - Relevant (${relevanceResult.relevanceScore}) - Processing with enhanced templates...`);
                    let success = false;
                    if (isNavigationRequest && (filePath.toLowerCase().includes('nav') || filePath.toLowerCase().includes('header'))) {
                        success = yield this.modifyFullFileForNavigation(filePath, prompt, relevanceResult.reasoning, projectFiles, verifiedPath);
                    }
                    else if (isLayoutChange) {
                        success = yield this.modifyFullFileWithLayoutTemplate(filePath, prompt, relevanceResult.reasoning, projectFiles, verifiedPath);
                    }
                    else {
                        success = yield this.modifyFullFileWithTemplate(filePath, prompt, relevanceResult.reasoning, projectFiles, verifiedPath);
                    }
                    if (success) {
                        successCount++;
                        yield modificationSummary.addChange('modified', filePath, `Enhanced full file modification: ${prompt.substring(0, 50)}...`);
                        this.streamUpdate(`✅ Modified ${filePath} using template prompts (Total: ${successCount})`);
                    }
                }
                else {
                    this.streamUpdate(`❌ ${filePath} - Not relevant (${relevanceResult.relevanceScore})`);
                }
            }
            this.streamUpdate(`📊 ENHANCED FULL_FILE complete: ${successCount} files modified using template prompts`);
            const tokenStats = this.tokenTracker.getStats();
            this.streamUpdate(`💰 Session Total - ${tokenStats.totalTokens} tokens ($${tokenStats.estimatedCost.toFixed(4)})`);
            return successCount > 0;
        });
    }
    shouldSkipFile(filePath, file) {
        const skipPatterns = [
            /\.d\.ts$/,
            /test\.|spec\./,
            /utils\.ts$/,
            /types\.ts$/,
            /constants\.ts$/,
            /config\./
        ];
        if (skipPatterns.some(pattern => pattern.test(filePath))) {
            return true;
        }
        if (filePath.includes('/hooks/') && !file.content.includes('JSX') && !file.content.includes('<')) {
            return true;
        }
        if (file.lines < 10) {
            return true;
        }
        return false;
    }
    /**
     * FIXED: Modify full file with template and correct path handling
     */
    modifyFullFileWithTemplate(filePath, prompt, relevanceReasoning, projectFiles, verifiedPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const file = projectFiles.get(filePath);
            if (!file) {
                return false;
            }
            // Extract file structure for preservation
            const structure = this.structureValidator.extractFileStructure(file.content);
            // Analyze file for template variables
            const fileAnalysis = this.analyzeFileForTemplate(file);
            const projectSummary = this.generateProjectSummary(projectFiles);
            // Prepare template variables
            const templateVariables = (0, template_1.prepareFullFileVariables)(prompt, filePath, file.content, projectSummary, fileAnalysis, structure.preservationPrompt, relevanceReasoning);
            // Generate the enhanced prompt using template
            const modificationPrompt = (0, template_1.replaceTemplateVariables)(template_1.fullFilePrompt, templateVariables);
            try {
                this.streamUpdate(`🚀 Using enhanced template prompt for ${filePath}...`);
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 8000,
                    temperature: 0,
                    messages: [{ role: 'user', content: modificationPrompt }],
                });
                this.tokenTracker.logUsage(response.usage, `Enhanced Template Full File: ${filePath}`);
                const firstBlock = response.content[0];
                if ((firstBlock === null || firstBlock === void 0 ? void 0 : firstBlock.type) === 'text') {
                    const text = firstBlock.text;
                    const codeMatch = text.match(/```(?:jsx|tsx|javascript|typescript|js|ts)\n([\s\S]*?)```/);
                    if (codeMatch) {
                        const modifiedContent = codeMatch[1].trim();
                        const strictValidation = this.structureValidator.validateStructurePreservation(modifiedContent, structure);
                        if (strictValidation.isValid) {
                            // FIXED: Use verified path for writing
                            yield fs_1.promises.writeFile(verifiedPath, modifiedContent, 'utf8');
                            // Update project file content in memory
                            file.content = modifiedContent;
                            file.lines = modifiedContent.split('\n').length;
                            this.streamUpdate(`✅ ${filePath} modified successfully with template validation`);
                            return true;
                        }
                        else {
                            this.streamUpdate(`⚠️ Template validation failed, attempting enhanced repair...`);
                            const repairedContent = this.structureValidator.repairFileStructure(modifiedContent, structure, file.content);
                            if (repairedContent) {
                                yield fs_1.promises.writeFile(verifiedPath, repairedContent, 'utf8');
                                // Update project file content in memory
                                file.content = repairedContent;
                                file.lines = repairedContent.split('\n').length;
                                this.streamUpdate(`✅ ${filePath} modified successfully after template repair`);
                                return true;
                            }
                            else {
                                this.streamUpdate(`❌ ${filePath} template repair failed - keeping original file`);
                                return false;
                            }
                        }
                    }
                    else {
                        this.streamUpdate(`❌ No code block found in template response for ${filePath}`);
                        return false;
                    }
                }
                return false;
            }
            catch (error) {
                this.streamUpdate(`❌ Error modifying ${filePath} with template: ${error}`);
                return false;
            }
        });
    }
    /**
     * FIXED: Layout template modification with path handling
     */
    modifyFullFileWithLayoutTemplate(filePath, prompt, relevanceReasoning, projectFiles, verifiedPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const file = projectFiles.get(filePath);
            if (!file) {
                return false;
            }
            // Extract file structure for preservation
            const structure = this.structureValidator.extractFileStructure(file.content);
            // Analyze file for template variables
            const fileAnalysis = this.analyzeFileForTemplate(file);
            const projectSummary = this.generateProjectSummary(projectFiles);
            // Prepare template variables specifically for layout changes
            const templateVariables = (0, template_1.prepareLayoutChangeVariables)(prompt, filePath, file.content, projectSummary, fileAnalysis, structure.preservationPrompt, relevanceReasoning);
            // Generate the enhanced prompt using template
            const modificationPrompt = (0, template_1.replaceTemplateVariables)(template_1.fullFilePrompt, templateVariables);
            try {
                this.streamUpdate(`🎨 Using enhanced layout template for ${filePath}...`);
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 8000,
                    temperature: 0,
                    messages: [{ role: 'user', content: modificationPrompt }],
                });
                this.tokenTracker.logUsage(response.usage, `Enhanced Layout Template: ${filePath}`);
                const firstBlock = response.content[0];
                if ((firstBlock === null || firstBlock === void 0 ? void 0 : firstBlock.type) === 'text') {
                    const text = firstBlock.text;
                    const codeMatch = text.match(/```(?:jsx|tsx|javascript|typescript|js|ts)\n([\s\S]*?)```/);
                    if (codeMatch) {
                        const modifiedContent = codeMatch[1].trim();
                        // Use relaxed validation for layout changes
                        const relaxedValidation = this.structureValidator.validateStructurePreservationRelaxed(modifiedContent, structure);
                        if (relaxedValidation.isValid) {
                            yield fs_1.promises.writeFile(verifiedPath, modifiedContent, 'utf8');
                            // Update project file content in memory
                            file.content = modifiedContent;
                            file.lines = modifiedContent.split('\n').length;
                            this.streamUpdate(`✅ ${filePath} layout modified successfully with template`);
                            return true;
                        }
                        else {
                            this.streamUpdate(`⚠️ Layout template validation failed, attempting enhanced repair...`);
                            // Use the enhanced layout repair function
                            const layoutRepairFunction = (0, template_1.createLayoutRepairFunction)();
                            const repairedContent = layoutRepairFunction(modifiedContent, file.content, fileAnalysis.componentName);
                            if (repairedContent) {
                                yield fs_1.promises.writeFile(verifiedPath, repairedContent, 'utf8');
                                // Update project file content in memory
                                file.content = repairedContent;
                                file.lines = repairedContent.split('\n').length;
                                this.streamUpdate(`✅ ${filePath} layout modified successfully after enhanced repair`);
                                return true;
                            }
                            else {
                                this.streamUpdate(`❌ ${filePath} enhanced layout repair failed - keeping original`);
                                return false;
                            }
                        }
                    }
                }
                return false;
            }
            catch (error) {
                this.streamUpdate(`❌ Error modifying ${filePath} with layout template: ${error}`);
                return false;
            }
        });
    }
    /**
     * FIXED: Navigation modification with path handling
     */
    modifyFullFileForNavigation(filePath, prompt, relevanceReasoning, projectFiles, verifiedPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const file = projectFiles.get(filePath);
            if (!file) {
                return false;
            }
            const structure = this.structureValidator.extractFileStructure(file.content);
            const navigationPrompt = `
USER REQUEST: "${prompt}"
FILE: ${filePath} (Navigation Component)
WHY: ${relevanceReasoning}

CURRENT NAVIGATION FILE:
\`\`\`jsx
${file.content}
\`\`\`

TASK: Add current page highlighting to the navigation menu.

SPECIFIC REQUIREMENTS FOR NAVIGATION HIGHLIGHTING:
1. Add active/current page detection using window.location.pathname or React Router's useLocation
2. Apply highlighting styles (different background, text color, border, etc.) to the current page link
3. Ensure proper conditional className or styling for active states
4. Keep all existing navigation functionality
5. Preserve ALL imports and exports exactly as they are

EXAMPLE PATTERN:
\`\`\`jsx
import { useLocation } from 'react-router-dom'; // Add if needed

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'About', href: '/about' },
  // ... other items
];

const location = useLocation(); // Add if using React Router

// In your navigation rendering:
{navigation.map((item) => (
  <a
    key={item.name}
    href={item.href}
    className={\`base-nav-styles \${location.pathname === item.href ? 'active-nav-styles' : ''}\`}
  >
    {item.name}
  </a>
))}
\`\`\`

${structure.preservationPrompt}

RESPONSE: Return ONLY the complete modified navigation file:

\`\`\`jsx
[MODIFIED NAVIGATION FILE WITH HIGHLIGHTING]
\`\`\`
    `;
            try {
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 8000,
                    temperature: 0,
                    messages: [{ role: 'user', content: navigationPrompt }],
                });
                this.tokenTracker.logUsage(response.usage, `Navigation Highlighting: ${filePath}`);
                const firstBlock = response.content[0];
                if ((firstBlock === null || firstBlock === void 0 ? void 0 : firstBlock.type) === 'text') {
                    const text = firstBlock.text;
                    const codeMatch = text.match(/```(?:jsx|tsx|javascript|typescript|js|ts)\n([\s\S]*?)```/);
                    if (codeMatch) {
                        const modifiedContent = codeMatch[1].trim();
                        const relaxedValidation = this.structureValidator.validateStructurePreservationRelaxed(modifiedContent, structure);
                        if (relaxedValidation.isValid) {
                            yield fs_1.promises.writeFile(verifiedPath, modifiedContent, 'utf8');
                            // Update project file content in memory
                            file.content = modifiedContent;
                            file.lines = modifiedContent.split('\n').length;
                            this.streamUpdate(`✅ ${filePath} navigation highlighting added successfully`);
                            return true;
                        }
                        else {
                            const repairedContent = this.structureValidator.repairFileStructure(modifiedContent, structure, file.content);
                            if (repairedContent) {
                                yield fs_1.promises.writeFile(verifiedPath, repairedContent, 'utf8');
                                // Update project file content in memory
                                file.content = repairedContent;
                                file.lines = repairedContent.split('\n').length;
                                this.streamUpdate(`✅ ${filePath} navigation highlighting added after repair`);
                                return true;
                            }
                            else {
                                this.streamUpdate(`❌ ${filePath} navigation modification failed - keeping original`);
                                return false;
                            }
                        }
                    }
                }
                return false;
            }
            catch (error) {
                this.streamUpdate(`❌ Error adding navigation highlighting to ${filePath}: ${error}`);
                return false;
            }
        });
    }
    analyzeFileForTemplate(file) {
        const content = file.content;
        const lines = content.split('\n');
        // Extract component name
        let componentName;
        const componentMatch = content.match(/(?:export\s+(?:default\s+)?(?:function|const)\s+(\w+)|(?:function|const)\s+(\w+)\s*[=:])/);
        if (componentMatch) {
            componentName = componentMatch[1] || componentMatch[2];
        }
        // Determine file type
        let fileType = 'component';
        if (file.path.includes('page') || file.path.includes('Page')) {
            fileType = 'page';
        }
        else if (file.path.includes('app') || file.path.includes('App')) {
            fileType = 'app';
        }
        // Determine file purpose
        let filePurpose = 'React component';
        if (content.includes('useState') || content.includes('useEffect')) {
            filePurpose = 'Interactive React component with state management';
        }
        if (content.includes('Router') || content.includes('Route')) {
            filePurpose = 'React component with routing functionality';
        }
        if (content.includes('nav') || content.includes('Nav')) {
            filePurpose = 'Navigation component';
        }
        return {
            componentName,
            lineCount: lines.length,
            fileType,
            filePurpose
        };
    }
    generateProjectSummary(projectFiles) {
        const totalFiles = projectFiles.size;
        const componentFiles = Array.from(projectFiles.keys()).filter(path => path.includes('.tsx') || path.includes('.jsx')).length;
        const keyFiles = Array.from(projectFiles.keys())
            .filter(path => path.includes('App.') || path.includes('index.') || path.includes('main.'))
            .slice(0, 3);
        return `React TypeScript project with ${totalFiles} files (${componentFiles} components). Key files: ${keyFiles.join(', ')}.`;
    }
}
exports.FullFileProcessor = FullFileProcessor;
//# sourceMappingURL=Fullfileprocessor.js.map