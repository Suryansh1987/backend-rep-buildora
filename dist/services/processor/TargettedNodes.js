"use strict";
// ============================================================================
// GRANULAR AST PROCESSOR - FILE BY FILE NODE ANALYSIS
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
exports.TargetedNodesProcessor = exports.GranularASTProcessor = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const Structurevalidator_1 = require("../../utils/Structurevalidator");
// ============================================================================
// MAIN GRANULAR PROCESSOR
// ============================================================================
class GranularASTProcessor {
    constructor(anthropic, tokenTracker, astAnalyzer, reactBasePath) {
        this.anthropic = anthropic;
        this.tokenTracker = tokenTracker;
        this.astAnalyzer = astAnalyzer;
        this.structureValidator = new Structurevalidator_1.StructureValidator();
        // CRITICAL FIX: Clean the double 'd' typo in path
        this.reactBasePath = (reactBasePath || process.cwd()).replace(/builddora/g, 'buildora');
    }
    setStreamCallback(callback) {
        this.streamCallback = callback;
    }
    streamUpdate(message) {
        if (this.streamCallback) {
            this.streamCallback(message);
        }
        console.log(message);
    }
    resolveFilePath(projectFile) {
        if ((0, path_1.isAbsolute)(projectFile.path)) {
            return projectFile.path.replace(/builddora/g, 'buildora');
        }
        if (projectFile.relativePath) {
            return (0, path_1.join)(this.reactBasePath, projectFile.relativePath);
        }
        return projectFile.path.replace(/builddora/g, 'buildora');
    }
    /**
     * MAIN GRANULAR PROCESSING METHOD
     */
    processGranularModification(prompt, projectFiles, reactBasePath, streamCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            this.setStreamCallback(streamCallback);
            if (reactBasePath) {
                this.reactBasePath = reactBasePath.replace(/builddora/g, 'buildora');
            }
            try {
                this.streamUpdate(`🎯 GRANULAR: Starting file-by-file AST node analysis...`);
                this.streamUpdate(`📂 Base path: ${this.reactBasePath}`);
                let totalFilesProcessed = 0;
                let totalFilesModified = 0;
                let totalNodesAnalyzed = 0;
                let totalNodesSelected = 0;
                let totalNodesModified = 0;
                const changes = [];
                // Filter to relevant files only
                const relevantFiles = this.filterRelevantFiles(projectFiles);
                this.streamUpdate(`📁 Found ${relevantFiles.size} relevant files to analyze`);
                // STEP 1: Process each file individually
                for (const [filePath, projectFile] of relevantFiles) {
                    try {
                        this.streamUpdate(`\n🔍 ANALYZING FILE: ${filePath}`);
                        // Parse AST nodes for this specific file
                        const astNodes = this.astAnalyzer.parseFileWithAST(filePath, projectFiles);
                        if (astNodes.length === 0) {
                            this.streamUpdate(`⏭️ No AST nodes found in ${filePath}, skipping...`);
                            continue;
                        }
                        this.streamUpdate(`📊 Found ${astNodes.length} AST nodes in ${filePath}`);
                        totalNodesAnalyzed += astNodes.length;
                        // Get component info
                        const componentInfo = this.analyzeFileForTemplate(projectFile);
                        // STEP 2: Ask Claude if this file needs changes and which nodes
                        const nodeAnalysis = yield this.analyzeFileNodes(filePath, componentInfo.componentName, componentInfo.componentPurpose, astNodes, prompt);
                        totalFilesProcessed++;
                        if (!nodeAnalysis.needsChanges || nodeAnalysis.selectedNodeIds.length === 0) {
                            this.streamUpdate(`⏭️ ${filePath}: No changes needed (${nodeAnalysis.reasoning})`);
                            changes.push({
                                type: 'analyzed',
                                file: filePath,
                                description: `No changes needed: ${nodeAnalysis.reasoning}`,
                                success: true,
                                details: {
                                    nodesAnalyzed: astNodes.length,
                                    nodesSelected: 0,
                                    nodesModified: 0,
                                    reasoning: nodeAnalysis.reasoning
                                }
                            });
                            continue;
                        }
                        this.streamUpdate(`✅ ${filePath}: Needs changes - selected ${nodeAnalysis.selectedNodeIds.length} nodes`);
                        this.streamUpdate(`   📝 Reasoning: ${nodeAnalysis.reasoning}`);
                        totalNodesSelected += nodeAnalysis.selectedNodeIds.length;
                        // STEP 3: Get the selected nodes and modify them
                        const selectedNodes = astNodes.filter(node => nodeAnalysis.selectedNodeIds.includes(node.id));
                        if (selectedNodes.length === 0) {
                            this.streamUpdate(`⚠️ ${filePath}: Node IDs not found, skipping...`);
                            continue;
                        }
                        // STEP 4: Generate modifications for selected nodes
                        const nodeModifications = yield this.modifySelectedNodes(selectedNodes, prompt, filePath, componentInfo);
                        if (nodeModifications.length === 0) {
                            this.streamUpdate(`❌ ${filePath}: No modifications generated for selected nodes`);
                            continue;
                        }
                        // STEP 5: Apply modifications to the file
                        const actualPath = this.resolveFilePath(projectFile);
                        const applySuccess = yield this.applyNodeModifications(filePath, astNodes, nodeModifications, projectFile, actualPath);
                        totalNodesModified += nodeModifications.length;
                        if (applySuccess) {
                            totalFilesModified++;
                            this.streamUpdate(`✅ ${filePath}: Successfully modified ${nodeModifications.length} nodes`);
                            changes.push({
                                type: 'modified',
                                file: filePath,
                                description: `Successfully modified ${nodeModifications.length} nodes`,
                                success: true,
                                details: {
                                    nodesAnalyzed: astNodes.length,
                                    nodesSelected: nodeAnalysis.selectedNodeIds.length,
                                    nodesModified: nodeModifications.length,
                                    reasoning: nodeAnalysis.reasoning
                                }
                            });
                        }
                        else {
                            this.streamUpdate(`❌ ${filePath}: Failed to apply modifications`);
                            changes.push({
                                type: 'failed',
                                file: filePath,
                                description: `Failed to apply ${nodeModifications.length} node modifications`,
                                success: false,
                                details: {
                                    nodesAnalyzed: astNodes.length,
                                    nodesSelected: nodeAnalysis.selectedNodeIds.length,
                                    nodesModified: 0,
                                    reasoning: 'File write error'
                                }
                            });
                        }
                    }
                    catch (error) {
                        this.streamUpdate(`❌ Error processing ${filePath}: ${error}`);
                        changes.push({
                            type: 'error',
                            file: filePath,
                            description: `Processing error: ${error}`,
                            success: false
                        });
                    }
                }
                // STEP 6: Report comprehensive results
                this.streamUpdate(`\n🎉 GRANULAR PROCESSING COMPLETE!`);
                this.streamUpdate(`   📁 Total files: ${projectFiles.size}`);
                this.streamUpdate(`   🔍 Relevant files: ${relevantFiles.size}`);
                this.streamUpdate(`   📊 Files processed: ${totalFilesProcessed}`);
                this.streamUpdate(`   ✅ Files modified: ${totalFilesModified}`);
                this.streamUpdate(`   🧩 Nodes analyzed: ${totalNodesAnalyzed}`);
                this.streamUpdate(`   🎯 Nodes selected: ${totalNodesSelected}`);
                this.streamUpdate(`   🔧 Nodes modified: ${totalNodesModified}`);
                const tokenStats = this.tokenTracker.getStats();
                this.streamUpdate(`💰 Token usage: ${tokenStats.totalTokens} total`);
                return {
                    success: totalFilesModified > 0,
                    updatedProjectFiles: projectFiles,
                    projectFiles: projectFiles,
                    changes: changes
                };
            }
            catch (error) {
                this.streamUpdate(`❌ Error in granular processing: ${error}`);
                return {
                    success: false,
                    changes: [{
                            type: 'error',
                            file: 'system',
                            description: `Granular processing failed: ${error}`,
                            success: false
                        }]
                };
            }
        });
    }
    /**
     * STEP 2: Ask Claude to analyze file nodes and select which ones need changes
     */
    analyzeFileNodes(filePath, componentName, componentPurpose, astNodes, userRequest) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Create AST tree representation
            const astTreeRepresentation = this.createASTTreeRepresentation(astNodes);
            const analysisPrompt = `
TASK: Analyze AST nodes in a React file and determine which nodes need modification.

FILE: ${filePath}
COMPONENT: ${componentName}
PURPOSE: ${componentPurpose}
USER REQUEST: "${userRequest}"

AST NODE TREE:
${astTreeRepresentation}

INSTRUCTIONS:
1. Analyze each AST node to see if it needs modification for the user request
2. Consider the component's purpose and the specific user requirements
3. Select ONLY the nodes that actually need changes
4. If no changes are needed, return 0
5. Be precise - don't select unnecessary nodes

RESPONSE FORMAT (JSON):
{
  "needsChanges": true/false,
  "selectedNodeIds": ["node1", "node2"] or [],
  "reasoning": "Explanation of why these nodes were selected or why no changes needed",
  "confidence": 85
}

If no changes needed, respond with:
{
  "needsChanges": false,
  "selectedNodeIds": [],
  "reasoning": "No modifications required for this request",
  "confidence": 90
}

ANALYSIS:`;
            try {
                this.streamUpdate(`🧠 Analyzing ${astNodes.length} nodes in ${filePath}...`);
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 2000,
                    temperature: 0.1,
                    messages: [{ role: 'user', content: analysisPrompt }],
                });
                this.tokenTracker.logUsage(response.usage, `Node Analysis: ${filePath}`);
                const responseText = ((_a = response.content[0]) === null || _a === void 0 ? void 0 : _a.text) || '';
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        const analysis = JSON.parse(jsonMatch[0]);
                        this.streamUpdate(`📊 Analysis result: ${analysis.needsChanges ? 'NEEDS CHANGES' : 'NO CHANGES'} (${analysis.confidence}%)`);
                        return {
                            needsChanges: analysis.needsChanges || false,
                            selectedNodeIds: analysis.selectedNodeIds || [],
                            reasoning: analysis.reasoning || 'Analysis completed',
                            confidence: analysis.confidence || 50
                        };
                    }
                    catch (parseError) {
                        this.streamUpdate(`❌ JSON parse error for ${filePath}: ${parseError}`);
                        return {
                            needsChanges: false,
                            selectedNodeIds: [],
                            reasoning: 'JSON parse error',
                            confidence: 0
                        };
                    }
                }
                else {
                    this.streamUpdate(`⚠️ No JSON found in response for ${filePath}`);
                    return {
                        needsChanges: false,
                        selectedNodeIds: [],
                        reasoning: 'No valid response format',
                        confidence: 0
                    };
                }
            }
            catch (error) {
                this.streamUpdate(`❌ Error analyzing nodes in ${filePath}: ${error}`);
                return {
                    needsChanges: false,
                    selectedNodeIds: [],
                    reasoning: `Analysis error: ${error}`,
                    confidence: 0
                };
            }
        });
    }
    /**
     * STEP 4: Generate modifications for selected nodes
     */
    modifySelectedNodes(selectedNodes, userRequest, filePath, componentInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const nodeModifications = [];
            // Create context for the nodes
            const fileContext = `File: ${filePath}, Component: ${componentInfo.componentName} (${componentInfo.componentPurpose})`;
            const modificationPrompt = `
TASK: Modify the selected AST nodes according to the user request.

USER REQUEST: "${userRequest}"
FILE CONTEXT: ${fileContext}

SELECTED NODES TO MODIFY:
${selectedNodes.map((node, index) => `
NODE ${index + 1}: ${node.id}
TYPE: ${node.type || 'Unknown'}
LINES: ${node.startLine}-${node.endLine}
CURRENT CODE:
\`\`\`tsx
${node.codeSnippet}
\`\`\`
`).join('\n')}

