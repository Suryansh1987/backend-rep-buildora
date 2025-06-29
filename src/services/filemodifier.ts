// services/filemodifier-build-aware.ts - FIXED VERSION
import Anthropic from '@anthropic-ai/sdk';
import { 
  ProjectFile, 
  ASTNode, 
  ModificationResult, 
  ModificationScope,
  ModificationChange
} from './filemodifier/types';
import { ScopeAnalyzer } from './filemodifier/scopeanalyzer';
import { ComponentGenerationSystem } from './filemodifier/component';
import { DependencyManager } from './filemodifier/dependancy';
import { FallbackMechanism } from './filemodifier/fallback';

// Import modular processors
import { ASTAnalyzer } from './processor/Astanalyzer';
import { ProjectAnalyzer } from './processor/projectanalyzer';
import { FullFileProcessor } from './processor/Fullfileprocessor';
import { TargetedNodesProcessor } from './processor/TargettedNodes';
import { ComponentAdditionProcessor } from './processor/ComponentAddition';
import { TokenTracker } from '../utils/TokenTracer';
import { RedisService } from './Redis';
import { RedisModificationSummary } from './filemodifier/modification';
import { promises as fs } from 'fs';
import * as path from 'path';

export class StatelessIntelligentFileModifier {
  private anthropic: Anthropic;
  private reactBasePath: string;
  private sessionId: string;
  private streamCallback?: (message: string) => void;
  
  // Redis and components
  private redis: RedisService;
  private scopeAnalyzer!: ScopeAnalyzer;
  private componentGenerationSystem!: ComponentGenerationSystem;
  private dependencyManager!: DependencyManager;
  private fallbackMechanism!: FallbackMechanism;

  // Processors
  private astAnalyzer!: ASTAnalyzer;
  private projectAnalyzer!: ProjectAnalyzer;
  private fullFileProcessor!: FullFileProcessor;
  private targetedNodesProcessor!: TargetedNodesProcessor;
  private componentAdditionProcessor!: ComponentAdditionProcessor;
  private tokenTracker!: TokenTracker;

