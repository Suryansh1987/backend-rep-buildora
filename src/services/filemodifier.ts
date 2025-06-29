// services/filemodifier-redis.ts - Compatible version
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

export class StatelessIntelligentFileModifier {
  private anthropic: Anthropic;
  private reactBasePath: string;
  private redis: RedisService;
  private sessionId: string;
  private streamCallback?: (message: string) => void;
  
  // Original module instances (now stateless)
  private scopeAnalyzer: ScopeAnalyzer;
  private componentGenerationSystem: ComponentGenerationSystem;
  private dependencyManager: DependencyManager;
  private fallbackMechanism: FallbackMechanism;

  // New modular processors
  private astAnalyzer: ASTAnalyzer;
  private projectAnalyzer: ProjectAnalyzer;
  private fullFileProcessor: FullFileProcessor;
  private targetedNodesProcessor: TargetedNodesProcessor;
  private componentAdditionProcessor: ComponentAdditionProcessor;
  private tokenTracker: TokenTracker;

  constructor(anthropic: Anthropic, reactBasePath: string, sessionId: string, redisUrl?: string) {
    this.anthropic = anthropic;
    this.reactBasePath = reactBasePath;
    this.sessionId = sessionId;
    this.redis = new RedisService(redisUrl);
    
    // Initialize original modules
    this.scopeAnalyzer = new ScopeAnalyzer(anthropic);
    this.componentGenerationSystem = new ComponentGenerationSystem(anthropic, reactBasePath);
    this.dependencyManager = new DependencyManager(new Map()); // Will be populated from Redis
    this.fallbackMechanism = new FallbackMechanism(anthropic);

    // Initialize new modular processors with proper arguments
    this.tokenTracker = new TokenTracker();
    this.astAnalyzer = new ASTAnalyzer();
    this.projectAnalyzer = new ProjectAnalyzer(reactBasePath);
    
    this.fullFileProcessor = new FullFileProcessor(
      anthropic, 
      this.tokenTracker, 
      this.astAnalyzer
    );
    
    this.targetedNodesProcessor = new TargetedNodesProcessor(
      anthropic, 
      this.tokenTracker, 
      this.astAnalyzer
    );
    
    this.componentAdditionProcessor = new ComponentAdditionProcessor(
      anthropic, 
      reactBasePath,
      this.tokenTracker
    );
  }

  // ==============================================================
  // SESSION MANAGEMENT
  // ==============================================================

  async initializeSession(): Promise<void> {
    const existingStartTime = await this.redis.getSessionStartTime(this.sessionId);
    if (!existingStartTime) {
      await this.redis.setSessionStartTime(this.sessionId, new Date().toISOString());
    }

    const hasCache = await this.redis.hasProjectFiles(this.sessionId);
    if (!hasCache) {
      this.streamUpdate('🔄 Building project tree (first time for this session)...');
      await this.buildProjectTree();
    } else {
      this.streamUpdate('📁 Loading cached project files from Redis...');
    }
  }

  async clearSession(): Promise<void> {
    await this.redis.clearSession(this.sessionId);
  }

  // ==============================================================
  // PROJECT FILES MANAGEMENT (Redis-backed)
  // ==============================================================

  private async getProjectFiles(): Promise<Map<string, ProjectFile>> {
    const projectFiles = await this.redis.getProjectFiles(this.sessionId);
    return projectFiles || new Map();
  }

  private async setProjectFiles(projectFiles: Map<string, ProjectFile>): Promise<void> {
    await this.redis.setProjectFiles(this.sessionId, projectFiles);
  }

  private async updateProjectFile(filePath: string, projectFile: ProjectFile): Promise<void> {
    await this.redis.updateProjectFile(this.sessionId, filePath, projectFile);
  }

  // ==============================================================
  // MODIFICATION SUMMARY (Redis-backed)
  // ==============================================================

  private async addModificationChange(
    type: 'modified' | 'created' | 'updated',
    file: string,
    description: string,
    options?: {
      approach?: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION';
      success?: boolean;
      linesChanged?: number;
      componentsAffected?: string[];
      reasoning?: string;
    }
  ): Promise<void> {
    const change: ModificationChange = {
      type,
      file,
      description,
      timestamp: new Date().toISOString(),
      approach: options?.approach,
      success: options?.success,
      details: {
        linesChanged: options?.linesChanged,
        componentsAffected: options?.componentsAffected,
        reasoning: options?.reasoning
      }
    };

    await this.redis.addModificationChange(this.sessionId, change);
  }

