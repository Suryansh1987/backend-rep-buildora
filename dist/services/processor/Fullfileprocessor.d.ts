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
    private reactBasePath;
    constructor(anthropic: any, tokenTracker: TokenTracker, astAnalyzer: ASTAnalyzer, reactBasePath?: string);
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    /**
     * FIXED: Resolve the correct file path for saving
     */
    private resolveFilePath;
    /**
     * FIXED: Verify file exists before attempting modifications
     */
    private verifyFileExists;
    handleFullFileModification(prompt: string, projectFiles: Map<string, ProjectFile>, modificationSummary: RedisModificationSummary): Promise<boolean>;
    private shouldSkipFile;
    /**
     * FIXED: Modify full file with template and correct path handling
     */
    private modifyFullFileWithTemplate;
    /**
     * FIXED: Layout template modification with path handling
     */
    private modifyFullFileWithLayoutTemplate;
    /**
     * FIXED: Navigation modification with path handling
     */
    private modifyFullFileForNavigation;
    private analyzeFileForTemplate;
    private generateProjectSummary;
}
