export declare class SimpleBuildValidator {
    private buildPath;
    private streamCallback?;
    constructor(buildPath: string);
    setStreamCallback(callback: (message: string) => void): void;
    private log;
    /**
     * MAIN: Validate build before Azure deployment
     */
    validateBeforeDeployment(): Promise<{
        isValid: boolean;
        errors: string[];
        warnings: string[];
        fixedFiles: string[];
    }>;
    /**
     * Validate basic project structure
     */
    private validateProjectStructure;
    /**
     * Validate and auto-fix React/TypeScript files
     */
    private validateAndFixFiles;
    /**
     * Analyze React file for common issues
     */
    private analyzeReactFile;
    /**
     * Auto-fix common React file issues
     */
    private autoFixReactFile;
    /**
     * Quick syntax check without full TypeScript compilation
     */
    private quickSyntaxCheck;
    /**
     * Basic syntax checks without TypeScript compiler
     */
    private checkBasicSyntax;
    /**
     * Test local build
     */
    private testLocalBuild;
    /**
     * Validate package.json
     */
    private validatePackageJson;
    /**
     * Helper: Get all React files
     */
    private getAllReactFiles;
}
export declare function enhancedAzureDeployWithValidation(sourceZipUrl: string, buildId: string, config: {
    resourceGroup: string;
    containerAppEnv: string;
    acrName: string;
    storageConnectionString: string;
    storageAccountName: string;
}, tempBuildPath: string): Promise<string>;
