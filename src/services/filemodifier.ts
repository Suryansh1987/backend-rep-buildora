// ============================================================================
// MAIN FILE: IntelligentFileModifier.ts
// ============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { 
  ProjectFile, 
  ASTNode, 
  ModificationResult, 
  ModificationScope
} from './filemodifier/types';
import { ScopeAnalyzer } from './filemodifier/scopeanalyzer';
import { ComponentGenerationSystem } from './filemodifier/component';
import { ModificationSummary } from './filemodifier/modification';
import { DependencyManager } from './filemodifier/dependancy';
import { FallbackMechanism } from './filemodifier/fallback';

// Import modular processors
import { ASTAnalyzer } from './processor/Astanalyzer';
import { ProjectAnalyzer } from './processor/projectanalyzer';
import { FullFileProcessor } from './processor/Fullfileprocessor';
import { TargetedNodesProcessor } from './processor/TargettedNodes';
import { ComponentAdditionProcessor } from './processor/ComponentAddition';
import { TokenTracker } from '../utils/TokenTracer';

export class IntelligentFileModifier {
  private anthropic: Anthropic;
  private reactBasePath: string;
  private projectFiles: Map<string, ProjectFile>;
  private streamCallback?: (message: string) => void;
  
  // Original module instances
  private scopeAnalyzer: ScopeAnalyzer;
  private componentGenerationSystem: ComponentGenerationSystem;
  private modificationSummary: ModificationSummary;
  private dependencyManager: DependencyManager;
  private fallbackMechanism: FallbackMechanism;

  // New modular processors
  private astAnalyzer: ASTAnalyzer;
  private projectAnalyzer: ProjectAnalyzer;
  private fullFileProcessor: FullFileProcessor;
  private targetedNodesProcessor: TargetedNodesProcessor;
  private componentAdditionProcessor: ComponentAdditionProcessor;
  private tokenTracker: TokenTracker;

  constructor(anthropic: Anthropic, reactBasePath: string) {
    this.anthropic = anthropic;
    this.reactBasePath = reactBasePath;
    this.projectFiles = new Map();
    
    // Initialize original modules
    this.scopeAnalyzer = new ScopeAnalyzer(anthropic);
    this.componentGenerationSystem = new ComponentGenerationSystem(anthropic, reactBasePath);
    this.modificationSummary = new ModificationSummary();
    this.dependencyManager = new DependencyManager(this.projectFiles);
    this.fallbackMechanism = new FallbackMechanism(anthropic);

    // Initialize new modular processors
    this.tokenTracker = new TokenTracker();
    this.astAnalyzer = new ASTAnalyzer();
    this.projectAnalyzer = new ProjectAnalyzer(reactBasePath);
    this.fullFileProcessor = new FullFileProcessor(anthropic, this.tokenTracker, this.astAnalyzer);
    this.targetedNodesProcessor = new TargetedNodesProcessor(anthropic, this.tokenTracker, this.astAnalyzer);
    this.componentAdditionProcessor = new ComponentAdditionProcessor(anthropic, reactBasePath, this.tokenTracker);
  }

  setStreamCallback(callback: (message: string) => void): void {
    this.streamCallback = callback;
    
    // Set callback for all original modules
    this.scopeAnalyzer.setStreamCallback(callback);
    this.componentGenerationSystem.setStreamCallback(callback);
    this.dependencyManager.setStreamCallback(callback);
    this.fallbackMechanism.setStreamCallback(callback);

    // Set callback for new processors
    this.astAnalyzer.setStreamCallback(callback);
    this.projectAnalyzer.setStreamCallback(callback);
    this.fullFileProcessor.setStreamCallback(callback);
    this.targetedNodesProcessor.setStreamCallback(callback);
    this.componentAdditionProcessor.setStreamCallback(callback);
    this.tokenTracker.setStreamCallback(callback);
  }

  private streamUpdate(message: string): void {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
  }

  // Delegated methods using new processors
  private async buildProjectTree(): Promise<void> {
    return this.projectAnalyzer.buildProjectTree(this.projectFiles, this.dependencyManager, this.streamCallback);
  }

  private parseFileWithAST(filePath: string): ASTNode[] {
    return this.astAnalyzer.parseFileWithAST(filePath, this.projectFiles);
  }

