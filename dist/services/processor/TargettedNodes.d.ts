import { ProjectFile } from '../filemodifier/types';
import { RedisModificationSummary } from '../filemodifier/modification';
import { ASTAnalyzer } from './Astanalyzer';
import { TokenTracker } from '../../utils/TokenTracer';
export declare class FixedTargetedNodesProcessor {
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
     * FIXED: Only skip actual styling files, NOT component directories
     */
    private shouldSkipFile;
    /**
     * Check if file contains actual business logic (not just styling)
     */
    private hasBusinessLogic;
    /**
     * FIXED: Don't filter out UI nodes - process ALL nodes in component files
     */
    private shouldProcessNode;
    /**
     * Main entry point matching the expected interface
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
                componentsAffected?: string[];
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
                componentsAffected?: string[];
                reasoning?: string;
            };
        }>;
    }>;
    /**
     * Legacy method - now calls the main processor
     */
    handleTargetedModification(prompt: string, projectFiles: Map<string, ProjectFile>, modificationSummary?: RedisModificationSummary | any): Promise<boolean>;
    private modifyCodeSnippetsWithTemplate;
    private applyModifications;
    private analyzeFileForTemplate;
    private generateProjectSummary;
}
export { FixedTargetedNodesProcessor as TargetedNodesProcessor };
