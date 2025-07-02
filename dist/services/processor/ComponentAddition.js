"use strict";
// ============================================================================
// ENHANCED COMPONENT PROCESSOR - WITH FILE ANALYSIS & BATCH PROCESSING
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
exports.EnhancedAtomicComponentProcessor = void 0;
const path_1 = require("path");
const fs_1 = require("fs");
const template_1 = require("../filemodifier/template"); // Your existing prompts
// ============================================================================
// ENHANCED PATH MANAGER (From FixedPathManager)
// ============================================================================
class EnhancedPathManager {
    constructor(reactBasePath) {
        this.reactBasePath = (0, path_1.resolve)(reactBasePath);
    }
    setStreamCallback(callback) {
        this.streamCallback = callback;
    }
    streamUpdate(message) {
        if (this.streamCallback) {
            this.streamCallback(message);
        }
    }
    resolveFilePath(inputPath) {
        let cleanPath = inputPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        if (!cleanPath.startsWith('src/')) {
            cleanPath = `src/${cleanPath}`;
        }
        if (!cleanPath.match(/\.(tsx?|jsx?)$/)) {
            cleanPath += '.tsx';
        }
        const fullPath = (0, path_1.resolve)((0, path_1.join)(this.reactBasePath, cleanPath));
        this.streamUpdate(`📍 Resolved file path: ${inputPath} → ${fullPath}`);
        return fullPath;
    }
    fileExists(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const fullPath = this.resolveFilePath(filePath);
                yield fs_1.promises.access(fullPath, fs_1.promises.constants.F_OK);
                return true;
            }
            catch (_a) {
                return false;
            }
        });
    }
    readFile(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const fullPath = this.resolveFilePath(filePath);
                const content = yield fs_1.promises.readFile(fullPath, 'utf8');
                this.streamUpdate(`📖 Read file: ${fullPath} (${content.length} chars)`);
                return content;
            }
            catch (error) {
                this.streamUpdate(`❌ Failed to read file ${filePath}: ${error}`);
                return null;
            }
        });
    }
    safeCreateFile(filePath, content) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const fullFilePath = this.resolveFilePath(filePath);
                const directoryPath = (0, path_1.dirname)(fullFilePath);
                this.streamUpdate(`📁 Creating directory: ${directoryPath}`);
                yield fs_1.promises.mkdir(directoryPath, { recursive: true });
                this.streamUpdate(`💾 Writing file: ${fullFilePath}`);
                yield fs_1.promises.writeFile(fullFilePath, content, 'utf8');
                const stats = yield fs_1.promises.stat(fullFilePath);
                this.streamUpdate(`✅ File created successfully: ${fullFilePath} (${stats.size} bytes)`);
                return {
                    success: true,
                    actualPath: fullFilePath
                };
            }
            catch (error) {
                this.streamUpdate(`❌ File creation failed: ${error}`);
                return {
                    success: false,
                    error: `Failed to create file: ${error}`
                };
            }
        });
    }
    safeUpdateFile(filePath, content) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const fullFilePath = this.resolveFilePath(filePath);
                try {
                    yield fs_1.promises.access(fullFilePath, fs_1.promises.constants.F_OK);
                }
                catch (_a) {
                    return {
                        success: false,
                        error: `File does not exist: ${fullFilePath}`
                    };
                }
                this.streamUpdate(`🔄 Updating existing file: ${fullFilePath}`);
                yield fs_1.promises.writeFile(fullFilePath, content, 'utf8');
                const stats = yield fs_1.promises.stat(fullFilePath);
                this.streamUpdate(`✅ File updated successfully: ${fullFilePath} (${stats.size} bytes)`);
                return {
                    success: true,
                    actualPath: fullFilePath
                };
            }
            catch (error) {
                this.streamUpdate(`❌ File update failed: ${error}`);
                return {
                    success: false,
                    error: `Failed to update file: ${error}`
                };
            }
        });
    }
}
class FileRequirementAnalyzer {
    constructor(anthropic, pathManager) {
        this.anthropic = anthropic;
        this.pathManager = pathManager;
    }
    analyzeRequirements(prompt, existingFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Create detailed file summaries from existing project files
            const fileSummaries = Array.from(existingFiles.entries())
                .map(([path, file]) => {
                const purpose = this.inferFilePurpose(file);
                const preview = file.content.substring(0, 200).replace(/\n/g, ' ');
                return `${path} (${file.lines} lines) - ${purpose}\n  Preview: ${preview}...`;
            })
                .join('\n\n');
            const analysisPrompt = `
TASK: Analyze what component/page to create and what EXISTING files will need INTEGRATION updates.

USER REQUEST: "${prompt}"

EXISTING PROJECT FILES:
${fileSummaries}

ANALYSIS REQUIREMENTS:
1. Determine if this is a COMPONENT or PAGE
2. Extract the name (PascalCase)
3. Identify which EXISTING files need updates for proper integration
4. Plan the new file that needs to be created
5. Mark each file as required(true/false) based on necessity

INTEGRATION PATTERNS:
FOR PAGES:
- CREATE: src/pages/PageName.tsx (required: true) - Main page file to CREATE
- UPDATE: src/App.tsx (required: true) - MUST UPDATE for routing integration
- UPDATE: src/components/Header.tsx (required: true) - MUST UPDATE for navigation links
- UPDATE: src/components/Navbar.tsx (required: true) - MUST UPDATE for navigation
- UPDATE: src/components/Layout.tsx (required: false) - If layout needs page integration

FOR COMPONENTS:
- CREATE: src/components/ComponentName.tsx (required: true) - Main component file to CREATE
- UPDATE: src/pages/HomePage.tsx (required: true) - MUST UPDATE to import and use component
- UPDATE: src/App.tsx (required: false) - Usually not needed for components
- UPDATE: src/components/Layout.tsx (required: false) - If component used in layout

IMPORTANT: Only select files that ACTUALLY EXIST in the project files list above!
IMPORTANT: For PAGES, always include App.tsx + Header/Navbar for integration IF THEY EXIST
IMPORTANT: For COMPONENTS, always include HomePage.tsx or relevant pages that will use it IF THEY EXIST

PAGE KEYWORDS: "page", "screen", "route", "about", "contact", "dashboard", "home", "services", "blog"
COMPONENT KEYWORDS: "component", "button", "card", "form", "modal", "header", "footer", "table", "list"

RESPONSE FORMAT (JSON):
{
  "type": "component|page",
  "name": "ComponentName",
  "confidence": 85,
  "reasoning": "Brief explanation",
  "fileRequirements": [
    {
      "filePath": "src/pages/ComponentName.tsx",
      "required": true,
      "purpose": "Main page file to create",
      "priority": "high"
    },
    {
      "filePath": "src/App.tsx",
      "required": true,
      "purpose": "Add routing integration",
      "priority": "high"
    },
    {
      "filePath": "src/components/Header.tsx",
      "required": true,
      "purpose": "Add navigation link",
      "priority": "medium"
    }
  ]
}
`;
            const response = yield this.anthropic.messages.create({
                model: 'claude-3-5-sonnet-20240620',
                max_tokens: 1000,
                temperature: 0,
                messages: [{ role: 'user', content: analysisPrompt }],
            });
            const text = ((_a = response.content[0]) === null || _a === void 0 ? void 0 : _a.type) === 'text' ? response.content[0].text : '';
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            const analysis = JSON.parse(jsonMatch[0]);
            return yield this.enhanceWithExistenceCheck(analysis, existingFiles);
        });
    }
    enhanceWithExistenceCheck(analysis, existingFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check which files actually exist in the project
            const enhancedRequirements = [];
            this.pathManager['streamUpdate'](`🔍 ANALYZING FILE REQUIREMENTS:`);
            for (const req of analysis.fileRequirements) {
                // Check if file exists in project files map
                const exists = this.findFileInProject(req.filePath, existingFiles) !== null;
                const operation = exists ?
                    (req.required ? 'update' : 'skip') :
                    (req.required ? 'create' : 'skip');
                enhancedRequirements.push({
                    filePath: req.filePath,
                    required: req.required,
                    exists,
                    purpose: req.purpose,
                    priority: req.priority || 'medium',
                    operation
                });
                // Log each file analysis
                const status = exists ? '✅ EXISTS' : '❌ MISSING';
                const actionEmoji = operation === 'create' ? '🆕' : operation === 'update' ? '🔄' : '⏭️';
                this.pathManager['streamUpdate'](`   📄 ${req.filePath}`);
                this.pathManager['streamUpdate'](`      Status: ${status} | Action: ${actionEmoji} ${operation.toUpperCase()}`);
                this.pathManager['streamUpdate'](`      Purpose: ${req.purpose} | Priority: ${req.priority}`);
                this.pathManager['streamUpdate'](`      Required: ${req.required ? 'YES' : 'NO'}`);
            }
            this.pathManager['streamUpdate'](`📊 ANALYSIS SUMMARY:`);
            this.pathManager['streamUpdate'](`   🆕 Files to CREATE: ${enhancedRequirements.filter(r => r.operation === 'create').length}`);
            this.pathManager['streamUpdate'](`   🔄 Files to UPDATE: ${enhancedRequirements.filter(r => r.operation === 'update').length}`);
            this.pathManager['streamUpdate'](`   ⏭️ Files to SKIP: ${enhancedRequirements.filter(r => r.operation === 'skip').length}`);
            return {
                type: analysis.type,
                name: analysis.name,
                confidence: analysis.confidence,
                reasoning: analysis.reasoning,
                fileRequirements: enhancedRequirements
            };
        });
    }
    findFileInProject(filePath, projectFiles) {
        // Try exact match first
        let file = projectFiles.get(filePath);
        if (file)
            return file;
        // Try variations
        const variations = [
            filePath.replace(/^src\//, ''),
            `src/${filePath.replace(/^src\//, '')}`,
            filePath.replace(/\\/g, '/'),
            filePath.replace(/\//g, '\\')
        ];
        for (const variation of variations) {
            file = projectFiles.get(variation);
            if (file)
                return file;
        }
        // Try basename matching
        const fileName = filePath.split('/').pop() || '';
        for (const [key, value] of projectFiles) {
            if (key.split('/').pop() === fileName) {
                return value;
            }
        }
        return null;
    }
    inferFilePurpose(file) {
        if (file.isMainFile)
            return 'Main application file';
        if (file.relativePath.includes('component'))
            return 'UI Component';
        if (file.relativePath.includes('page'))
            return 'Application Page';
        if (file.relativePath.includes('hook'))
            return 'Custom Hook';
        if (file.relativePath.includes('util'))
            return 'Utility Module';
        if (file.relativePath.includes('service'))
            return 'Service Module';
        if (file.relativePath.includes('context'))
            return 'Context Provider';
        return `${file.fileType} file`;
    }
}
class BatchContentGenerator {
    constructor(anthropic, pathManager) {
        this.anthropic = anthropic;
        this.pathManager = pathManager;
    }
    generateBatch(prompt, analysis, existingFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = [];
            // Log what files will be processed
            this.pathManager['streamUpdate'](`🎨 BATCH GENERATION STARTING:`);
            const filesToCreate = analysis.fileRequirements.filter(req => req.operation === 'create');
            const filesToUpdate = analysis.fileRequirements.filter(req => req.operation === 'update');
            this.pathManager['streamUpdate'](`   🆕 Creating ${filesToCreate.length} new files:`);
            filesToCreate.forEach(file => {
                this.pathManager['streamUpdate'](`      📄 ${file.filePath} - ${file.purpose}`);
            });
            this.pathManager['streamUpdate'](`   🔄 Updating ${filesToUpdate.length} existing files:`);
            filesToUpdate.forEach(file => {
                this.pathManager['streamUpdate'](`      📄 ${file.filePath} - ${file.purpose}`);
            });
            // Generate new files
            if (filesToCreate.length > 0) {
                this.pathManager['streamUpdate'](`🆕 GENERATING NEW FILES...`);
                const createdFiles = yield this.generateNewFiles(prompt, analysis, filesToCreate);
                results.push(...createdFiles);
            }
            // Update existing files with integration
            if (filesToUpdate.length > 0) {
                this.pathManager['streamUpdate'](`🔄 UPDATING EXISTING FILES FOR INTEGRATION...`);
                const updatedFiles = yield this.updateExistingFiles(prompt, analysis, filesToUpdate, existingFiles);
                results.push(...updatedFiles);
            }
            this.pathManager['streamUpdate'](`✅ BATCH GENERATION COMPLETE: ${results.length} files processed`);
            return results;
        });
    }
    generateNewFiles(prompt, analysis, filesToCreate) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = [];
            for (const fileReq of filesToCreate) {
                if (fileReq.filePath.includes(`${analysis.name}.tsx`)) {
                    // Generate main component/page file
                    const content = yield this.generateMainFile(prompt, analysis);
                    results.push({
                        filePath: fileReq.filePath,
                        content,
                        operation: 'create',
                        success: true
                    });
                }
            }
            return results;
        });
    }
    updateExistingFiles(prompt, analysis, filesToUpdate, existingFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = [];
            for (const fileReq of filesToUpdate) {
                this.pathManager['streamUpdate'](`🔄 Processing update: ${fileReq.filePath}`);
                // Get original content from existing files map instead of reading from disk
                const existingFile = this.findFileInProject(fileReq.filePath, existingFiles);
                if (existingFile) {
                    const originalContent = existingFile.content;
                    let updatedContent;
                    if (fileReq.filePath.includes('App.tsx') && analysis.type === 'page') {
                        // Update App.tsx for page routing
                        this.pathManager['streamUpdate'](`   🛣️ Adding routing for ${analysis.name} page`);
                        updatedContent = yield this.generateAppUpdate(originalContent, analysis.name);
                    }
                    else if (fileReq.filePath.includes('Header.tsx') || fileReq.filePath.includes('Navbar.tsx')) {
                        // Update navigation components for page links
                        this.pathManager['streamUpdate'](`   🧭 Adding navigation link for ${analysis.name}`);
                        updatedContent = yield this.generateNavigationUpdate(originalContent, analysis.name, analysis.type);
                    }
                    else if (fileReq.filePath.includes('HomePage.tsx') && analysis.type === 'component') {
                        // Update HomePage to use new component
                        this.pathManager['streamUpdate'](`   🏠 Adding ${analysis.name} component to HomePage`);
                        updatedContent = yield this.generateHomePageUpdate(originalContent, analysis.name);
                    }
                    else if (fileReq.filePath.includes('Layout.tsx')) {
                        // Update Layout to include new component/page
                        this.pathManager['streamUpdate'](`   📐 Updating Layout for ${analysis.name}`);
                        updatedContent = yield this.generateLayoutUpdate(originalContent, analysis.name, analysis.type);
                    }
                    else {
                        // Generic update - add import and usage
                        this.pathManager['streamUpdate'](`   🔗 Adding generic integration for ${analysis.name}`);
                        updatedContent = yield this.generateGenericUpdate(originalContent, analysis.name, analysis.type);
                    }
                    results.push({
                        filePath: fileReq.filePath,
                        content: updatedContent,
                        operation: 'update',
                        success: true
                    });
                    this.pathManager['streamUpdate'](`   ✅ Update content generated (${updatedContent.length} chars)`);
                }
                else {
                    this.pathManager['streamUpdate'](`   ❌ Could not find file in existing files: ${fileReq.filePath}`);
                }
            }
            return results;
        });
    }
    findFileInProject(filePath, projectFiles) {
        // Try exact match first
        let file = projectFiles.get(filePath);
        if (file)
            return file;
        // Try variations
        const variations = [
            filePath.replace(/^src\//, ''),
            `src/${filePath.replace(/^src\//, '')}`,
            filePath.replace(/\\/g, '/'),
            filePath.replace(/\//g, '\\')
        ];
        for (const variation of variations) {
            file = projectFiles.get(variation);
            if (file)
                return file;
        }
        // Try basename matching
        const fileName = filePath.split('/').pop() || '';
        for (const [key, value] of projectFiles) {
            if (key.split('/').pop() === fileName) {
                return value;
            }
        }
        return null;
    }
    generateMainFile(prompt, analysis) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const templatePrompt = analysis.type === 'page' ? template_1.pagePrompt : template_1.componentPrompt;
            const finalPrompt = templatePrompt
                .replace(/\{userRequest\}/g, prompt)
                .replace(/\{componentName\}/g, analysis.name)
                .replace(/\{pageName\}/g, analysis.name)
                .replace(/\{componentType\}/g, analysis.type)
                .replace(/\{componentPurpose\}/g, `${analysis.type} for: ${prompt}`)
                .replace(/\{pageDescription\}/g, `${analysis.name} page based on: ${prompt}`);
            const response = yield this.anthropic.messages.create({
                model: 'claude-3-5-sonnet-20240620',
                max_tokens: 4000,
                temperature: 0.3,
                messages: [{ role: 'user', content: finalPrompt }],
            });
            const text = ((_a = response.content[0]) === null || _a === void 0 ? void 0 : _a.type) === 'text' ? response.content[0].text : '';
            const codeMatch = text.match(/```(?:tsx|typescript|jsx|javascript)\n([\s\S]*?)```/);
            return codeMatch[1].trim();
        });
    }
    generateAppUpdate(originalContent, componentName) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const updatePrompt = `
Update this App file to add routing for the new page "${componentName}":

CURRENT APP:
\`\`\`tsx
${originalContent}
\`\`\`

REQUIREMENTS:
1. Add import: import ${componentName} from './pages/${componentName}';
2. If no React Router, add: import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
3. Add route: <Route path="/${componentName.toLowerCase()}" element={<${componentName} />} />
4. Keep all existing code intact

Return ONLY the complete updated App code:

\`\`\`tsx
[UPDATED APP CODE]
\`\`\`
`;
            const response = yield this.anthropic.messages.create({
                model: 'claude-3-5-sonnet-20240620',
                max_tokens: 4000,
                temperature: 0,
                messages: [{ role: 'user', content: updatePrompt }],
            });
            const text = ((_a = response.content[0]) === null || _a === void 0 ? void 0 : _a.type) === 'text' ? response.content[0].text : '';
            const codeMatch = text.match(/```(?:tsx|typescript|jsx|javascript)\n([\s\S]*?)```/);
            return codeMatch[1].trim();
        });
    }
    generateNavigationUpdate(originalContent, componentName, type) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const updatePrompt = `
Update this navigation component to add a link for the new ${type} "${componentName}":

CURRENT NAVIGATION:
\`\`\`tsx
${originalContent}
\`\`\`

REQUIREMENTS:
1. Add a navigation link for ${componentName}
2. Use proper routing path: /${componentName.toLowerCase()}
3. Add appropriate icon if other nav items have icons
4. Maintain existing styling and structure
5. Place the new link in logical order with other navigation items

Return ONLY the complete updated navigation code:

\`\`\`tsx
[UPDATED NAVIGATION CODE]
\`\`\`
`;
            const response = yield this.anthropic.messages.create({
                model: 'claude-3-5-sonnet-20240620',
                max_tokens: 4000,
                temperature: 0,
                messages: [{ role: 'user', content: updatePrompt }],
            });
            const text = ((_a = response.content[0]) === null || _a === void 0 ? void 0 : _a.type) === 'text' ? response.content[0].text : '';
            const codeMatch = text.match(/```(?:tsx|typescript|jsx|javascript)\n([\s\S]*?)```/);
            return codeMatch[1].trim();
        });
    }
    generateHomePageUpdate(originalContent, componentName) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const updatePrompt = `
Update this HomePage to import and use the new component "${componentName}":

CURRENT HOMEPAGE:
\`\`\`tsx
${originalContent}
\`\`\`

REQUIREMENTS:
1. Add import: import ${componentName} from '../components/${componentName}';
2. Add the component to the page in a logical location
3. Pass appropriate props if the component expects them
4. Maintain existing page structure and styling
5. Make it look integrated, not just added

Return ONLY the complete updated HomePage code:

\`\`\`tsx
[UPDATED HOMEPAGE CODE]
\`\`\`
`;
            const response = yield this.anthropic.messages.create({
                model: 'claude-3-5-sonnet-20240620',
                max_tokens: 4000,
                temperature: 0,
                messages: [{ role: 'user', content: updatePrompt }],
            });
            const text = ((_a = response.content[0]) === null || _a === void 0 ? void 0 : _a.type) === 'text' ? response.content[0].text : '';
            const codeMatch = text.match(/```(?:tsx|typescript|jsx|javascript)\n([\s\S]*?)```/);
            return codeMatch[1].trim();
        });
    }
    generateLayoutUpdate(originalContent, componentName, type) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const updatePrompt = `
Update this Layout component to integrate the new ${type} "${componentName}":

CURRENT LAYOUT:
\`\`\`tsx
${originalContent}
\`\`\`

REQUIREMENTS:
1. If it's a component, import and add it appropriately to the layout
2. If it's a page, ensure the layout supports the new page route
3. Maintain existing layout structure
4. Add proper integration without breaking existing functionality

Return ONLY the complete updated Layout code:

\`\`\`tsx
[UPDATED LAYOUT CODE]
\`\`\`
`;
            const response = yield this.anthropic.messages.create({
                model: 'claude-3-5-sonnet-20240620',
                max_tokens: 4000,
                temperature: 0,
                messages: [{ role: 'user', content: updatePrompt }],
            });
            const text = ((_a = response.content[0]) === null || _a === void 0 ? void 0 : _a.type) === 'text' ? response.content[0].text : '';
            const codeMatch = text.match(/```(?:tsx|typescript|jsx|javascript)\n([\s\S]*?)```/);
            return codeMatch[1].trim();
        });
    }
    generateGenericUpdate(originalContent, componentName, type) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const updatePrompt = `
Update this file to integrate the new ${type} "${componentName}":

CURRENT FILE:
\`\`\`tsx
${originalContent}
\`\`\`

REQUIREMENTS:
1. Import the new ${type} appropriately
2. Add it to the file in a logical way
3. Maintain existing functionality
4. Ensure proper integration

Return ONLY the complete updated file code:

\`\`\`tsx
[UPDATED FILE CODE]
\`\`\`
`;
            const response = yield this.anthropic.messages.create({
                model: 'claude-3-5-sonnet-20240620',
                max_tokens: 4000,
                temperature: 0,
                messages: [{ role: 'user', content: updatePrompt }],
            });
            const text = ((_a = response.content[0]) === null || _a === void 0 ? void 0 : _a.type) === 'text' ? response.content[0].text : '';
            const codeMatch = text.match(/```(?:tsx|typescript|jsx|javascript)\n([\s\S]*?)```/);
            return codeMatch[1].trim();
        });
    }
}
// ============================================================================
// MAIN ENHANCED COMPONENT PROCESSOR
// ============================================================================
class EnhancedAtomicComponentProcessor {
    constructor(anthropic, reactBasePath) {
        this.anthropic = anthropic;
        this.reactBasePath = reactBasePath;
        this.pathManager = new EnhancedPathManager(reactBasePath);
        this.analyzer = new FileRequirementAnalyzer(anthropic, this.pathManager);
        this.generator = new BatchContentGenerator(anthropic, this.pathManager);
    }
    setStreamCallback(callback) {
        this.streamCallback = callback;
        this.pathManager.setStreamCallback(callback);
    }
    streamUpdate(message) {
        if (this.streamCallback) {
            this.streamCallback(message);
        }
    }
    handleComponentAddition(prompt, scope, projectFiles, modificationSummary, componentGenerationSystem, projectSummaryCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            this.streamUpdate('🚀 ENHANCED: Starting component creation with file analysis...');
            try {
                // STEP 0: Scan existing project files first (like full file modifier)
                this.streamUpdate('📂 Step 0: Scanning existing project files...');
                const existingFiles = yield this.scanProjectFiles();
                this.streamUpdate(`📊 SCANNED PROJECT FILES:`);
                this.streamUpdate(`   📁 Total files found: ${existingFiles.size}`);
                existingFiles.forEach((file, path) => {
                    this.streamUpdate(`   📄 ${path} (${file.lines} lines) - ${file.fileType}`);
                });
                // STEP 1: Analyze requirements using existing files (like full file modifier)
                this.streamUpdate('🔍 Step 1: Analyzing requirements with existing files...');
                const analysis = yield this.analyzer.analyzeRequirements(prompt, existingFiles);
                this.streamUpdate(`📝 Analysis Complete:`);
                this.streamUpdate(`   Type: ${analysis.name} (${analysis.type}) - ${analysis.confidence}% confidence`);
                this.streamUpdate(`   Reasoning: ${analysis.reasoning}`);
                this.streamUpdate(`   Files Required: ${analysis.fileRequirements.length}`);
                // Log file analysis
                analysis.fileRequirements.forEach(req => {
                    const status = req.exists ? '✅ EXISTS' : '❌ MISSING';
                    const operation = req.operation.toUpperCase();
                    this.streamUpdate(`   📄 ${req.filePath} - ${status} - ${operation} (${req.priority} priority)`);
                    this.streamUpdate(`      Purpose: ${req.purpose}`);
                });
                // STEP 2: Generate batch content with existing files
                this.streamUpdate('🎨 Step 2: Generating batch content with existing files...');
                const generatedFiles = yield this.generator.generateBatch(prompt, analysis, existingFiles);
                this.streamUpdate(`✅ Generated ${generatedFiles.length} files:`);
                generatedFiles.forEach(file => {
                    this.streamUpdate(`   📄 ${file.filePath} (${file.operation}) - ${file.content.length} chars`);
                });
                // STEP 3: Apply all changes in batch
                this.streamUpdate('💾 Step 3: Applying batch changes...');
                const applyResult = yield this.applyBatchChanges(generatedFiles, analysis);
                // STEP 4: Update modification summary
                this.streamUpdate('📊 Step 4: Updating modification summary...');
                const createdFiles = applyResult.results.filter(r => r.operation === 'create' && r.success);
                const updatedFiles = applyResult.results.filter(r => r.operation === 'update' && r.success);
                for (const result of applyResult.results) {
                    yield modificationSummary.addChange(result.success ? result.operation + 'd' : 'failed', result.filePath, result.success ?
                        `${result.operation === 'create' ? 'Created' : 'Updated'} ${analysis.type}: ${analysis.name}` :
                        `Failed to ${result.operation} file`, {
                        success: result.success,
                        linesChanged: ((_a = result.content) === null || _a === void 0 ? void 0 : _a.split('\n').length) || 0,
                        reasoning: result.success ? analysis.reasoning : result.error
                    });
                }
                // SUCCESS SUMMARY
                this.streamUpdate(`🎉 BATCH SUCCESS!`);
                this.streamUpdate(`   📁 Created: ${createdFiles.length} files`);
                this.streamUpdate(`   📝 Updated: ${updatedFiles.length} files`);
                this.streamUpdate(`   ❌ Failed: ${applyResult.failedCount} operations`);
                return {
                    success: applyResult.successCount > 0,
                    selectedFiles: updatedFiles.map(f => f.filePath),
                    addedFiles: createdFiles.map(f => f.filePath),
                    approach: 'ENHANCED_COMPONENT_ADDITION',
                    reasoning: `Successfully processed ${analysis.name} ${analysis.type}. ` +
                        `Applied ${applyResult.successCount}/${generatedFiles.length} file operations.`,
                    modificationSummary: yield modificationSummary.getSummary(),
                    componentGenerationResult: {
                        success: true,
                        generatedFiles: createdFiles.map(f => f.filePath),
                        updatedFiles: updatedFiles.map(f => f.filePath),
                        analysis: analysis,
                        projectSummary: ''
                    },
                    tokenUsage: { totalTokens: 0, inputTokens: 0, outputTokens: 0 } // Placeholder
                };
            }
            catch (error) {
                this.streamUpdate(`❌ Enhanced processor failed: ${error}`);
                throw error;
            }
        });
    }
    /**
     * Scan project files (inspired by full file modifier)
     */
    scanProjectFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            const projectFiles = new Map();
            const scanDirectory = (dir_1, ...args_1) => __awaiter(this, [dir_1, ...args_1], void 0, function* (dir, baseDir = this.reactBasePath) {
                try {
                    const entries = yield fs_1.promises.readdir(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const fullPath = (0, path_1.join)(dir, entry.name);
                        const relativePath = (0, path_1.relative)(baseDir, fullPath).replace(/\\/g, '/');
                        if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
                            yield scanDirectory(fullPath, baseDir);
                        }
                        else if (entry.isFile() && this.isRelevantFile(entry.name)) {
                            try {
                                const content = yield fs_1.promises.readFile(fullPath, 'utf8');
                                const stats = yield fs_1.promises.stat(fullPath);
                                const projectFile = {
                                    path: fullPath,
                                    relativePath,
                                    content,
                                    lines: content.split('\n').length,
                                    isMainFile: this.isMainFile(entry.name, relativePath),
                                    fileType: this.determineFileType(entry.name),
                                    lastModified: stats.mtime
                                };
                                projectFiles.set(relativePath, projectFile);
                            }
                            catch (readError) {
                                this.streamUpdate(`⚠️ Could not read file: ${relativePath}`);
                            }
                        }
                    }
                }
                catch (error) {
                    this.streamUpdate(`⚠️ Error scanning directory ${dir}: ${error}`);
                }
            });
            yield scanDirectory(this.reactBasePath);
            return projectFiles;
        });
    }
    shouldSkipDirectory(name) {
        const skipPatterns = ['node_modules', '.git', '.next', 'dist', 'build'];
        return skipPatterns.includes(name) || name.startsWith('.');
    }
    isRelevantFile(fileName) {
        const extensions = ['.tsx', '.ts', '.jsx', '.js', '.css', '.json'];
        return extensions.some(ext => fileName.endsWith(ext));
    }
    isMainFile(fileName, relativePath) {
        return fileName === 'App.tsx' || fileName === 'App.jsx' ||
            relativePath.includes('App.') || fileName === 'index.tsx';
    }
    determineFileType(fileName) {
        if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx'))
            return 'react-component';
        if (fileName.endsWith('.ts') || fileName.endsWith('.js'))
            return 'module';
        if (fileName.endsWith('.css'))
            return 'stylesheet';
        if (fileName.endsWith('.json'))
            return 'config';
        return 'unknown';
    }
    componentGenerationSystem(prompt, modificationSummary, componentGenerationSystem, projectSummaryCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            this.streamUpdate('🚀 ENHANCED: Starting component creation with file analysis...');
            try {
                const existingFiles = yield this.scanProjectFiles();
                this.streamUpdate('🔍 Step 1: Analyzing requirements and checking file existence...');
                const analysis = yield this.analyzer.analyzeRequirements(prompt, existingFiles);
                this.streamUpdate(`📝 Analysis Complete:`);
                this.streamUpdate(`   Type: ${analysis.name} (${analysis.type}) - ${analysis.confidence}% confidence`);
                this.streamUpdate(`   Reasoning: ${analysis.reasoning}`);
                this.streamUpdate(`   Files Required: ${analysis.fileRequirements.length}`);
                for (const req of analysis.fileRequirements) {
                    const status = req.exists ? '✅ EXISTS' : '❌ MISSING';
                    const operation = req.operation.toUpperCase();
                    this.streamUpdate(`   📄 ${req.filePath} - ${status} - ${operation} (${req.priority} priority)`);
                    this.streamUpdate(`      Purpose: ${req.purpose}`);
                }
                // STEP 2: Generate files
                this.streamUpdate('🎨 Step 2: Generating batch content...');
                const generatedFiles = yield this.generator.generateBatch(prompt, analysis, existingFiles);
                this.streamUpdate(`✅ Generated ${generatedFiles.length} files:`);
                for (const file of generatedFiles) {
                    this.streamUpdate(`   📄 ${file.filePath} (${file.operation}) - ${file.content.length} chars`);
                }
                // STEP 3: Apply batch changes
                this.streamUpdate('💾 Step 3: Applying batch changes...');
                const applyResult = yield this.applyBatchChanges(generatedFiles, analysis);
                // STEP 4: Modification Summary
                this.streamUpdate('📊 Step 4: Updating modification summary...');
                const createdFiles = applyResult.results.filter(r => r.operation === 'create' && r.success);
                const updatedFiles = applyResult.results.filter(r => r.operation === 'update' && r.success);
                for (const result of applyResult.results) {
                    const pastTenseOp = result.operation === 'create' ? 'created' : 'updated';
                    const operationStr = result.success ? pastTenseOp : 'failed';
                    const linesChanged = ((_a = result.content) === null || _a === void 0 ? void 0 : _a.split('\n').length) || 0;
                    yield modificationSummary.addChange(operationStr, result.filePath, result.success
                        ? `${pastTenseOp[0].toUpperCase() + pastTenseOp.slice(1)} ${analysis.type}: ${analysis.name}`
                        : `Failed to ${result.operation} file`, {
                        success: result.success,
                        linesChanged,
                        reasoning: result.success ? analysis.reasoning : result.error
                    });
                }
                // (Optional) Step 5: Project summary callback
                let projectSummary = '';
                if (projectSummaryCallback) {
                    const summary = yield projectSummaryCallback(analysis.reasoning, prompt);
                    if (summary) {
                        projectSummary = summary;
                        this.streamUpdate('📋 Project summary updated via callback.');
                    }
                }
                // FINAL SUMMARY
                this.streamUpdate(`🎉 BATCH SUCCESS!`);
                this.streamUpdate(`   📁 Created: ${createdFiles.length} files`);
                this.streamUpdate(`   📝 Updated: ${updatedFiles.length} files`);
                this.streamUpdate(`   ❌ Failed: ${applyResult.failedCount} operations`);
                return {
                    success: applyResult.successCount > 0,
                    selectedFiles: updatedFiles.map(f => f.filePath),
                    addedFiles: createdFiles.map(f => f.filePath),
                    approach: 'ENHANCED_COMPONENT_ADDITION',
                    reasoning: `Successfully processed ${analysis.name} ${analysis.type}. Applied ${applyResult.successCount}/${generatedFiles.length} file operations.`,
                    modificationSummary: yield modificationSummary.getSummary(),
                    componentGenerationResult: {
                        success: true,
                        generatedFiles: createdFiles.map(f => f.filePath),
                        updatedFiles: updatedFiles.map(f => f.filePath),
                        analysis,
                        projectSummary,
                        existingFiles
                    },
                    tokenUsage: {
                        totalTokens: 0,
                        inputTokens: 0,
                        outputTokens: 0
                    }
                };
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.streamUpdate(`❌ Enhanced processor failed: ${message}`);
                throw error;
            }
        });
    }
    applyBatchChanges(generatedFiles, analysis) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = [];
            let successCount = 0;
            let failedCount = 0;
            this.streamUpdate(`💾 APPLYING BATCH CHANGES:`);
            this.streamUpdate(`   📦 Processing ${generatedFiles.length} files...`);
            for (const file of generatedFiles) {
                try {
                    this.streamUpdate(`🔧 Processing: ${file.filePath} (${file.operation})`);
                    if (file.operation === 'create') {
                        const createResult = yield this.pathManager.safeCreateFile(file.filePath, file.content);
                        results.push({
                            filePath: file.filePath,
                            operation: 'create',
                            success: createResult.success,
                            content: file.content,
                            error: createResult.error
                        });
                        if (createResult.success) {
                            successCount++;
                            this.streamUpdate(`   ✅ CREATED: ${file.filePath} (${file.content.length} chars)`);
                        }
                        else {
                            failedCount++;
                            this.streamUpdate(`   ❌ CREATE FAILED: ${file.filePath} - ${createResult.error}`);
                        }
                    }
                    else if (file.operation === 'update') {
                        const updateResult = yield this.pathManager.safeUpdateFile(file.filePath, file.content);
                        results.push({
                            filePath: file.filePath,
                            operation: 'update',
                            success: updateResult.success,
                            content: file.content,
                            error: updateResult.error
                        });
                        if (updateResult.success) {
                            successCount++;
                            this.streamUpdate(`   ✅ UPDATED: ${file.filePath} (${file.content.length} chars)`);
                        }
                        else {
                            failedCount++;
                            this.streamUpdate(`   ❌ UPDATE FAILED: ${file.filePath} - ${updateResult.error}`);
                        }
                    }
                }
                catch (error) {
                    // Fallback to a valid operation to satisfy return type
                    const fallbackOp = file.operation === 'update' ? 'update' : 'create';
                    results.push({
                        filePath: file.filePath,
                        operation: fallbackOp,
                        success: false,
                        error: `Exception: ${error}`
                    });
                    failedCount++;
                    this.streamUpdate(`   ❌ EXCEPTION: ${file.filePath} - ${error}`);
                }
            }
            this.streamUpdate(`📊 BATCH CHANGES SUMMARY:`);
            this.streamUpdate(`   ✅ Successful: ${successCount}`);
            this.streamUpdate(`   ❌ Failed: ${failedCount}`);
            this.streamUpdate(`   📈 Success Rate: ${Math.round((successCount / generatedFiles.length) * 100)}%`);
            return { successCount, failedCount, results };
        });
    }
}
exports.EnhancedAtomicComponentProcessor = EnhancedAtomicComponentProcessor;
//# sourceMappingURL=ComponentAddition.js.map