  private async analyzeFileRelevance(
    prompt: string,
    filePath: string,
    astNodes: ASTNode[],
    modificationMethod: 'FULL_FILE' | 'TARGETED_NODES'
  ) {
    return this.astAnalyzer.analyzeFileRelevance(
      prompt, 
      filePath, 
      astNodes, 
      modificationMethod, 
      this.projectFiles, 
      this.anthropic,
      this.tokenTracker
    );
  }

  private async handleFullFileModification(prompt: string): Promise<boolean> {
    return this.fullFileProcessor.handleFullFileModification(
      prompt, 
      this.projectFiles, 
      this.modificationSummary
    );
  }

  private async handleTargetedModification(prompt: string): Promise<boolean> {
    return this.targetedNodesProcessor.handleTargetedModification(
      prompt, 
      this.projectFiles, 
      this.modificationSummary
    );
  }

  private async handleComponentAddition(
    prompt: string,
    scope: ModificationScope,
    projectSummaryCallback?: (summary: string, prompt: string) => Promise<string | null>
  ): Promise<ModificationResult> {
    return this.componentAdditionProcessor.handleComponentAddition(
      prompt,
      scope,
      this.projectFiles,
      this.modificationSummary,
      this.componentGenerationSystem,
      projectSummaryCallback
    );
  }