INSTRUCTIONS:
1. Modify each node according to the user request
2. Maintain all existing functionality unless explicitly changing it
3. Keep proper TypeScript/React syntax
4. Preserve imports, exports, and component structure
5. Return complete modified code for each node

RESPONSE FORMAT (JSON):
{
  "modifications": [
    {
      "nodeId": "${(_a = selectedNodes[0]) === null || _a === void 0 ? void 0 : _a.id}",
      "modifiedCode": "complete modified code here",
      "reasoning": "explanation of changes made"
    }
  ]
}

MODIFICATIONS:`;
            try {
                this.streamUpdate(`🎨 Generating modifications for ${selectedNodes.length} selected nodes...`);
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 6000,
                    temperature: 0.1,
                    messages: [{ role: 'user', content: modificationPrompt }],
                });
                this.tokenTracker.logUsage(response.usage, `Node Modifications: ${filePath}`);
                const responseText = ((_b = response.content[0]) === null || _b === void 0 ? void 0 : _b.text) || '';
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        const result = JSON.parse(jsonMatch[0]);
                        if (result.modifications && Array.isArray(result.modifications)) {
                            for (const mod of result.modifications) {
                                if (mod.nodeId && mod.modifiedCode) {
                                    nodeModifications.push({
                                        nodeId: mod.nodeId,
                                        modifiedCode: mod.modifiedCode,
                                        reasoning: mod.reasoning || 'Modified as requested'
                                    });
                                    this.streamUpdate(`✅ Generated modification for node ${mod.nodeId}`);
                                }
                            }
                        }
                    }
                    catch (parseError) {
                        this.streamUpdate(`❌ JSON parse error for modifications: ${parseError}`);
                    }
                }
                else {
                    this.streamUpdate(`⚠️ No JSON found in modification response`);
                }
            }
            catch (error) {
                this.streamUpdate(`❌ Error generating modifications: ${error}`);
            }
            this.streamUpdate(`📝 Generated ${nodeModifications.length}/${selectedNodes.length} modifications`);
            return nodeModifications;
        });
    }
    /**
     * STEP 5: Apply node modifications to the file
     */
    applyNodeModifications(filePath, allNodes, modifications, projectFile, actualPath) {
        return __awaiter(this, void 0, void 0, function* () {
            if (modifications.length === 0) {
                this.streamUpdate(`⚠️ No modifications to apply for ${filePath}`);
                return true;
            }
            let modifiedContent = projectFile.content;
            const lines = modifiedContent.split('\n');
            // Create modification map
            const modMap = new Map();
            for (const mod of modifications) {
                modMap.set(mod.nodeId, mod.modifiedCode);
            }
            // Sort nodes by line number (descending) to avoid offset issues
            const nodesToModify = allNodes
                .filter(node => modMap.has(node.id))
                .sort((a, b) => b.startLine - a.startLine);
            this.streamUpdate(`🔧 Applying ${nodesToModify.length} modifications to ${filePath}...`);
            for (const node of nodesToModify) {
                const modifiedCode = modMap.get(node.id);
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
                projectFile.content = modifiedContent;
                projectFile.lines = modifiedContent.split('\n').length;
                return true;
            }
            catch (error) {
                this.streamUpdate(`❌ Failed to save ${filePath}: ${error}`);
                return false;
            }
        });
    }
    /**
     * Create AST tree representation for Claude
     */
    createASTTreeRepresentation(astNodes) {
        let representation = '';
        for (let i = 0; i < astNodes.length; i++) {
            const node = astNodes[i];
            representation += `
