// ============================================================================
// UPGRADED FULL FILE PROCESSOR - WITH PROVEN PATH RESOLUTION
// ============================================================================

import { join, basename, dirname, resolve, relative, isAbsolute } from 'path';
import { promises as fs } from 'fs';
import {fullFilePrompt} from '../filemodifier/template'
// ============================================================================
// UPGRADED PATH MANAGER (Inspired by FixedPathManager)
// ============================================================================

class UpgradedPathManager {
  private reactBasePath: string;
  private streamCallback?: (message: string) => void;

  constructor(reactBasePath: string) {
    // Clean any path issues and resolve
    this.reactBasePath = resolve(reactBasePath.replace(/builddora/g, 'buildora'));
  }

  setStreamCallback(callback: (message: string) => void): void {
    this.streamCallback = callback;
  }

  private streamUpdate(message: string): void {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
  }

  /**
   * CRITICAL UPGRADE: Enhanced file path resolution
   * - Never tries to open directories as files
   * - Properly handles existing vs new files
   * - Clean path normalization
   */
  resolveFilePath(inputPath: string, ensureExists: boolean = false): string {
    // Clean the input path
    let cleanPath = inputPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    
    // Remove any leading 'src/' if it's doubled up
    cleanPath = cleanPath.replace(/^src\/src\//, 'src/');
    
    // Ensure it starts with src/ if it doesn't already (for relative paths)
    if (!cleanPath.startsWith('src/') && !isAbsolute(cleanPath)) {
      cleanPath = `src/${cleanPath}`;
    }

    // Build the full path
    const fullPath = isAbsolute(cleanPath) ? 
      resolve(cleanPath) : 
      resolve(join(this.reactBasePath, cleanPath));
    
    this.streamUpdate(`📍 Resolved file path: ${inputPath} → ${fullPath}`);
    
    return fullPath;
  }

  /**
   * UPGRADED: Find existing file with multiple search strategies
   */
  async findExistingFile(inputPath: string): Promise<string | null> {
    const searchPaths = [
      // Try exact path
      this.resolveFilePath(inputPath),
      // Try with src/ prefix
      this.resolveFilePath(`src/${inputPath.replace(/^src\//, '')}`),
      // Try without src/ prefix if it has one
      this.resolveFilePath(inputPath.replace(/^src\//, '')),
      // Try different extension combinations
      this.resolveFilePath(inputPath.replace(/\.(tsx?|jsx?)$/, '') + '.tsx'),
      this.resolveFilePath(inputPath.replace(/\.(tsx?|jsx?)$/, '') + '.jsx'),
    ];

    for (const searchPath of searchPaths) {
      try {
        const stats = await fs.stat(searchPath);
        if (stats.isFile()) {
          this.streamUpdate(`📍 Found existing file: ${inputPath} → ${searchPath}`);
          return searchPath;
        }
      } catch (error) {
        // Continue searching
      }
    }

    this.streamUpdate(`❌ File not found: ${inputPath}`);
    return null;
  }

  /**
   * SAFE: Update existing file (ONLY write to existing files)
   */
  async safeUpdateFile(filePath: string, content: string): Promise<{ success: boolean; actualPath?: string; error?: string }> {
    try {
      // Find the existing file first
      const existingFilePath = await this.findExistingFile(filePath);
      
      if (!existingFilePath) {
        return {
          success: false,
          error: `File does not exist: ${filePath}`
        };
      }
      
      // Verify it's actually a file
      const stats = await fs.stat(existingFilePath);
      if (!stats.isFile()) {
        return {
          success: false,
          error: `Path exists but is not a file: ${existingFilePath}`
        };
      }
      
      this.streamUpdate(`🔄 Updating existing file: ${existingFilePath}`);
      await fs.writeFile(existingFilePath, content, 'utf8');
      
      // Verify the update
      const newStats = await fs.stat(existingFilePath);
      this.streamUpdate(`✅ File updated successfully: ${existingFilePath} (${newStats.size} bytes)`);
      
      return {
        success: true,
        actualPath: existingFilePath
      };
    } catch (error) {
      this.streamUpdate(`❌ File update failed: ${error}`);
      return {
        success: false,
        error: `Failed to update file: ${error}`
      };
    }
  }

  /**
   * SAFE: Create new file with proper directory handling
   */
  async safeCreateFile(filePath: string, content: string): Promise<{ success: boolean; actualPath?: string; error?: string }> {
    try {
      // Get the FULL FILE PATH (not directory)
      const fullFilePath = this.resolveFilePath(filePath);
      
      // Get the DIRECTORY containing the file
      const directoryPath = dirname(fullFilePath);
      
      this.streamUpdate(`📁 Creating directory: ${directoryPath}`);
      await fs.mkdir(directoryPath, { recursive: true });
      
      this.streamUpdate(`💾 Writing file: ${fullFilePath}`);
      await fs.writeFile(fullFilePath, content, 'utf8');
      
      // Verify the file was created
      const stats = await fs.stat(fullFilePath);
      this.streamUpdate(`✅ File created successfully: ${fullFilePath} (${stats.size} bytes)`);
      
      return {
        success: true,
        actualPath: fullFilePath
      };
    } catch (error) {
      this.streamUpdate(`❌ File creation failed: ${error}`);
      return {
        success: false,
        error: `Failed to create file: ${error}`
      };
    }
  }

  /**
   * Read file content safely
   */
  async readFile(filePath: string): Promise<string | null> {
    try {
      const existingFilePath = await this.findExistingFile(filePath);
      if (!existingFilePath) {
        this.streamUpdate(`❌ File not found for reading: ${filePath}`);
        return null;
      }

      const content = await fs.readFile(existingFilePath, 'utf8');
      this.streamUpdate(`📖 Read file: ${existingFilePath} (${content.length} chars)`);
      return content;
    } catch (error) {
      this.streamUpdate(`❌ Failed to read file ${filePath}: ${error}`);
      return null;
    }
  }
}

// ============================================================================
// TYPE DEFINITIONS (Enhanced)
// ============================================================================

interface ProjectFile {
  path: string;
  relativePath: string;
  content: string;
  lines: number;
  isMainFile: boolean;
  fileType: string;
  lastModified?: Date;
}

interface FileAnalysisResult {
  filePath: string;
  file: ProjectFile;
  relevanceScore: number;
  reasoning: string;
  changeType: string[];
  priority: 'high' | 'medium' | 'low';
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

interface TokenTracker {
  logUsage(usage: any, description: string): void;
  getStats(): { totalTokens: number; estimatedCost: number };
}

// ============================================================================
// ENHANCED FILE ANALYZER
// ============================================================================

class EnhancedFileAnalyzer {
  private anthropic: any;

  constructor(anthropic: any) {
    this.anthropic = anthropic;
  }

  async analyzeFiles(
    prompt: string,
    projectFiles: Map<string, ProjectFile>
  ): Promise<FileAnalysisResult[]> {
    
    // Create detailed file summaries
    const fileSummaries = Array.from(projectFiles.entries())
      .map(([path, file]) => {
        const purpose = this.inferFilePurpose(file);
        const preview = file.content.substring(0, 200).replace(/\n/g, ' ');
        return `${path} (${file.lines} lines) - ${purpose}\n  Preview: ${preview}...`;
      })
      .join('\n\n');
    
    const analysisPrompt = `
TASK: Analyze which files need modification for the user request.

USER REQUEST: "${prompt}"

AVAILABLE FILES:
${fileSummaries}

INSTRUCTIONS:
1. Select ONLY files that need modification
2. Be selective - don't modify unnecessary files
3. Focus on main components and relevant files
4. For layout changes: select all components and pages (not app.tsx unless routing)
5. For color/styling changes: select all components and pages (not app.tsx)
6. For functionality changes: select relevant components and any config files
7. Provide clear reasoning for each selection

RESPONSE FORMAT:
Return a JSON array:
[
  {
    "filePath": "src/App.tsx",
    "relevanceScore": 85,
    "reasoning": "This file needs modification because...",
    "changeType": ["styling", "layout"],
    "priority": "high"
  }
]

ANALYSIS:`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 4000,
        temperature: 0.1,
        messages: [{ role: 'user', content: analysisPrompt }],
      });

      const responseText = response.content[0]?.text || '';
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      
      if (!jsonMatch) {
        return this.getFallbackFileSelection(prompt, projectFiles);
      }
      
      const analysisResults = JSON.parse(jsonMatch[0]);
      
      const relevantFiles: FileAnalysisResult[] = [];
      
      for (const result of analysisResults) {
        const file = this.findFileInProject(result.filePath, projectFiles);
        if (file) {
          relevantFiles.push({
            filePath: result.filePath,
            file,
            relevanceScore: result.relevanceScore || 50,
            reasoning: result.reasoning || 'Selected by analysis',
            changeType: result.changeType || ['general'],
            priority: result.priority || 'medium'
          });
        }
      }
      
      return relevantFiles;
      
    } catch (error) {
      return this.getFallbackFileSelection(prompt, projectFiles);
    }
  }

  private findFileInProject(filePath: string, projectFiles: Map<string, ProjectFile>): ProjectFile | null {
    // Try exact match first
    let file = projectFiles.get(filePath);
    if (file) return file;

    // Try variations
    const variations = [
      filePath.replace(/^src\//, ''),
      `src/${filePath.replace(/^src\//, '')}`,
      filePath.replace(/\\/g, '/'),
      filePath.replace(/\//g, '\\')
    ];

    for (const variation of variations) {
      file = projectFiles.get(variation);
      if (file) return file;
    }

    // Try basename matching
    const fileName = basename(filePath);
    for (const [key, value] of projectFiles) {
      if (basename(key) === fileName) {
        return value;
      }
    }

    return null;
  }

  private getFallbackFileSelection(
    prompt: string,
    projectFiles: Map<string, ProjectFile>
  ): FileAnalysisResult[] {
    const relevantFiles: FileAnalysisResult[] = [];
    
    // Enhanced fallback: select files based on prompt analysis
    const promptLower = prompt.toLowerCase();
    
    for (const [filePath, file] of projectFiles) {
      let relevanceScore = 0;
      const changeTypes: string[] = [];
      
      // Main files get higher priority
      if (file.isMainFile || filePath.includes('App.')) {
        relevanceScore += 30;
        changeTypes.push('main');
      }
      
      // Styling-related keywords
      if (promptLower.includes('color') || promptLower.includes('style') || 
          promptLower.includes('theme') || promptLower.includes('design')) {
        if (filePath.includes('component') || filePath.includes('page')) {
          relevanceScore += 40;
          changeTypes.push('styling');
        }
      }
      
      // Layout-related keywords
      if (promptLower.includes('layout') || promptLower.includes('grid') || 
          promptLower.includes('responsive') || promptLower.includes('flex')) {
        if (filePath.includes('component') || filePath.includes('page')) {
          relevanceScore += 40;
          changeTypes.push('layout');
        }
      }
      
      // Component-specific keywords
      if (promptLower.includes('component') || promptLower.includes('button') || 
          promptLower.includes('form') || promptLower.includes('modal')) {
        if (filePath.includes('component')) {
          relevanceScore += 50;
          changeTypes.push('component');
        }
      }
      
      if (relevanceScore > 30) {
        relevantFiles.push({
          filePath,
          file,
          relevanceScore,
          reasoning: `Fallback selection based on keywords: ${changeTypes.join(', ')}`,
          changeType: changeTypes.length > 0 ? changeTypes : ['general'],
          priority: relevanceScore > 60 ? 'high' : relevanceScore > 40 ? 'medium' : 'low'
        });
      }
    }
    
    // If no files selected, select main files
    if (relevantFiles.length === 0) {
      for (const [filePath, file] of projectFiles) {
        if (file.isMainFile) {
          relevantFiles.push({
            filePath,
            file,
            relevanceScore: 70,
            reasoning: 'Main application file (emergency fallback)',
            changeType: ['general'],
            priority: 'high'
          });
        }
      }
    }
    
    return relevantFiles;
  }

  private inferFilePurpose(file: ProjectFile): string {
    if (file.isMainFile) return 'Main application file';
    if (file.relativePath.includes('component')) return 'UI Component';
    if (file.relativePath.includes('page')) return 'Application Page';
    if (file.relativePath.includes('hook')) return 'Custom Hook';
    if (file.relativePath.includes('util')) return 'Utility Module';
    if (file.relativePath.includes('service')) return 'Service Module';
    if (file.relativePath.includes('context')) return 'Context Provider';
    return `${file.fileType} file`;
  }
}

// ============================================================================
// ENHANCED CONTENT GENERATOR
// ============================================================================

class EnhancedContentGenerator {
  private anthropic: any;

  constructor(anthropic: any) {
    this.anthropic = anthropic;
  }

 async generateModifications(
  prompt: string,
  relevantFiles: FileAnalysisResult[]
): Promise<Array<{ filePath: string; modifiedContent: string }>> {
  
  const modificationPrompt = `
🚧 TASK OVERVIEW:
You are an expert TypeScript and React engineer. Modify the provided files according to the user's request while following best practices and avoiding errors related to unresolved imports, types, or external dependencies.

👤 USER REQUEST:
"${prompt}"

🗂️ FILES TO MODIFY:

${relevantFiles.map((result, index) => `
=== FILE ${index + 1}: ${result.filePath} ===
CHANGE TYPES: ${result.changeType.join(', ')}
PRIORITY: ${result.priority}
REASONING: ${result.reasoning}

CURRENT CONTENT:
\`\`\`tsx
${result.file.content}
\`\`\`
`).join('\n')}

📏 STRICT INSTRUCTIONS:
1. Only modify the files listed above. Do NOT assume or use any files not listed.
2. If a file imports types, components, or utilities from another file that is NOT listed, you MUST:
   - Recreate the missing type locally in the file.
   - Recreate minimal versions of utilities/components **inline** inside the component or page as needed.
   - Do NOT import from unknown paths — no assumptions allowed.
3. If a type/interface is missing, define it inline at the top or near usage. Keep definitions minimal but correct.
4. Maintain TypeScript syntax correctness at all times.
5. Do not use styled-components. You MUST use **Tailwind CSS** classes for styling.
6. Keep the structure of existing components, props, and imports unless change is required by the prompt.
7. Ensure the UI remains **responsive** and **accessible**.
8. Do NOT add any new external dependencies.
9. DO NOT generate relative imports for files that are not included in the list.
10. If you must extract logic or a helper function, define it inside the same file — do NOT assume separate utility files.

📦 RESPONSE FORMAT:
Return each modified file in clearly marked code blocks:

\\\tsx
// FILE: ${relevantFiles[0]?.filePath}
[COMPLETE MODIFIED CONTENT]
\\\

Continue for all files. Be sure to include the FILE comment for each..
`;

  try {
    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 8000,
      temperature: 0.1,
      messages: [{ role: 'user', content: modificationPrompt }],
      system:fullFilePrompt
        });

    const responseText = response.content[0]?.text || '';
    return this.extractModifiedFiles(responseText, relevantFiles);
    
  } catch (error) {
    console.error('Error generating modifications:', error);
    return [];
  }
}


  private extractModifiedFiles(
    responseText: string,
    originalFiles: FileAnalysisResult[]
  ): Array<{ filePath: string; modifiedContent: string }> {
    const modifiedFiles: Array<{ filePath: string; modifiedContent: string }> = [];
    
    // Enhanced regex to capture file paths and content
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
        // Clean up the file path
        filePath = filePath.replace(/^["']|["']$/g, ''); // Remove quotes
        
        modifiedFiles.push({
          filePath,
          modifiedContent
        });
      }
      
      fileIndex++;
    }
    
    return modifiedFiles;
  }
}

// ============================================================================
// MAIN UPGRADED PROCESSOR
// ============================================================================

export class FullFileProcessor {
  private anthropic: any;
  private tokenTracker: TokenTracker;
  private streamCallback?: (message: string) => void;
  private basePath: string;

  private pathManager: UpgradedPathManager;
  private analyzer: EnhancedFileAnalyzer;
  private generator: EnhancedContentGenerator;

  constructor(anthropic: any, tokenTracker: TokenTracker, basePath?: string) {
    this.anthropic = anthropic;
    this.tokenTracker = tokenTracker;
    // Clean any path issues
    this.basePath = (basePath || process.cwd()).replace(/builddora/g, 'buildora');

    this.pathManager = new UpgradedPathManager(this.basePath);
    this.analyzer = new EnhancedFileAnalyzer(anthropic);
    this.generator = new EnhancedContentGenerator(anthropic);
  }

  setStreamCallback(callback: (message: string) => void): void {
    this.streamCallback = callback;
    this.pathManager.setStreamCallback(callback);
  }

  private streamUpdate(message: string): void {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
    console.log(message);
  }

  /**
   * MAIN PROCESSING METHOD - With Upgraded Path Handling
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

    this.streamUpdate('🚀 UPGRADED: Starting file modification with enhanced path handling...');

    try {
      // Handle different calling patterns
      let projectFiles: Map<string, ProjectFile>;
      let actualBasePath: string;

      if (typeof folderNameOrProjectFiles === 'string') {
        // Load from folder name
        const folderName = folderNameOrProjectFiles;
        actualBasePath = this.resolveProjectPath(folderName);
        projectFiles = await this.loadProjectFiles(actualBasePath);
      } else {
        // Use provided project files
        projectFiles = folderNameOrProjectFiles;
        actualBasePath = typeof streamCallbackOrBasePath === 'string' 
          ? streamCallbackOrBasePath 
          : this.basePath;
      }

      // Set up stream callback
      const actualCallback = typeof streamCallbackOrBasePath === 'function' 
        ? streamCallbackOrBasePath 
        : legacyStreamCallback;
      
      if (actualCallback) {
        this.setStreamCallback(actualCallback);
      }

      this.streamUpdate(`📁 Working with ${projectFiles.size} files`);
      this.streamUpdate(`📂 Base path: ${actualBasePath}`);

      // Update path manager with correct base path
      this.pathManager = new UpgradedPathManager(actualBasePath);
      this.pathManager.setStreamCallback(this.streamCallback || (() => {}));

      // STEP 1: Enhanced analysis
      this.streamUpdate('🔍 Step 1: Enhanced file analysis...');
      const relevantFiles = await this.analyzer.analyzeFiles(prompt, projectFiles);
      
      if (relevantFiles.length === 0) {
        this.streamUpdate('❌ No relevant files identified');
        return { success: false };
      }

      this.streamUpdate(`✅ Selected ${relevantFiles.length} files for modification`);
      relevantFiles.forEach(file => {
        this.streamUpdate(`   📝 ${file.filePath} (${file.priority} priority) - ${file.reasoning}`);
      });

      // STEP 2: Enhanced content generation
      this.streamUpdate('🎨 Step 2: Enhanced content generation...');
      const modifiedFiles = await this.generator.generateModifications(prompt, relevantFiles);
      
      if (modifiedFiles.length === 0) {
        this.streamUpdate('❌ No modifications generated');
        return { success: false };
      }

      this.streamUpdate(`✅ Generated ${modifiedFiles.length} file modifications`);

      // STEP 3: Apply modifications using UPGRADED method
      this.streamUpdate('💾 Step 3: Applying modifications with upgraded path handling...');
      const applyResult = await this.applyModificationsWithUpgradedMethod(
        modifiedFiles, 
        projectFiles
      );

      this.streamUpdate(`🎉 SUCCESS! Applied ${applyResult.successCount}/${modifiedFiles.length} modifications`);

      return {
        success: applyResult.successCount > 0,
        changes: applyResult.changes,
        modifiedFiles: applyResult.modifiedFiles
      };

    } catch (error) {
      this.streamUpdate(`❌ Processing failed: ${error}`);
      return { success: false };
    }
  }

  /**
   * UPGRADED METHOD: Apply modifications with enhanced file handling
   */
  private async applyModificationsWithUpgradedMethod(
    modifiedFiles: Array<{ filePath: string; modifiedContent: string }>,
    projectFiles: Map<string, ProjectFile>
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
        this.streamUpdate(`🔧 Processing: ${filePath}`);

        // Use the upgraded path manager to update the file
        const updateResult = await this.pathManager.safeUpdateFile(filePath, modifiedContent);

        if (updateResult.success) {
          // Update project file in memory
          const existingFile = this.analyzer['findFileInProject'](filePath, projectFiles);
          if (existingFile) {
            existingFile.content = modifiedContent;
            existingFile.lines = modifiedContent.split('\n').length;
          }

          successCount++;
          modifiedFilePaths.push(filePath);

          changes.push({
            type: 'modified',
            file: filePath,
            description: 'Successfully updated with enhanced path handling',
            success: true,
            details: {
              linesChanged: modifiedContent.split('\n').length,
              changeType: ['update'],
              reasoning: 'Updated using upgraded path manager'
            }
          });

          this.streamUpdate(`✅ Successfully updated: ${updateResult.actualPath}`);

        } else {
          this.streamUpdate(`❌ Failed to update ${filePath}: ${updateResult.error}`);
          changes.push({
            type: 'failed',
            file: filePath,
            description: updateResult.error || 'Update failed',
            success: false
          });
        }

      } catch (error) {
        this.streamUpdate(`❌ Error processing ${filePath}: ${error}`);
        
        changes.push({
          type: 'failed',
          file: filePath,
          description: `Error: ${error}`,
          success: false
        });
      }
    }

    return { successCount, changes, modifiedFiles: modifiedFilePaths };
  }

  /**
   * Helper methods (enhanced)
   */
  private resolveProjectPath(folderName: string): string {
    if (isAbsolute(folderName)) {
      return folderName.replace(/builddora/g, 'buildora');
    }
    const cleanBasePath = process.cwd().replace(/builddora/g, 'buildora');
    return resolve(join(cleanBasePath, 'temp-builds', folderName));
  }

  private async loadProjectFiles(projectPath: string): Promise<Map<string, ProjectFile>> {
    const projectFiles = new Map<string, ProjectFile>();
    
    const scanDirectory = async (dir: string, baseDir: string = projectPath): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          const relativePath = relative(baseDir, fullPath).replace(/\\/g, '/');
          
          if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
            await scanDirectory(fullPath, baseDir);
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
                fileType: this.determineFileType(entry.name),
                lastModified: stats.mtime
              };
              
              projectFiles.set(relativePath, projectFile);
              
            } catch (readError) {
              this.streamUpdate(`⚠️ Could not read file: ${relativePath}`);
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

  private shouldSkipDirectory(name: string): boolean {
    const skipPatterns = ['node_modules', '.git', '.next', 'dist', 'build'];
    return skipPatterns.includes(name) || name.startsWith('.');
  }

  private isRelevantFile(fileName: string): boolean {
    const extensions = ['.tsx', '.ts', '.jsx', '.js', '.css', '.json'];
    return extensions.some(ext => fileName.endsWith(ext));
  }

  private isMainFile(fileName: string, relativePath: string): boolean {
    return fileName === 'App.tsx' || fileName === 'App.jsx' || 
           relativePath.includes('App.') || fileName === 'index.tsx';
  }

  private determineFileType(fileName: string): string {
    if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) return 'react-component';
    if (fileName.endsWith('.ts') || fileName.endsWith('.js')) return 'module';
    if (fileName.endsWith('.css')) return 'stylesheet';
    if (fileName.endsWith('.json')) return 'config';
    return 'unknown';
  }

  // ============================================================================
  // BACKWARD COMPATIBILITY METHODS
  // ============================================================================

  /**
   * Legacy method for compatibility
   */
  async process(
    prompt: string,
    projectFiles: Map<string, ProjectFile>,
    reactBasePath: string,
    streamCallback: (message: string) => void
  ) {
    this.streamUpdate('🔄 Legacy process method called');
    return this.processFullFileModification(
      prompt,
      projectFiles,
      reactBasePath,
      streamCallback
    );
  }

  /**
   * Legacy method for compatibility
   */
  async handleFullFileModification(
    prompt: string, 
    projectFiles: Map<string, ProjectFile>, 
    modificationSummary?: any
  ): Promise<boolean> {
    this.streamUpdate('🔄 Legacy handleFullFileModification called');
    const result = await this.processFullFileModification(
      prompt,
      projectFiles,
      undefined,
      (message: string) => this.streamUpdate(message)
    );
    return result.success;
  }
}