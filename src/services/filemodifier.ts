// ============================================================================
// SECURE FILE MODIFIER SERVICE - Enhanced with Strict src/ Path Restrictions
// ============================================================================

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

// Import secure processors with path restriction
import { 
  PathRestrictionManager,
  SafeComponentAdditionProcessor,
  SafeFullFileProcessor,
  SafeProjectAnalyzer
} from './pathrestrictor';

import { ASTAnalyzer } from './processor/Astanalyzer';
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
  
  // Security and path management
  private pathManager: PathRestrictionManager;
  
  // Redis and components
  private redis: RedisService;
  private scopeAnalyzer!: ScopeAnalyzer;
  private componentGenerationSystem!: ComponentGenerationSystem;
  private dependencyManager!: DependencyManager;
  private fallbackMechanism!: FallbackMechanism;

  // Secure processors
  private astAnalyzer!: ASTAnalyzer;
  private safeProjectAnalyzer!: SafeProjectAnalyzer;
  private safeFullFileProcessor!: SafeFullFileProcessor;
  private safeComponentAdditionProcessor!: SafeComponentAdditionProcessor;
  private tokenTracker!: TokenTracker;

  constructor(
    anthropic: Anthropic, 
    reactBasePath: string,
    sessionId: string, 
    redisUrl?: string
  ) {
    this.anthropic = anthropic;
    this.reactBasePath = path.resolve(reactBasePath);
    this.sessionId = sessionId;
    this.redis = new RedisService(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    
    // Initialize security manager FIRST
    this.pathManager = new PathRestrictionManager(this.reactBasePath);
    
    // Initialize components
    this.initializeSecureComponents();
    this.setupStreamCallbacks();
    
    // Log initialization with security info
    this.streamUpdate(`🔒 SECURE file modifier initialization:`);
    this.streamUpdate(`   React Base Path: ${this.reactBasePath}`);
    this.streamUpdate(`   Secure src Path: ${path.join(this.reactBasePath, 'src')}`);
    this.streamUpdate(`   Session ID: ${sessionId}`);
    this.streamUpdate(`   Security: Path restrictions ENABLED`);
  }

  private initializeSecureComponents(): void {
    // Initialize original modules
    this.scopeAnalyzer = new ScopeAnalyzer(this.anthropic);
    this.componentGenerationSystem = new ComponentGenerationSystem(this.anthropic, this.reactBasePath);
    this.dependencyManager = new DependencyManager(new Map());
    this.fallbackMechanism = new FallbackMechanism(this.anthropic);

    // Initialize secure processors
    this.tokenTracker = new TokenTracker();
    this.astAnalyzer = new ASTAnalyzer();
    
    // Use SECURE versions of processors
    this.safeProjectAnalyzer = new SafeProjectAnalyzer(this.reactBasePath);
    this.safeFullFileProcessor = new SafeFullFileProcessor(
      this.anthropic, 
      this.tokenTracker, 
      this.reactBasePath
    );
    this.safeComponentAdditionProcessor = new SafeComponentAdditionProcessor(
      this.anthropic, 
      this.reactBasePath,
      this.tokenTracker
    );
  }

  private setupStreamCallbacks(): void {
    const streamUpdate = (message: string) => this.streamUpdate(message);
    
    // Set callbacks with safety checks
    this.pathManager.setStreamCallback(streamUpdate);
    this.safeProjectAnalyzer.setStreamCallback(streamUpdate);
    this.safeFullFileProcessor.setStreamCallback(streamUpdate);
    this.safeComponentAdditionProcessor.setStreamCallback(streamUpdate);
    
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
  // SECURE SESSION MANAGEMENT
  // ==============================================================

  async initializeSession(): Promise<void> {
    this.streamUpdate('🔒 Initializing SECURE session...');
    
    // Security check: Verify src directory exists and is accessible
    const srcPath = path.join(this.reactBasePath, 'src');
    try {
      await fs.access(srcPath, fs.constants.R_OK | fs.constants.W_OK);
      this.streamUpdate(`✅ SECURE: src directory verified at ${srcPath}`);
    } catch (error) {
      throw new Error(`SECURITY: src directory not accessible: ${srcPath}`);
    }
    
    // Verify no path traversal in base path
    const resolvedBase = path.resolve(this.reactBasePath);
    if (resolvedBase !== this.reactBasePath) {
      this.streamUpdate(`🔧 Path normalized: ${this.reactBasePath} → ${resolvedBase}`);
      this.reactBasePath = resolvedBase;
    }

    const existingStartTime = await this.redis.getSessionStartTime(this.sessionId);
    if (!existingStartTime) {
      await this.redis.setSessionStartTime(this.sessionId, new Date().toISOString());
    }

    // Build project tree with security
    this.streamUpdate('🔄 Building SECURE project tree (src only)...');
    await this.buildSecureProjectTree();
  }

  async buildSecureProjectTree(): Promise<void> {
    this.streamUpdate('📂 Analyzing React project structure with security restrictions...');
    
    try {
      let projectFiles = new Map<string, ProjectFile>();
      
      // Use SECURE project analyzer - only scans src folder
      await this.safeProjectAnalyzer.buildProjectTreeSafely(projectFiles);
      
      if (projectFiles.size === 0) {
        throw new Error('No valid React files found in src directory');
      }

      // SECURITY: Clean and validate all file paths
      const secureProjectFiles = this.pathManager.cleanProjectFilePaths(projectFiles);
      
      // Update dependency manager with secure files
      this.dependencyManager = new DependencyManager(secureProjectFiles);

      // Store secure paths in Redis
      await this.setProjectFiles(secureProjectFiles);
      
      this.streamUpdate(`✅ SECURE: Loaded ${secureProjectFiles.size} validated React files from src/`);
      this.streamUpdate(`🔒 All file paths verified to be within src/ directory only`);
      
    } catch (error) {
      console.error('Error building secure project tree:', error);
      throw error;
    }
  }

  // ==============================================================
  // SECURE REDIS OPERATIONS
  // ==============================================================

  private async getProjectFiles(): Promise<Map<string, ProjectFile>> {
    const projectFiles = await this.redis.getProjectFiles(this.sessionId);
    
    if (projectFiles && projectFiles.size > 0) {
      // SECURITY: Re-validate all cached paths
      return this.pathManager.cleanProjectFilePaths(projectFiles);
    }
    
    return new Map();
  }

  private async setProjectFiles(projectFiles: Map<string, ProjectFile>): Promise<void> {
    // SECURITY: Clean paths before storing
    const secureFiles = this.pathManager.cleanProjectFilePaths(projectFiles);
    await this.redis.setProjectFiles(this.sessionId, secureFiles);
  }

  private async getModificationSummary(): Promise<RedisModificationSummary> {
    return new RedisModificationSummary(this.redis, this.sessionId);
  }

  // ==============================================================
  // SECURE MODIFICATION HANDLERS
  // ==============================================================

  private async handleSecureComponentAddition(
    prompt: string,
    scope: ModificationScope,
    projectSummaryCallback?: (summary: string, prompt: string) => Promise<string | null>
  ): Promise<ModificationResult> {
    this.streamUpdate('🔒 SECURE component addition workflow...');
    
    const projectFiles = await this.getProjectFiles();
    const modificationSummary = await this.getModificationSummary();

    // Extract component name and type
    const componentName = await this.extractComponentNameSecurely(prompt);
    const componentType = this.determineComponentType(prompt);
    
    this.streamUpdate(`🔒 Creating SECURE ${componentType}: ${componentName}`);
    
    // Generate component content (this is safe as it's just text generation)
    const componentContent = await this.generateComponentContentSecurely(componentName, componentType, prompt);
    
    if (!componentContent) {
      return {
        success: false,
        error: 'Failed to generate component content',
        selectedFiles: [],
        addedFiles: []
      };
    }

    // SECURE file creation
    const createResult = await this.safeComponentAdditionProcessor.createComponentSafely(
      componentName,
      componentType,
      componentContent
    );

    if (!createResult.success) {
      return {
        success: false,
        error: createResult.error,
        selectedFiles: [],
        addedFiles: []
      };
    }

    let updatedFiles: string[] = [];

    // For pages, update App.tsx securely
    if (componentType === 'page') {
      this.streamUpdate('🔒 Updating App.tsx securely...');
      
      const appContent = await this.generateAppUpdateContentSecurely(componentName, projectFiles);
      if (appContent) {
        const appUpdateResult = await this.safeComponentAdditionProcessor.updateAppSafely(
          projectFiles,
          componentName,
          appContent
        );
        
        if (appUpdateResult.success && appUpdateResult.updatedFiles) {
          updatedFiles = appUpdateResult.updatedFiles;
        }
      }
    }

    // Update modification summary
    const relativePath = `src/${componentType === 'page' ? 'pages' : 'components'}/${componentName}.tsx`;
    modificationSummary.addChange('created', relativePath, `Created secure ${componentType}: ${componentName}`);
    
    updatedFiles.forEach(file => {
      modificationSummary.addChange('updated', file, `Updated for ${componentName} integration`);
    });

    return {
      success: true,
      selectedFiles: updatedFiles,
      addedFiles: [relativePath],
      approach: 'COMPONENT_ADDITION',
      reasoning: `Successfully created ${componentName} ${componentType} with secure path validation`,
      modificationSummary: await modificationSummary.getSummary(),
      tokenUsage: this.tokenTracker.getStats()
    };
  }

  private async handleSecureFullFileModification(prompt: string): Promise<boolean> {
    this.streamUpdate('🔒 SECURE full file modification workflow...');
    
    const projectFiles = await this.getProjectFiles();
    const modificationSummary = await this.getModificationSummary();
    
    if (projectFiles.size === 0) {
      this.streamUpdate('❌ No secure files available for modification');
      return false;
    }

    try {
      let modifiedCount = 0;
      const RELEVANCE_THRESHOLD = 70;

      // Analyze each file for relevance (already secure files)
      for (const [relativePath, file] of projectFiles) {
        // Double-check security for each file
        const verification = await this.pathManager.verifyFileInSrc(relativePath);
        if (!verification.isValid) {
          this.streamUpdate(`🚨 SECURITY: Skipping invalid path ${relativePath}`);
          continue;
        }

        // Get AST nodes for analysis
        const astNodes = this.astAnalyzer.parseFileWithAST(relativePath, projectFiles);
        
        if (astNodes.length === 0) {
          continue;
        }

        // Analyze relevance
        const relevanceResult = await this.astAnalyzer.analyzeFileRelevance(
          prompt,
          relativePath,
          astNodes,
          'FULL_FILE',
          projectFiles,
          this.anthropic,
          this.tokenTracker
        );

        if (relevanceResult.isRelevant && relevanceResult.relevanceScore >= RELEVANCE_THRESHOLD) {
          this.streamUpdate(`✅ SECURE: Modifying ${relativePath} (score: ${relevanceResult.relevanceScore})`);
          
          // Generate modified content
          const modifiedContent = await this.generateModifiedContentSecurely(file, prompt, relevanceResult.reasoning);
          
          if (modifiedContent) {
            // SECURE file modification
            const modifyResult = await this.safeFullFileProcessor.modifyFileSafely(
              relativePath,
              modifiedContent,
              projectFiles
            );

            if (modifyResult.success) {
              modifiedCount++;
              await modificationSummary.addChange('modified', relativePath, `Secure modification: ${prompt.substring(0, 50)}...`);
              this.streamUpdate(`✅ SECURE: Modified ${relativePath}`);
            } else {
              this.streamUpdate(`❌ SECURE: Failed to modify ${relativePath}: ${modifyResult.error}`);
            }
          }
        }
      }

      // Update project files cache
      if (modifiedCount > 0) {
        await this.setProjectFiles(projectFiles);
      }

      this.streamUpdate(`🔒 SECURE full file modification complete: ${modifiedCount} files modified`);
      return modifiedCount > 0;

    } catch (error) {
      this.streamUpdate(`❌ SECURE full file modification failed: ${error}`);
      return false;
    }
  }

  // ==============================================================
  // SECURE CONTENT GENERATION HELPERS
  // ==============================================================

  private async extractComponentNameSecurely(prompt: string): Promise<string> {
    // Safe AI extraction - no file system operations
    const extractionPrompt = `Extract component name from: "${prompt}". Return only the PascalCase name, nothing else.`;
    
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 30,
        temperature: 0,
        messages: [{ role: 'user', content: extractionPrompt }],
      });

      this.tokenTracker.logUsage(response.usage, 'Secure Component Name Extraction');

      const firstBlock = response.content[0];
      if (firstBlock?.type === 'text') {
        let name = firstBlock.text.trim().replace(/[^a-zA-Z]/g, '');
        if (name && name.length > 0) {
          return name.charAt(0).toUpperCase() + name.slice(1);
        }
      }
    } catch (error) {
      this.streamUpdate(`⚠️ AI extraction failed: ${error}`);
    }

    // Fallback pattern matching
    return this.fallbackExtractComponentName(prompt);
  }

  private fallbackExtractComponentName(prompt: string): string {
    const patterns = [
      /create.*?([A-Za-z]+).*?page/i,
      /add.*?([A-Za-z]+).*?component/i,
      /make.*?([A-Za-z]+)/i,
      /([A-Za-z]+).*?page/i,
      /([A-Za-z]+).*?component/i
    ];

    for (const pattern of patterns) {
      const match = prompt.match(pattern);
      if (match && match[1] && match[1].length > 2) {
        return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      }
    }

    return 'NewComponent';
  }

  private determineComponentType(prompt: string): 'component' | 'page' {
    return /page|route|screen|view/i.test(prompt) ? 'page' : 'component';
  }

  private async generateComponentContentSecurely(
    componentName: string,
    componentType: 'component' | 'page',
    prompt: string
  ): Promise<string | null> {
    // Safe content generation - no file operations
    const generationPrompt = `
Create a React TypeScript ${componentType} named ${componentName}.

Requirements:
- Use TypeScript (.tsx)
- Export as default
- Include basic functionality based on: "${prompt}"
- Use modern React with hooks
- Include basic styling with Tailwind classes
- Keep it simple and functional

Return ONLY the complete component code:
`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 2000,
        temperature: 0,
        messages: [{ role: 'user', content: generationPrompt }],
      });

      this.tokenTracker.logUsage(response.usage, `Secure Component Generation: ${componentName}`);

      const firstBlock = response.content[0];
      if (firstBlock?.type === 'text') {
        const text = firstBlock.text;
        const codeMatch = text.match(/```(?:tsx|typescript|jsx|javascript)\n([\s\S]*?)```/);
        return codeMatch ? codeMatch[1].trim() : text.trim();
      }
    } catch (error) {
      this.streamUpdate(`❌ Component generation failed: ${error}`);
    }

    return null;
  }

  private async generateAppUpdateContentSecurely(
    componentName: string,
    projectFiles: Map<string, ProjectFile>
  ): Promise<string | null> {
    // Find App.tsx safely
    const appFile = projectFiles.get('src/App.tsx') || projectFiles.get('src/App.jsx');
    if (!appFile) {
      return null;
    }

    const updatePrompt = `
Update this App.tsx file to include routing for new page component ${componentName}:

Current App.tsx:
\`\`\`tsx
${appFile.content}
\`\`\`

Requirements:
1. Add import for ${componentName} from './pages/${componentName}'
2. Add route for /${componentName.toLowerCase()} 
3. Add React Router imports if not present
4. Wrap in BrowserRouter if needed
5. Preserve all existing functionality

Return ONLY the complete updated App.tsx:
`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 3000,
        temperature: 0,
        messages: [{ role: 'user', content: updatePrompt }],
      });

      this.tokenTracker.logUsage(response.usage, 'Secure App.tsx Update');

      const firstBlock = response.content[0];
      if (firstBlock?.type === 'text') {
        const text = firstBlock.text;
        const codeMatch = text.match(/```(?:tsx|typescript|jsx|javascript)\n([\s\S]*?)```/);
        return codeMatch ? codeMatch[1].trim() : null;
      }
    } catch (error) {
      this.streamUpdate(`❌ App.tsx update generation failed: ${error}`);
    }

    return null;
  }

  private async generateModifiedContentSecurely(
    file: ProjectFile,
    prompt: string,
    reasoning: string
  ): Promise<string | null> {
    const modificationPrompt = `
Modify this React file based on the user request:

USER REQUEST: "${prompt}"
WHY THIS FILE: ${reasoning}

CURRENT FILE (${file.relativePath}):
\`\`\`tsx
${file.content}
\`\`\`

Requirements:
1. Preserve ALL imports and exports exactly
2. Keep component structure intact
3. Only modify what's necessary for the request
4. Maintain TypeScript types
5. Keep existing functionality

Return ONLY the complete modified file:
`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 4000,
        temperature: 0,
        messages: [{ role: 'user', content: modificationPrompt }],
      });

      this.tokenTracker.logUsage(response.usage, `Secure File Modification: ${file.relativePath}`);

      const firstBlock = response.content[0];
      if (firstBlock?.type === 'text') {
        const text = firstBlock.text;
        const codeMatch = text.match(/```(?:tsx|typescript|jsx|javascript)\n([\s\S]*?)```/);
        return codeMatch ? codeMatch[1].trim() : null;
      }
    } catch (error) {
      this.streamUpdate(`❌ Content modification failed: ${error}`);
    }

    return null;
  }

  // ==============================================================
  // MAIN SECURE PROCESSING METHOD
  // ==============================================================

  async processModification(
    prompt: string, 
    conversationContext?: string,
    dbSummary?: string,
    projectSummaryCallback?: (summary: string, prompt: string) => Promise<string | null>
  ): Promise<ModificationResult> {
    try {
      this.streamUpdate('🔒 Starting SECURE intelligent modification workflow...');
      
      await this.initializeSession();
      
      const projectFiles = await this.getProjectFiles();
      
      if (projectFiles.size === 0) {
        return { 
          success: false, 
          error: 'No secure React files found in src directory',
          selectedFiles: [],
          addedFiles: []
        };
      }

      // Build project summary for scope analysis
      const projectSummary = dbSummary || this.buildProjectSummary(projectFiles);
      const contextWithSummary = (conversationContext || '') + '\n\n' + await this.getModificationContextualSummary();
      
      // Analyze scope
      const scope = await this.scopeAnalyzer.analyzeScope(
        prompt, 
        projectSummary, 
        contextWithSummary,
        dbSummary
      );
      
      this.streamUpdate(`📋 SECURE modification method: ${scope.scope}`);

      // Execute the chosen approach securely
      switch (scope.scope) {
        case 'COMPONENT_ADDITION':
          const componentResult = await this.handleSecureComponentAddition(prompt, scope, projectSummaryCallback);
          return componentResult;
          
        case 'FULL_FILE':
          const success = await this.handleSecureFullFileModification(prompt);
          if (success) {
            const modificationSummary = await this.getModificationContextualSummary();
            const mostModified = await this.getMostModifiedFiles();
            
            return {
              success: true,
              selectedFiles: mostModified.map(item => item.file),
              addedFiles: [],
              approach: 'FULL_FILE',
              reasoning: `${scope.reasoning} Secure modification of files within src/ only.`,
              modificationSummary,
              tokenUsage: this.tokenTracker.getStats()
            };
          } else {
            return {
              success: false,
              error: 'Secure full file modification failed',
              selectedFiles: [],
              addedFiles: [],
              approach: 'FULL_FILE',
              reasoning: scope.reasoning,
              tokenUsage: this.tokenTracker.getStats()
            };
          }
          
        case 'TARGETED_NODES':
          // For now, fall back to full file for targeted modifications
          this.streamUpdate('🔒 Using secure full file modification for targeted changes...');
          const targetedSuccess = await this.handleSecureFullFileModification(prompt);
          
          if (targetedSuccess) {
            const modificationSummary = await this.getModificationContextualSummary();
            const mostModified = await this.getMostModifiedFiles();
            
            return {
              success: true,
              selectedFiles: mostModified.map(item => item.file),
              addedFiles: [],
              approach: 'TARGETED_NODES',
              reasoning: `${scope.reasoning} Secure targeted modification within src/ only.`,
              modificationSummary,
              tokenUsage: this.tokenTracker.getStats()
            };
          } else {
            return {
              success: false,
              error: 'Secure targeted modification failed',
              selectedFiles: [],
              addedFiles: [],
              approach: 'TARGETED_NODES',
              reasoning: scope.reasoning,
              tokenUsage: this.tokenTracker.getStats()
            };
          }
          
        default:
          return { 
            success: false, 
            error: 'Unknown modification scope',
            selectedFiles: [],
            addedFiles: []
          };
      }
      
    } catch (error) {
      console.error('❌ SECURE modification process failed:', error);
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

  private buildProjectSummary(projectFiles: Map<string, ProjectFile>): string {
    const totalFiles = projectFiles.size;
    const componentFiles = Array.from(projectFiles.keys()).filter(path => 
      path.includes('.tsx') || path.includes('.jsx')
    ).length;
    
    const keyFiles = Array.from(projectFiles.keys())
      .filter(path => path.includes('App.') || path.includes('index.') || path.includes('main.'))
      .slice(0, 3);
    
    return `Secure React TypeScript project with ${totalFiles} files (${componentFiles} components) in src/ directory. Key files: ${keyFiles.join(', ')}.`;
  }

  private async getModificationContextualSummary(): Promise<string> {
    const modificationSummary = await this.getModificationSummary();
    return await modificationSummary.getContextualSummary();
  }

  private async getMostModifiedFiles(): Promise<Array<{ file: string; count: number }>> {
    const modificationSummary = await this.getModificationSummary();
    return await modificationSummary.getMostModifiedFiles();
  }

  async cleanup(): Promise<void> {
    await this.redis.disconnect();
  }
}