"use strict";
// ============================================================================
// PROJECT ANALYZER: processors/ProjectAnalyzer.ts
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
exports.ProjectAnalyzer = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const dependancy_1 = require("../filemodifier/dependancy");
class ProjectAnalyzer {
    constructor(reactBasePath) {
        this.reactBasePath = reactBasePath;
    }
    setStreamCallback(callback) {
        this.streamCallback = callback;
    }
    streamUpdate(message) {
        if (this.streamCallback) {
            this.streamCallback(message);
        }
    }
    buildProjectTree(projectFiles, dependencyManager, streamCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('🔍 Starting comprehensive project analysis...');
            const srcPath = (0, path_1.join)(this.reactBasePath, 'src');
            try {
                yield fs_1.promises.access(srcPath);
                this.streamUpdate('✅ Found src directory! Scanning React components and project structure...');
            }
            catch (error) {
                this.streamUpdate('❌ No src directory found. Invalid React project structure.');
                return;
            }
            const scanDir = (dir_1, ...args_1) => __awaiter(this, [dir_1, ...args_1], void 0, function* (dir, relativePath = '') {
                try {
                    const entries = yield fs_1.promises.readdir(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const fullPath = (0, path_1.join)(dir, entry.name);
                        const relPath = relativePath ? (0, path_1.join)(relativePath, entry.name) : entry.name;
                        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                            yield scanDir(fullPath, relPath);
                        }
                        else if (entry.isFile() && /\.(js|jsx|ts|tsx)$/.test(entry.name)) {
                            yield this.analyzeFile(fullPath, relPath, projectFiles);
                        }
                    }
                }
                catch (error) {
                    this.streamUpdate(`⚠️ Error scanning ${dir}: ${error}`);
                }
            });
            yield scanDir(srcPath);
            // Update dependency manager with current project files
            const updatedDependencyManager = new dependancy_1.DependencyManager(projectFiles);
            if (streamCallback) {
                updatedDependencyManager.setStreamCallback(streamCallback);
            }
            this.streamUpdate(`✅ Project analysis complete! Found ${projectFiles.size} React files.`);
        });
    }
    analyzeFile(filePath, relativePath, projectFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (relativePath.includes('components/ui/') || relativePath.includes('components\\ui\\')) {
                    return;
                }
                const content = yield fs_1.promises.readFile(filePath, 'utf8');
                const stats = yield fs_1.promises.stat(filePath);
                const lines = content.split('\n');
                const projectFile = {
                    name: (0, path_1.basename)(filePath),
                    path: filePath,
                    relativePath: `src/${relativePath}`,
                    content,
                    lines: lines.length,
                    size: stats.size,
                    snippet: lines.slice(0, 15).join('\n'),
                    componentName: this.extractComponentNameFromContent(content),
                    hasButtons: this.checkForButtons(content),
                    hasSignin: this.checkForSignin(content),
                    isMainFile: this.isMainFile(filePath, content)
                };
                projectFiles.set(projectFile.relativePath, projectFile);
            }
            catch (error) {
                console.error(`Failed to analyze file ${relativePath}:`, error);
            }
        });
    }
    buildProjectSummary(projectFiles) {
        let summary = "**COMPLETE PROJECT STRUCTURE:**\n\n";
        summary += "**ANALYZED REACT FILES WITH METADATA:**\n\n";
        const sortedFiles = Array.from(projectFiles.values())
            .sort((a, b) => {
            if (a.isMainFile && !b.isMainFile)
                return -1;
            if (!a.isMainFile && b.isMainFile)
                return 1;
            return a.relativePath.localeCompare(b.relativePath);
        });
        summary += `**Total React Files Found: ${sortedFiles.length}**\n\n`;
        sortedFiles.forEach(file => {
            summary += `**${file.relativePath}**\n`;
            summary += `- Component: ${file.componentName || 'Unknown'}\n`;
            summary += `- Has buttons: ${file.hasButtons ? 'Yes' : 'No'}\n`;
            summary += `- Has signin: ${file.hasSignin ? 'Yes' : 'No'}\n`;
            summary += `- Is main file: ${file.isMainFile ? 'Yes' : 'No'}\n\n`;
        });
        return summary;
    }
    getProjectAnalytics(prompt, projectFiles, astAnalyzer, anthropic, tokenTracker) {
        return __awaiter(this, void 0, void 0, function* () {
            const analytics = {
                totalFiles: projectFiles.size,
                analyzedFiles: projectFiles.size,
                potentialTargets: []
            };
            if (prompt && projectFiles.size > 0) {
                this.streamUpdate('📊 Running project analytics...');
                let fileCount = 0;
                const maxAnalyze = 10;
                for (const [filePath] of projectFiles) {
                    if (fileCount >= maxAnalyze)
                        break;
                    const astNodes = astAnalyzer.parseFileWithAST(filePath, projectFiles);
                    const target = {
                        filePath,
                        elementCount: astNodes.length,
                        relevanceScore: undefined
                    };
                    if (astNodes.length > 0) {
                        try {
                            const relevanceResult = yield astAnalyzer.analyzeFileRelevance(prompt, filePath, astNodes, 'FULL_FILE', projectFiles, anthropic, tokenTracker);
                            target.relevanceScore = relevanceResult.relevanceScore;
                        }
                        catch (error) {
                            // Continue without score
                        }
                    }
                    analytics.potentialTargets.push(target);
                    fileCount++;
                }
                analytics.potentialTargets.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
            }
            return analytics;
        });
    }
    getUnusedPagesInfo(projectFiles, reactBasePath) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.findUnusedPages(projectFiles, reactBasePath);
        });
    }
    findUnusedPages(projectFiles, reactBasePath) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('🔍 Analyzing App.tsx to find unused pages...');
            const pages = yield this.scanPagesDirectory(reactBasePath);
            if (pages.length === 0) {
                return [];
            }
            // Find App.tsx
            let appFile = projectFiles.get('src/App.tsx') || projectFiles.get('src/App.jsx');
            if (!appFile) {
                const appPaths = ['src/App.tsx', 'src/App.jsx'];
                for (const appPath of appPaths) {
                    try {
                        const fullPath = (0, path_1.join)(reactBasePath, appPath.replace('src/', ''));
                        const content = yield fs_1.promises.readFile(fullPath, 'utf8');
                        appFile = {
                            name: (0, path_1.basename)(fullPath),
                            path: fullPath,
                            relativePath: appPath,
                            content,
                            lines: content.split('\n').length,
                            size: 0,
                            snippet: '',
                            componentName: 'App',
                            hasButtons: false,
                            hasSignin: false,
                            isMainFile: true
                        };
                        break;
                    }
                    catch (_a) {
                        continue;
                    }
                }
            }
            if (!appFile) {
                this.streamUpdate('❌ No App.tsx found');
                return pages;
            }
            const appContent = appFile.content;
            // Check each page
            for (const page of pages) {
                // Check if imported
                const importRegex = new RegExp(`import\\s+${page.name}\\s+from\\s+['"](\\./)?pages/${page.name}['"]`, 'i');
                page.isImported = importRegex.test(appContent);
                // Check if used in routing
                const routeRegex = new RegExp(`<Route[^>]*element={<${page.name}[^>]*>}[^>]*>`, 'i');
                const componentRegex = new RegExp(`<${page.name}[\\s/>]`, 'i');
                page.isUsedInRouting = routeRegex.test(appContent) || componentRegex.test(appContent);
                this.streamUpdate(`📄 ${page.name}: imported=${page.isImported}, used=${page.isUsedInRouting}`);
            }
            // Return only unused pages
            const unusedPages = pages.filter(page => !page.isImported || !page.isUsedInRouting);
            this.streamUpdate(`📊 Found ${unusedPages.length} unused pages: ${unusedPages.map(p => p.name).join(', ')}`);
            return unusedPages;
        });
    }
    scanPagesDirectory(reactBasePath) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('📁 Scanning pages directory for existing pages...');
            const pagesPath = (0, path_1.join)(reactBasePath, 'src', 'pages');
            const pages = [];
            try {
                const entries = yield fs_1.promises.readdir(pagesPath, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
                        const pageName = entry.name.replace(/\.(tsx?|jsx?)$/, '');
                        const relativePath = `src/pages/${entry.name}`;
                        pages.push({
                            name: pageName,
                            path: relativePath,
                            isImported: false,
                            isUsedInRouting: false,
                            suggestedRoute: `/${pageName.toLowerCase()}`
                        });
                    }
                }
                this.streamUpdate(`📋 Found ${pages.length} pages in directory`);
            }
            catch (error) {
                this.streamUpdate(`⚠️ No pages directory found or error reading: ${error}`);
            }
            return pages;
        });
    }
    extractComponentNameFromContent(content) {
        const patterns = [
            /(?:function|const)\s+([A-Z]\w+)/,
            /export\s+default\s+([A-Z]\w+)/,
            /class\s+([A-Z]\w+)/
        ];
        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return 'Unknown';
    }
    checkForButtons(content) {
        return /button|Button|btn|<button|type.*submit/i.test(content);
    }
    checkForSignin(content) {
        return /signin|sign.?in|login|log.?in|auth/i.test(content);
    }
    isMainFile(filePath, content) {
        const fileName = (0, path_1.basename)(filePath).toLowerCase();
        const isMainName = /^(app|index|main|home)\./.test(fileName);
        const hasMainContent = /export\s+default|function\s+App|class\s+App/i.test(content);
        return isMainName || hasMainContent;
    }
}
exports.ProjectAnalyzer = ProjectAnalyzer;
//# sourceMappingURL=projectanalyzer.js.map