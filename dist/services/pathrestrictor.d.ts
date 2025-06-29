import { ProjectFile } from './filemodifier/types';
export declare class PathRestrictionManager {
    private reactBasePath;
    private srcPath;
    private streamCallback?;
    constructor(reactBasePath: string);
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    /**
     * CRITICAL: Validate that a path is within src/ folder only
     */
    validatePathInSrc(filePath: string): {
        isValid: boolean;
        normalizedPath: string;
        error?: string;
    };
    /**
     * ENHANCED: Safe file path resolution with strict src restriction
     */
    resolveSafeFilePath(relativePath: string): string | null;
    /**
     * CRITICAL: Verify file exists and is within src before any operation
     */
    verifyFileInSrc(filePath: string): Promise<{
        isValid: boolean;
        resolvedPath?: string;
        error?: string;
    }>;
    /**
     * CRITICAL: Safe write operation - only within src
     */
    safeWriteFile(filePath: string, content: string): Promise<{
        success: boolean;
        actualPath?: string;
        error?: string;
    }>;
    /**
     * ENHANCED: Clean project file paths with validation
     */
    cleanProjectFilePaths(projectFiles: Map<string, ProjectFile>): Map<string, ProjectFile>;
    /**
     * SECURITY: Check for suspicious file operations
     */
    detectSuspiciousActivity(filePath: string): {
        isSuspicious: boolean;
        reason?: string;
    };
    /**
     * AUDIT: Log all file operations for security
     */
    auditFileOperation(operation: 'read' | 'write' | 'create', filePath: string, success: boolean): void;
    /**
     * UTILITY: Get safe src subdirectories
     */
    getAllowedSrcSubdirectories(): string[];
    /**
     * VALIDATION: Ensure file is in allowed src subdirectory
     */
    isInAllowedDirectory(filePath: string): boolean;
}
export declare class SafeComponentAdditionProcessor {
    private pathManager;
    private anthropic;
    private reactBasePath;
    private tokenTracker;
    private streamCallback?;
    constructor(anthropic: any, reactBasePath: string, tokenTracker: any);
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    /**
     * ENHANCED: Safe component file creation
     */
    createComponentSafely(componentName: string, componentType: 'component' | 'page', content: string): Promise<{
        success: boolean;
        filePath?: string;
        error?: string;
    }>;
    /**
     * ENHANCED: Safe App.tsx update with strict validation
     */
    updateAppSafely(projectFiles: Map<string, ProjectFile>, componentName: string, content: string): Promise<{
        success: boolean;
        updatedFiles?: string[];
        error?: string;
    }>;
}
export declare class SafeFullFileProcessor {
    private pathManager;
    private anthropic;
    private tokenTracker;
    private streamCallback?;
    constructor(anthropic: any, tokenTracker: any, reactBasePath: string);
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    /**
     * ENHANCED: Safe file modification
     */
    modifyFileSafely(filePath: string, modifiedContent: string, projectFiles: Map<string, ProjectFile>): Promise<{
        success: boolean;
        actualPath?: string;
        error?: string;
    }>;
}
export declare class SafeProjectAnalyzer {
    private pathManager;
    private reactBasePath;
    private streamCallback?;
    constructor(reactBasePath: string);
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    /**
     * ENHANCED: Safe project tree building - src only
     */
    buildProjectTreeSafely(projectFiles: Map<string, ProjectFile>): Promise<void>;
    /**
     * SAFE: Analyze individual file
     */
    private analyzeFileSafely;
    private extractComponentName;
}
