import { ProjectFile } from '../filemodifier/types';
import { RedisModificationSummary } from '../filemodifier/modification';
import { ASTAnalyzer } from './Astanalyzer';
import { TokenTracker } from '../../utils/TokenTracer';
export declare class GranularASTProcessor {
    private anthropic;
    private tokenTracker;
    private astAnalyzer;
    private structureValidator;
    private streamCallback?;
    private reactBasePath;
    constructor(anthropic: any, tokenTracker: TokenTracker, astAnalyzer: ASTAnalyzer, reactBasePath?: string);
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    private resolveFilePath;
    /**
     * MAIN GRANULAR PROCESSING METHOD
     */
    processGranularModification(prompt: string, projectFiles: Map<string, ProjectFile>, reactBasePath: string, streamCallback: (message: string) => void): Promise<{
        success: boolean;
        projectFiles?: Map<string, ProjectFile>;
        updatedProjectFiles?: Map<string, ProjectFile>;
        changes?: Array<{
            type: string;
            file: string;
            description: string;
            success: boolean;
            details?: {
                linesChanged?: number;
                nodesAnalyzed?: number;
                nodesSelected?: number;
                nodesModified?: number;
                reasoning?: string;
            };
        }>;
    }>;
    /**
     * STEP 2: Ask Claude to analyze file nodes and select which ones need changes
     */
    private analyzeFileNodes;
    /**
     * STEP 4: Generate modifications for selected nodes
     */
    private modifySelectedNodes;
    /**
     * STEP 5: Apply node modifications to the file
     */
    private applyNodeModifications;
    /**
     * Create AST tree representation for Claude
     */
    private createASTTreeRepresentation;
    /**
     * Get code preview for AST representation
     */
    private getCodePreview;
    /**
     * Filter to relevant files only
     */
    private filterRelevantFiles;
    /**
     * Check if file should be analyzed
     */
    private shouldAnalyzeFile;
    /**
     * Analyze file for template variables
     */
    private analyzeFileForTemplate;
    /**
     * Main method matching expected interface
     */
    processTargetedModification(prompt: string, projectFiles: Map<string, ProjectFile>, reactBasePath: string, streamCallback: (message: string) => void): Promise<{
        success: boolean;
        projectFiles?: Map<string, ProjectFile>;
        updatedProjectFiles?: Map<string, ProjectFile>;
        changes?: Array<{
            type: string;
            file: string;
            description: string;
            success: boolean;
            details?: {
                linesChanged?: number;
                nodesAnalyzed?: number;
                nodesSelected?: number;
                nodesModified?: number;
                reasoning?: string;
            };
        }>;
    }>;
    /**
     * Alternative method name for compatibility
     */
    process(prompt: string, projectFiles: Map<string, ProjectFile>, reactBasePath: string, streamCallback: (message: string) => void): Promise<{
        success: boolean;
        projectFiles?: Map<string, ProjectFile>;
        updatedProjectFiles?: Map<string, ProjectFile>;
        changes?: Array<{
            type: string;
            file: string;
            description: string;
            success: boolean;
            details?: {
                linesChanged?: number;
                nodesAnalyzed?: number;
                nodesSelected?: number;
                nodesModified?: number;
                reasoning?: string;
            };
        }>;
    }>;
    /**
     * Legacy method
     */
    handleTargetedModification(prompt: string, projectFiles: Map<string, ProjectFile>, modificationSummary?: RedisModificationSummary | any): Promise<boolean>;
}
export { GranularASTProcessor as TargetedNodesProcessor };
