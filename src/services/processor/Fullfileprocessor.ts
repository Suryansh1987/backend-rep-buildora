
import { promises as fs } from 'fs';
import { join, resolve, isAbsolute, relative, dirname, basename } from 'path';

type FileNode = {
  type: 'file';
  size: number;
  lines: number;
};

type DirectoryNode = {
  type: 'directory';
  children: FileTree;
};

type FileTree = {
  [name: string]: FileNode | DirectoryNode;
};
interface ProjectFile {
  path: string;
  relativePath: string;
  content: string;
  lines: number;
  isMainFile: boolean;
  fileType: string;
  lastModified?: Date;
}

interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  size?: number;
  extension?: string;
}

interface FileAnalysisResult {
  filePath: string;
  file: ProjectFile;
  relevanceScore: number;
  reasoning: string;
  changeType: string[];
  priority: 'high' | 'medium' | 'low';
}

interface BatchModificationRequest {
  files: Array<{
    filePath: string;
    content: string;
    fileType: string;
    changeType: string[];
    priority: string;
  }>;
  prompt: string;
  projectContext: {
    fileTree: string;
    projectType: string;
    mainFiles: string[];
    totalFiles: number;
    framework: string;
  };
}

interface ChangeRecord {
  type: string;
  file: string;
  description: string;
  success: boolean;
  details?: {
    linesChanged?: number;
    changeType?: string[];
    reasoning?: string;
  };
}

// Token tracker interface
interface TokenTracker {
  logUsage(usage: any, description: string): void;
  getStats(): { totalTokens: number; estimatedCost: number };
}

export class FullFileProcessor {
  private anthropic: any;
  private tokenTracker: TokenTracker;
  private streamCallback?: (message: string) => void;
  private basePath: string;

  constructor(anthropic: any, tokenTracker: TokenTracker, basePath?: string) {
    this.anthropic = anthropic;
    this.tokenTracker = tokenTracker;
    this.basePath = basePath || process.cwd();
  }

  setStreamCallback(callback: (message: string) => void): void {
    this.streamCallback = callback;
  }

  private streamUpdate(message: string): void {
    try {
      if (this.streamCallback && typeof this.streamCallback === 'function') {
        this.streamCallback(message);
      }
    } catch (error) {
      console.warn('Stream callback error:', error);
    }
    console.log(message);
  }

  /**
   * Main entry point for dynamic file modification
   * Handles various input types for backward compatibility
   */
  async processFullFileModification(
    prompt: string,
    folderNameOrProjectFiles: string | Map<string, ProjectFile>,
    streamCallbackOrBasePath?: ((message: string) => void) | string,
    legacyStreamCallback?: (message: string) => void
  ): Promise<{
    success: boolean;
    changes?: ChangeRecord[];
    modifiedFiles?: string[];
  }> {
    let actualFolderName: string;
    let actualStreamCallback: ((message: string) => void) | undefined;
    let projectFiles: Map<string, ProjectFile> | undefined;

    // Handle different calling patterns for backward compatibility
    if (typeof folderNameOrProjectFiles === 'string') {
      actualFolderName = folderNameOrProjectFiles;
      actualStreamCallback = typeof streamCallbackOrBasePath === 'function' 
        ? streamCallbackOrBasePath 
        : legacyStreamCallback;
    } else if (folderNameOrProjectFiles instanceof Map) {
      projectFiles = folderNameOrProjectFiles;
      const reactBasePath = streamCallbackOrBasePath as string;
      actualStreamCallback = legacyStreamCallback;
      
      if (typeof reactBasePath === 'string') {
        actualFolderName = this.extractFolderNameFromPath(reactBasePath);
      } else {
        const firstFile = Array.from(projectFiles.values())[0];
        if (firstFile?.path) {
          actualFolderName = this.extractFolderNameFromPath(firstFile.path);
        } else {
          throw new Error('Cannot determine folder name from project files');
        }
      }
    } else {
      throw new Error(`Invalid first parameter. Expected string (folderName) or Map (projectFiles), got: ${typeof folderNameOrProjectFiles}`);
    }

    // Initialize stream callback with proper fallback
    if (actualStreamCallback && typeof actualStreamCallback === 'function') {
      this.setStreamCallback(actualStreamCallback);
    } else {
      this.setStreamCallback((message: string) => console.log(message));
    }
    
    try {
      // Validate inputs
      if (!prompt || typeof prompt !== 'string') {
        throw new Error(`Invalid prompt provided: ${prompt} (type: ${typeof prompt})`);
      }
      
      if (!actualFolderName || typeof actualFolderName !== 'string') {
        throw new Error(`Invalid folderName resolved: ${actualFolderName} (type: ${typeof actualFolderName})`);
      }
      
      this.streamUpdate(`🚀 Starting DYNAMIC BATCH processing for folder: "${actualFolderName}"`);
      this.streamUpdate(`📝 User prompt: "${prompt}"`);
      
      // PHASE 1: Determine project path with async waiting and scan files
      this.streamUpdate(`🔍 Resolving project path (with extraction wait logic)...`);
      const projectPath = await this.resolveProjectPathAsync(actualFolderName);
      this.streamUpdate(`📂 Resolved project path: ${projectPath}`);
      
      // Wait for project to be ready (extraction might still be in progress)
      this.streamUpdate(`⏳ Ensuring project extraction is complete...`);
      const isReady = await this.waitForProjectReady(projectPath, 30000); // Wait up to 30 seconds
      
      if (!isReady) {
        // Try fallback approach - check if files exist in provided projectFiles
        if (projectFiles && projectFiles.size > 0) {
          this.streamUpdate(`📁 Project path not ready, but using provided project files (${projectFiles.size} files)`);
        } else {
          throw new Error(`Project path is not ready after waiting, and no project files provided: ${projectPath}`);
        }
      }
      
      // PHASE 2: Generate file tree and load project files
      this.streamUpdate(`🌳 Generating file tree...`);
      let fileTree: string;
      let actualProjectFiles: Map<string, ProjectFile>;
      
      if (projectFiles && projectFiles.size > 0) {
        this.streamUpdate(`📁 Using provided project files (${projectFiles.size} files)`);
        actualProjectFiles = projectFiles;
        
        // Generate file tree from provided files
        fileTree = this.generateFileTreeFromProjectFiles(actualProjectFiles);
      } else {
        this.streamUpdate(`📁 Loading project files from disk...`);
        
        try {
          fileTree = await this.generateFileTree(projectPath);
          actualProjectFiles = await this.loadProjectFiles(projectPath);
        } catch (error) {
          this.streamUpdate(`❌ Error loading from disk: ${error}`);
          throw new Error(`Failed to load project files from ${projectPath}: ${error}`);
        }
      }
      
      this.streamUpdate(`📊 Working with ${actualProjectFiles.size} files from project`);
      
      if (actualProjectFiles.size === 0) {
        throw new Error(`No files found in project. Path: ${projectPath}, Provided files: ${projectFiles?.size || 0}`);
      }
      
      // Continue with the rest of the processing...
      // PHASE 3: Use Claude to analyze which files need changes
      this.streamUpdate(`🧠 Analyzing files with Claude...`);
      const relevantFiles = await this.analyzeFilesWithClaude(
        prompt, 
        fileTree, 
        actualProjectFiles
      );
      
      if (relevantFiles.length === 0) {
        this.streamUpdate(`❌ No relevant files identified for modification`);
        return { 
          success: false, 
          changes: [{
            type: 'info',
            file: 'system',
            description: 'No files were identified as needing modification for this request',
            success: false
          }]
        };
      }
      
      this.streamUpdate(`✅ Claude identified ${relevantFiles.length} files for modification`);
      
      // PHASE 4: Prepare and execute batch modification
      this.streamUpdate(`📦 Preparing batch modification request...`);
      const batchRequest = this.prepareDynamicBatchRequest(
        prompt, 
        relevantFiles, 
        fileTree, 
        actualProjectFiles
      );
      
      this.streamUpdate(`🚀 Executing batch modification...`);
      const modificationResult = await this.executeDynamicBatchModification(batchRequest);
      
      if (!modificationResult.success || modificationResult.modifiedFiles.length === 0) {
        throw new Error('Batch modification failed or returned no modified files');
      }
      
      // PHASE 5: Apply modifications to actual files
      this.streamUpdate(`💾 Applying modifications to files...`);
      const applyResult = await this.applyModificationsToFiles(
        modificationResult.modifiedFiles,
        projectPath,
        actualProjectFiles
      );
      
      this.streamUpdate(`🎉 COMPLETE: ${applyResult.successCount} files modified successfully`);
      
      return {
        success: applyResult.successCount > 0,
        changes: applyResult.changes,
        modifiedFiles: applyResult.modifiedFiles
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.streamUpdate(`❌ Error in dynamic processing: ${errorMessage}`);
      
      return {
        success: false,
        changes: [{
          type: 'error',
          file: 'system',
          description: `Dynamic processing failed: ${errorMessage}`,
          success: false
        }]
      };
    }
  }

  /**
   * Generate file tree from project files Map (when files are provided instead of loading from disk)
   */
   private generateFileTreeFromProjectFiles(projectFiles: Map<string, ProjectFile>): string {
    const pathStructure: FileTree = {};

    // Build tree structure
    for (const [relativePath, file] of projectFiles) {
      const parts = relativePath.split('/');
      let current: FileTree = pathStructure;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        if (i === parts.length - 1) {
          // It's a file
          current[part] = {
            type: 'file',
            size: file.content.length,
            lines: file.lines,
          };
        } else {
          // It's a directory
          if (!current[part]) {
            current[part] = { type: 'directory', children: {} };
          }

          // Type guard to safely narrow the type
          const next = current[part];
          if (next.type === 'directory') {
            current = next.children;
          }
        }
      }
    }

    // Convert to string representation
    const buildTreeString = (obj: FileTree, prefix = ''): string => {
      let result = '';

      const entries = Object.entries(obj) as [string, FileNode | DirectoryNode][];
      const sortedEntries = entries.sort(([a, aData], [b, bData]) => {
        if (aData.type === 'directory' && bData.type === 'file') return -1;
        if (aData.type === 'file' && bData.type === 'directory') return 1;
        return a.localeCompare(b);
      });

      for (const [name, data] of sortedEntries) {
        if (data.type === 'directory') {
          result += `${prefix}📁 ${name}/\n`;
          result += buildTreeString(data.children, prefix + '  ');
        } else {
          const icon = this.getFileIcon(name);
          const size = this.formatFileSize(data.size || 0);
          result += `${prefix}${icon} ${name} (${size})\n`;
        }
      }

      return result;
    };

    return buildTreeString(pathStructure);
  }