  // Main processing method (keeping same signature)
  async processModification(
    prompt: string, 
    conversationContext?: string,
    dbSummary?: string,
    projectSummaryCallback?: (summary: string, prompt: string) => Promise<string | null>
  ): Promise<ModificationResult> {
    try {
      this.streamUpdate('🚀 Starting MODULAR intelligent modification workflow...');
      
      // Step 1: Build or load project structure
      if (!dbSummary) {
        await this.buildProjectTree();
        
        if (this.projectFiles.size === 0) {
          return { 
            success: false, 
            error: 'No React files found in project',
            selectedFiles: [],
            addedFiles: []
          };
        }
      } else {
        this.streamUpdate('📊 Using provided database summary...');
      }

      // Step 2: Determine modification method
      const projectSummary = dbSummary || this.projectAnalyzer.buildProjectSummary(this.projectFiles);
      const contextWithSummary = (conversationContext || '') + '\n\n' + this.modificationSummary.getContextualSummary();
      
      const scope = await this.scopeAnalyzer.analyzeScope(
        prompt, 
        projectSummary, 
        contextWithSummary,
        dbSummary
      );
      
      this.streamUpdate(`📋 Modification method: ${scope.scope}`);

      // Step 3: Initialize component generation system if needed
      if (scope.scope === 'COMPONENT_ADDITION') {
        await this.componentGenerationSystem.refreshFileStructure();
        if (dbSummary) {
          this.componentGenerationSystem.setProjectSummary(dbSummary);
        }
      }

      // Step 4: Load project files if using database summary
      if (dbSummary && this.projectFiles.size === 0) {
        await this.buildProjectTree();
        if (this.projectFiles.size === 0) {
          return { 
            success: false, 
            error: 'No React files found after loading',
            selectedFiles: [],
            addedFiles: []
          };
        }
      }

      // Step 5: Execute modification based on scope
      let success = false;
      let selectedFiles: string[] = [];
      let addedFiles: string[] = [];

      switch (scope.scope) {
        case 'COMPONENT_ADDITION':
          const componentResult = await this.handleComponentAddition(prompt, scope, projectSummaryCallback);
          return componentResult;
          
        case 'FULL_FILE':
          success = await this.handleFullFileModification(prompt);
          selectedFiles = this.modificationSummary.getMostModifiedFiles().map(item => item.file);
          break;
          
        case 'TARGETED_NODES':
          success = await this.handleTargetedModification(prompt);
          selectedFiles = this.modificationSummary.getMostModifiedFiles().map(item => item.file);
          break;
          
        default:
          return { 
            success: false, 
            error: 'Unknown modification scope',
            selectedFiles: [],
            addedFiles: []
          };
      }
      
      // Step 6: Return results
      if (success) {
        return {
          success: true,
          selectedFiles,
          addedFiles,
          approach: scope.scope,
          reasoning: `${scope.reasoning} Enhanced AST analysis identified ${selectedFiles.length} files for modification.`,
          modificationSummary: this.modificationSummary.getSummary(),
          tokenUsage: this.tokenTracker.getStats()
        };
      } else {
        this.streamUpdate('⚠️ Primary approach failed, trying fallback...');
        
        const fallbackResult = await this.fallbackMechanism.executeComprehensiveFallback(
          prompt,
          this.projectFiles,
          scope.scope as 'FULL_FILE' | 'TARGETED_NODES',
          []
        );
        
        if (fallbackResult.success) {
          fallbackResult.modifiedFiles.forEach(filePath => {
            this.modificationSummary.addChange('modified', filePath, `Fallback modification: ${prompt.substring(0, 50)}...`);
          });
          
          return {
            success: true,
            selectedFiles: fallbackResult.modifiedFiles,
            addedFiles: [],
            reasoning: 'Primary analysis failed, but fallback mechanism succeeded',
            modificationSummary: this.modificationSummary.getSummary() + '\n\n' + this.fallbackMechanism.getFallbackSummary(fallbackResult),
            tokenUsage: this.tokenTracker.getStats()
          };
        }
        
        return { 
          success: false, 
          error: `${scope.scope} modifications failed - no relevant files found`,
          selectedFiles,
          addedFiles: [],
          modificationSummary: this.modificationSummary.getSummary(),
          tokenUsage: this.tokenTracker.getStats()
        };
      }
      
    } catch (error) {
      this.streamUpdate(`💥 Unexpected error: ${error}`);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        selectedFiles: [],
        addedFiles: [],
        modificationSummary: this.modificationSummary.getSummary(),
        tokenUsage: this.tokenTracker.getStats()
      };
    }
  }

  // Public utility methods (keeping same signatures)
  async refreshComponentStructure(): Promise<void> {
    this.streamUpdate('🔄 Refreshing component generation system file structure...');
    await this.componentGenerationSystem.refreshFileStructure();
    this.streamUpdate('✅ Component structure refreshed');
  }

  async getComponentGenerationAnalytics(): Promise<{
    totalComponents: number;
    totalPages: number;
    hasRouting: boolean;
    availableForIntegration: number;
  }> {
    const summary = this.componentGenerationSystem.getFileStructureSummary();
    
    if (!summary) {
      await this.componentGenerationSystem.refreshFileStructure();
      const refreshedSummary = this.componentGenerationSystem.getFileStructureSummary();
      
      return {
        totalComponents: refreshedSummary?.components.length || 0,
        totalPages: refreshedSummary?.pages.length || 0,
        hasRouting: refreshedSummary?.appStructure.hasRouting || false,
        availableForIntegration: refreshedSummary?.components.filter(c => c.canAcceptChildren).length || 0
      };
    }
    
    return {
      totalComponents: summary.components.length,
      totalPages: summary.pages.length,
      hasRouting: summary.appStructure.hasRouting,
      availableForIntegration: summary.components.filter(c => c.canAcceptChildren).length
    };
  }

  async getProjectAnalytics(prompt?: string): Promise<{
    totalFiles: number;
    analyzedFiles: number;
    potentialTargets?: Array<{ filePath: string; elementCount: number; relevanceScore?: number }>;
  }> {
    return this.projectAnalyzer.getProjectAnalytics(
      prompt, 
      this.projectFiles, 
      this.astAnalyzer, 
      this.anthropic,
      this.tokenTracker
    );
  }

  async forceAnalyzeSpecificFiles(
    prompt: string,
    filePaths: string[],
    method: 'FULL_FILE' | 'TARGETED_NODES' = 'FULL_FILE'
  ) {
    return this.astAnalyzer.forceAnalyzeSpecificFiles(
      prompt,
      filePaths,
      method,
      this.projectFiles,
      this.anthropic,
      this.tokenTracker
    );
  }

  async getUnusedPagesInfo() {
    return this.projectAnalyzer.getUnusedPagesInfo(this.projectFiles, this.reactBasePath);
  }

  async forceRefreshProject(): Promise<void> {
    this.projectFiles.clear();
    await this.buildProjectTree();
  }

  // Token tracking methods
  getTokenUsageStats() {
    return this.tokenTracker.getStats();
  }

  resetTokenTracking(): void {
    this.tokenTracker.reset();
  }
}