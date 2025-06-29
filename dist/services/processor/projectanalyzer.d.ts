import { ProjectFile, PageInfo } from '../filemodifier/types';
import { DependencyManager } from '../filemodifier/dependancy';
import { ASTAnalyzer } from './Astanalyzer';
import { TokenTracker } from '../../utils/TokenTracer';
export declare class ProjectAnalyzer {
    private reactBasePath;
    private streamCallback?;
    constructor(reactBasePath: string);
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    buildProjectTree(projectFiles: Map<string, ProjectFile>, dependencyManager: DependencyManager, streamCallback?: (message: string) => void): Promise<void>;
    private analyzeFile;
    buildProjectSummary(projectFiles: Map<string, ProjectFile>): string;
    getProjectAnalytics(prompt: string | undefined, projectFiles: Map<string, ProjectFile>, astAnalyzer: ASTAnalyzer, anthropic: any, tokenTracker: TokenTracker): Promise<{
        totalFiles: number;
        analyzedFiles: number;
        potentialTargets?: Array<{
            filePath: string;
            elementCount: number;
            relevanceScore?: number;
        }>;
    }>;
    getUnusedPagesInfo(projectFiles: Map<string, ProjectFile>, reactBasePath: string): Promise<PageInfo[]>;
    private findUnusedPages;
    private scanPagesDirectory;
    private extractComponentNameFromContent;
    private checkForButtons;
    private checkForSignin;
    private isMainFile;
}
