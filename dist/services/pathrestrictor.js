"use strict";
// ============================================================================
// CONFIGURABLE PATH RESTRICTION SYSTEM - Adjustable Security Levels
// ============================================================================
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PathRestrictionManager = void 0;
exports.createPathManager = createPathManager;
const fs_1 = require("fs");
const path_1 = require("path");
class PathRestrictionManager {
    constructor(reactBasePath, config) {
        this.reactBasePath = (0, path_1.resolve)(reactBasePath);
        this.srcPath = (0, path_1.join)(this.reactBasePath, 'src');
        // Set default config based on security level
        this.config = this.mergeWithDefaults(config || {});
    }
    mergeWithDefaults(userConfig) {
        const securityLevel = userConfig.securityLevel || 'moderate';
        const defaults = this.getDefaultConfigForLevel(securityLevel);
        return Object.assign(Object.assign(Object.assign({}, defaults), userConfig), { securityLevel });
    }
    getDefaultConfigForLevel(level) {
        switch (level) {
            case 'strict':
                return {
                    securityLevel: 'strict',
                    allowedDirectories: [
                        'src/components',
                        'src/pages',
                        'src/hooks',
                        'src/utils',
                        'src/styles',
                        'src/assets',
                        'src/services',
                        'src/types',
                        'src/constants',
                        'src/context'
                    ],
                    blockedPatterns: [
                        { pattern: /\.\./, reason: 'Path traversal attempt' },
                        { pattern: /^\//, reason: 'Absolute path outside project' },
                        { pattern: /^[A-Za-z]:/, reason: 'Windows absolute path' },
                        { pattern: /node_modules/, reason: 'Attempting to modify node_modules' },
                        { pattern: /\.git/, reason: 'Attempting to modify git files' },
                        { pattern: /package\.json$/, reason: 'Attempting to modify package.json' },
                        { pattern: /yarn\.lock$/, reason: 'Attempting to modify yarn.lock' },
                        { pattern: /package-lock\.json$/, reason: 'Attempting to modify package-lock.json' },
                        { pattern: /\.env/, reason: 'Attempting to modify environment files' },
                        { pattern: /build\//, reason: 'Attempting to modify build directory' },
                        { pattern: /dist\//, reason: 'Attempting to modify dist directory' }
                    ],
                    allowPathTraversal: false,
                    allowAbsolutePaths: false,
                    requireSrcFolder: true,
                    auditOperations: true,
                    validateFileExtensions: true,
                    allowedExtensions: ['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.json']
                };
            case 'moderate':
                return {
                    securityLevel: 'moderate',
                    allowedDirectories: [
                        'src',
                        'public',
                        'components',
                        'pages',
                        'hooks',
                        'utils',
                        'styles',
                        'assets',
                        'services',
                        'types',
                        'constants',
                        'context',
                        'lib',
                        'config'
                    ],
                    blockedPatterns: [
                        { pattern: /node_modules/, reason: 'Attempting to modify node_modules' },
                        { pattern: /\.git/, reason: 'Attempting to modify git files' },
                        { pattern: /package\.json$/, reason: 'Attempting to modify package.json' },
                        { pattern: /yarn\.lock$/, reason: 'Attempting to modify yarn.lock' },
                        { pattern: /package-lock\.json$/, reason: 'Attempting to modify package-lock.json' },
                        { pattern: /\.env/, reason: 'Attempting to modify environment files' }
                    ],
                    allowPathTraversal: false,
                    allowAbsolutePaths: true,
                    requireSrcFolder: false,
                    auditOperations: true,
                    validateFileExtensions: true,
                    allowedExtensions: ['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.json', '.md', '.txt']
                };
            case 'relaxed':
                return {
                    securityLevel: 'relaxed',
                    allowedDirectories: [], // Empty = allow all directories
                    blockedPatterns: [
                        { pattern: /node_modules/, reason: 'Attempting to modify node_modules' },
                        { pattern: /\.git/, reason: 'Attempting to modify git files' }
                    ],
                    allowPathTraversal: true,
                    allowAbsolutePaths: true,
                    requireSrcFolder: false,
                    auditOperations: false,
                    validateFileExtensions: false,
                    allowedExtensions: []
                };
            case 'minimal':
                return {
                    securityLevel: 'minimal',
                    allowedDirectories: [],
                    blockedPatterns: [],
                    allowPathTraversal: true,
                    allowAbsolutePaths: true,
                    requireSrcFolder: false,
                    auditOperations: false,
                    validateFileExtensions: false,
                    allowedExtensions: []
                };
            default:
                return this.getDefaultConfigForLevel('moderate');
        }
    }
    // Method to update security configuration at runtime
    updateConfig(newConfig) {
        this.config = Object.assign(Object.assign({}, this.config), newConfig);
        this.streamUpdate(`🔧 Security configuration updated: ${this.config.securityLevel} level`);
    }
    // Method to get current configuration
    getConfig() {
        return Object.assign({}, this.config);
    }
    setStreamCallback(callback) {
        this.streamCallback = callback;
    }
    streamUpdate(message) {
        if (this.streamCallback) {
            this.streamCallback(message);
        }
    }
    /**
     * CONFIGURABLE: Validate path based on current security settings
     */
    validatePathInSrc(filePath) {
        try {
            const normalizedInput = (0, path_1.normalize)(filePath).replace(/\\/g, '/');
            let resolvedPath;
            // Handle different input formats based on configuration
            if (normalizedInput.startsWith('src/') && this.config.requireSrcFolder) {
                resolvedPath = (0, path_1.resolve)((0, path_1.join)(this.reactBasePath, normalizedInput));
            }
            else if ((normalizedInput.startsWith('/') || normalizedInput.match(/^[A-Za-z]:/)) && this.config.allowAbsolutePaths) {
                resolvedPath = (0, path_1.resolve)(normalizedInput);
            }
            else if (this.config.requireSrcFolder) {
                resolvedPath = (0, path_1.resolve)((0, path_1.join)(this.srcPath, normalizedInput));
            }
            else {
                // For relaxed/minimal security, allow relative to project root
                resolvedPath = (0, path_1.resolve)((0, path_1.join)(this.reactBasePath, normalizedInput));
            }
            // Check for path traversal based on configuration
            if (!this.config.allowPathTraversal) {
                const basePath = this.config.requireSrcFolder ? this.srcPath : this.reactBasePath;
                const relativePath = (0, path_1.relative)(basePath, resolvedPath);
                if (relativePath.startsWith('..') || relativePath.includes('..')) {
                    return {
                        isValid: false,
                        normalizedPath: '',
                        error: `Path traversal detected: ${filePath} resolves outside allowed folder`
                    };
                }
            }
            // Check if path is within allowed boundaries based on configuration
            if (this.config.requireSrcFolder) {
                if (!resolvedPath.startsWith(this.srcPath + path_1.sep) && resolvedPath !== this.srcPath) {
                    return {
                        isValid: false,
                        normalizedPath: '',
                        error: `Path ${filePath} is outside src folder: ${resolvedPath}`
                    };
                }
            }
            else {
                // For non-strict modes, just ensure it's within project
                if (!resolvedPath.startsWith(this.reactBasePath + path_1.sep) && resolvedPath !== this.reactBasePath) {
                    return {
                        isValid: false,
                        normalizedPath: '',
                        error: `Path ${filePath} is outside project folder: ${resolvedPath}`
                    };
                }
            }
            // Validate file extension if enabled
            if (this.config.validateFileExtensions && this.config.allowedExtensions && this.config.allowedExtensions.length > 0) {
                const ext = filePath.substring(filePath.lastIndexOf('.'));
                if (ext && !this.config.allowedExtensions.includes(ext)) {
                    return {
                        isValid: false,
                        normalizedPath: '',
                        error: `File extension ${ext} not allowed`
                    };
                }
            }
            const projectRelativePath = (0, path_1.relative)(this.reactBasePath, resolvedPath).replace(/\\/g, '/');
            if (this.config.securityLevel !== 'minimal') {
                this.streamUpdate(`✅ Path validated (${this.config.securityLevel}): ${filePath} → ${projectRelativePath}`);
            }
            return {
                isValid: true,
                normalizedPath: projectRelativePath
            };
        }
        catch (error) {
            return {
                isValid: false,
                normalizedPath: '',
                error: `Path validation error: ${error}`
            };
        }
    }
    /**
     * CONFIGURABLE: Safe file path resolution
     */
    resolveSafeFilePath(relativePath) {
        const validation = this.validatePathInSrc(relativePath);
        if (!validation.isValid) {
            if (this.config.securityLevel !== 'minimal') {
                this.streamUpdate(`❌ BLOCKED (${this.config.securityLevel}): ${validation.error}`);
            }
            return null;
        }
        return (0, path_1.join)(this.reactBasePath, validation.normalizedPath);
    }
    /**
     * CONFIGURABLE: Verify file exists and is accessible
     */
    verifyFileInSrc(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const safeResolvedPath = this.resolveSafeFilePath(filePath);
            if (!safeResolvedPath) {
                return {
                    isValid: false,
                    error: `Path ${filePath} is not allowed or invalid (${this.config.securityLevel} mode)`
                };
            }
            try {
                yield fs_1.promises.access(safeResolvedPath, fs_1.promises.constants.R_OK | fs_1.promises.constants.W_OK);
                if (this.config.securityLevel !== 'minimal') {
                    this.streamUpdate(`✅ File verified (${this.config.securityLevel}): ${filePath} → ${safeResolvedPath}`);
                }
                return {
                    isValid: true,
                    resolvedPath: safeResolvedPath
                };
            }
            catch (error) {
                return {
                    isValid: false,
                    error: `File not accessible: ${safeResolvedPath} - ${error}`
                };
            }
        });
    }
    /**
     * CONFIGURABLE: Safe write operation
     */
    safeWriteFile(filePath, content) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.config.securityLevel !== 'minimal') {
                this.streamUpdate(`🔒 SAFE WRITE (${this.config.securityLevel}): Attempting to write ${filePath}`);
            }
            const safeResolvedPath = this.resolveSafeFilePath(filePath);
            if (!safeResolvedPath) {
                return {
                    success: false,
                    error: `Write blocked - Path ${filePath} is not allowed (${this.config.securityLevel} mode)`
                };
            }
            try {
                const fileDir = (0, path_1.dirname)(safeResolvedPath);
                // For strict mode, validate directory too
                if (this.config.securityLevel === 'strict') {
                    const dirValidation = this.validatePathInSrc((0, path_1.relative)(this.reactBasePath, fileDir));
                    if (!dirValidation.isValid) {
                        return {
                            success: false,
                            error: `Directory not allowed: ${fileDir}`
                        };
                    }
                }
                yield fs_1.promises.mkdir(fileDir, { recursive: true });
                yield fs_1.promises.writeFile(safeResolvedPath, content, 'utf8');
                const stats = yield fs_1.promises.stat(safeResolvedPath);
                if (this.config.securityLevel !== 'minimal') {
                    this.streamUpdate(`✅ SAFE WRITE SUCCESS (${this.config.securityLevel}): ${safeResolvedPath} (${stats.size} bytes)`);
                }
                return {
                    success: true,
                    actualPath: safeResolvedPath
                };
            }
            catch (error) {
                if (this.config.securityLevel !== 'minimal') {
                    this.streamUpdate(`❌ WRITE FAILED: ${error}`);
                }
                return {
                    success: false,
                    error: `Write failed: ${error}`
                };
            }
        });
    }
    /**
     * CONFIGURABLE: Safe file modification
     */
    safeModifyFile(filePath, content) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.config.securityLevel !== 'minimal') {
                this.streamUpdate(`🔒 SAFE MODIFY (${this.config.securityLevel}): Attempting to modify ${filePath}`);
            }
            const verification = yield this.verifyFileInSrc(filePath);
            if (!verification.isValid || !verification.resolvedPath) {
                return {
                    success: false,
                    error: `Modify blocked - ${verification.error}`
                };
            }
            try {
                yield fs_1.promises.writeFile(verification.resolvedPath, content, 'utf8');
                const stats = yield fs_1.promises.stat(verification.resolvedPath);
                if (this.config.securityLevel !== 'minimal') {
                    this.streamUpdate(`✅ SAFE MODIFY SUCCESS (${this.config.securityLevel}): ${verification.resolvedPath} (${stats.size} bytes)`);
                }
                return {
                    success: true,
                    actualPath: verification.resolvedPath
                };
            }
            catch (error) {
                if (this.config.securityLevel !== 'minimal') {
                    this.streamUpdate(`❌ MODIFY FAILED: ${error}`);
                }
                return {
                    success: false,
                    error: `Modify failed: ${error}`
                };
            }
        });
    }
    /**
     * CONFIGURABLE: Clean project file paths with validation
     */
    cleanProjectFilePaths(projectFiles) {
        if (this.config.securityLevel !== 'minimal') {
            this.streamUpdate(`🧹 Cleaning ${projectFiles.size} project file paths (${this.config.securityLevel} mode)...`);
        }
        const cleanedFiles = new Map();
        let validFiles = 0;
        let invalidFiles = 0;
        for (const [relativePath, file] of projectFiles) {
            const validation = this.validatePathInSrc(relativePath);
            if (validation.isValid) {
                const safeAbsolutePath = this.resolveSafeFilePath(relativePath);
                if (safeAbsolutePath) {
                    const cleanedFile = Object.assign(Object.assign({}, file), { path: safeAbsolutePath, relativePath: validation.normalizedPath });
                    cleanedFiles.set(validation.normalizedPath, cleanedFile);
                    validFiles++;
                }
                else {
                    invalidFiles++;
                }
            }
            else {
                if (this.config.securityLevel !== 'minimal') {
                    this.streamUpdate(`❌ Blocked invalid path: ${relativePath} - ${validation.error}`);
                }
                invalidFiles++;
            }
        }
        if (this.config.securityLevel !== 'minimal') {
            this.streamUpdate(`✅ Path cleaning complete (${this.config.securityLevel}): ${validFiles} valid, ${invalidFiles} invalid/blocked`);
        }
        return cleanedFiles;
    }
    /**
     * CONFIGURABLE: Check for suspicious file operations
     */
    detectSuspiciousActivity(filePath) {
        // Skip suspicious activity detection for relaxed/minimal modes
        if (this.config.securityLevel === 'relaxed' || this.config.securityLevel === 'minimal') {
            return { isSuspicious: false };
        }
        for (const { pattern, reason } of this.config.blockedPatterns || []) {
            if (pattern.test(filePath)) {
                this.streamUpdate(`🚨 SECURITY ALERT (${this.config.securityLevel}): ${reason} in path: ${filePath}`);
                return { isSuspicious: true, reason };
            }
        }
        return { isSuspicious: false };
    }
    /**
     * CONFIGURABLE: Audit file operations
     */
    auditFileOperation(operation, filePath, success) {
        if (!this.config.auditOperations) {
            return;
        }
        const timestamp = new Date().toISOString();
        const status = success ? 'SUCCESS' : 'FAILED';
        this.streamUpdate(`📋 AUDIT [${timestamp}]: ${operation.toUpperCase()} ${status} - ${filePath}`);
    }
    /**
     * CONFIGURABLE: Get allowed directories based on security level
     */
    getAllowedSrcSubdirectories() {
        return this.config.allowedDirectories || [];
    }
    /**
     * CONFIGURABLE: Check if file is in allowed directory
     */
    isInAllowedDirectory(filePath) {
        // For relaxed/minimal modes with empty allowed directories, allow all
        if (!this.config.allowedDirectories || this.config.allowedDirectories.length === 0) {
            return true;
        }
        const validation = this.validatePathInSrc(filePath);
        if (!validation.isValid) {
            return false;
        }
        // Check if file is in an allowed directory
        return this.config.allowedDirectories.some(dir => {
            const normalizedDir = dir.replace(/\\/g, '/');
            return validation.normalizedPath.startsWith(normalizedDir) ||
                validation.normalizedPath === normalizedDir.replace(/\/$/, '');
        });
    }
    // Utility methods for configuration management
    setSecurityLevel(level) {
        const newConfig = this.getDefaultConfigForLevel(level);
        this.config = newConfig;
        this.streamUpdate(`🔧 Security level changed to: ${level}`);
    }
    getCurrentSecurityLevel() {
        return this.config.securityLevel;
    }
    addAllowedDirectory(directory) {
        if (!this.config.allowedDirectories) {
            this.config.allowedDirectories = [];
        }
        this.config.allowedDirectories.push(directory);
        this.streamUpdate(`➕ Added allowed directory: ${directory}`);
    }
    removeAllowedDirectory(directory) {
        if (this.config.allowedDirectories) {
            this.config.allowedDirectories = this.config.allowedDirectories.filter(dir => dir !== directory);
            this.streamUpdate(`➖ Removed allowed directory: ${directory}`);
        }
    }
    addBlockedPattern(pattern, reason) {
        if (!this.config.blockedPatterns) {
            this.config.blockedPatterns = [];
        }
        this.config.blockedPatterns.push({ pattern, reason });
        this.streamUpdate(`🚫 Added blocked pattern: ${pattern.source}`);
    }
    removeBlockedPattern(patternSource) {
        if (this.config.blockedPatterns) {
            this.config.blockedPatterns = this.config.blockedPatterns.filter(bp => bp.pattern.source !== patternSource);
            this.streamUpdate(`✅ Removed blocked pattern: ${patternSource}`);
        }
    }
}
exports.PathRestrictionManager = PathRestrictionManager;
// ============================================================================
// FACTORY FUNCTION FOR EASY CONFIGURATION
// ============================================================================
function createPathManager(reactBasePath, options = {}) {
    var _a, _b;
    const config = {
        securityLevel: options.securityLevel || 'moderate',
        requireSrcFolder: (_a = options.allowSrcOnly) !== null && _a !== void 0 ? _a : false,
        auditOperations: (_b = options.enableAudit) !== null && _b !== void 0 ? _b : true,
        allowedDirectories: options.customAllowedDirs,
        blockedPatterns: options.customBlockedPatterns
    };
    return new PathRestrictionManager(reactBasePath, config);
}
// ============================================================================
// USAGE EXAMPLES
// ============================================================================
/*
// Example 1: Minimal restrictions (almost no security)
const minimalManager = new PathRestrictionManager('/path/to/project', {
  securityLevel: 'minimal'
});

// Example 2: Moderate restrictions (balanced security)
const moderateManager = new PathRestrictionManager('/path/to/project', {
  securityLevel: 'moderate',
  requireSrcFolder: false,
  allowAbsolutePaths: true
});

// Example 3: Custom configuration
const customManager = new PathRestrictionManager('/path/to/project', {
  securityLevel: 'relaxed',
  allowedDirectories: ['src', 'components', 'pages', 'utils', 'styles'],
  blockedPatterns: [
    { pattern: /node_modules/, reason: 'No node_modules access' }
  ],
  auditOperations: false
});

// Example 4: Using factory function
const easyManager = createPathManager('/path/to/project', {
  securityLevel: 'relaxed',
  allowSrcOnly: false,
  enableAudit: false
});

// Example 5: Runtime configuration changes
const manager = new PathRestrictionManager('/path/to/project');
manager.setSecurityLevel('relaxed');
manager.addAllowedDirectory('custom');
manager.updateConfig({ auditOperations: false });
*/ 
//# sourceMappingURL=pathrestrictor.js.map