  constructor(
    anthropic: Anthropic, 
    reactBasePath: string,
    sessionId: string, 
    redisUrl?: string
  ) {
    this.anthropic = anthropic;
    this.reactBasePath = reactBasePath;
    this.sessionId = sessionId;
    this.redis = new RedisService(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    
    // Initialize early to avoid undefined issues
    this.streamCallback = undefined;
    
    // Initialize components
    this.initializeComponents();
    this.setupStreamCallbacks();
    
    // Log initialization
    this.streamUpdate(`🏗️ Stateless file modifier initialization:`);
    this.streamUpdate(`   React Base Path: ${reactBasePath}`);
    this.streamUpdate(`   Session ID: ${sessionId}`);
  }

  private initializeComponents(): void {
    // Initialize original modules
    this.scopeAnalyzer = new ScopeAnalyzer(this.anthropic);
    this.componentGenerationSystem = new ComponentGenerationSystem(this.anthropic, this.reactBasePath);
    this.dependencyManager = new DependencyManager(new Map());
    this.fallbackMechanism = new FallbackMechanism(this.anthropic);

    // Initialize processors
    this.tokenTracker = new TokenTracker();
    this.astAnalyzer = new ASTAnalyzer();
    this.projectAnalyzer = new ProjectAnalyzer(this.reactBasePath);
    
    // Initialize processors with fallback for constructor compatibility
    try {
      this.fullFileProcessor = new FullFileProcessor(
        this.anthropic, 
        this.tokenTracker, 
        this.astAnalyzer,
        this.reactBasePath
      );
    } catch (error) {
      this.fullFileProcessor = new FullFileProcessor(
        this.anthropic, 
        this.tokenTracker, 
        this.astAnalyzer
      ) as any;
      if ('reactBasePath' in this.fullFileProcessor) {
        (this.fullFileProcessor as any).reactBasePath = this.reactBasePath;
      }
    }
    
    try {
      this.targetedNodesProcessor = new TargetedNodesProcessor(
        this.anthropic, 
        this.tokenTracker, 
        this.astAnalyzer,
        this.reactBasePath
      );
    } catch (error) {
      this.targetedNodesProcessor = new TargetedNodesProcessor(
        this.anthropic, 
        this.tokenTracker, 
        this.astAnalyzer
      ) as any;
      if ('reactBasePath' in this.targetedNodesProcessor) {
        (this.targetedNodesProcessor as any).reactBasePath = this.reactBasePath;
      }
    }
    
    this.componentAdditionProcessor = new ComponentAdditionProcessor(
      this.anthropic, 
      this.reactBasePath,
      this.tokenTracker
    );
  }

  private setupStreamCallbacks(): void {
    const streamUpdate = (message: string) => this.streamUpdate(message);
    
    // Set callbacks with safety checks
    if (this.scopeAnalyzer && typeof this.scopeAnalyzer.setStreamCallback === 'function') {
      this.scopeAnalyzer.setStreamCallback(streamUpdate);
    }
    if (this.componentGenerationSystem && typeof this.componentGenerationSystem.setStreamCallback === 'function') {
      this.componentGenerationSystem.setStreamCallback(streamUpdate);
    }
    if (this.fallbackMechanism && typeof this.fallbackMechanism.setStreamCallback === 'function') {
      this.fallbackMechanism.setStreamCallback(streamUpdate);
    }
    if (this.astAnalyzer && typeof this.astAnalyzer.setStreamCallback === 'function') {
      this.astAnalyzer.setStreamCallback(streamUpdate);
    }
    if (this.projectAnalyzer && typeof this.projectAnalyzer.setStreamCallback === 'function') {
      this.projectAnalyzer.setStreamCallback(streamUpdate);
    }
    if (this.fullFileProcessor && typeof this.fullFileProcessor.setStreamCallback === 'function') {
      this.fullFileProcessor.setStreamCallback(streamUpdate);
    }
    if (this.targetedNodesProcessor && typeof this.targetedNodesProcessor.setStreamCallback === 'function') {
      this.targetedNodesProcessor.setStreamCallback(streamUpdate);
    }
    if (this.componentAdditionProcessor && typeof this.componentAdditionProcessor.setStreamCallback === 'function') {
      this.componentAdditionProcessor.setStreamCallback(streamUpdate);
    }
  }

  setStreamCallback(callback: (message: string) => void): void {
    this.streamCallback = callback;
    this.setupStreamCallbacks();
  }

  private streamUpdate(message: string): void {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
  }

  // ==============================================================
  // SESSION MANAGEMENT
  // ==============================================================

  async initializeSession(): Promise<void> {
    this.streamUpdate('🚀 Initializing stateless session...');
    this.streamUpdate(`📍 React Base Path: ${this.reactBasePath}`);
    
    // Verify directory structure
    const structureValid = await this.verifyDirectoryStructure();
    if (!structureValid) {
      throw new Error(`Directory structure is invalid: ${this.reactBasePath}`);
    }

    const existingStartTime = await this.redis.getSessionStartTime(this.sessionId);
    if (!existingStartTime) {
      await this.redis.setSessionStartTime(this.sessionId, new Date().toISOString());
    }

    // Build project tree
    this.streamUpdate('🔄 Building project tree...');
    await this.buildProjectTree();
  }

  private async verifyDirectoryStructure(): Promise<boolean> {
    this.streamUpdate('🏗️ Verifying directory structure...');
    
    try {
      await fs.access(this.reactBasePath);
      this.streamUpdate(`✅ Directory exists: ${this.reactBasePath}`);
      return true;
    } catch (error) {
      this.streamUpdate(`❌ Directory does not exist: ${this.reactBasePath}`);
      return false;
    }
  }

  async buildProjectTree(): Promise<void> {
    this.streamUpdate('📂 Analyzing React project structure...');
    
    try {
      let projectFiles = new Map<string, ProjectFile>();
      
      // Update dependency manager
      const currentProjectFiles = await this.getProjectFiles();
      this.dependencyManager = new DependencyManager(currentProjectFiles);
      
      // Use project analyzer
      await this.projectAnalyzer.buildProjectTree(
        projectFiles, 
        this.dependencyManager,
        (message: string) => this.streamUpdate(message)
      );
      
      if (projectFiles.size === 0) {
        throw new Error('No React files found in directory');
      }

      // CRITICAL: Update all file paths to current reactBasePath
      const fixedProjectFiles = new Map<string, ProjectFile>();
      
      for (const [relativePath, file] of projectFiles) {
        const currentFilePath = this.resolveCurrentFilePath(relativePath);
        
        const fixedFile: ProjectFile = {
          ...file,
          path: currentFilePath // Use current build directory path
        };
        fixedProjectFiles.set(relativePath, fixedFile);
        this.streamUpdate(`🔧 Fixed path: ${relativePath} → ${currentFilePath}`);
      }

      // Store fixed paths in Redis
      await this.setProjectFiles(fixedProjectFiles);
      
      this.streamUpdate(`✅ Loaded ${fixedProjectFiles.size} React files with updated paths`);
    } catch (error) {
      console.error('Error building project tree:', error);
      throw error;
    }
  }

  // ==============================================================
  // REDIS OPERATIONS (Simplified)
  // ==============================================================

  private async getProjectFiles(): Promise<Map<string, ProjectFile>> {
    const projectFiles = await this.redis.getProjectFiles(this.sessionId);
    return projectFiles || new Map();
  }

  private async setProjectFiles(projectFiles: Map<string, ProjectFile>): Promise<void> {
    await this.redis.setProjectFiles(this.sessionId, projectFiles);
  }

  private async getModificationSummary(): Promise<RedisModificationSummary> {
    return new RedisModificationSummary(this.redis, this.sessionId);
  }

  private async getModificationContextualSummary(): Promise<string> {
    const modificationSummary = await this.getModificationSummary();
    return await modificationSummary.getContextualSummary();
  }

  private async getMostModifiedFiles(): Promise<Array<{ file: string; count: number }>> {
    const modificationSummary = await this.getModificationSummary();
    return await modificationSummary.getMostModifiedFiles();
  }

  // ==============================================================
  // MODIFICATION HANDLERS
  // ==============================================================

  private async handleComponentAddition(
    prompt: string,
    scope: ModificationScope,
    projectSummaryCallback?: (summary: string, prompt: string) => Promise<string | null>
  ): Promise<ModificationResult> {
    const projectFiles = await this.getProjectFiles();
    const modificationSummary = await this.getModificationSummary();

    return await this.componentAdditionProcessor.handleComponentAddition(
      prompt,
      scope,
      projectFiles,
      modificationSummary,
      this.componentGenerationSystem,
      projectSummaryCallback
    );
  }

  private async handleFullFileModification(prompt: string): Promise<boolean> {
    const projectFiles = await this.getProjectFiles();
    const modificationSummary = await this.getModificationSummary();
    
    try {
      let result: boolean = false;
      
      if (this.fullFileProcessor && 'handleFullFileModification' in this.fullFileProcessor && 
          typeof (this.fullFileProcessor as any).handleFullFileModification === 'function') {
        result = await (this.fullFileProcessor as any).handleFullFileModification(
          prompt,
          projectFiles,
          modificationSummary
        );
      } else {
        this.streamUpdate('⚠️ Using fallback full file modification method');
        this.streamUpdate('❌ Full file processor method not available - modification skipped');
        return false;
      }

      if (result) {
        await this.setProjectFiles(projectFiles);
      }

      return result;
    } catch (error) {
      this.streamUpdate(`❌ Full file modification failed: ${error}`);
      return false;
    }
  }

  private async handleTargetedModification(prompt: string): Promise<boolean> {
    const projectFiles = await this.getProjectFiles();
    const modificationSummary = await this.getModificationSummary();
    
    try {
      let result: boolean = false;
      
      if (this.targetedNodesProcessor && 'handleTargetedModification' in this.targetedNodesProcessor &&
          typeof (this.targetedNodesProcessor as any).handleTargetedModification === 'function') {
        result = await (this.targetedNodesProcessor as any).handleTargetedModification(
          prompt,
          projectFiles,
          modificationSummary
        );
      } else {
        this.streamUpdate('⚠️ Using fallback targeted modification method');
        this.streamUpdate('❌ Targeted nodes processor method not available - modification skipped');
        return false;
      }

      if (result) {
        await this.setProjectFiles(projectFiles);
      }

      return result;
    } catch (error) {
      this.streamUpdate(`❌ Targeted modification failed: ${error}`);
      return false;
    }
  }

  // ==============================================================
  // MAIN PROCESSING METHOD
  // ==============================================================

  async processModification(
    prompt: string, 
    conversationContext?: string,
    dbSummary?: string,
    projectSummaryCallback?: (summary: string, prompt: string) => Promise<string | null>
  ): Promise<ModificationResult> {
    try {
      this.streamUpdate('🚀 Starting stateless intelligent modification workflow...');
      
      await this.initializeSession();
      
      const projectFiles = await this.getProjectFiles();
      
      if (projectFiles.size === 0) {
        return { 
          success: false, 
          error: 'No React files found in directory',
          selectedFiles: [],
          addedFiles: []
        };
      }

      // Build project summary for scope analysis
      const projectSummary = dbSummary || this.projectAnalyzer.buildProjectSummary(projectFiles);
      const contextWithSummary = (conversationContext || '') + '\n\n' + await this.getModificationContextualSummary();
      
      // Analyze scope
      const scope = await this.scopeAnalyzer.analyzeScope(
        prompt, 
        projectSummary, 
        contextWithSummary,
        dbSummary
      );
      
      this.streamUpdate(`📋 Modification method: ${scope.scope}`);

      // Prepare for component generation if needed
      if (scope.scope === 'COMPONENT_ADDITION') {
        if (typeof this.componentGenerationSystem.refreshFileStructure === 'function') {
          await this.componentGenerationSystem.refreshFileStructure();
        }
        if (dbSummary && typeof this.componentGenerationSystem.setProjectSummary === 'function') {
          this.componentGenerationSystem.setProjectSummary(dbSummary);
        }
      }

      // Execute the chosen approach
      let success = false;
      let selectedFiles: string[] = [];
      let addedFiles: string[] = [];

      switch (scope.scope) {
        case 'COMPONENT_ADDITION':
          const componentResult = await this.handleComponentAddition(prompt, scope, projectSummaryCallback);
          // Write component addition changes to files
          if (componentResult.success) {
            await this.writeChangesToFiles();
          }
          return componentResult;
          
        case 'FULL_FILE':
          success = await this.handleFullFileModification(prompt);
          const fullFileModifications = await this.getMostModifiedFiles();
          selectedFiles = fullFileModifications.map(item => item.file);
          break;
          
        case 'TARGETED_NODES':
          success = await this.handleTargetedModification(prompt);
          const targetedModifications = await this.getMostModifiedFiles();
          selectedFiles = targetedModifications.map(item => item.file);
          break;
          
        default:
          return { 
            success: false, 
            error: 'Unknown modification scope',
            selectedFiles: [],
            addedFiles: []
          };
      }
      
      // Return results
      if (success) {
        const modificationSummary = await this.getModificationContextualSummary();
        
        // CRITICAL: Write Redis changes back to actual files
        await this.writeChangesToFiles();
        
        return {
          success: true,
          selectedFiles,
          addedFiles,
          approach: scope.scope,
          reasoning: `${scope.reasoning} Stateless AST analysis identified ${selectedFiles.length} files for modification.`,
          modificationSummary,
          tokenUsage: this.tokenTracker.getStats()
        };
      } else {
        return {
          success: false,
          error: 'Modification process failed',
          selectedFiles: [],
          addedFiles: [],
          approach: scope.scope,
          reasoning: scope.reasoning,
          tokenUsage: this.tokenTracker.getStats()
        };
      }
      
    } catch (error) {
      console.error('❌ Stateless modification process failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        selectedFiles: [],
        addedFiles: [],
        tokenUsage: this.tokenTracker.getStats()
      };
    }
  }

  // ==============================================================
  // UTILITY METHODS
  // ==============================================================

  /**
   * Write Redis cached changes back to actual files
   */
  async writeChangesToFiles(): Promise<void> {
    this.streamUpdate('💾 Starting to write Redis cached changes back to actual files...');
    this.streamUpdate(`📍 Base directory: ${this.reactBasePath}`);
    
    try {
      const projectFiles = await this.getProjectFiles();
      this.streamUpdate(`📦 Found ${projectFiles.size} files in Redis cache`);
      
      if (projectFiles.size === 0) {
        this.streamUpdate('⚠️ No files found in Redis cache to write');
        return;
      }
      
      let filesWritten = 0;
      let filesSkipped = 0;
      
      for (const [relativePath, projectFile] of projectFiles.entries()) {
        this.streamUpdate(`\n🔍 Processing: ${relativePath}`);
        this.streamUpdate(`   Has content: ${!!projectFile.content}`);
        this.streamUpdate(`   Content length: ${projectFile.content?.length || 0}`);
        
        if (projectFile.content) {
          try {
            // CRITICAL FIX: Use current reactBasePath, not cached paths
            const currentFilePath = this.resolveCurrentFilePath(relativePath);
            
            // Debug: Log the path resolution
            this.streamUpdate(`🔧 Path resolution:`);
            this.streamUpdate(`   Input: ${relativePath}`);
            this.streamUpdate(`   Output: ${currentFilePath}`);
            this.streamUpdate(`   Base: ${this.reactBasePath}`);
            
            // Ensure directory exists
            const dir = path.dirname(currentFilePath);
            this.streamUpdate(`📁 Ensuring directory exists: ${dir}`);
            await fs.mkdir(dir, { recursive: true });
            
            // Check if target file already exists
            const existsBefore = await fs.access(currentFilePath).then(() => true).catch(() => false);
            this.streamUpdate(`   File exists before write: ${existsBefore}`);
            
            // Write the updated content to the actual file in current temp-build
            this.streamUpdate(`💾 Writing ${projectFile.content.length} characters to file...`);
            await fs.writeFile(currentFilePath, projectFile.content, 'utf8');
            
            // Verify the file was written
            const stats = await fs.stat(currentFilePath);
            const existsAfter = await fs.access(currentFilePath).then(() => true).catch(() => false);
            
            this.streamUpdate(`✅ SUCCESS: Written to ${currentFilePath}`);
            this.streamUpdate(`   File size: ${stats.size} bytes`);
            this.streamUpdate(`   Modified: ${stats.mtime}`);
            this.streamUpdate(`   Exists after write: ${existsAfter}`);
            
            filesWritten++;
            
          } catch (writeError) {
            this.streamUpdate(`❌ FAILED to write ${relativePath}:`);
            this.streamUpdate(`   Error: ${writeError}`);
            console.error(`Failed to write file ${relativePath}:`, writeError);
          }
        } else {
          this.streamUpdate(`⚠️ SKIPPED ${relativePath}: No content`);
          filesSkipped++;
        }
      }
      
      this.streamUpdate(`\n📊 Write Summary:`);
      this.streamUpdate(`   Files written: ${filesWritten}`);
      this.streamUpdate(`   Files skipped: ${filesSkipped}`);
      this.streamUpdate(`   Total processed: ${projectFiles.size}`);
      
      // Additional verification: List what's actually in the temp directory
      try {
        this.streamUpdate(`\n🔍 Verifying temp directory structure:`);
        const srcPath = path.join(this.reactBasePath, 'src');
        const srcExists = await fs.access(srcPath).then(() => true).catch(() => false);
        
        this.streamUpdate(`   src/ exists: ${srcExists} at ${srcPath}`);
        
        if (srcExists) {
          const srcFiles = await fs.readdir(srcPath, { recursive: true });
          this.streamUpdate(`   Files in src/: ${srcFiles.length}`);
          this.streamUpdate(`   First 10 files: ${srcFiles.slice(0, 10).join(', ')}`);
          
          // Check specific modified files
          const modifiedFiles = ['pages/TodoApp.tsx', 'components/TodoFilters.tsx'];
          for (const file of modifiedFiles) {
            const filePath = path.join(srcPath, file);
            const exists = await fs.access(filePath).then(() => true).catch(() => false);
            if (exists) {
              const stats = await fs.stat(filePath);
              this.streamUpdate(`   ✅ ${file}: ${stats.size} bytes, modified ${stats.mtime}`);
            } else {
              this.streamUpdate(`   ❌ ${file}: NOT FOUND at ${filePath}`);
            }
          }
        } else {
          this.streamUpdate(`❌ src directory doesn't exist at: ${srcPath}`);
          
          // Check what's in the base directory
          const baseFiles = await fs.readdir(this.reactBasePath);
          this.streamUpdate(`   Files in base directory: ${baseFiles.join(', ')}`);
        }
      } catch (verifyError) {
        this.streamUpdate(`⚠️ Could not verify directory structure: ${verifyError}`);
      }
      
    } catch (error) {
      this.streamUpdate(`❌ Error writing changes to files: ${error}`);
      console.error('Error writing changes to files:', error);
      throw error;
    }
  }

  /**
   * Resolve file path to current build directory
   */
  private resolveCurrentFilePath(relativePath: string): string {
    // Clean the relative path and normalize separators
    const cleanPath = relativePath.replace(/^[\/\\]+/, '').replace(/\\/g, '/');
    
    // Handle different path patterns
    if (cleanPath.startsWith('src/')) {
      // Path already includes src, use directly
      return path.join(this.reactBasePath, cleanPath);
    } else {
      // Assume it's a file in src directory
      return path.join(this.reactBasePath, 'src', cleanPath);
    }
  }

  async cleanup(): Promise<void> {
    await this.redis.disconnect();
  }
}