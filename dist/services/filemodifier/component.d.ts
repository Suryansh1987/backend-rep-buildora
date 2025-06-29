import Anthropic from '@anthropic-ai/sdk';
interface ComponentSpec {
    name: string;
    type: 'component' | 'page';
    description: string;
    userRequest: string;
}
interface PageIntegrationAnalysis {
    pagePath: string;
    pageName: string;
    shouldIntegrate: boolean;
    reasoning: string;
    integrationPoint: string;
    confidence: number;
}
interface FileStructureSummary {
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
        elementTree?: string;
    }>;
    appStructure: {
        path: string;
        hasRouting: boolean;
        existingRoutes: string[];
        importedPages: string[];
    };
}
interface GenerationResult {
    success: boolean;
    generatedFile?: string;
    updatedFiles: string[];
    componentContent?: string;
    integrationPath: 'component' | 'page' | 'app';
    integratedWithPages?: string[];
    error?: string;
}
export declare class ComponentGenerationSystem {
    private anthropic;
    private reactBasePath;
    private streamCallback?;
    private fileStructureSummary;
    private projectSummary;
    private projectSummaryCallback?;
    constructor(anthropic: Anthropic, reactBasePath: string);
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    setProjectSummary(summary: string | null): void;
    setProjectSummaryCallback(callback: (summary: string, prompt: string) => Promise<string | null>): void;
    /**
     * ENHANCED: Main component generation workflow with intelligent type detection
     */
    generateComponent(spec: ComponentSpec): Promise<GenerationResult>;
    /**
     * NEW: Intelligent component vs page decision using Claude
     */
    private intelligentlyDecideComponentType;
    /**
     * Fallback component type decision using pattern matching
     */
    private fallbackComponentTypeDecision;
    /**
     * ENHANCED: Extract file structure with page element trees
     */
    private extractFileStructure;
    /**
     * NEW: Analyze page file with element tree for component integration
     */
    private analyzePageFileWithElementTree;
    /**
     * Calculate JSX nesting depth
     */
    private calculateJSXDepth;
    /**
     * NEW: Integrate component with existing pages using intelligent analysis
     */
    private integrateComponentWithPages;
    /**
     * NEW: Analyze if a component should be integrated with a specific page
     */
    private analyzePageIntegration;
    /**
     * Fallback page integration analysis using pattern matching
     */
    private fallbackPageIntegrationAnalysis;
    /**
     * NEW: Update page file with component integration
     */
    private updatePageWithComponent;
    /**
     * EXISTING: Page integration with App.tsx (unchanged)
     */
    private integratePageWithApp;
    /**
     * EXISTING METHODS (unchanged for backward compatibility)
     */
    private generateComponentContent;
    private getContentGuidanceForRequest;
    private createComponentFile;
    private updateFileStructureSummary;
    private scanDirectory;
    private analyzeComponentFile;
    private analyzeAppFile;
    private integrateWithApp;
    private updateAppFile;
    private updateProjectSummaryAfterCreation;
    private extractNameFromPath;
    /**
     * Public methods for external access
     */
    getFileStructureSummary(): FileStructureSummary | null;
    refreshFileStructure(): Promise<void>;
    generateComponentWithUniqueNaming(spec: ComponentSpec): Promise<GenerationResult>;
    private isComponentNameTaken;
    private generateUniqueComponentName;
    /**
     * NEW: Get integration analytics for debugging
     */
    getIntegrationAnalytics(): Promise<{
        totalComponents: number;
        totalPages: number;
        hasRouting: boolean;
        pagesWithElementTrees: number;
        averagePageComplexity: number;
    }>;
    /**
     * NEW: Force analyze specific page for integration testing
     */
    forceAnalyzePageIntegration(pageName: string, componentSpec: ComponentSpec): Promise<PageIntegrationAnalysis | null>;
}
export {};