NODE ${i + 1}: ${node.id}
├── Type: ${node.type || 'Unknown'}
├── Lines: ${node.startLine}-${node.endLine}
├── Code Preview: ${this.getCodePreview(node.codeSnippet)}
└── Full Code:
    \`\`\`tsx
    ${node.codeSnippet}
    \`\`\`
`;
        }
        return representation;
    }
    /**
     * Get code preview for AST representation
     */
    getCodePreview(code) {
        const firstLine = code.split('\n')[0];
        return firstLine.length > 60 ? firstLine.substring(0, 60) + '...' : firstLine;
    }
    /**
     * Filter to relevant files only
     */
    filterRelevantFiles(projectFiles) {
        const relevantFiles = new Map();
        for (const [filePath, projectFile] of projectFiles) {
            if (this.shouldAnalyzeFile(filePath, projectFile.content)) {
                relevantFiles.set(filePath, projectFile);
            }
        }
        return relevantFiles;
    }
    /**
     * Check if file should be analyzed
     */
    shouldAnalyzeFile(filePath, content) {
        // ALWAYS analyze React/JS/TS files
        if (filePath.match(/\.(tsx?|jsx?)$/i)) {
            return true;
        }
        // Skip non-code files
        const skipFileTypes = [
            /\.css$/i, /\.scss$/i, /\.sass$/i, /\.less$/i, /\.styl$/i,
            /\.module\.css$/i, /\.module\.scss$/i, /package\.json$/i,
            /yarn\.lock$/i, /package-lock\.json$/i, /\.gitignore$/i,
            /\.env$/i, /\.md$/i, /\.txt$/i, /\.log$/i,
            /\.(png|jpg|jpeg|gif|svg|ico|webp)$/i,
            /\.(mp4|mp3|wav|avi)$/i,
            /dist\//i, /build\//i, /node_modules\//i, /\.next\//i, /\.git\//i
        ];
        return !skipFileTypes.some(pattern => pattern.test(filePath));
    }
    /**
     * Analyze file for template variables
     */
    analyzeFileForTemplate(file) {
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
        return { componentName, componentPurpose };
    }
    // ============================================================================
    // BACKWARD COMPATIBILITY METHODS
    // ============================================================================
    /**
     * Main method matching expected interface
     */
    processTargetedModification(prompt, projectFiles, reactBasePath, streamCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.processGranularModification(prompt, projectFiles, reactBasePath, streamCallback);
        });
    }
    /**
     * Alternative method name for compatibility
     */
    process(prompt, projectFiles, reactBasePath, streamCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.processGranularModification(prompt, projectFiles, reactBasePath, streamCallback);
        });
    }
    /**
     * Legacy method
     */
    handleTargetedModification(prompt, projectFiles, modificationSummary) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.processGranularModification(prompt, projectFiles, this.reactBasePath, (message) => this.streamUpdate(message));
            return result.success;
        });
    }
}
exports.GranularASTProcessor = GranularASTProcessor;
exports.TargetedNodesProcessor = GranularASTProcessor;
// ============================================================================
// INTEGRATION INSTRUCTIONS
// ============================================================================
/*
## HOW TO INTEGRATE THIS GRANULAR PROCESSOR:

### 1. Replace your imports:
```typescript
// REPLACE:
import { EnhancedTargetedNodesProcessor } from './EnhancedTargetedNodesProcessor';

// WITH:
import { GranularASTProcessor } from './GranularASTProcessor';
```

### 2. Update initialization:
```typescript
// REPLACE:
this.targetedProcessor = new EnhancedTargetedNodesProcessor(anthropic, tokenTracker, astAnalyzer, reactBasePath);

// WITH:
this.granularProcessor = new GranularASTProcessor(anthropic, tokenTracker, astAnalyzer, reactBasePath);
```

### 3. Update method calls:
```typescript
// All existing method calls will work the same:
const result = await this.granularProcessor.processTargetedModification(
  prompt,
  projectFiles,
  reactBasePath,
  streamCallback
);
```

## GRANULAR PROCESSING FLOW:

1. **📁 Filter Files**: Select only relevant React/JS/TS files for analysis
2. **🔍 Parse AST**: Extract AST nodes for each file individually
3. **🧠 Ask Claude**: "Does this file need changes? Which nodes?"
4. **🎯 Node Selection**: Claude responds with specific node IDs or "0" if no changes
5. **🎨 Generate Modifications**: For selected nodes, generate new code
6. **💾 Apply Changes**: Update only the selected nodes in the file

## KEY BENEFITS:

✅ **PRECISE TARGETING**: Only modifies nodes that actually need changes
✅ **GRANULAR CONTROL**: File-by-file and node-by-node analysis
✅ **INTELLIGENT SELECTION**: Claude decides which nodes need modification
✅ **MINIMAL CHANGES**: Preserves all unrelated code unchanged
✅ **COMPREHENSIVE REPORTING**: Detailed statistics on analysis and modifications

This approach is much more surgical and precise than bulk processing!
*/ 
//# sourceMappingURL=TargettedNodes.js.map