  private async getModificationContextualSummary(): Promise<string> {
    const changes = await this.redis.getModificationChanges(this.sessionId);
    
    if (changes.length === 0) {
      return "";
    }

    const recentChanges = changes.slice(-5);
    const uniqueFiles = new Set(changes.map(c => c.file));
    const sessionStartTime = await this.redis.getSessionStartTime(this.sessionId);
    
    const durationMs = new Date().getTime() - new Date(sessionStartTime).getTime();
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    const duration = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    let summary = `
**RECENT MODIFICATIONS IN THIS SESSION:**
${recentChanges.map(change => {
  const icon = this.getChangeIcon(change);
  const status = change.success === false ? ' (failed)' : '';
  return `• ${icon} ${change.file}${status}: ${change.description}`;
}).join('\n')}

**Session Context:**
• Total files modified: ${uniqueFiles.size}
• Session duration: ${duration}
    `.trim();

    return summary;
  }

  private async getMostModifiedFiles(): Promise<Array<{ file: string; count: number }>> {
    const changes = await this.redis.getModificationChanges(this.sessionId);
    const fileStats: Record<string, number> = {};
    
    changes.forEach(change => {
      fileStats[change.file] = (fileStats[change.file] || 0) + 1;
    });
    
    return Object.entries(fileStats)
      .map(([file, count]) => ({ file, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  // ==============================================================
  // PROJECT TREE BUILDING - Compatible with your existing interface
  // ==============================================================

  async buildProjectTree(): Promise<void> {
    this.streamUpdate('📂 Analyzing React project structure...');
    
    try {
      // Try to use your existing buildProjectTree method signature
      let projectFiles = new Map<string, ProjectFile>();
      
      // Update dependency manager with current Redis data
      const currentProjectFiles = await this.getProjectFiles();
      this.dependencyManager = new DependencyManager(currentProjectFiles);
      
      // Call buildProjectTree with the signature your class expects
      const buildResult = await (this.projectAnalyzer as any).buildProjectTree(
        projectFiles, 
        this.dependencyManager,
        (message: string) => this.streamUpdate(message)
      );
      
      // If buildProjectTree returns the files instead of mutating the parameter
      if (buildResult && buildResult.size > 0) {
        projectFiles = buildResult;
      }
      
      if (projectFiles.size === 0) {
        throw new Error('No React files found in project');
      }

      // Store in Redis
      await this.setProjectFiles(projectFiles);
      
      this.streamUpdate(`✅ Loaded ${projectFiles.size} React files into cache`);
    } catch (error) {
      console.error('Error building project tree:', error);
      throw error;
    }
  }

  // ==============================================================
  // STREAM UPDATES
  // ==============================================================

  setStreamCallback(callback: (message: string) => void): void {
    this.streamCallback = callback;
  }

  private streamUpdate(message: string): void {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
  }

  // ==============================================================
  // COMPONENT ADDITION HANDLER
  // ==============================================================

  private async handleComponentAddition(
    prompt: string,
    scope: ModificationScope,
    projectSummaryCallback?: (summary: string, prompt: string) => Promise<string | null>
  ): Promise<ModificationResult> {
    const projectFiles = await this.getProjectFiles();
    
    const modificationSummary = {
      addChange: async (type: any, file: string, description: string, options?: any) => 
        await this.addModificationChange(type, file, description, options),
      getContextualSummary: async () => await this.getModificationContextualSummary(),
      getMostModifiedFiles: async () => await this.getMostModifiedFiles()
    };

    return await this.componentAdditionProcessor.handleComponentAddition(
      prompt,
      scope,
      projectFiles,
      modificationSummary as any,
      this.componentGenerationSystem,
      projectSummaryCallback
    );
  }

  // ==============================================================
  // MODIFICATION HANDLERS - Compatible with your existing processors
  // ==============================================================

  private async handleFullFileModification(prompt: string): Promise<boolean> {
    const projectFiles = await this.getProjectFiles();
    
    try {
      // Try different method names your processor might have
      const processor = this.fullFileProcessor as any;
      let result;
      
      if (processor.processFullFileModification) {
        result = await processor.processFullFileModification(
          prompt,
          projectFiles,
          this.reactBasePath,
          (message: string) => this.streamUpdate(message)
        );
      } else if (processor.process) {
        result = await processor.process(
          prompt,
          projectFiles,
          this.reactBasePath,
          (message: string) => this.streamUpdate(message)
        );
      } else if (processor.handleFullFileModification) {
        result = await processor.handleFullFileModification(
          prompt,
          projectFiles,
          this.reactBasePath,
          (message: string) => this.streamUpdate(message)
        );
      } else {
        console.warn('No suitable method found on FullFileProcessor');
        return false;
      }

      if (result) {
        // Update project files in Redis if result contains updated files
        if (result.updatedProjectFiles) {
          await this.setProjectFiles(result.updatedProjectFiles);
        } else if (result.projectFiles) {
          await this.setProjectFiles(result.projectFiles);
        }

        // Add modification changes if available
        if (result.changes && Array.isArray(result.changes)) {
          for (const change of result.changes) {
            await this.addModificationChange(
              change.type || 'modified',
              change.file,
              change.description || 'File modified',
              {
                approach: 'FULL_FILE',
                success: change.success !== false,
                linesChanged: change.details?.linesChanged,
                componentsAffected: change.details?.componentsAffected,
                reasoning: change.details?.reasoning
              }
            );
          }
        }

        return result.success !== false;
      }

      return false;
    } catch (error) {
      console.error('Full file modification failed:', error);
      return false;
    }
  }

  private async handleTargetedModification(prompt: string): Promise<boolean> {
    const projectFiles = await this.getProjectFiles();
    
    try {
      // Try different method names your processor might have
      const processor = this.targetedNodesProcessor as any;
      let result;
      
      if (processor.processTargetedModification) {
        result = await processor.processTargetedModification(
          prompt,
          projectFiles,
          this.reactBasePath,
          (message: string) => this.streamUpdate(message)
        );
      } else if (processor.process) {
        result = await processor.process(
          prompt,
          projectFiles,
          this.reactBasePath,
          (message: string) => this.streamUpdate(message)
        );
      } else if (processor.handleTargetedModification) {
        result = await processor.handleTargetedModification(
          prompt,
          projectFiles,
          this.reactBasePath,
          (message: string) => this.streamUpdate(message)
        );
      } else {
        console.warn('No suitable method found on TargetedNodesProcessor');
        return false;
      }

      if (result) {
        // Update project files in Redis if result contains updated files
        if (result.updatedProjectFiles) {
          await this.setProjectFiles(result.updatedProjectFiles);
        } else if (result.projectFiles) {
          await this.setProjectFiles(result.projectFiles);
        }

        // Add modification changes if available
        if (result.changes && Array.isArray(result.changes)) {
          for (const change of result.changes) {
            await this.addModificationChange(
              change.type || 'modified',
              change.file,
              change.description || 'File modified',
              {
                approach: 'TARGETED_NODES',
                success: change.success !== false,
                linesChanged: change.details?.linesChanged,
                componentsAffected: change.details?.componentsAffected,
                reasoning: change.details?.reasoning
              }
            );
          }
        }

        return result.success !== false;
      }

      return false;
    } catch (error) {
      console.error('Targeted modification failed:', error);
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
      this.streamUpdate('🚀 Starting STATELESS intelligent modification workflow...');
      
      await this.initializeSession();
      
      const projectFiles = await this.getProjectFiles();
      
      if (projectFiles.size === 0) {
        return { 
          success: false, 
          error: 'No React files found in project',
          selectedFiles: [],
          addedFiles: []
        };
      }

      const projectSummary = dbSummary || this.projectAnalyzer.buildProjectSummary(projectFiles);
      const contextWithSummary = (conversationContext || '') + '\n\n' + await this.getModificationContextualSummary();
      
      const scope = await this.scopeAnalyzer.analyzeScope(
        prompt, 
        projectSummary, 
        contextWithSummary,
        dbSummary
      );
      
      this.streamUpdate(`📋 Modification method: ${scope.scope}`);

      if (scope.scope === 'COMPONENT_ADDITION') {
        await this.componentGenerationSystem.refreshFileStructure();
        if (dbSummary) {
          this.componentGenerationSystem.setProjectSummary(dbSummary);
        }
      }

      let success = false;
      let selectedFiles: string[] = [];
      let addedFiles: string[] = [];

      switch (scope.scope) {
        case 'COMPONENT_ADDITION':
          const componentResult = await this.handleComponentAddition(prompt, scope, projectSummaryCallback);
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
      
      if (success) {
        return {
          success: true,
          selectedFiles,
          addedFiles,
          approach: scope.scope,
          reasoning: `${scope.reasoning} Enhanced AST analysis identified ${selectedFiles.length} files for modification.`,
          modificationSummary: await this.getModificationContextualSummary()
        };
      } else {
        return {
          success: false,
          error: 'Modification process failed',
          selectedFiles: [],
          addedFiles: [],
          approach: scope.scope,
          reasoning: scope.reasoning
        };
      }
      
    } catch (error) {
      console.error('❌ Modification process failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        selectedFiles: [],
        addedFiles: []
      };
    }
  }

  // ==============================================================
  // UTILITY METHODS
  // ==============================================================

  private getChangeIcon(change: ModificationChange): string {
    switch (change.type) {
      case 'created': return '📝';
      case 'modified': return '🔄';
      case 'updated': return '⚡';
      default: return '🔧';
    }
  }

  async getRedisStats(): Promise<any> {
    return await this.redis.getStats();
  }

  async cleanup(): Promise<void> {
    await this.redis.disconnect();
  }
}