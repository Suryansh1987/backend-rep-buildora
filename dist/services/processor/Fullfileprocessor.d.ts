interface ProjectFile {
    path: string;
    relativePath: string;
    content: string;
    lines: number;
    isMainFile: boolean;
    fileType: string;
    lastModified?: Date;
}
interface ChangeRecord {
    type: string;
    file: string;
    description: string;
    success: boolean;
    details?: {
        linesChanged?: number;
        changeType?: string[];
        reasoning?: string;
    };
}
interface TokenTracker {
    logUsage(usage: any, description: string): void;
    getStats(): {
        totalTokens: number;
        estimatedCost: number;
    };
}
export declare class FullFileProcessor {
    private anthropic;
    private tokenTracker;
    private streamCallback?;
    private basePath;
    constructor(anthropic: any, tokenTracker: TokenTracker, basePath?: string);
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    /**
     * Main entry point for dynamic file modification
     * Handles various input types for backward compatibility
     */
    processFullFileModification(prompt: string, folderNameOrProjectFiles: string | Map<string, ProjectFile>, streamCallbackOrBasePath?: ((message: string) => void) | string, legacyStreamCallback?: (message: string) => void): Promise<{
        success: boolean;
        changes?: ChangeRecord[];
        modifiedFiles?: string[];
    }>;
    /**
     * Generate file tree from project files Map (when files are provided instead of loading from disk)
     */
    private generateFileTreeFromProjectFiles;
    /**
     * Extract folder name from various path formats
     * Updated to handle projects without src subdirectory and preserve temp-build structure
     */
    private extractFolderNameFromPath;
    /**
     * Resolve project path with async waiting and retry logic
     * Handles cases where file extraction is still in progress
     */
    private resolveProjectPathAsync;
    /**
     * Legacy sync resolve method for backward compatibility
     */
    private resolveProjectPath;
    /**
     * Check if a path contains project files
     */
    private hasProjectFiles;
    /**
     * Sleep utility function
     */
    private sleep;
    /**
     * Enhanced path existence check with better error handling
     */
    private pathExists;
    /**
     * Wait for project to be ready (extraction complete)
     */
    private waitForProjectReady;
    /**
     * Generate file tree representation with smart filtering
     */
    private generateFileTree;
    /**
     * Load all project files into memory
     */
    private loadProjectFiles;
    /**
     * Use Claude to analyze which files need changes based on file tree and user prompt
     */
    private analyzeFilesWithClaude;
    /**
     * Fallback file selection when Claude analysis fails
     */
    private getFallbackFileSelection;
    /**
     * Prepare dynamic batch modification request
     */
    private prepareDynamicBatchRequest;
    /**
     * Execute dynamic batch modification
     */
    private executeDynamicBatchModification;
    /**
     * Create dynamic modification prompt
     */
    private createDynamicModificationPrompt;
    /**
     * Extract modified files from Claude's response
     */
    private extractModifiedFilesFromResponse;
    /**
     * Apply modifications to actual files and optionally update Redis
     */
    private applyModificationsToFiles;
    private extractBuildIdFromPath;
    private updateRedisFile;
    /**
     * Process files with Redis integration
     */
    processFullFileModificationWithRedis(prompt: string, folderNameOrProjectFiles: string | Map<string, ProjectFile>, redisClient: any, streamCallbackOrBasePath?: ((message: string) => void) | string, legacyStreamCallback?: (message: string) => void): Promise<{
        success: boolean;
        changes?: ChangeRecord[];
        modifiedFiles?: string[];
    }>;
    /**
     * Sync individual change to Redis
     */
    private syncChangeToRedis;
    private shouldSkipFileOrDirectory;
    private isRelevantFile;
    private isMainFile;
    private determineFileType;
    private formatFileSize;
    private getFileIcon;
    private inferFilePurpose;
    private detectProjectType;
    private detectFramework;
    private getLanguageFromPath;
    /**
     * Legacy method for compatibility with existing code
     * Now handles the case where Map is passed as folderName
     */
    process(prompt: string, projectFiles: Map<string, ProjectFile>, reactBasePath: string, streamCallback: (message: string) => void): Promise<{
        success: boolean;
        changes?: ChangeRecord[];
        modifiedFiles?: string[];
    }>;
    /**
     * Legacy method for compatibility
     * Now handles the case where Map is passed as folderName
     */
    handleFullFileModification(prompt: string, projectFiles: Map<string, ProjectFile>, modificationSummary?: any): Promise<boolean>;
    /**
     * Get file tree as utility function
     */
    getFileTree(dirPath: string, prefix?: string): Promise<string>;
    /**
     * Static utility method to generate file tree
     */
    static generateFileTreeStatic(dirPath: string, prefix?: string): Promise<string>;
    /**
     * Scan project files utility
     */
    scanProjectFiles(projectPath: string): Promise<Map<string, ProjectFile>>;
    /**
     * Get project analysis with async path resolution
     */
    analyzeProject(folderName: string): Promise<{
        fileTree: string;
        projectFiles: Map<string, ProjectFile>;
        projectType: string;
        framework: string;
        mainFiles: string[];
    }>;
    /**
     * Enhanced method with file history consideration
     */
    processWithHistory(prompt: string, folderName: string, fileHistory: Array<{
        filePath: string;
        lastModified: Date;
        changeType: string[];
    }>, streamCallback?: (message: string) => void): Promise<{
        success: boolean;
        changes?: ChangeRecord[];
        modifiedFiles?: string[];
    }>;
}
export {};
