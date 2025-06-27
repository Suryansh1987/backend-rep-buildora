// ============================================================================
// PROJECT ANALYZER: processors/ProjectAnalyzer.ts
// ============================================================================

import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { ProjectFile, PageInfo } from '../filemodifier/types';
import { DependencyManager } from '../filemodifier/dependancy';
import { ASTAnalyzer } from './Astanalyzer';
import { TokenTracker } from '../../utils/TokenTracer';

export class ProjectAnalyzer {
  private reactBasePath: string;
  private streamCallback?: (message: string) => void;

  constructor(reactBasePath: string) {
    this.reactBasePath = reactBasePath;
  }

  setStreamCallback(callback: (message: string) => void): void {
    this.streamCallback = callback;
  }

  private streamUpdate(message: string): void {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
  }

  async buildProjectTree(
    projectFiles: Map<string, ProjectFile>, 
    dependencyManager: DependencyManager,
    streamCallback?: (message: string) => void
  ): Promise<void> {
    this.streamUpdate('🔍 Starting comprehensive project analysis...');
    
    const srcPath = join(this.reactBasePath, 'src');
    
    try {
      await fs.access(srcPath);
      this.streamUpdate('✅ Found src directory! Scanning React components and project structure...');
    } catch (error) {
      this.streamUpdate('❌ No src directory found. Invalid React project structure.');
      return;
    }
    
    const scanDir = async (dir: string, relativePath: string = ''): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          const relPath = relativePath ? join(relativePath, entry.name) : entry.name;
          
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await scanDir(fullPath, relPath);
          } else if (entry.isFile() && /\.(js|jsx|ts|tsx)$/.test(entry.name)) {
            await this.analyzeFile(fullPath, relPath, projectFiles);
          }
        }
      } catch (error) {
        this.streamUpdate(`⚠️ Error scanning ${dir}: ${error}`);
      }
    };

    await scanDir(srcPath);
    
    // Update dependency manager with current project files
    const updatedDependencyManager = new DependencyManager(projectFiles);
    if (streamCallback) {
      updatedDependencyManager.setStreamCallback(streamCallback);
    }
    
    this.streamUpdate(`✅ Project analysis complete! Found ${projectFiles.size} React files.`);
  }

  private async analyzeFile(
    filePath: string, 
    relativePath: string, 
    projectFiles: Map<string, ProjectFile>
  ): Promise<void> {
    try {
      if (relativePath.includes('components/ui/') || relativePath.includes('components\\ui\\')) {
        return;
      }

      const content = await fs.readFile(filePath, 'utf8');
      const stats = await fs.stat(filePath);
      const lines = content.split('\n');
      
      const projectFile: ProjectFile = {
        name: basename(filePath),
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
    } catch (error) {
      console.error(`Failed to analyze file ${relativePath}:`, error);
    }
  }

  buildProjectSummary(projectFiles: Map<string, ProjectFile>): string {
    let summary = "**COMPLETE PROJECT STRUCTURE:**\n\n";
    summary += "**ANALYZED REACT FILES WITH METADATA:**\n\n";
    
    const sortedFiles = Array.from(projectFiles.values())
      .sort((a, b) => {
        if (a.isMainFile && !b.isMainFile) return -1;
        if (!a.isMainFile && b.isMainFile) return 1;
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

  async getProjectAnalytics(
    prompt: string | undefined,
    projectFiles: Map<string, ProjectFile>,
    astAnalyzer: ASTAnalyzer,
    anthropic: any,
    tokenTracker: TokenTracker
  ): Promise<{
    totalFiles: number;
    analyzedFiles: number;
    potentialTargets?: Array<{ filePath: string; elementCount: number; relevanceScore?: number }>;
  }> {
    const analytics = {
      totalFiles: projectFiles.size,
      analyzedFiles: projectFiles.size,
      potentialTargets: [] as Array<{ filePath: string; elementCount: number; relevanceScore?: number }>
    };

    if (prompt && projectFiles.size > 0) {
      this.streamUpdate('📊 Running project analytics...');
      
      let fileCount = 0;
      const maxAnalyze = 10;
      
      for (const [filePath] of projectFiles) {
        if (fileCount >= maxAnalyze) break;
        
        const astNodes = astAnalyzer.parseFileWithAST(filePath, projectFiles);
        const target = {
          filePath,
          elementCount: astNodes.length,
          relevanceScore: undefined as number | undefined
        };
        
        if (astNodes.length > 0) {
          try {
            const relevanceResult = await astAnalyzer.analyzeFileRelevance(
              prompt,
              filePath,
              astNodes,
              'FULL_FILE',
              projectFiles,
              anthropic,
              tokenTracker
            );
            target.relevanceScore = relevanceResult.relevanceScore;
          } catch (error) {
            // Continue without score
          }
        }
        
        analytics.potentialTargets.push(target);
        fileCount++;
      }
      
      analytics.potentialTargets.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    }

    return analytics;
  }

  async getUnusedPagesInfo(projectFiles: Map<string, ProjectFile>, reactBasePath: string): Promise<PageInfo[]> {
    return this.findUnusedPages(projectFiles, reactBasePath);
  }

  private async findUnusedPages(projectFiles: Map<string, ProjectFile>, reactBasePath: string): Promise<PageInfo[]> {
    this.streamUpdate('🔍 Analyzing App.tsx to find unused pages...');
    
    const pages = await this.scanPagesDirectory(reactBasePath);
    if (pages.length === 0) {
      return [];
    }
    
    // Find App.tsx
    let appFile = projectFiles.get('src/App.tsx') || projectFiles.get('src/App.jsx');
    
    if (!appFile) {
      const appPaths = ['src/App.tsx', 'src/App.jsx'];
      for (const appPath of appPaths) {
        try {
          const fullPath = join(reactBasePath, appPath.replace('src/', ''));
          const content = await fs.readFile(fullPath, 'utf8');
          
          appFile = {
            name: basename(fullPath),
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
        } catch {
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
  }

  private async scanPagesDirectory(reactBasePath: string): Promise<PageInfo[]> {
    this.streamUpdate('📁 Scanning pages directory for existing pages...');
    
    const pagesPath = join(reactBasePath, 'src', 'pages');
    const pages: PageInfo[] = [];
    
    try {
      const entries = await fs.readdir(pagesPath, { withFileTypes: true });
      
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
    } catch (error) {
      this.streamUpdate(`⚠️ No pages directory found or error reading: ${error}`);
    }
    
    return pages;
  }

  private extractComponentNameFromContent(content: string): string {
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

  private checkForButtons(content: string): boolean {
    return /button|Button|btn|<button|type.*submit/i.test(content);
  }

  private checkForSignin(content: string): boolean {
    return /signin|sign.?in|login|log.?in|auth/i.test(content);
  }

  private isMainFile(filePath: string, content: string): boolean {
    const fileName = basename(filePath).toLowerCase();
    const isMainName = /^(app|index|main|home)\./.test(fileName);
    const hasMainContent = /export\s+default|function\s+App|class\s+App/i.test(content);
    return isMainName || hasMainContent;
  }
}