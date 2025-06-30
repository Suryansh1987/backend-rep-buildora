import { ProjectFile } from './filemodifier/types';
export type SecurityLevel = 'strict' | 'moderate' | 'relaxed' | 'minimal';
export interface PathRestrictionConfig {
    securityLevel: SecurityLevel;
    allowedDirectories?: string[];
    blockedPatterns?: Array<{
        pattern: RegExp;
        reason: string;
    }>;
    allowPathTraversal?: boolean;
    allowAbsolutePaths?: boolean;
    requireSrcFolder?: boolean;
    auditOperations?: boolean;
    validateFileExtensions?: boolean;
    allowedExtensions?: string[];
}
export declare class PathRestrictionManager {
    private reactBasePath;
    private srcPath;
    private streamCallback?;
    private config;
    constructor(reactBasePath: string, config?: Partial<PathRestrictionConfig>);
    private mergeWithDefaults;
    private getDefaultConfigForLevel;
    updateConfig(newConfig: Partial<PathRestrictionConfig>): void;
    getConfig(): PathRestrictionConfig;
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    /**
     * CONFIGURABLE: Validate path based on current security settings
     */
    validatePathInSrc(filePath: string): {
        isValid: boolean;
        normalizedPath: string;
        error?: string;
    };
    /**
     * CONFIGURABLE: Safe file path resolution
     */
    resolveSafeFilePath(relativePath: string): string | null;
    /**
     * CONFIGURABLE: Verify file exists and is accessible
     */
    verifyFileInSrc(filePath: string): Promise<{
        isValid: boolean;
        resolvedPath?: string;
        error?: string;
    }>;
    /**
     * CONFIGURABLE: Safe write operation
     */
    safeWriteFile(filePath: string, content: string): Promise<{
        success: boolean;
        actualPath?: string;
        error?: string;
    }>;
    /**
     * CONFIGURABLE: Safe file modification
     */
    safeModifyFile(filePath: string, content: string): Promise<{
        success: boolean;
        actualPath?: string;
        error?: string;
    }>;
    /**
     * CONFIGURABLE: Clean project file paths with validation
     */
    cleanProjectFilePaths(projectFiles: Map<string, ProjectFile>): Map<string, ProjectFile>;
    /**
     * CONFIGURABLE: Check for suspicious file operations
     */
    detectSuspiciousActivity(filePath: string): {
        isSuspicious: boolean;
        reason?: string;
    };
    /**
     * CONFIGURABLE: Audit file operations
     */
    auditFileOperation(operation: 'read' | 'write' | 'create', filePath: string, success: boolean): void;
    /**
     * CONFIGURABLE: Get allowed directories based on security level
     */
    getAllowedSrcSubdirectories(): string[];
    /**
     * CONFIGURABLE: Check if file is in allowed directory
     */
    isInAllowedDirectory(filePath: string): boolean;
    setSecurityLevel(level: SecurityLevel): void;
    getCurrentSecurityLevel(): SecurityLevel;
    addAllowedDirectory(directory: string): void;
    removeAllowedDirectory(directory: string): void;
    addBlockedPattern(pattern: RegExp, reason: string): void;
    removeBlockedPattern(patternSource: string): void;
}
export declare function createPathManager(reactBasePath: string, options?: {
    securityLevel?: SecurityLevel;
    allowSrcOnly?: boolean;
    enableAudit?: boolean;
    customAllowedDirs?: string[];
    customBlockedPatterns?: Array<{
        pattern: RegExp;
        reason: string;
    }>;
}): PathRestrictionManager;
