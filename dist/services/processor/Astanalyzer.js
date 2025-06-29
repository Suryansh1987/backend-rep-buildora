"use strict";
// ============================================================================
// AST ANALYZER: processors/ASTAnalyzer.ts
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASTAnalyzer = void 0;
const parser_1 = require("@babel/parser");
const traverse_1 = __importDefault(require("@babel/traverse"));
class ASTAnalyzer {
    setStreamCallback(callback) {
        this.streamCallback = callback;
    }
    streamUpdate(message) {
        if (this.streamCallback) {
            this.streamCallback(message);
        }
    }
    parseFileWithAST(filePath, projectFiles) {
        this.streamUpdate(`🔬 Parsing ${filePath} with AST analysis...`);
        const file = projectFiles.get(filePath);
        if (!file) {
            return [];
        }
        try {
            const ast = (0, parser_1.parse)(file.content, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript'],
            });
            const nodes = [];
            let nodeId = 1;
            const lines = file.content.split('\n');
            (0, traverse_1.default)(ast, {
                JSXElement(path) {
                    var _a, _b, _c, _d, _e, _f, _g;
                    const node = path.node;
                    let tagName = 'unknown';
                    if (((_b = (_a = node.openingElement) === null || _a === void 0 ? void 0 : _a.name) === null || _b === void 0 ? void 0 : _b.type) === 'JSXIdentifier') {
                        tagName = node.openingElement.name.name;
                    }
                    let textContent = '';
                    if (node.children) {
                        node.children.forEach((child) => {
                            if (child.type === 'JSXText') {
                                textContent += child.value.trim() + ' ';
                            }
                        });
                    }
                    const startLine = ((_c = node.loc) === null || _c === void 0 ? void 0 : _c.start.line) || 1;
                    const endLine = ((_d = node.loc) === null || _d === void 0 ? void 0 : _d.end.line) || 1;
                    const startColumn = ((_e = node.loc) === null || _e === void 0 ? void 0 : _e.start.column) || 0;
                    const endColumn = ((_f = node.loc) === null || _f === void 0 ? void 0 : _f.end.column) || 0;
                    const codeSnippet = lines.slice(startLine - 1, endLine).join('\n');
                    const contextStart = Math.max(0, startLine - 4);
                    const contextEnd = Math.min(lines.length, endLine + 3);
                    const fullContext = lines.slice(contextStart, contextEnd).join('\n');
                    const attributes = [];
                    if ((_g = node.openingElement) === null || _g === void 0 ? void 0 : _g.attributes) {
                        node.openingElement.attributes.forEach((attr) => {
                            if (attr.type === 'JSXAttribute' && attr.name) {
                                attributes.push(attr.name.name);
                            }
                        });
                    }
                    nodes.push({
                        id: `node_${nodeId++}`,
                        type: 'JSXElement',
                        tagName,
                        textContent: textContent.trim(),
                        startLine,
                        endLine,
                        startColumn,
                        endColumn,
                        codeSnippet,
                        fullContext,
                        isButton: tagName.toLowerCase().includes('button'),
                        hasSigninText: /sign\s*in|log\s*in|login|signin/i.test(textContent),
                        attributes
                    });
                }
            });
            this.streamUpdate(`✅ AST parsing complete! Found ${nodes.length} JSX elements.`);
            return nodes;
        }
        catch (error) {
            this.streamUpdate(`❌ AST parsing failed for ${filePath}: ${error}`);
            return [];
        }
    }
    analyzeFileRelevance(prompt, filePath, astNodes, modificationMethod, projectFiles, anthropic, tokenTracker) {
        return __awaiter(this, void 0, void 0, function* () {
            const file = projectFiles.get(filePath);
            if (!file || astNodes.length === 0) {
                return {
                    isRelevant: false,
                    reasoning: 'File not found or no AST nodes available',
                    relevanceScore: 0
                };
            }
            let analysisPrompt = '';
            if (modificationMethod === 'TARGETED_NODES') {
                const nodesPreview = astNodes.slice(0, 20).map(node => `${node.id}: <${node.tagName}> "${node.textContent.substring(0, 50)}" ${node.isButton ? '[BUTTON]' : ''}${node.hasSigninText ? '[SIGNIN]' : ''}`).join('\n');
                analysisPrompt = `
USER REQUEST: "${prompt}"
FILE: ${filePath}
METHOD: TARGETED_NODES

ELEMENTS IN FILE:
${nodesPreview}

Question: Does this file contain specific elements that match the user's request?

Answer with ONLY this format:
RELEVANT: YES/NO
SCORE: 0-100
REASON: [brief explanation]
TARGETS: [comma-separated node IDs if relevant]

Example:
RELEVANT: YES
SCORE: 85
REASON: Contains signin button that matches request
TARGETS: node_1,node_3
      `;
            }
            else {
                const filePreview = file.content.substring(0, 500);
                const elementSummary = [...new Set(astNodes.map(n => n.tagName))].slice(0, 10).join(', ');
                analysisPrompt = `
USER REQUEST: "${prompt}"
FILE: ${filePath}
METHOD: FULL_FILE

FILE PREVIEW:
${filePreview}...

COMPONENT: ${file.componentName || 'Unknown'}
ELEMENTS: ${elementSummary}
HAS BUTTONS: ${file.hasButtons}
HAS SIGNIN: ${file.hasSignin}

Question: Should this entire file be modified to fulfill the user's request?

Answer with ONLY this format:
RELEVANT: YES/NO
SCORE: 0-100
REASON: [brief explanation]

Example:
RELEVANT: YES
SCORE: 75
REASON: Main component file that needs layout changes
      `;
            }
            try {
                const response = yield anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 300,
                    temperature: 0,
                    messages: [{ role: 'user', content: analysisPrompt }],
                });
                tokenTracker.logUsage(response.usage, `File Relevance Analysis: ${filePath}`);
                const firstBlock = response.content[0];
                if ((firstBlock === null || firstBlock === void 0 ? void 0 : firstBlock.type) === 'text') {
                    const text = firstBlock.text;
                    return this.parseSimpleRelevanceResponse(text, astNodes);
                }
                return {
                    isRelevant: false,
                    reasoning: 'Failed to get response from AI',
                    relevanceScore: 0
                };
            }
            catch (error) {
                this.streamUpdate(`❌ Error analyzing file relevance for ${filePath}: ${error}`);
                return {
                    isRelevant: false,
                    reasoning: `Error during analysis: ${error}`,
                    relevanceScore: 0
                };
            }
        });
    }
    parseSimpleRelevanceResponse(text, astNodes) {
        try {
            const lines = text.split('\n').map(line => line.trim());
            let isRelevant = false;
            let score = 0;
            let reasoning = 'No reasoning provided';
            let targetNodes = [];
            for (const line of lines) {
                if (line.startsWith('RELEVANT:')) {
                    isRelevant = line.includes('YES');
                }
                else if (line.startsWith('SCORE:')) {
                    const scoreMatch = line.match(/\d+/);
                    if (scoreMatch) {
                        score = parseInt(scoreMatch[0]);
                    }
                }
                else if (line.startsWith('REASON:')) {
                    reasoning = line.replace('REASON:', '').trim();
                }
                else if (line.startsWith('TARGETS:')) {
                    const targetIds = line.replace('TARGETS:', '').trim().split(',').map(id => id.trim());
                    targetNodes = astNodes.filter(node => targetIds.includes(node.id));
                }
            }
            return {
                isRelevant,
                reasoning,
                relevanceScore: Math.max(0, Math.min(100, score)),
                targetNodes: targetNodes.length > 0 ? targetNodes : undefined
            };
        }
        catch (error) {
            return {
                isRelevant: false,
                reasoning: `Failed to parse AI response: ${error}`,
                relevanceScore: 0
            };
        }
    }
    forceAnalyzeSpecificFiles(prompt, filePaths, method, projectFiles, anthropic, tokenTracker) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate(`🔍 Analyzing specific files: ${filePaths.join(', ')}`);
            const results = [];
            const maxFiles = Math.min(filePaths.length, 5);
            for (let i = 0; i < maxFiles; i++) {
                const filePath = filePaths[i];
                const astNodes = this.parseFileWithAST(filePath, projectFiles);
                if (astNodes.length === 0) {
                    results.push({
                        filePath,
                        isRelevant: false,
                        score: 0,
                        reasoning: 'No AST nodes found',
                    });
                    continue;
                }
                const relevanceResult = yield this.analyzeFileRelevance(prompt, filePath, astNodes, method, projectFiles, anthropic, tokenTracker);
                results.push({
                    filePath,
                    isRelevant: relevanceResult.isRelevant,
                    score: relevanceResult.relevanceScore,
                    reasoning: relevanceResult.reasoning,
                    targetNodes: relevanceResult.targetNodes
                });
            }
            return results;
        });
    }
}
exports.ASTAnalyzer = ASTAnalyzer;
//# sourceMappingURL=Astanalyzer.js.map