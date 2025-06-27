// ============================================================================
// TYPES: filemodifier/types.ts - Complete Type Definitions
// ============================================================================

export interface ProjectFile {
  name: string;
  path: string;
  relativePath: string;
  content: string;
  lines: number;
  size: number;
  snippet: string;
  componentName: string | null;
  hasButtons: boolean;
  hasSignin: boolean;
  isMainFile: boolean;
}

export interface ASTNode {
  id: string;
  type: string;
  tagName?: string;
  textContent: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  codeSnippet: string;
  fullContext: string;
  isButton: boolean;
  hasSigninText: boolean;
  attributes?: string[];
}

export interface CodeRange {
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  originalCode: string;
}

export interface FileStructure {
  imports: string[];
  exports: string[];
  componentName: string | null;
  hasDefaultExport: boolean;
  fileHeader: string;
  fileFooter: string;
  preservationPrompt: string;
  components: string[];
  hooks?: string[];
}

export interface FileRelevanceResult {
  isRelevant: boolean;
  reasoning: string;
  relevanceScore: number;
  targetNodes?: ASTNode[];
}

export interface PageInfo {
  name: string;
  path: string;
  isImported: boolean;
  isUsedInRouting: boolean;
  suggestedRoute: string;
}

export interface ModificationChange {
  type: 'modified' | 'created' | 'updated';
  file: string;
  description: string;
  timestamp: string;
  approach?: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION';
  success?: boolean;
  details?: {
    linesChanged?: number;
    componentsAffected?: string[];
    reasoning?: string;
  };
}

export interface ModificationSessionSummary {
  changes: ModificationChange[];
  totalFiles: number;
  totalChanges: number;
  approach: string;
  sessionDuration: number;
  successRate: number;
  startTime: string;
  endTime: string;
}

export interface ComponentSpec {
  name: string;
  type: 'component' | 'page';
  description: string;
  userRequest: string;
}

export interface FileStructureSummary {
  components: Array<{
    name: string;
    path: string;
    exports: string[];
    canAcceptChildren: boolean;
    level: number;
  }>;
  pages: Array<{
    name: string;
    path: string;
    exports: string[];
    level: number;
  }>;
  appStructure: {
    path: string;
    hasRouting: boolean;
    existingRoutes: string[];
    importedPages: string[];
  };
}

export interface ComponentGenerationResult {
  success: boolean;
  generatedFile?: string;
  updatedFiles: string[];
  componentContent?: string;
  integrationPath: 'component' | 'page' | 'app';
  error?: string;
  projectSummary?: string;
}

export interface ComponentIntegrationLevel {
  level: number;
  type: 'component' | 'page' | 'app';
  description: string;
  compatibleWith: string[];
}

export interface ModificationScope {
  scope: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION';
  files: string[];
  reasoning: string;
  
  // Component addition specific properties
  componentName?: string;
  componentType?: 'component' | 'page' | 'app';
  dependencies?: string[];
  integrationLevel?: ComponentIntegrationLevel;
  
  // Enhanced properties for better tracking
  estimatedComplexity?: 'low' | 'medium' | 'high';
  requiresRouting?: boolean;
  affectedLevels?: number[];
}

export interface ModificationResult {
  success: boolean;
  selectedFiles?: string[];
  addedFiles?: string[];
  approach?: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION';
  reasoning?: string;
  error?: string;
  modificationSummary?: string;
  
  // Enhanced properties
  modifiedRanges?: Array<{
    file: string;
    range: CodeRange;
    modifiedCode: string;
  }>;
  
  // Component generation specific results
  componentGenerationResult?: ComponentGenerationResult;
  integrationSummary?: {
    level: number;
    integratedWith: string[];
    routingUpdated: boolean;
    newRoutes: string[];
  };
  
  // Token usage tracking
  tokenUsage?: {
    totalInputTokens: number;
    totalOutputTokens: number;
    apiCalls: number;
    totalTokens: number;
    estimatedCost: number;
  };
}

// File analysis interfaces for component generation
export interface ComponentAnalysis {
  name: string;
  path: string;
  type: 'component' | 'page';
  level: number;
  exports: string[];
  imports: string[];
  canAcceptChildren: boolean;
  hasRouting: boolean;
  isContainer: boolean;
  childComponents: string[];
}

export interface ProjectStructureAnalysis {
  totalComponents: number;
  totalPages: number;
  hasAppRouter: boolean;
  routingType: 'react-router' | 'next-router' | 'none';
  componentHierarchy: Map<string, ComponentAnalysis>;
  integrationOpportunities: Array<{
    parentComponent: string;
    level: number;
    compatibility: number;
  }>;
}

// Integration strategies
export interface IntegrationStrategy {
  type: 'component-to-component' | 'component-to-page' | 'page-to-app';
  targetFile: string;
  method: 'import-and-use' | 'route-addition' | 'children-prop';
  confidence: number;
  reasoning: string;
}

// Enhanced AST node interface for component generation
export interface ComponentASTNode extends ASTNode {
  canAcceptNewChildren: boolean;
  componentType: 'container' | 'leaf' | 'layout';
  integrationPoints: Array<{
    line: number;
    type: 'children' | 'sibling' | 'wrapper';
    suitability: number;
  }>;
}

// Validation and structure interfaces
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score: number;
}

export interface StructureAnalysis {
  hasImports: boolean;
  hasExports: boolean;
  hasDefaultExport: boolean;
  componentNames: string[];
  importPaths: string[];
  exportTypes: string[];
  jsxElements: string[];
  hooks: string[];
  complexity: 'low' | 'medium' | 'high';
}

export interface RepairResult {
  success: boolean;
  repairedContent?: string;
  appliedFixes: string[];
  unresolvedIssues: string[];
}

// Token tracking interfaces
export interface TokenUsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  apiCalls: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface TokenUsageLog {
  timestamp: Date;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  cost: number;
}

export interface SessionStats {
  sessionStart: Date;
  sessionDuration: number;
  operationsPerformed: string[];
  averageTokensPerOperation: number;
  costBreakdown: {
    inputCost: number;
    outputCost: number;
    totalCost: number;
  };
}

// Project analytics interfaces
export interface ProjectAnalytics {
  totalFiles: number;
  analyzedFiles: number;
  potentialTargets?: Array<{
    filePath: string;
    elementCount: number;
    relevanceScore?: number;
  }>;
}

// Component generation analytics
export interface ComponentGenerationAnalytics {
  totalComponents: number;
  totalPages: number;
  hasRouting: boolean;
  availableForIntegration: number;
}

// File analysis result for forced analysis
export interface FileAnalysisResult {
  filePath: string;
  isRelevant: boolean;
  score: number;
  reasoning: string;
  targetNodes?: ASTNode[];
}

// Fallback mechanism interfaces
export interface FallbackResult {
  success: boolean;
  modifiedFiles: string[];
  approach: string;
  reasoning: string;
  error?: string;
}

// Dependency management interfaces
export interface DependencyInfo {
  file: string;
  dependencies: string[];
  dependents: string[];
  importChain: string[];
}

// Scope analysis interfaces
export interface ScopeAnalysisResult {
  scope: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION';
  reasoning: string;
  confidence: number;
  files: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
}