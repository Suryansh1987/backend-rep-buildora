import { ProjectFile } from '../filemodifier/types';
import { RedisModificationSummary } from '../filemodifier/modification';
import { ASTAnalyzer } from './Astanalyzer';
import { TokenTracker } from '../../utils/TokenTracer';
export declare class FullFileProcessor {
    private anthropic;
    private tokenTracker;
    private astAnalyzer;
    private structureValidator;
    private streamCallback?;
    constructor(anthropic: any, tokenTracker: TokenTracker, astAnalyzer: ASTAnalyzer);
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    handleFullFileModification(prompt: string, projectFiles: Map<string, ProjectFile>, modificationSummary: RedisModificationSummary): Promise<boolean>;
    private shouldSkipFile;
    private modifyFullFileWithTemplate;
    private modifyFullFileWithLayoutTemplate;
    private modifyFullFileForNavigation;
    private analyzeFileForTemplate;
    private generateProjectSummary;
}