  /**
   * Extract folder name from various path formats
   * Updated to handle projects without src subdirectory and preserve temp-build structure
   */
  private extractFolderNameFromPath(filePath: string): string {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error(`Invalid file path for folder extraction: ${filePath}`);
    }

    try {
      // Handle different path patterns
      const pathParts = filePath.replace(/\\/g, '/').split('/');
      
      // Pattern 1: /path/to/temp-build/{folderName}/src/... or /path/to/temp-build/{folderName}/...
      const tempBuildIndex = pathParts.findIndex(part => part === 'temp-build');
      if (tempBuildIndex >= 0 && tempBuildIndex < pathParts.length - 1) {
        const folderName = pathParts[tempBuildIndex + 1];
        this.streamUpdate(`📁 Extracted folder name from temp-build pattern: ${folderName}`);
        return folderName;
      }
      
      // Pattern 2: Direct path like C:\...\{UUID}\src\... (missing temp-build in path)
      // Look for UUID pattern and assume it should be in temp-build
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      for (const part of pathParts) {
        if (uuidPattern.test(part)) {
          this.streamUpdate(`📁 Extracted build ID from UUID pattern: ${part}`);
          return part;
        }
      }
      
      // Pattern 3: /path/to/{folderName}/src/...
      const srcIndex = pathParts.findIndex(part => part === 'src');
      if (srcIndex > 0) {
        const folderName = pathParts[srcIndex - 1];
        // Check if this looks like a UUID (build ID)
        if (uuidPattern.test(folderName)) {
          this.streamUpdate(`📁 Extracted build ID from src pattern: ${folderName}`);
          return folderName;
        }
        this.streamUpdate(`📁 Extracted folder name from src pattern: ${folderName}`);
        return folderName;
      }
      
      // Pattern 4: /path/to/{folderName}/components/... (no src)
      // Look for common project structure indicators
      const structureIndicators = ['components', 'pages', 'app', 'lib', 'utils', 'styles'];
      for (const indicator of structureIndicators) {
        const indicatorIndex = pathParts.findIndex(part => part === indicator);
        if (indicatorIndex > 0) {
          const folderName = pathParts[indicatorIndex - 1];
          this.streamUpdate(`📁 Extracted folder name from ${indicator} pattern: ${folderName}`);
          return folderName;
        }
      }
      
      // Pattern 5: Just use the directory name containing the file
      const fileName = basename(filePath);
      const dirPath = dirname(filePath);
      const folderName = basename(dirPath);
      
      this.streamUpdate(`📁 Extracted folder name from directory: ${folderName}`);
      return folderName;
      
    } catch (error) {
      this.streamUpdate(`⚠️ Error extracting folder name from ${filePath}: ${error}`);
      return 'unknown';
    }
  }

  /**
   * Resolve project path with async waiting and retry logic
   * Handles cases where file extraction is still in progress
   */
  private async resolveProjectPathAsync(folderName: string, maxRetries: number = 10, retryDelay: number = 500): Promise<string> {
    // Validate input
    if (!folderName || typeof folderName !== 'string') {
      throw new Error(`Invalid folderName provided: ${folderName} (type: ${typeof folderName})`);
    }
    
    this.streamUpdate(`🔍 Resolving project path for folder: "${folderName}" (with retry logic)`);
    
    // Check if it's already an absolute path
    if (isAbsolute(folderName)) {
      if (await this.pathExists(folderName)) {
        this.streamUpdate(`📂 Absolute path detected and verified: ${folderName}`);
        return folderName;
      } else {
        this.streamUpdate(`⚠️ Absolute path provided but doesn't exist: ${folderName}`);
      }
    }
    
    // Define possible paths to check - prioritize temp-build structure
    const possiblePaths = [
      // First priority: temp-build structure with src
      join(process.cwd(), 'temp-build', folderName, 'src'),
      join(this.basePath, 'temp-build', folderName, 'src'),
      
      // Second priority: temp-build structure without src
      join(process.cwd(), 'temp-build', folderName),
      join(this.basePath, 'temp-build', folderName),
      
      // Third priority: direct folder structure with src
      join(process.cwd(), folderName, 'src'),
      join(this.basePath, folderName, 'src'),
      
      // Last priority: direct folder structure without src
      join(process.cwd(), folderName),
      join(this.basePath, folderName),
    ];
    
    this.streamUpdate(`🔍 Will check ${possiblePaths.length} possible paths with up to ${maxRetries} retries...`);
    this.streamUpdate(`🎯 Priority path: ${possiblePaths[0]}`);
    
    // Retry logic
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      this.streamUpdate(`🔄 Attempt ${attempt}/${maxRetries} - Checking for project path...`);
      
      for (const path of possiblePaths) {
        try {
          this.streamUpdate(`🔍 Checking: ${path}`);
          
          if (await this.pathExists(path)) {
            // Additional check: make sure this path contains actual project files
            const hasProjectFiles = await this.hasProjectFiles(path);
            
            if (hasProjectFiles) {
              this.streamUpdate(`✅ Found project with files at: ${path}`);
              return path;
            } else {
              this.streamUpdate(`📂 Directory exists but no project files found: ${path}`);
            }
          }
        } catch (error) {
          this.streamUpdate(`⚠️ Error checking path ${path}: ${error}`);
          // Continue to next path
        }
      }
      
      // If not found and we have more attempts, wait before retrying
      if (attempt < maxRetries) {
        this.streamUpdate(`⏳ Project not found yet, waiting ${retryDelay}ms before retry ${attempt + 1}...`);
        await this.sleep(retryDelay);
        
        // Increase delay slightly for subsequent retries
        retryDelay = Math.min(retryDelay * 1.2, 2000);
      }
    }
    
    // If still nothing found after all retries, use the most likely path (temp-build with src)
    const fallbackPath = join(process.cwd(), 'temp-build', folderName, 'src');
    this.streamUpdate(`⚠️ No existing project found after ${maxRetries} attempts, using fallback path: ${fallbackPath}`);
    return fallbackPath;
  }

  /**
   * Legacy sync resolve method for backward compatibility
   */
  private resolveProjectPath(folderName: string): string {
    // This is the old synchronous method - we'll make it point to the most likely path
    // For backward compatibility with methods that don't use async
    if (!folderName || typeof folderName !== 'string') {
      throw new Error(`Invalid folderName provided: ${folderName} (type: ${typeof folderName})`);
    }
    
    if (isAbsolute(folderName)) {
      return folderName;
    }
    
    // Return the most likely path with temp-build structure
    return join(process.cwd(), 'temp-build', folderName, 'src');
  }

  /**
   * Check if a path contains project files
   */
  private async hasProjectFiles(path: string): Promise<boolean> {
    try {
      const files = await fs.readdir(path);
      return files.some(file => 
        file.endsWith('.tsx') || 
        file.endsWith('.jsx') || 
        file.endsWith('.ts') || 
        file.endsWith('.js') ||
        file.endsWith('.vue') ||
        file === 'package.json' ||
        file === 'index.html'
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Sleep utility function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Enhanced path existence check with better error handling
   */
  private async pathExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for project to be ready (extraction complete)
   */
  private async waitForProjectReady(projectPath: string, maxWaitTime: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 500; // Check every 500ms
    
    this.streamUpdate(`⏳ Waiting for project to be ready at: ${projectPath}`);
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Check if path exists
        if (await this.pathExists(projectPath)) {
          // Check if it has project files
          const hasFiles = await this.hasProjectFiles(projectPath);
          if (hasFiles) {
            this.streamUpdate(`✅ Project is ready at: ${projectPath}`);
            return true;
          }
        }
        
        // Wait before next check
        await this.sleep(checkInterval);
        this.streamUpdate(`⏳ Still waiting... (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`);
        
      } catch (error) {
        this.streamUpdate(`⚠️ Error while waiting for project: ${error}`);
        await this.sleep(checkInterval);
      }
    }
    
    this.streamUpdate(`❌ Timeout waiting for project after ${maxWaitTime}ms`);
    return false;
  }

  /**
   * Generate file tree representation with smart filtering
   */
  private async generateFileTree(dirPath: string, prefix = '', maxDepth = 5, currentDepth = 0): Promise<string> {
    if (currentDepth >= maxDepth) {
      return `${prefix}... (max depth reached)\n`;
    }
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      const result = await Promise.all(
        entries
          .filter(entry => !this.shouldSkipFileOrDirectory(entry.name))
          .sort((a, b) => {
            // Directories first, then files
            if (a.isDirectory() && !b.isDirectory()) return -1;
            if (!a.isDirectory() && b.isDirectory()) return 1;
            return a.name.localeCompare(b.name);
          })
          .map(async (entry) => {
            const fullPath = join(dirPath, entry.name);
            
            if (entry.isDirectory()) {
              const subTree = await this.generateFileTree(
                fullPath, 
                prefix + '  ', 
                maxDepth, 
                currentDepth + 1
              );
              return `${prefix}📁 ${entry.name}/\n${subTree}`;
            } else {
              const stats = await fs.stat(fullPath);
              const size = this.formatFileSize(stats.size);
              const icon = this.getFileIcon(entry.name);
              return `${prefix}${icon} ${entry.name} (${size})`;
            }
          })
      );
      
      return result.join('\n');
    } catch (error) {
      return `${prefix}❌ Error reading directory: ${error}\n`;
    }
  }

  /**
   * Load all project files into memory
   */
  private async loadProjectFiles(projectPath: string): Promise<Map<string, ProjectFile>> {
    const projectFiles = new Map<string, ProjectFile>();
    
    const scanDirectory = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          const relativePath = relative(projectPath, fullPath);
          
          if (entry.isDirectory() && !this.shouldSkipFileOrDirectory(entry.name)) {
            await scanDirectory(fullPath);
          } else if (entry.isFile() && this.isRelevantFile(entry.name)) {
            try {
              const content = await fs.readFile(fullPath, 'utf8');
              const stats = await fs.stat(fullPath);
              
              const projectFile: ProjectFile = {
                path: fullPath,
                relativePath,
                content,
                lines: content.split('\n').length,
                isMainFile: this.isMainFile(entry.name, relativePath),
                fileType: this.determineFileType(entry.name, content),
                lastModified: stats.mtime
              };
              
              projectFiles.set(relativePath, projectFile);
              this.streamUpdate(`📄 Loaded: ${relativePath} (${projectFile.lines} lines)`);
              
            } catch (readError) {
              this.streamUpdate(`⚠️ Could not read file: ${relativePath} - ${readError}`);
            }
          }
        }
      } catch (error) {
        this.streamUpdate(`⚠️ Error scanning directory ${dir}: ${error}`);
      }
    };
    
    await scanDirectory(projectPath);
    return projectFiles;
  }

  /**
   * Use Claude to analyze which files need changes based on file tree and user prompt
   */
  private async analyzeFilesWithClaude(
    prompt: string,
    fileTree: string,
    projectFiles: Map<string, ProjectFile>
  ): Promise<FileAnalysisResult[]> {
    
    // Create a summary of available files with their purposes
    const fileSummaries = Array.from(projectFiles.entries())
      .map(([path, file]) => {
        const purpose = this.inferFilePurpose(file);
        return `${path} (${file.lines} lines) - ${purpose}`;
      })
      .join('\n');
    
    const analysisPrompt = `
TASK: Analyze which files need modification for the user request.

USER REQUEST: "${prompt}"

PROJECT FILE TREE:
${fileTree}

AVAILABLE FILES WITH PURPOSES:
${fileSummaries}

INSTRUCTIONS:
1. Analyze the user request and determine what type of changes are needed
2. Look at the file tree and file purposes to understand the project structure
3. Select ONLY the files that actually need modification to fulfill the request
4. Be selective - don't modify files that don't need changes
5. Consider the project type (React, Vue, vanilla JS, etc.) based on file extensions
6. Prioritize main components, pages, and layout files for UI changes
7. For functionality changes, focus on relevant feature components

RESPONSE FORMAT:
Return a JSON array of objects with the following structure:
[
  {
    "filePath": "path/to/file.tsx",
    "relevanceScore": 85,
    "reasoning": "This file needs modification because...",
    "changeType": ["styling", "layout"],
    "priority": "high"
  }
]

Only include files that actually need changes. Be selective and practical.

ANALYSIS:`;

    try {
      this.streamUpdate(`🧠 Sending file analysis to Claude...`);
      
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 4000,
        temperature: 0.1,
        messages: [{ role: 'user', content: analysisPrompt }],
      });

      this.tokenTracker.logUsage(response.usage, 'Dynamic File Selection Analysis');

      const responseText = response.content[0]?.text || '';
      
      // Extract JSON from response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.streamUpdate(`⚠️ Could not parse Claude's file analysis response`);
        return this.getFallbackFileSelection(prompt, projectFiles);
      }
      
      const analysisResults = JSON.parse(jsonMatch[0]);
      
      // Convert to FileAnalysisResult format
      const relevantFiles: FileAnalysisResult[] = [];
      
      for (const result of analysisResults) {
        const file = projectFiles.get(result.filePath);
        if (file) {
          relevantFiles.push({
            filePath: result.filePath,
            file,
            relevanceScore: result.relevanceScore || 50,
            reasoning: result.reasoning || 'Selected by Claude analysis',
            changeType: result.changeType || ['general'],
            priority: result.priority || 'medium'
          });
          
          this.streamUpdate(`✅ Selected: ${result.filePath} (${result.relevanceScore}%) - ${result.reasoning}`);
        } else {
          this.streamUpdate(`⚠️ File not found: ${result.filePath}`);
        }
      }
      
      return relevantFiles;
      
    } catch (error) {
      this.streamUpdate(`❌ Claude analysis failed: ${error}`);
      return this.getFallbackFileSelection(prompt, projectFiles);
    }
  }

  /**
   * Fallback file selection when Claude analysis fails
   */
  private getFallbackFileSelection(
    prompt: string,
    projectFiles: Map<string, ProjectFile>
  ): FileAnalysisResult[] {
    this.streamUpdate(`🚨 Using fallback file selection...`);
    
    const promptLower = prompt.toLowerCase();
    const relevantFiles: FileAnalysisResult[] = [];
    
    // Define selection criteria based on prompt
    const isUIChange = /color|theme|style|design|layout|appearance|visual|css|tailwind|ui|ux/i.test(prompt);
    const isNavChange = /nav|menu|header|footer|sidebar|routing|link/i.test(prompt);
    const isFunctionalChange = /add|create|function|feature|component|page|form|api|data/i.test(prompt);
    
    for (const [filePath, file] of projectFiles) {
      let relevanceScore = 0;
      let reasoning = '';
      const changeType: string[] = [];
      let priority: 'high' | 'medium' | 'low' = 'low';
      
      // Main files always get consideration
      if (file.isMainFile) {
        relevanceScore += 30;
        reasoning += 'Main application file. ';
        priority = 'high';
      }
      
      // UI/Layout changes
      if (isUIChange) {
        if (filePath.includes('App.') || filePath.includes('layout') || filePath.includes('theme')) {
          relevanceScore += 40;
          changeType.push('styling', 'layout');
          reasoning += 'UI/layout file for styling changes. ';
          priority = 'high';
        }
        
        if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
          relevanceScore += 20;
          changeType.push('styling');
          reasoning += 'React component for UI changes. ';
          if (priority === 'low') priority = 'medium';
        }
      }
      
      // Navigation changes
      if (isNavChange) {
        if (filePath.includes('nav') || filePath.includes('header') || filePath.includes('menu')) {
          relevanceScore += 50;
          changeType.push('navigation');
          reasoning += 'Navigation component. ';
          priority = 'high';
        }
      }
      
      // Functional changes
      if (isFunctionalChange) {
        if (filePath.includes('component') || filePath.includes('page')) {
          relevanceScore += 30;
          changeType.push('functionality');
          reasoning += 'Component file for functional changes. ';
          if (priority === 'low') priority = 'medium';
        }
      }
      
      // File type bonuses
      if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
        relevanceScore += 10;
        reasoning += 'React component file. ';
      }
      
      // Minimum threshold for inclusion
      if (relevanceScore >= 25) {
        relevantFiles.push({
          filePath,
          file,
          relevanceScore,
          reasoning: reasoning.trim(),
          changeType: changeType.length > 0 ? changeType : ['general'],
          priority
        });
        
        this.streamUpdate(`📋 Fallback selected: ${filePath} (${relevanceScore}%)`);
      }
    }
    
    // Ensure we have at least one file
    if (relevantFiles.length === 0) {
      const mainFile = Array.from(projectFiles.values()).find(f => f.isMainFile);
      if (mainFile) {
        const mainPath = Array.from(projectFiles.entries()).find(([_, f]) => f === mainFile)?.[0];
        if (mainPath) {
          relevantFiles.push({
            filePath: mainPath,
            file: mainFile,
            relevanceScore: 35,
            reasoning: 'Emergency selection - main application file',
            changeType: ['general'],
            priority: 'medium'
          });
        }
      }
    }
    
    return relevantFiles;
  }

  /**
   * Prepare dynamic batch modification request
   */
  private prepareDynamicBatchRequest(
    prompt: string,
    relevantFiles: FileAnalysisResult[],
    fileTree: string,
    projectFiles: Map<string, ProjectFile>
  ): BatchModificationRequest {
    
    const projectType = this.detectProjectType(projectFiles);
    const framework = this.detectFramework(projectFiles);
    const mainFiles = Array.from(projectFiles.entries())
      .filter(([_, file]) => file.isMainFile)
      .map(([path, _]) => path);
    
    return {
      files: relevantFiles.map(result => ({
        filePath: result.filePath,
        content: result.file.content,
        fileType: result.file.fileType,
        changeType: result.changeType,
        priority: result.priority
      })),
      prompt,
      projectContext: {
        fileTree,
        projectType,
        mainFiles,
        totalFiles: projectFiles.size,
        framework
      }
    };
  }

  /**
   * Execute dynamic batch modification
   */
  private async executeDynamicBatchModification(
    batchRequest: BatchModificationRequest
  ): Promise<{
    success: boolean;
    modifiedFiles: Array<{ filePath: string; modifiedContent: string }>;
  }> {
    
    const modificationPrompt = this.createDynamicModificationPrompt(batchRequest);
    
    try {
      this.streamUpdate(`🚀 Sending batch modification request to Claude...`);
      
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 8000,
        temperature: 0.1,
        messages: [{ role: 'user', content: modificationPrompt }],
      });

      this.tokenTracker.logUsage(response.usage, 'Dynamic Batch Modification');

      const responseText = response.content[0]?.text || '';
      const modifiedFiles = this.extractModifiedFilesFromResponse(responseText, batchRequest.files);
      
      this.streamUpdate(`📥 Extracted ${modifiedFiles.length} modified files from Claude response`);
      
      return {
        success: modifiedFiles.length > 0,
        modifiedFiles
      };
      
    } catch (error) {
      this.streamUpdate(`❌ Error in batch modification: ${error}`);
      return { success: false, modifiedFiles: [] };
    }
  }

  /**
   * Create dynamic modification prompt
   */
  private createDynamicModificationPrompt(batchRequest: BatchModificationRequest): string {
    const { files, prompt, projectContext } = batchRequest;
    
    return `
DYNAMIC BATCH FILE MODIFICATION REQUEST

USER REQUEST: "${prompt}"

PROJECT CONTEXT:
- Type: ${projectContext.projectType}
- Framework: ${projectContext.framework}
- Total Files: ${projectContext.totalFiles}
- Main Files: ${projectContext.mainFiles.join(', ')}

PROJECT STRUCTURE:
${projectContext.fileTree}

MODIFICATION REQUIREMENTS:
1. Implement the user's requested changes across all relevant files
2. Maintain consistency with the detected project type and framework
3. Preserve all imports, exports, and existing functionality
4. Ensure type safety and proper syntax
5. Apply changes based on each file's change type and priority

FILES TO MODIFY (${files.length} files):

${files.map((file, index) => `
=== FILE ${index + 1}: ${file.filePath} ===
TYPE: ${file.fileType}
CHANGE TYPES: ${file.changeType.join(', ')}
PRIORITY: ${file.priority}

CURRENT CONTENT:
\`\`\`${this.getLanguageFromPath(file.filePath)}
${file.content}
\`\`\`
`).join('\n')}

