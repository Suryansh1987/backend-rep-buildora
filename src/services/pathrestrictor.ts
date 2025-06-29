// ============================================================================
// ENHANCED PATH RESTRICTION SYSTEM - Strict src/ Folder Only Modifications
// ============================================================================

import { promises as fs } from 'fs';
import { join, resolve, relative, normalize, sep, dirname } from 'path';
import { ProjectFile } from './filemodifier/types';

export class PathRestrictionManager {
  private reactBasePath: string;
  private srcPath: string;
  private streamCallback?: (message: string) => void;

  constructor(reactBasePath: string) {
    this.reactBasePath = resolve(reactBasePath);
    this.srcPath = join(this.reactBasePath, 'src');
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
   * CRITICAL: Validate that a path is within src/ folder only
   */
  validatePathInSrc(filePath: string): { isValid: boolean; normalizedPath: string; error?: string } {
    try {
      // Normalize and resolve the path
      const normalizedInput = normalize(filePath).replace(/\\/g, '/');
      let resolvedPath: string;

      // Handle different input formats
      if (normalizedInput.startsWith('src/')) {
        // Path starts with src/ - join with base
        resolvedPath = resolve(join(this.reactBasePath, normalizedInput));
      } else if (normalizedInput.startsWith('/') || normalizedInput.match(/^[A-Za-z]:/)) {
        // Absolute path - validate it's within our src folder
        resolvedPath = resolve(normalizedInput);
      } else {
        // Relative path - assume it's within src
        resolvedPath = resolve(join(this.srcPath, normalizedInput));
      }

      // CRITICAL CHECK: Ensure the resolved path is within src folder
      const relativePath = relative(this.srcPath, resolvedPath);
      
      // Check for path traversal attempts
      if (relativePath.startsWith('..') || relativePath.includes('..')) {
        return {
          isValid: false,
          normalizedPath: '',
          error: `Path traversal detected: ${filePath} resolves outside src folder`
        };
      }

      // Check if path is actually within src
      if (!resolvedPath.startsWith(this.srcPath + sep) && resolvedPath !== this.srcPath) {
        return {
          isValid: false,
          normalizedPath: '',
          error: `Path ${filePath} is outside src folder: ${resolvedPath}`
        };
      }

      // Return the validated path relative to project root
      const projectRelativePath = relative(this.reactBasePath, resolvedPath).replace(/\\/g, '/');
      
      this.streamUpdate(`✅ Path validated: ${filePath} → ${projectRelativePath}`);
      
      return {
        isValid: true,
        normalizedPath: projectRelativePath
      };

    } catch (error) {
      return {
        isValid: false,
        normalizedPath: '',
        error: `Path validation error: ${error}`
      };
    }
  }

  /**
   * ENHANCED: Safe file path resolution with strict src restriction
   */
  resolveSafeFilePath(relativePath: string): string | null {
    const validation = this.validatePathInSrc(relativePath);
    
    if (!validation.isValid) {
      this.streamUpdate(`❌ BLOCKED: ${validation.error}`);
      return null;
    }

    return join(this.reactBasePath, validation.normalizedPath);
  }

  /**
   * CRITICAL: Verify file exists and is within src before any operation
   */
  async verifyFileInSrc(filePath: string): Promise<{ isValid: boolean; resolvedPath?: string; error?: string }> {
    const safeResolvedPath = this.resolveSafeFilePath(filePath);
    
    if (!safeResolvedPath) {
      return {
        isValid: false,
        error: `Path ${filePath} is not within src folder or invalid`
      };
    }

    try {
      await fs.access(safeResolvedPath, fs.constants.R_OK | fs.constants.W_OK);
      
      this.streamUpdate(`✅ File verified in src: ${filePath} → ${safeResolvedPath}`);
      
      return {
        isValid: true,
        resolvedPath: safeResolvedPath
      };
    } catch (error) {
      return {
        isValid: false,
        error: `File not accessible: ${safeResolvedPath} - ${error}`
      };
    }
  }

  /**
   * CRITICAL: Safe write operation - only within src
   */
  async safeWriteFile(filePath: string, content: string): Promise<{ success: boolean; actualPath?: string; error?: string }> {
    this.streamUpdate(`🔒 SAFE WRITE: Attempting to write ${filePath}`);
    
    const verification = await this.verifyFileInSrc(filePath);
    
    if (!verification.isValid || !verification.resolvedPath) {
      this.streamUpdate(`❌ WRITE BLOCKED: ${verification.error}`);
      return {
        success: false,
        error: `Write blocked - ${verification.error}`
      };
    }

    try {
      // Ensure directory exists within src
      const fileDir = dirname(verification.resolvedPath);
      const dirValidation = this.validatePathInSrc(relative(this.reactBasePath, fileDir));
      
      if (!dirValidation.isValid) {
        return {
          success: false,
          error: `Directory outside src: ${fileDir}`
        };
      }

      await fs.mkdir(fileDir, { recursive: true });
      await fs.writeFile(verification.resolvedPath, content, 'utf8');
      
      this.streamUpdate(`✅ SAFE WRITE SUCCESS: ${verification.resolvedPath}`);
      
      return {
        success: true,
        actualPath: verification.resolvedPath
      };
    } catch (error) {
      this.streamUpdate(`❌ WRITE FAILED: ${error}`);
      return {
        success: false,
        error: `Write failed: ${error}`
      };
    }
  }

  /**
   * ENHANCED: Clean project file paths with validation
   */
  cleanProjectFilePaths(projectFiles: Map<string, ProjectFile>): Map<string, ProjectFile> {
    this.streamUpdate(`🧹 Cleaning ${projectFiles.size} project file paths...`);
    
    const cleanedFiles = new Map<string, ProjectFile>();
    let validFiles = 0;
    let invalidFiles = 0;

    for (const [relativePath, file] of projectFiles) {
      const validation = this.validatePathInSrc(relativePath);
      
      if (validation.isValid) {
        const safeAbsolutePath = this.resolveSafeFilePath(relativePath);
        
        if (safeAbsolutePath) {
          const cleanedFile: ProjectFile = {
            ...file,
            path: safeAbsolutePath,
            relativePath: validation.normalizedPath
          };
          
          cleanedFiles.set(validation.normalizedPath, cleanedFile);
          validFiles++;
        } else {
          this.streamUpdate(`⚠️ Skipped invalid path: ${relativePath}`);
          invalidFiles++;
        }
      } else {
        this.streamUpdate(`❌ Blocked invalid path: ${relativePath} - ${validation.error}`);
        invalidFiles++;
      }
    }

    this.streamUpdate(`✅ Path cleaning complete: ${validFiles} valid, ${invalidFiles} invalid/blocked`);
    
    return cleanedFiles;
  }

  /**
   * SECURITY: Check for suspicious file operations
   */
  detectSuspiciousActivity(filePath: string): { isSuspicious: boolean; reason?: string } {
    const suspiciousPatterns = [
      { pattern: /\.\./, reason: 'Path traversal attempt' },
      { pattern: /^\//, reason: 'Absolute path outside project' },
      { pattern: /^[A-Za-z]:/, reason: 'Windows absolute path' },
      { pattern: /node_modules/, reason: 'Attempting to modify node_modules' },
      { pattern: /\.git/, reason: 'Attempting to modify git files' },
      { pattern: /package\.json$/, reason: 'Attempting to modify package.json' },
      { pattern: /yarn\.lock$/, reason: 'Attempting to modify yarn.lock' },
      { pattern: /package-lock\.json$/, reason: 'Attempting to modify package-lock.json' },
      { pattern: /\.env/, reason: 'Attempting to modify environment files' },
      { pattern: /build\//, reason: 'Attempting to modify build directory' },
      { pattern: /dist\//, reason: 'Attempting to modify dist directory' }
    ];

    for (const { pattern, reason } of suspiciousPatterns) {
      if (pattern.test(filePath)) {
        this.streamUpdate(`🚨 SECURITY ALERT: ${reason} in path: ${filePath}`);
        return { isSuspicious: true, reason };
      }
    }

    return { isSuspicious: false };
  }

  /**
   * AUDIT: Log all file operations for security
   */
  auditFileOperation(operation: 'read' | 'write' | 'create', filePath: string, success: boolean): void {
    const timestamp = new Date().toISOString();
    const status = success ? 'SUCCESS' : 'FAILED';
    
    this.streamUpdate(`📋 AUDIT [${timestamp}]: ${operation.toUpperCase()} ${status} - ${filePath}`);
  }

  /**
   * UTILITY: Get safe src subdirectories
   */
  getAllowedSrcSubdirectories(): string[] {
    return [
      'src/components',
      'src/pages',
      'src/hooks',
      'src/utils',
      'src/styles',
      'src/assets',
      'src/services',
      'src/types',
      'src/constants',
      'src/context'
    ];
  }

  /**
   * VALIDATION: Ensure file is in allowed src subdirectory
   */
  isInAllowedDirectory(filePath: string): boolean {
    const allowedDirs = this.getAllowedSrcSubdirectories();
    const validation = this.validatePathInSrc(filePath);
    
    if (!validation.isValid) {
      return false;
    }

    // Check if file is directly in src or in an allowed subdirectory
    if (validation.normalizedPath === 'src' || validation.normalizedPath.startsWith('src/')) {
      return true;
    }

    return allowedDirs.some(dir => validation.normalizedPath.startsWith(dir));
  }
}

// ============================================================================
// UPDATED COMPONENT ADDITION PROCESSOR WITH STRICT PATH RESTRICTION
// ============================================================================

export class SafeComponentAdditionProcessor {
  private pathManager: PathRestrictionManager;
  private anthropic: any;
  private reactBasePath: string;
  private tokenTracker: any;
  private streamCallback?: (message: string) => void;

  constructor(anthropic: any, reactBasePath: string, tokenTracker: any) {
    this.anthropic = anthropic;
    this.reactBasePath = reactBasePath;
    this.tokenTracker = tokenTracker;
    this.pathManager = new PathRestrictionManager(reactBasePath);
  }

  setStreamCallback(callback: (message: string) => void): void {
    this.streamCallback = callback;
    this.pathManager.setStreamCallback(callback);
  }

  private streamUpdate(message: string): void {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
  }

  /**
   * ENHANCED: Safe component file creation
   */
  async createComponentSafely(
    componentName: string,
    componentType: 'component' | 'page',
    content: string
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    
    // Determine safe file path within src
    const subDir = componentType === 'page' ? 'pages' : 'components';
    const fileName = `${componentName}.tsx`;
    const relativePath = `src/${subDir}/${fileName}`;
    
    this.streamUpdate(`🔒 Creating ${componentType} safely: ${relativePath}`);
    
    // Validate path is safe
    const validation = this.pathManager.validatePathInSrc(relativePath);
    if (!validation.isValid) {
      return {
        success: false,
        error: `Invalid path: ${validation.error}`
      };
    }

    // Check for suspicious activity
    const suspiciousCheck = this.pathManager.detectSuspiciousActivity(relativePath);
    if (suspiciousCheck.isSuspicious) {
      return {
        success: false,
        error: `Suspicious activity detected: ${suspiciousCheck.reason}`
      };
    }

    // Ensure it's in allowed directory
    if (!this.pathManager.isInAllowedDirectory(relativePath)) {
      return {
        success: false,
        error: `Path not in allowed src subdirectory: ${relativePath}`
      };
    }

    // Safe write operation
    const writeResult = await this.pathManager.safeWriteFile(relativePath, content);
    
    if (writeResult.success) {
      this.pathManager.auditFileOperation('create', relativePath, true);
      return {
        success: true,
        filePath: writeResult.actualPath
      };
    } else {
      this.pathManager.auditFileOperation('create', relativePath, false);
      return {
        success: false,
        error: writeResult.error
      };
    }
  }

  /**
   * ENHANCED: Safe App.tsx update with strict validation
   */
  async updateAppSafely(
    projectFiles: Map<string, ProjectFile>,
    componentName: string,
    content: string
  ): Promise<{ success: boolean; updatedFiles?: string[]; error?: string }> {
    
    this.streamUpdate(`🔒 Updating App.tsx safely...`);
    
    // Find App.tsx in safe src paths only
    const appPaths = ['src/App.tsx', 'src/App.jsx'];
    let appFile: ProjectFile | undefined;
    let appPath: string | undefined;

    for (const path of appPaths) {
      const validation = this.pathManager.validatePathInSrc(path);
      if (validation.isValid) {
        appFile = projectFiles.get(validation.normalizedPath);
        if (appFile) {
          appPath = validation.normalizedPath;
          break;
        }
      }
    }

    if (!appFile || !appPath) {
      return {
        success: false,
        error: 'App.tsx not found in safe src paths'
      };
    }

    // Verify file exists and is safe
    const verification = await this.pathManager.verifyFileInSrc(appPath);
    if (!verification.isValid) {
      return {
        success: false,
        error: verification.error
      };
    }

    // Safe write operation
    const writeResult = await this.pathManager.safeWriteFile(appPath, content);
    
    if (writeResult.success) {
      this.pathManager.auditFileOperation('write', appPath, true);
      return {
        success: true,
        updatedFiles: [appPath]
      };
    } else {
      this.pathManager.auditFileOperation('write', appPath, false);
      return {
        success: false,
        error: writeResult.error
      };
    }
  }
}

// ============================================================================
// UPDATED FULL FILE PROCESSOR WITH PATH RESTRICTION
// ============================================================================

export class SafeFullFileProcessor {
  private pathManager: PathRestrictionManager;
  private anthropic: any;
  private tokenTracker: any;
  private streamCallback?: (message: string) => void;

  constructor(anthropic: any, tokenTracker: any, reactBasePath: string) {
    this.anthropic = anthropic;
    this.tokenTracker = tokenTracker;
    this.pathManager = new PathRestrictionManager(reactBasePath);
  }

  setStreamCallback(callback: (message: string) => void): void {
    this.streamCallback = callback;
    this.pathManager.setStreamCallback(callback);
  }

  private streamUpdate(message: string): void {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
  }

  /**
   * ENHANCED: Safe file modification
   */
  async modifyFileSafely(
    filePath: string,
    modifiedContent: string,
    projectFiles: Map<string, ProjectFile>
  ): Promise<{ success: boolean; actualPath?: string; error?: string }> {
    
    this.streamUpdate(`🔒 Modifying file safely: ${filePath}`);
    
    // Validate file is in project and safe
    const projectFile = projectFiles.get(filePath);
    if (!projectFile) {
      return {
        success: false,
        error: `File not found in project: ${filePath}`
      };
    }

    // Verify path safety
    const verification = await this.pathManager.verifyFileInSrc(filePath);
    if (!verification.isValid) {
      return {
        success: false,
        error: verification.error
      };
    }

    // Check for suspicious activity
    const suspiciousCheck = this.pathManager.detectSuspiciousActivity(filePath);
    if (suspiciousCheck.isSuspicious) {
      return {
        success: false,
        error: `Suspicious activity: ${suspiciousCheck.reason}`
      };
    }

    // Safe write operation
    const writeResult = await this.pathManager.safeWriteFile(filePath, modifiedContent);
    
    if (writeResult.success) {
      // Update project file in memory
      projectFile.content = modifiedContent;
      projectFile.lines = modifiedContent.split('\n').length;
      
      this.pathManager.auditFileOperation('write', filePath, true);
      
      return {
        success: true,
        actualPath: writeResult.actualPath
      };
    } else {
      this.pathManager.auditFileOperation('write', filePath, false);
      return {
        success: false,
        error: writeResult.error
      };
    }
  }
}

// ============================================================================
// UPDATED PROJECT ANALYZER WITH PATH RESTRICTION
// ============================================================================

export class SafeProjectAnalyzer {
  private pathManager: PathRestrictionManager;
  private reactBasePath: string;
  private streamCallback?: (message: string) => void;

  constructor(reactBasePath: string) {
    this.reactBasePath = reactBasePath;
    this.pathManager = new PathRestrictionManager(reactBasePath);
  }

  setStreamCallback(callback: (message: string) => void): void {
    this.streamCallback = callback;
    this.pathManager.setStreamCallback(callback);
  }

  private streamUpdate(message: string): void {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
  }

  /**
   * ENHANCED: Safe project tree building - src only
   */
  async buildProjectTreeSafely(projectFiles: Map<string, ProjectFile>): Promise<void> {
    this.streamUpdate('🔒 Building project tree safely - src folder only...');
    
    const srcPath = join(this.reactBasePath, 'src');
    
    try {
      await fs.access(srcPath);
      this.streamUpdate('✅ src directory verified');
    } catch (error) {
      throw new Error(`src directory not accessible: ${srcPath}`);
    }

    projectFiles.clear();
    let scannedFiles = 0;
    let validFiles = 0;
    let blockedFiles = 0;

    const scanSrcOnly = async (dir: string, relativePath: string = ''): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          const relPath = relativePath ? join(relativePath, entry.name) : entry.name;
          const srcRelativePath = `src/${relPath}`;
          
          // Validate every path
          const validation = this.pathManager.validatePathInSrc(srcRelativePath);
          if (!validation.isValid) {
            this.streamUpdate(`❌ BLOCKED: ${validation.error}`);
            blockedFiles++;
            continue;
          }

          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            // Only scan allowed subdirectories
            if (this.pathManager.isInAllowedDirectory(srcRelativePath)) {
              await scanSrcOnly(fullPath, relPath);
            } else {
              this.streamUpdate(`⏭️ Skipping non-allowed directory: ${srcRelativePath}`);
            }
          } else if (entry.isFile() && /\.(js|jsx|ts|tsx)$/.test(entry.name)) {
            scannedFiles++;
            
            // Additional safety checks
            const suspiciousCheck = this.pathManager.detectSuspiciousActivity(srcRelativePath);
            if (suspiciousCheck.isSuspicious) {
              this.streamUpdate(`🚨 BLOCKED suspicious file: ${srcRelativePath}`);
              blockedFiles++;
              continue;
            }

            // Safe file analysis
            const analysisResult = await this.analyzeFileSafely(fullPath, validation.normalizedPath);
            if (analysisResult) {
              projectFiles.set(validation.normalizedPath, analysisResult);
              validFiles++;
              this.streamUpdate(`✅ Added safe file: ${validation.normalizedPath}`);
            } else {
              blockedFiles++;
            }
          }
        }
      } catch (error) {
        this.streamUpdate(`⚠️ Error scanning directory ${dir}: ${error}`);
      }
    };

    await scanSrcOnly(srcPath);
    
    this.streamUpdate(`🔒 Safe project analysis complete:`);
    this.streamUpdate(`   Scanned: ${scannedFiles} files`);
    this.streamUpdate(`   Valid: ${validFiles} files`);
    this.streamUpdate(`   Blocked: ${blockedFiles} files`);
    this.streamUpdate(`   Total in cache: ${projectFiles.size} files`);
  }

  /**
   * SAFE: Analyze individual file
   */
  private async analyzeFileSafely(filePath: string, relativePath: string): Promise<ProjectFile | null> {
    try {
      const verification = await this.pathManager.verifyFileInSrc(relativePath);
      if (!verification.isValid) {
        return null;
      }

      const content = await fs.readFile(filePath, 'utf8');
      const stats = await fs.stat(filePath);
      const lines = content.split('\n');
      
      return {
        name: require('path').basename(filePath),
        path: filePath,
        relativePath,
        content,
        lines: lines.length,
        size: stats.size,
        snippet: lines.slice(0, 15).join('\n'),
        componentName: this.extractComponentName(content),
        hasButtons: /button|Button/i.test(content),
        hasSignin: /signin|login/i.test(content),
        isMainFile: /App\.(tsx|jsx)$/.test(filePath)
      };
    } catch (error) {
      this.streamUpdate(`❌ Failed to analyze ${relativePath}: ${error}`);
      return null;
    }
  }

  private extractComponentName(content: string): string {
    const match = content.match(/(?:function|const)\s+([A-Z]\w+)/);
    return match ? match[1] : 'Unknown';
  }
}