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
     * Emergency fallback - create component with minimal dependencies
     */
    private emergencyCreateComponent;
}