RESPONSE FORMAT:
Return each modified file wrapped in code blocks with clear file path indicators:

\`\`\`${this.getLanguageFromPath(files[0]?.filePath || 'tsx')}
// FILE: ${files[0]?.filePath || 'path/to/file'}
[COMPLETE MODIFIED FILE CONTENT]
\`\`\`

\`\`\`${this.getLanguageFromPath(files[1]?.filePath || 'tsx')}
// FILE: ${files[1]?.filePath || 'path/to/file'}
[COMPLETE MODIFIED FILE CONTENT]
\`\`\`

Continue for all ${files.length} files. Each file must be complete and syntactically valid.

IMPORTANT: Return ALL files with their modifications, maintaining full file structure.
    `;
  }

  /**
   * Extract modified files from Claude's response
   */
  private extractModifiedFilesFromResponse(
    responseText: string,
    originalFiles: Array<{ filePath: string; content: string }>
  ): Array<{ filePath: string; modifiedContent: string }> {
    const modifiedFiles: Array<{ filePath: string; modifiedContent: string }> = [];
    
    // Enhanced regex to capture file path and content
    const codeBlockRegex = /```(?:\w+)?\s*\n(?:\/\/\s*FILE:\s*(.+?)\n)?([\s\S]*?)```/g;
    let match;
    let fileIndex = 0;
    
    while ((match = codeBlockRegex.exec(responseText)) !== null) {
      let filePath = match[1]?.trim();
      const modifiedContent = match[2].trim();
      
      // If no file path in comment, use original file order
      if (!filePath && fileIndex < originalFiles.length) {
        filePath = originalFiles[fileIndex].filePath;
      }
      
      if (filePath && modifiedContent) {
        modifiedFiles.push({
          filePath,
          modifiedContent
        });
        
        this.streamUpdate(`📝 Extracted modification for: ${filePath}`);
      }
      
      fileIndex++;
    }
    
    return modifiedFiles;
  }

  /**
   * Apply modifications to actual files and optionally update Redis
   */
  private async applyModificationsToFiles(
    modifiedFiles: Array<{ filePath: string; modifiedContent: string }>,
    projectPath: string,
    projectFiles: Map<string, ProjectFile>,
    updateRedis: boolean = false,
    redisClient?: any
  ): Promise<{
    successCount: number;
    changes: ChangeRecord[];
    modifiedFiles: string[];
  }> {
    let successCount = 0;
    const changes: ChangeRecord[] = [];
    const modifiedFilePaths: string[] = [];
    
    for (const { filePath, modifiedContent } of modifiedFiles) {
      try {
        const file = projectFiles.get(filePath);
        if (!file) {
          this.streamUpdate(`⚠️ File not found in project files: ${filePath}`);
          continue;
        }
        
        // Determine actual file path
        const actualFilePath = join(projectPath, filePath);
        
        // Ensure directory exists
        const dir = dirname(actualFilePath);
        await fs.mkdir(dir, { recursive: true });
        
        // Write the modified content to disk
        await fs.writeFile(actualFilePath, modifiedContent, 'utf8');
        
        // Update project file content in memory
        file.content = modifiedContent;
        file.lines = modifiedContent.split('\n').length;
        
        // Update Redis if enabled and client provided
        if (updateRedis && redisClient) {
          try {
            await this.updateRedisFile(redisClient, filePath, modifiedContent, projectPath);
            this.streamUpdate(`📝 Updated Redis for: ${filePath}`);
          } catch (redisError) {
            this.streamUpdate(`⚠️ Redis update failed for ${filePath}: ${redisError}`);
          }
        }
        
        successCount++;
        modifiedFilePaths.push(filePath);
        
        const change: ChangeRecord = {
          type: 'modified',
          file: filePath,
          description: `Successfully applied dynamic modification`,
          success: true,
          details: {
            linesChanged: file.lines,
            changeType: ['dynamic'],
            reasoning: 'Applied modifications based on Claude analysis'
          }
        };
        changes.push(change);
        
        this.streamUpdate(`✅ Applied modification to: ${filePath}`);
        
      } catch (error) {
        this.streamUpdate(`❌ Error applying modification to ${filePath}: ${error}`);
        
        const change: ChangeRecord = {
          type: 'failed',
          file: filePath,
          description: `Failed to apply modification: ${error}`,
          success: false
        };
        changes.push(change);
      }
    }
    
    return { successCount, changes, modifiedFiles: modifiedFilePaths };
  }

  private extractBuildIdFromPath(projectPath: string): string {
    if (!projectPath) return 'unknown';
    
    const pathParts = projectPath.replace(/\\/g, '/').split('/');
    
    // Look for temp-build pattern: /path/to/temp-build/{buildId}/src/...
    const tempBuildIndex = pathParts.findIndex(part => part === 'temp-build');
    if (tempBuildIndex >= 0 && tempBuildIndex < pathParts.length - 1) {
      return pathParts[tempBuildIndex + 1];
    }
    
    // Fallback: look for UUID-like pattern anywhere in path
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const part of pathParts) {
      if (uuidPattern.test(part)) {
        return part;
      }
    }
    
    return 'unknown';
  }

  private async updateRedisFile(
    redisClient: any,
    filePath: string,
    content: string,
    projectPath: string
  ): Promise<void> {
    if (!redisClient) return;
    
    try {
      // Extract build ID from project path
      const buildId = this.extractBuildIdFromPath(projectPath);
      
      // Update Redis with the new file content
      const redisKey = `build:${buildId}:files:${filePath}`;
      await redisClient.hset(redisKey, {
        content: content,
        lastModified: new Date().toISOString(),
        status: 'modified'
      });
      
      // Also update the build status
      const buildKey = `build:${buildId}:status`;
      await redisClient.hset(buildKey, {
        lastFileUpdate: new Date().toISOString(),
        modifiedFiles: JSON.stringify([filePath])
      });
      
    } catch (error) {
      throw new Error(`Redis update failed: ${error}`);
    }
  }

  /**
   * Process files with Redis integration
   */
  async processFullFileModificationWithRedis(
    prompt: string,
    folderNameOrProjectFiles: string | Map<string, ProjectFile>,
    redisClient: any,
    streamCallbackOrBasePath?: ((message: string) => void) | string,
    legacyStreamCallback?: (message: string) => void
  ): Promise<{
    success: boolean;
    changes?: ChangeRecord[];
    modifiedFiles?: string[];
  }> {
    // Process files normally first
    const result = await this.processFullFileModification(
      prompt,
      folderNameOrProjectFiles,
      streamCallbackOrBasePath,
      legacyStreamCallback
    );
    
    // If successful, update Redis
    if (result.success && result.changes && redisClient) {
      try {
        this.streamUpdate(`📝 Updating Redis with ${result.changes.length} changes...`);
        
        for (const change of result.changes) {
          if (change.success && change.type === 'modified') {
            await this.syncChangeToRedis(redisClient, change, folderNameOrProjectFiles);
          }
        }
        
        this.streamUpdate(`✅ Redis sync completed successfully`);
      } catch (error) {
        this.streamUpdate(`⚠️ Redis sync failed: ${error}`);
        // Don't fail the whole operation, just log the error
      }
    }
    
    return result;
  }

  /**
   * Sync individual change to Redis
   */
  private async syncChangeToRedis(
    redisClient: any,
    change: ChangeRecord,
    folderNameOrProjectFiles: string | Map<string, ProjectFile>
  ): Promise<void> {
    try {
      let buildId: string;
      
      if (typeof folderNameOrProjectFiles === 'string') {
        buildId = folderNameOrProjectFiles;
      } else {
        // Extract from Map
        const firstFile = Array.from(folderNameOrProjectFiles.values())[0];
        buildId = this.extractBuildIdFromPath(firstFile?.path || '');
      }
      
      // Update Redis with file change
      const redisKey = `build:${buildId}:file:${change.file}`;
      await redisClient.hset(redisKey, {
        status: 'modified',
        lastModified: new Date().toISOString(),
        changeType: change.details?.changeType?.join(',') || 'unknown',
        description: change.description
      });
      
      // Update build metadata
      const buildKey = `build:${buildId}:metadata`;
      await redisClient.hset(buildKey, {
        lastProcessed: new Date().toISOString(),
        lastFileModified: change.file,
        processingStatus: 'completed'
      });
      
      this.streamUpdate(`📝 Redis updated for: ${change.file}`);
      
    } catch (error) {
      throw new Error(`Failed to sync change to Redis: ${error}`);
    }
  }

  // Helper methods

  private shouldSkipFileOrDirectory(name: string): boolean {
    const skipPatterns = [
      'node_modules',
      '.git',
      '.next',
      '.nuxt',
      'dist',
      'build',
      '.cache',
      'coverage',
      '.nyc_output',
      '.DS_Store',
      'Thumbs.db'
    ];
    
    return skipPatterns.includes(name) || name.startsWith('.');
  }

  private isRelevantFile(fileName: string): boolean {
    const relevantExtensions = [
      '.tsx', '.ts', '.jsx', '.js',
      '.vue', '.svelte',
      '.css', '.scss', '.sass', '.less',
      '.json'
    ];
    
    return relevantExtensions.some(ext => fileName.endsWith(ext));
  }

  private isMainFile(fileName: string, relativePath: string): boolean {
    const mainPatterns = [
      /^App\.(tsx?|jsx?)$/,
      /^main\.(tsx?|jsx?)$/,
      /^index\.(tsx?|jsx?)$/,
      /src\/App\.(tsx?|jsx?)$/,
      /src\/main\.(tsx?|jsx?)$/,
      /src\/index\.(tsx?|jsx?)$/
    ];
    
    return mainPatterns.some(pattern => 
      pattern.test(fileName) || pattern.test(relativePath)
    );
  }

  private determineFileType(fileName: string, content: string): string {
    if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) {
      if (content.includes('export default')) return 'react-component';
      return 'react-module';
    }
    
    if (fileName.endsWith('.ts') || fileName.endsWith('.js')) {
      if (content.includes('export') || content.includes('import')) return 'module';
      return 'script';
    }
    
    if (fileName.endsWith('.vue')) return 'vue-component';
    if (fileName.endsWith('.svelte')) return 'svelte-component';
    if (fileName.endsWith('.css') || fileName.endsWith('.scss')) return 'stylesheet';
    if (fileName.endsWith('.json')) return 'config';
    
    return 'unknown';
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  private getFileIcon(fileName: string): string {
    if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) return '⚛️';
    if (fileName.endsWith('.ts') || fileName.endsWith('.js')) return '📜';
    if (fileName.endsWith('.vue')) return '💚';
    if (fileName.endsWith('.svelte')) return '🧡';
    if (fileName.endsWith('.css') || fileName.endsWith('.scss')) return '🎨';
    if (fileName.endsWith('.json')) return '⚙️';
    return '📄';
  }

  private inferFilePurpose(file: ProjectFile): string {
    const { relativePath, content, fileType } = file;
    
    if (file.isMainFile) return 'Main application entry point';
    
    if (relativePath.includes('component')) return 'UI Component';
    if (relativePath.includes('page')) return 'Application Page';
    if (relativePath.includes('layout')) return 'Layout Component';
    if (relativePath.includes('nav')) return 'Navigation Component';
    if (relativePath.includes('header')) return 'Header Component';
    if (relativePath.includes('footer')) return 'Footer Component';
    
    if (content.includes('useState') || content.includes('useEffect')) {
      return 'Interactive React Component';
    }
    
    if (content.includes('router') || content.includes('Router')) {
      return 'Routing Configuration';
    }
    
    return `${fileType} file`;
  }

  private detectProjectType(projectFiles: Map<string, ProjectFile>): string {
    const fileNames = Array.from(projectFiles.keys());
    
    if (fileNames.some(name => name.includes('package.json'))) {
      const packageFile = projectFiles.get('package.json');
      if (packageFile?.content.includes('react')) return 'React';
      if (packageFile?.content.includes('vue')) return 'Vue';
      if (packageFile?.content.includes('svelte')) return 'Svelte';
      if (packageFile?.content.includes('angular')) return 'Angular';
    }
    
    // Detect by file extensions
    if (fileNames.some(name => name.endsWith('.tsx') || name.endsWith('.jsx'))) {
      return 'React';
    }
    if (fileNames.some(name => name.endsWith('.vue'))) {
      return 'Vue';
    }
    if (fileNames.some(name => name.endsWith('.svelte'))) {
      return 'Svelte';
    }
    
    return 'JavaScript';
  }

  private detectFramework(projectFiles: Map<string, ProjectFile>): string {
    const fileNames = Array.from(projectFiles.keys());
    
    // Check for Next.js
    if (fileNames.some(name => name.includes('next.config'))) {
      return 'Next.js';
    }
    
    // Check for Vite
    if (fileNames.some(name => name.includes('vite.config'))) {
      return 'Vite';
    }
    
    // Check for Create React App
    if (fileNames.some(name => name.includes('public/index.html'))) {
      return 'Create React App';
    }
    
    // Check for Nuxt
    if (fileNames.some(name => name.includes('nuxt.config'))) {
      return 'Nuxt.js';
    }
    
    return 'Standard';
  }

  private getLanguageFromPath(filePath: string): string {
    if (filePath.endsWith('.tsx')) return 'tsx';
    if (filePath.endsWith('.jsx')) return 'jsx';
    if (filePath.endsWith('.ts')) return 'typescript';
    if (filePath.endsWith('.js')) return 'javascript';
    if (filePath.endsWith('.vue')) return 'vue';
    if (filePath.endsWith('.svelte')) return 'svelte';
    if (filePath.endsWith('.css')) return 'css';
    if (filePath.endsWith('.scss')) return 'scss';
    if (filePath.endsWith('.json')) return 'json';
    return 'text';
  }

  // Backward compatibility methods for existing code

  /**
   * Legacy method for compatibility with existing code
   * Now handles the case where Map is passed as folderName
   */
  async process(
    prompt: string,
    projectFiles: Map<string, ProjectFile>,
    reactBasePath: string,
    streamCallback: (message: string) => void
  ) {
    this.streamUpdate(`🔄 Legacy process method called`);
    this.streamUpdate(`📂 reactBasePath: ${reactBasePath}`);
    this.streamUpdate(`📊 projectFiles count: ${projectFiles?.size || 0}`);
    
    // Use the flexible processFullFileModification method
    return this.processFullFileModification(
      prompt,
      projectFiles,  // Pass the Map directly
      reactBasePath, // Pass reactBasePath as third parameter
      streamCallback // Pass callback as fourth parameter
    );
  }

  /**
   * Legacy method for compatibility
   * Now handles the case where Map is passed as folderName
   */
  async handleFullFileModification(
    prompt: string, 
    projectFiles: Map<string, ProjectFile>, 
    modificationSummary?: any
  ): Promise<boolean> {
    this.streamUpdate(`🔄 Legacy handleFullFileModification called`);
    this.streamUpdate(`📊 projectFiles count: ${projectFiles?.size || 0}`);
    
    // Use the flexible processFullFileModification method
    const result = await this.processFullFileModification(
      prompt,
      projectFiles,  // Pass the Map directly
      undefined,     // No reactBasePath
      (message: string) => this.streamUpdate(message)
    );
    
    return result.success;
  }

  /**
   * Get file tree as utility function
   */
  async getFileTree(dirPath: string, prefix = ''): Promise<string> {
    return this.generateFileTree(dirPath, prefix);
  }

  /**
   * Static utility method to generate file tree
   */
  static async generateFileTreeStatic(dirPath: string, prefix = ''): Promise<string> {
    const processor = new FullFileProcessor(null, {
      logUsage: () => {},
      getStats: () => ({ totalTokens: 0, estimatedCost: 0 })
    });
    
    return processor.generateFileTree(dirPath, prefix);
  }

  /**
   * Scan project files utility
   */
  async scanProjectFiles(projectPath: string): Promise<Map<string, ProjectFile>> {
    return this.loadProjectFiles(projectPath);
  }

  /**
   * Get project analysis with async path resolution
   */
  async analyzeProject(folderName: string): Promise<{
    fileTree: string;
    projectFiles: Map<string, ProjectFile>;
    projectType: string;
    framework: string;
    mainFiles: string[];
  }> {
    const projectPath = await this.resolveProjectPathAsync(folderName);
    const fileTree = await this.generateFileTree(projectPath);
    const projectFiles = await this.loadProjectFiles(projectPath);
    const projectType = this.detectProjectType(projectFiles);
    const framework = this.detectFramework(projectFiles);
    const mainFiles = Array.from(projectFiles.entries())
      .filter(([_, file]) => file.isMainFile)
      .map(([path, _]) => path);
    
    return {
      fileTree,
      projectFiles,
      projectType,
      framework,
      mainFiles
    };
  }

  /**
   * Enhanced method with file history consideration
   */
  async processWithHistory(
    prompt: string,
    folderName: string,
    fileHistory: Array<{ filePath: string; lastModified: Date; changeType: string[] }>,
    streamCallback?: (message: string) => void
  ): Promise<{
    success: boolean;
    changes?: ChangeRecord[];
    modifiedFiles?: string[];
  }> {
    // Initialize stream callback with proper fallback
    if (streamCallback && typeof streamCallback === 'function') {
      this.setStreamCallback(streamCallback);
    } else {
      this.setStreamCallback((message: string) => console.log(message));
    }
    
    this.streamUpdate(`🕒 Processing with file history consideration...`);
    
    // Get basic project analysis with async path resolution
    const analysis = await this.analyzeProject(folderName);
    
    // Enhanced file analysis prompt that includes history
    const historyContext = fileHistory.map(h => 
      `${h.filePath} - Last modified: ${h.lastModified.toISOString()}, Previous changes: ${h.changeType.join(', ')}`
    ).join('\n');
    
    const enhancedAnalysisPrompt = `
TASK: Analyze which files need modification considering file history and user request.

USER REQUEST: "${prompt}"

FILE HISTORY:
${historyContext}

PROJECT FILE TREE:
${analysis.fileTree}

AVAILABLE FILES:
${Array.from(analysis.projectFiles.entries())
  .map(([path, file]) => `${path} (${file.lines} lines) - ${this.inferFilePurpose(file)}`)
  .join('\n')}

INSTRUCTIONS:
1. Consider the file history to understand recent changes
2. Avoid modifying files that were recently changed unless directly related
3. Prioritize files that haven't been modified recently for safety
4. Select files based on the user request and logical dependencies

RESPONSE FORMAT:
Return a JSON array with file selections including history consideration:
[
  {
    "filePath": "path/to/file.tsx",
    "relevanceScore": 85,
    "reasoning": "This file needs modification because... (considering recent changes)",
    "changeType": ["styling", "layout"],
    "priority": "high",
    "historyImpact": "safe" | "cautious" | "risky"
  }
]

ANALYSIS:`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 4000,
        temperature: 0.1,
        messages: [{ role: 'user', content: enhancedAnalysisPrompt }],
      });

      this.tokenTracker.logUsage(response.usage, 'Enhanced File Selection with History');

      const responseText = response.content[0]?.text || '';
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        const analysisResults = JSON.parse(jsonMatch[0]);
        
        // Convert to FileAnalysisResult format
        const relevantFiles: FileAnalysisResult[] = analysisResults
          .filter((result: any) => analysis.projectFiles.has(result.filePath))
          .map((result: any) => ({
            filePath: result.filePath,
            file: analysis.projectFiles.get(result.filePath)!,
            relevanceScore: result.relevanceScore || 50,
            reasoning: `${result.reasoning} (History impact: ${result.historyImpact || 'unknown'})`,
            changeType: result.changeType || ['general'],
            priority: result.priority || 'medium'
          }));
        
        if (relevantFiles.length > 0) {
          // Continue with batch modification
          const batchRequest = this.prepareDynamicBatchRequest(
            prompt,
            relevantFiles,
            analysis.fileTree,
            analysis.projectFiles
          );
          
          const modificationResult = await this.executeDynamicBatchModification(batchRequest);
          
          const applyResult = await this.applyModificationsToFiles(
            modificationResult.modifiedFiles,
            await this.resolveProjectPathAsync(folderName),
            analysis.projectFiles
          );
          
          return {
            success: applyResult.successCount > 0,
            changes: applyResult.changes,
            modifiedFiles: applyResult.modifiedFiles
          };
        }
      }
      
      // Fallback to regular processing
      return this.processFullFileModification(prompt, folderName, streamCallback);
      
    } catch (error) {
      this.streamUpdate(`⚠️ History-enhanced analysis failed, falling back to regular processing: ${error}`);
      return this.processFullFileModification(prompt, folderName, streamCallback);
    }
  }
}