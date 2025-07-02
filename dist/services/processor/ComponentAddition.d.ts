interface ProjectFile {
    path: string;
    relativePath: string;
    content: string;
    lines: number;
    isMainFile: boolean;
    fileType: string;
    lastModified?: Date;
}
interface FileRequirement {
    filePath: string;
    required: boolean;
    exists: boolean;
    purpose: string;
    priority: 'high' | 'medium' | 'low';
    operation: 'create' | 'update' | 'skip';
}
interface ComponentAnalysis {
    type: 'component' | 'page';
    name: string;
    confidence: number;
    reasoning: string;
    fileRequirements: FileRequirement[];
}
export declare class EnhancedAtomicComponentProcessor {
    private anthropic;
    private reactBasePath;
    private streamCallback?;
    private pathManager;
    private analyzer;
    private generator;
    constructor(anthropic: any, reactBasePath: string);
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    handleComponentAddition(prompt: string, scope: any, projectFiles: Map<string, any>, modificationSummary: any, componentGenerationSystem: any, projectSummaryCallback?: (summary: string, prompt: string) => Promise<string | null>): Promise<any>;
    /**
     * Scan project files (inspired by full file modifier)
     */
    private scanProjectFiles;
    private shouldSkipDirectory;
    private isRelevantFile;
    private isMainFile;
    private determineFileType;
    componentGenerationSystem(prompt: string, modificationSummary: {
        addChange: (operation: string, filePath: string, description: string, meta: {
            success: boolean;
            linesChanged: number;
            reasoning: string | undefined;
        }) => Promise<void>;
        getSummary: () => Promise<string>;
    }, componentGenerationSystem: any, projectSummaryCallback?: (summary: string, prompt: string) => Promise<string | null>): Promise<{
        success: boolean;
        selectedFiles: string[];
        addedFiles: string[];
        approach: string;
        reasoning: string;
        modificationSummary: string;
        componentGenerationResult: {
            success: boolean;
            generatedFiles: string[];
            updatedFiles: string[];
            analysis: ComponentAnalysis;
            projectSummary: string;
            existingFiles: Map<string, ProjectFile>;
        };
        tokenUsage: {
            totalTokens: number;
            inputTokens: number;
            outputTokens: number;
        };
    }>;
    private applyBatchChanges;
}
export {};
