import { ProjectFile, ASTNode, FileRelevanceResult } from '../filemodifier/types';
import { TokenTracker } from '../../utils/TokenTracer';
export declare class ASTAnalyzer {
    private streamCallback?;
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    parseFileWithAST(filePath: string, projectFiles: Map<string, ProjectFile>): ASTNode[];
    analyzeFileRelevance(prompt: string, filePath: string, astNodes: ASTNode[], modificationMethod: 'FULL_FILE' | 'TARGETED_NODES', projectFiles: Map<string, ProjectFile>, anthropic: any, tokenTracker: TokenTracker): Promise<FileRelevanceResult>;
    private parseSimpleRelevanceResponse;
    forceAnalyzeSpecificFiles(prompt: string, filePaths: string[], method: 'FULL_FILE' | 'TARGETED_NODES', projectFiles: Map<string, ProjectFile>, anthropic: any, tokenTracker: TokenTracker): Promise<Array<{
        filePath: string;
        isRelevant: boolean;
        score: number;
        reasoning: string;
        targetNodes?: ASTNode[];
    }>>;
}
