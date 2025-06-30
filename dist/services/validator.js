"use strict";
// ============================================================================
// SIMPLIFIED BUILD VALIDATOR - No Complex TypeScript Compiler API
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
exports.SimpleBuildValidator = void 0;
exports.enhancedAzureDeployWithValidation = enhancedAzureDeployWithValidation;
const fs_1 = require("fs");
const path_1 = require("path");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class SimpleBuildValidator {
    constructor(buildPath) {
        this.buildPath = (0, path_1.resolve)(buildPath);
    }
    setStreamCallback(callback) {
        this.streamCallback = callback;
    }
    log(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[BUILD-VALIDATOR] ${message}`;
        if (this.streamCallback) {
            this.streamCallback(logMessage);
        }
        console.log(logMessage);
    }
    /**
     * MAIN: Validate build before Azure deployment
     */
    validateBeforeDeployment() {
        return __awaiter(this, void 0, void 0, function* () {
            this.log('🔍 Starting simplified pre-deployment validation...');
            const errors = [];
            const warnings = [];
            const fixedFiles = [];
            try {
                // 1. Validate project structure
                const structureResult = yield this.validateProjectStructure();
                errors.push(...structureResult.errors);
                warnings.push(...structureResult.warnings);
                // 2. Validate and fix React/TypeScript files
                const fileResult = yield this.validateAndFixFiles();
                errors.push(...fileResult.errors);
                warnings.push(...fileResult.warnings);
                fixedFiles.push(...fileResult.fixedFiles);
                // 3. Validate package.json
                const packageResult = yield this.validatePackageJson();
                errors.push(...packageResult.errors);
                warnings.push(...packageResult.warnings);
                // 4. Quick syntax check
                const syntaxResult = yield this.quickSyntaxCheck();
                errors.push(...syntaxResult.errors);
                warnings.push(...syntaxResult.warnings);
                // 5. Test local build (only if no critical errors)
                if (errors.length === 0) {
                    const buildResult = yield this.testLocalBuild();
                    errors.push(...buildResult.errors);
                    warnings.push(...buildResult.warnings);
                }
                const isValid = errors.length === 0;
                this.log(`🔍 Validation complete: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
                this.log(`📊 Results: ${errors.length} errors, ${warnings.length} warnings, ${fixedFiles.length} auto-fixed`);
                return { isValid, errors, warnings, fixedFiles };
            }
            catch (error) {
                errors.push(`Validation system error: ${error}`);
                return { isValid: false, errors, warnings, fixedFiles };
            }
        });
    }
    /**
     * Validate basic project structure
     */
    validateProjectStructure() {
        return __awaiter(this, void 0, void 0, function* () {
            this.log('📁 Validating project structure...');
            const errors = [];
            const warnings = [];
            // Check essential files
            const essentialFiles = [
                { path: 'package.json', critical: true },
                { path: 'src/App.tsx', critical: true },
                { path: 'src/index.tsx', critical: true },
                { path: 'public/index.html', critical: false }
            ];
            for (const file of essentialFiles) {
                const filePath = (0, path_1.join)(this.buildPath, file.path);
                try {
                    yield fs_1.promises.access(filePath);
                    this.log(`✅ Found: ${file.path}`);
                }
                catch (_a) {
                    if (file.critical) {
                        errors.push(`Missing critical file: ${file.path}`);
                    }
                    else {
                        warnings.push(`Missing optional file: ${file.path}`);
                    }
                }
            }
            // Check src directory
            try {
                const srcPath = (0, path_1.join)(this.buildPath, 'src');
                const srcFiles = yield fs_1.promises.readdir(srcPath, { recursive: true });
                const reactFiles = srcFiles.filter(f => typeof f === 'string' && (f.endsWith('.tsx') || f.endsWith('.jsx')));
                this.log(`📊 Found ${reactFiles.length} React component files`);
                if (reactFiles.length === 0) {
                    errors.push('No React component files found in src directory');
                }
            }
            catch (error) {
                errors.push(`Cannot access src directory: ${error}`);
            }
            return { errors, warnings };
        });
    }
    /**
     * Validate and auto-fix React/TypeScript files
     */
    validateAndFixFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            this.log('🔧 Validating and fixing React/TypeScript files...');
            const errors = [];
            const warnings = [];
            const fixedFiles = [];
            try {
                const srcPath = (0, path_1.join)(this.buildPath, 'src');
                const files = yield this.getAllReactFiles(srcPath);
                for (const file of files) {
                    const filePath = (0, path_1.join)(srcPath, file);
                    const relativePath = `src/${file}`;
                    try {
                        const originalContent = yield fs_1.promises.readFile(filePath, 'utf8');
                        // Analyze file
                        const analysis = this.analyzeReactFile(originalContent, relativePath);
                        errors.push(...analysis.errors);
                        warnings.push(...analysis.warnings);
                        // Auto-fix issues
                        const fixedContent = this.autoFixReactFile(originalContent, relativePath);
                        if (fixedContent !== originalContent) {
                            yield fs_1.promises.writeFile(filePath, fixedContent, 'utf8');
                            fixedFiles.push(relativePath);
                            this.log(`🔧 Auto-fixed: ${relativePath}`);
                        }
                        else {
                            this.log(`✅ No fixes needed: ${relativePath}`);
                        }
                    }
                    catch (fileError) {
                        errors.push(`Cannot process ${relativePath}: ${fileError}`);
                    }
                }
            }
            catch (error) {
                errors.push(`File validation failed: ${error}`);
            }
            return { errors, warnings, fixedFiles };
        });
    }
    /**
     * Analyze React file for common issues
     */
    analyzeReactFile(content, filePath) {
        const errors = [];
        const warnings = [];
        // Check for JSX without React import
        if (content.includes('<') && content.includes('>')) {
            if (!content.includes('import React') && !content.includes('import * as React')) {
                errors.push(`${filePath}: JSX found but React not imported`);
            }
        }
        // Check for component without export
        const hasComponent = /(?:function|const)\s+[A-Z]\w+/.test(content);
        if (hasComponent && !content.includes('export default') && !content.includes('export {')) {
            warnings.push(`${filePath}: Component found but no export statement`);
        }
        // Check for common JSX issues
        if (content.includes(' class=')) {
            warnings.push(`${filePath}: Use 'className' instead of 'class' in JSX`);
        }
        if (content.includes(' for=')) {
            warnings.push(`${filePath}: Use 'htmlFor' instead of 'for' in JSX`);
        }
        // Check for missing semicolons in imports
        const importLines = content.split('\n').filter(line => line.trim().startsWith('import'));
        for (const line of importLines) {
            if (!line.trim().endsWith(';')) {
                warnings.push(`${filePath}: Missing semicolon in import statement`);
            }
        }
        // Check for potential syntax issues
        if (content.includes('export default class') && !content.includes('extends')) {
            warnings.push(`${filePath}: Class component found - consider using function component`);
        }
        return { errors, warnings };
    }
    /**
     * Auto-fix common React file issues
     */
    autoFixReactFile(content, filePath) {
        let fixed = content;
        // 1. Add React import if JSX is present but React not imported
        if (fixed.includes('<') && fixed.includes('>')) {
            if (!fixed.includes('import React') && !fixed.includes('import * as React')) {
                // Add React import at the top
                const lines = fixed.split('\n');
                const firstImportIndex = lines.findIndex(line => line.trim().startsWith('import'));
                if (firstImportIndex !== -1) {
                    lines.splice(firstImportIndex, 0, 'import React from "react";');
                }
                else {
                    lines.unshift('import React from "react";', '');
                }
                fixed = lines.join('\n');
            }
        }
        // 2. Fix class -> className
        fixed = fixed.replace(/(\s)class=/g, '$1className=');
        // 3. Fix for -> htmlFor
        fixed = fixed.replace(/(\s)for=/g, '$1htmlFor=');
        // 4. Add semicolons to import statements
        fixed = fixed.replace(/^import[^;]+$/gm, match => {
            return match.trim().endsWith(';') ? match : match + ';';
        });
        // 5. Add export default if component exists but no export
        const componentMatch = fixed.match(/(?:function|const)\s+([A-Z]\w+)/);
        if (componentMatch && !fixed.includes('export default') && !fixed.includes('export {')) {
            const componentName = componentMatch[1];
            if (!fixed.endsWith('\n')) {
                fixed += '\n';
            }
            fixed += `\nexport default ${componentName};\n`;
        }
        // 6. Fix common TypeScript issues
        if (filePath.endsWith('.tsx')) {
            // Ensure proper React import for TypeScript
            if (fixed.includes('React.') && !fixed.includes('import React')) {
                fixed = 'import React from "react";\n' + fixed;
            }
        }
        return fixed;
    }
    /**
     * Quick syntax check without full TypeScript compilation
     */
    quickSyntaxCheck() {
        return __awaiter(this, void 0, void 0, function* () {
            this.log('⚡ Running quick syntax check...');
            const errors = [];
            const warnings = [];
            try {
                const srcPath = (0, path_1.join)(this.buildPath, 'src');
                const files = yield this.getAllReactFiles(srcPath);
                for (const file of files) {
                    const filePath = (0, path_1.join)(srcPath, file);
                    const relativePath = `src/${file}`;
                    try {
                        const content = yield fs_1.promises.readFile(filePath, 'utf8');
                        // Basic syntax checks
                        const syntaxIssues = this.checkBasicSyntax(content, relativePath);
                        errors.push(...syntaxIssues.errors);
                        warnings.push(...syntaxIssues.warnings);
                    }
                    catch (fileError) {
                        errors.push(`Cannot read ${relativePath}: ${fileError}`);
                    }
                }
            }
            catch (error) {
                errors.push(`Syntax check failed: ${error}`);
            }
            return { errors, warnings };
        });
    }
    /**
     * Basic syntax checks without TypeScript compiler
     */
    checkBasicSyntax(content, filePath) {
        var _a;
        const errors = [];
        const warnings = [];
        // Check for unmatched braces
        const openBraces = (content.match(/{/g) || []).length;
        const closeBraces = (content.match(/}/g) || []).length;
        if (openBraces !== closeBraces) {
            errors.push(`${filePath}: Unmatched braces (${openBraces} open, ${closeBraces} close)`);
        }
        // Check for unmatched parentheses
        const openParens = (content.match(/\(/g) || []).length;
        const closeParens = (content.match(/\)/g) || []).length;
        if (openParens !== closeParens) {
            errors.push(`${filePath}: Unmatched parentheses (${openParens} open, ${closeParens} close)`);
        }
        // Check for unmatched JSX tags (basic check)
        const jsxOpenTags = (content.match(/<[A-Za-z][^/>]*>/g) || []).length;
        const jsxCloseTags = (content.match(/<\/[A-Za-z][^>]*>/g) || []).length;
        const selfClosingTags = (content.match(/<[A-Za-z][^>]*\/>/g) || []).length;
        if (jsxOpenTags !== jsxCloseTags + selfClosingTags) {
            warnings.push(`${filePath}: Potential unmatched JSX tags`);
        }
        // Check for common syntax errors
        if (content.includes('import {') && !content.includes('} from')) {
            errors.push(`${filePath}: Malformed import statement`);
        }
        // Check for missing function body
        const functionRegex = /function\s+\w+\s*\([^)]*\)\s*{/g;
        const functionMatches = content.match(functionRegex);
        if (functionMatches) {
            for (const match of functionMatches) {
                const functionName = (_a = match.match(/function\s+(\w+)/)) === null || _a === void 0 ? void 0 : _a[1];
                if (functionName && !content.includes(`return`) && !content.includes(`throw`)) {
                    warnings.push(`${filePath}: Function ${functionName} may be missing return statement`);
                }
            }
        }
        return { errors, warnings };
    }
    /**
     * Test local build
     */
    testLocalBuild() {
        return __awaiter(this, void 0, void 0, function* () {
            this.log('🏗️ Testing local build...');
            const errors = [];
            const warnings = [];
            try {
                // Install dependencies
                this.log('📦 Installing dependencies...');
                try {
                    const { stderr: installErr } = yield execAsync('npm install', {
                        cwd: this.buildPath,
                        timeout: 120000 // 2 minutes
                    });
                    if (installErr && !installErr.includes('warn')) {
                        warnings.push(`npm install issues: ${installErr.substring(0, 200)}`);
                    }
                    this.log('✅ Dependencies installed');
                }
                catch (installError) {
                    errors.push(`Failed to install dependencies: ${installError}`);
                    return { errors, warnings };
                }
                // Run build
                this.log('🏗️ Running npm run build...');
                try {
                    const { stdout, stderr } = yield execAsync('npm run build', {
                        cwd: this.buildPath,
                        timeout: 300000 // 5 minutes
                    });
                    this.log('✅ Local build successful');
                    if (stderr && !stderr.includes('warn')) {
                        warnings.push(`Build warnings: ${stderr.substring(0, 200)}`);
                    }
                    // Verify build output
                    const buildDir = (0, path_1.join)(this.buildPath, 'build');
                    try {
                        const buildFiles = yield fs_1.promises.readdir(buildDir);
                        this.log(`📁 Build output: ${buildFiles.length} files`);
                        // Check for essential build files
                        const hasIndexHtml = buildFiles.some(f => f === 'index.html');
                        const hasStaticDir = buildFiles.some(f => f === 'static');
                        if (!hasIndexHtml) {
                            warnings.push('Build output missing index.html');
                        }
                        if (!hasStaticDir) {
                            warnings.push('Build output missing static directory');
                        }
                    }
                    catch (_a) {
                        warnings.push('Build completed but output directory not accessible');
                    }
                }
                catch (buildError) {
                    const errorMessage = buildError instanceof Error ? buildError.message : String(buildError);
                    errors.push(`Build failed: ${errorMessage.substring(0, 500)}`);
                    // Provide helpful hints based on error
                    if (errorMessage.includes('Module not found')) {
                        errors.push('HINT: Check import statements and file paths');
                    }
                    if (errorMessage.includes('TypeScript error')) {
                        errors.push('HINT: Fix TypeScript syntax errors above');
                    }
                    if (errorMessage.includes('JSX')) {
                        errors.push('HINT: Ensure React is imported in JSX files');
                    }
                }
            }
            catch (error) {
                errors.push(`Build test failed: ${error}`);
            }
            return { errors, warnings };
        });
    }
    /**
     * Validate package.json
     */
    validatePackageJson() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            this.log('📦 Validating package.json...');
            const errors = [];
            const warnings = [];
            try {
                const packageJsonPath = (0, path_1.join)(this.buildPath, 'package.json');
                const content = yield fs_1.promises.readFile(packageJsonPath, 'utf8');
                const packageJson = JSON.parse(content);
                // Check required scripts
                if (!((_a = packageJson.scripts) === null || _a === void 0 ? void 0 : _a.build)) {
                    errors.push('package.json: Missing "build" script');
                }
                if (!((_b = packageJson.scripts) === null || _b === void 0 ? void 0 : _b.start)) {
                    warnings.push('package.json: Missing "start" script');
                }
                // Check essential dependencies
                if (!((_c = packageJson.dependencies) === null || _c === void 0 ? void 0 : _c.react)) {
                    errors.push('package.json: Missing React dependency');
                }
                if (!((_d = packageJson.dependencies) === null || _d === void 0 ? void 0 : _d['react-dom'])) {
                    errors.push('package.json: Missing react-dom dependency');
                }
                // Check for TypeScript setup
                const hasTypeScript = ((_e = packageJson.dependencies) === null || _e === void 0 ? void 0 : _e.typescript) || ((_f = packageJson.devDependencies) === null || _f === void 0 ? void 0 : _f.typescript);
                if (!hasTypeScript && (((_g = packageJson.dependencies) === null || _g === void 0 ? void 0 : _g['@types/react']) || ((_h = packageJson.devDependencies) === null || _h === void 0 ? void 0 : _h['@types/react']))) {
                    warnings.push('package.json: TypeScript types found but TypeScript not installed');
                }
                this.log('✅ package.json validation complete');
            }
            catch (error) {
                errors.push(`package.json validation failed: ${error}`);
            }
            return { errors, warnings };
        });
    }
    /**
     * Helper: Get all React files
     */
    getAllReactFiles(srcPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const files = yield fs_1.promises.readdir(srcPath, { recursive: true });
            return files.filter(f => typeof f === 'string' && (f.endsWith('.tsx') || f.endsWith('.jsx') || f.endsWith('.ts') || f.endsWith('.js')));
        });
    }
}
exports.SimpleBuildValidator = SimpleBuildValidator;
// ============================================================================
// ENHANCED AZURE DEPLOY WITH SIMPLIFIED VALIDATION
// ============================================================================
function enhancedAzureDeployWithValidation(sourceZipUrl, buildId, config, tempBuildPath) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[${buildId}] Starting Azure deployment with simplified validation...`);
        // Run simplified validation
        const validator = new SimpleBuildValidator(tempBuildPath);
        validator.setStreamCallback((msg) => console.log(`[${buildId}] ${msg}`));
        console.log(`[${buildId}] Running pre-deployment validation...`);
        const validationResult = yield validator.validateBeforeDeployment();
        if (!validationResult.isValid) {
            console.error(`[${buildId}] ❌ Pre-validation FAILED:`);
            validationResult.errors.forEach(error => console.error(`  - ${error}`));
            // Create detailed error message
            const errorSummary = `Pre-validation failed with ${validationResult.errors.length} errors:\n${validationResult.errors.join('\n')}`;
            throw new Error(errorSummary);
        }
        console.log(`[${buildId}] ✅ Pre-validation PASSED`);
        if (validationResult.warnings.length > 0) {
            console.log(`[${buildId}] ⚠️ Warnings (${validationResult.warnings.length}):`);
            validationResult.warnings.slice(0, 5).forEach(warning => console.log(`  - ${warning}`));
            if (validationResult.warnings.length > 5) {
                console.log(`  ... and ${validationResult.warnings.length - 5} more warnings`);
            }
        }
        if (validationResult.fixedFiles.length > 0) {
            console.log(`[${buildId}] 🔧 Auto-fixed ${validationResult.fixedFiles.length} files:`);
            validationResult.fixedFiles.forEach(file => console.log(`  - ${file}`));
        }
        // Now proceed with your original Azure deployment logic
        // (Your existing triggerAzureContainerJob function here)
        return `{"previewUrl": "https://example.com", "downloadUrl": "https://example.com/download"}`;
    });
}
//# sourceMappingURL=validator.js.map