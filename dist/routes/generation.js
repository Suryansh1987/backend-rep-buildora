"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeGenerationRoutes = initializeGenerationRoutes;
// routes/generation.ts - Project generation routes with updated Azure deployment
const express_1 = __importDefault(require("express"));
const uuid_1 = require("uuid");
const adm_zip_1 = __importDefault(require("adm-zip"));
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const azure_deploy_1 = require("../services/azure-deploy");
const promt_1 = require("../defaults/promt");
const newparser_1 = require("../utils/newparser");
const router = express_1.default.Router();
function getFileDescription(file) {
    const content = file.content;
    let description = '';
    if (file.path.includes('App.tsx')) {
        description = 'Main app with routing and navigation setup';
    }
    else if (file.path.includes('pages/')) {
        if (content.includes('Hero') || content.includes('hero'))
            description = 'Landing page with hero section';
        else if (content.includes('About'))
            description = 'About page with company info';
        else if (content.includes('Contact'))
            description = 'Contact page with form';
        else if (content.includes('Services'))
            description = 'Services page with offerings';
        else if (content.includes('Gallery'))
            description = 'Gallery page with images';
        else
            description = 'Page component with content sections';
    }
    else if (file.path.includes('components/')) {
        if (content.includes('Header') || content.includes('nav'))
            description = 'Header/navigation component';
        else if (content.includes('Footer'))
            description = 'Footer component with links';
        else if (content.includes('Card'))
            description = 'Card component for displaying content';
        else if (content.includes('Button'))
            description = 'Button component with variants';
        else if (content.includes('Form'))
            description = 'Form component with validation';
        else if (content.includes('Modal'))
            description = 'Modal/dialog component';
        else
            description = 'Reusable UI component';
    }
    else if (file.path.includes('types/')) {
        description = 'TypeScript type definitions and interfaces';
    }
    else if (file.path.includes('hooks/')) {
        description = 'Custom React hooks for state/logic';
    }
    else if (file.path.includes('lib/')) {
        description = 'Utility functions and helpers';
    }
    else {
        description = 'Frontend utility file';
    }
    return description;
}
function cleanupTempDirectory(buildId) {
    return __awaiter(this, void 0, void 0, function* () {
        const tempBuildDir = path_1.default.join(__dirname, "../../temp-builds", buildId);
        try {
            yield fs.promises.rm(tempBuildDir, { recursive: true, force: true });
            console.log(`[${buildId}] 🧹 Temp directory cleaned up`);
        }
        catch (error) {
            console.warn(`[${buildId}] ⚠️ Failed to cleanup temp directory:`, error);
        }
    });
}
function initializeGenerationRoutes(anthropic, messageDB, sessionManager) {
    // MAIN GENERATION ENDPOINT (enhanced with Redis session support and new Azure deployment)
    router.post("/", (req, res) => __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const { prompt, projectId } = req.body;
        if (!prompt) {
            res.status(400).json({
                success: false,
                error: "Prompt is required"
            });
            return;
        }
        const buildId = (0, uuid_1.v4)();
        const sessionId = sessionManager.generateSessionId(); // Generate stateless session
        console.log(`[${buildId}] Starting stateless build pipeline for prompt: "${prompt.substring(0, 100)}..."`);
        console.log(`[${buildId}] Session ID: ${sessionId}`);
        const cleanupTimer = setTimeout(() => {
            cleanupTempDirectory(buildId);
            sessionManager.cleanup(sessionId); // Cleanup Redis session
        }, 5 * 60 * 1000);
        try {
            // Save initial session context
            yield sessionManager.saveSessionContext(sessionId, {
                buildId,
                tempBuildDir: '',
                lastActivity: Date.now()
            });
            console.log('🚀 Starting frontend generation for prompt:', prompt.substring(0, 100) + '...');
            const sourceTemplateDir = path_1.default.join(__dirname, "../../react-base");
            const tempBuildDir = path_1.default.join(__dirname, "../../temp-builds", buildId);
            yield fs.promises.mkdir(tempBuildDir, { recursive: true });
            yield fs.promises.cp(sourceTemplateDir, tempBuildDir, { recursive: true });
            console.log(`[${buildId}] Template copied to temp directory`);
            // Update session with temp directory
            yield sessionManager.updateSessionContext(sessionId, { tempBuildDir });
            const userMessageId = yield messageDB.addMessage(prompt, 'user', {
                promptType: 'frontend_generation',
                requestType: 'user_prompt',
                timestamp: new Date().toISOString(),
                sessionId: sessionId // Track session in DB
            });
            console.log('🔨 Generating frontend code using system prompt...');
            const frontendPrompt = `${prompt}

Generate a React TypeScript frontend application. Focus on creating functional, modern components with good structure.`;
            const startTime = Date.now();
            console.log('📡 Starting streaming request for frontend generation...');
            const stream = yield anthropic.messages.stream({
                model: "claude-sonnet-4-0",
                max_tokens: 25000,
                temperature: 0.1,
                system: promt_1.systemPrompt, // Use imported system prompt
                messages: [
                    {
                        role: "user",
                        content: [{
                                type: "text",
                                text: frontendPrompt
                            }]
                    }
                ]
            });
            let accumulatedResponse = '';
            let responseLength = 0;
            stream.on('text', (text) => {
                accumulatedResponse += text;
                responseLength += text.length;
                if (responseLength % 10000 < text.length) {
                    console.log(`📊 Received ${responseLength} characters...`);
                }
            });
            const result = yield stream.finalMessage();
            const frontendEndTime = Date.now();
            const frontendProcessingTime = frontendEndTime - startTime;
            console.log('🔍 Frontend generation completed. Total response length:', accumulatedResponse.length);
            // Parse files using the new parser
            let parsedFiles = [];
            let parseSuccess = false;
            let parseError = null;
            try {
                console.log('🔍 Attempting to parse frontend response with new parser...');
                const parsedFrontend = (0, newparser_1.parseFrontendCode)(accumulatedResponse);
                parsedFiles = parsedFrontend.codeFiles;
                parseSuccess = true;
                console.log(`✅ Successfully parsed ${parsedFiles.length} files using new parser`);
            }
            catch (error) {
                parseError = error;
                console.error('❌ Failed to parse files from response:', parseError);
                // Fallback to old parsing logic if needed
                try {
                    console.log('🔧 Attempting fallback parsing...');
                    let jsonContent = accumulatedResponse.trim();
                    const jsonBlockMatch = jsonContent.match(/```json\s*([\s\S]*?)\s*```/);
                    if (jsonBlockMatch) {
                        jsonContent = jsonBlockMatch[1].trim();
                        console.log('🔍 Extracted JSON from markdown code block');
                    }
                    else {
                        const jsonObjectMatch = jsonContent.match(/\{[\s\S]*\}/);
                        if (jsonObjectMatch) {
                            jsonContent = jsonObjectMatch[0];
                            console.log('🔍 Extracted JSON object from response');
                        }
                    }
                    if (!jsonContent.endsWith('}')) {
                        console.log('⚠️ JSON appears truncated, attempting to fix...');
                        const lastCompleteQuote = jsonContent.lastIndexOf('",');
                        if (lastCompleteQuote !== -1) {
                            jsonContent = jsonContent.substring(0, lastCompleteQuote + 1) + '\n  }\n}';
                            console.log('🔧 Attempted to close truncated JSON');
                        }
                    }
                    const parsed = JSON.parse(jsonContent);
                    if (parsed.codeFiles && typeof parsed.codeFiles === 'object') {
                        parsedFiles = Object.entries(parsed.codeFiles).map(([path, content]) => ({
                            path,
                            content: content
                        }));
                        parseSuccess = true;
                        console.log(`✅ Successfully parsed ${parsedFiles.length} files from codeFiles object`);
                    }
                    else if (parsed.files && Array.isArray(parsed.files)) {
                        parsedFiles = parsed.files;
                        parseSuccess = true;
                        console.log(`✅ Successfully parsed ${parsedFiles.length} files from files array`);
                    }
                    else {
                        throw new Error(`JSON structure not recognized. Keys found: ${Object.keys(parsed).join(', ')}`);
                    }
                }
                catch (fallbackError) {
                    console.error('❌ Fallback parsing also failed:', fallbackError);
                }
            }
            if (!parseSuccess) {
                clearTimeout(cleanupTimer);
                yield sessionManager.cleanup(sessionId);
                res.status(400).json({
                    success: false,
                    error: 'Failed to parse generated files',
                    details: parseError,
                    rawResponse: accumulatedResponse.substring(0, 500) + '...'
                });
                return;
            }
            // Write files to temp directory AND cache in Redis
            console.log('💾 Writing generated files to temp build directory and caching in Redis...');
            const fileMap = {};
            for (const file of parsedFiles) {
                const fullPath = path_1.default.join(tempBuildDir, file.path);
                yield fs.promises.mkdir(path_1.default.dirname(fullPath), { recursive: true });
                yield fs.promises.writeFile(fullPath, file.content, "utf8");
                console.log(`✅ Written to temp: ${file.path}`);
                // Cache in Redis for potential future modifications
                fileMap[file.path] = file.content;
            }
            // Cache all files in Redis
            yield sessionManager.cacheProjectFiles(sessionId, fileMap);
            console.log(`📦 Cached ${Object.keys(fileMap).length} files in Redis for session: ${sessionId}`);
            // Generate project summary
            console.log('📋 Generating project summary...');
            const fileAnalysis = parsedFiles.map(file => {
                const content = file.content;
                const importMatches = content.match(/^import\s+.*?from\s+['"](.*?)['"];?$/gm) || [];
                const imports = importMatches.map(imp => {
                    const fromMatch = imp.match(/from\s+['"](.*?)['"]/) || [];
                    const whatMatch = imp.match(/import\s+({.*?}|\*\s+as\s+\w+|\w+)/) || [];
                    return {
                        what: whatMatch[1] || '',
                        from: fromMatch[1] || ''
                    };
                });
                const exportMatches = content.match(/^export\s+.*$/gm) || [];
                const exports = exportMatches.map(exp => {
                    if (exp.includes('export default')) {
                        const defaultMatch = exp.match(/export\s+default\s+(\w+)/) || [];
                        return { type: 'default', name: defaultMatch[1] || 'component' };
                    }
                    else if (exp.includes('export const') || exp.includes('export function')) {
                        const namedMatch = exp.match(/export\s+(?:const|function)\s+(\w+)/) || [];
                        return { type: 'named', name: namedMatch[1] || 'unknown' };
                    }
                    else if (exp.includes('export interface') || exp.includes('export type')) {
                        const typeMatch = exp.match(/export\s+(?:interface|type)\s+(\w+)/) || [];
                        return { type: 'type', name: typeMatch[1] || 'unknown' };
                    }
                    return { type: 'other', name: 'unknown' };
                });
                const firstLines = content.split('\n').slice(0, 3).join(' ').substring(0, 150);
                return {
                    path: file.path,
                    imports: imports,
                    exports: exports,
                    preview: firstLines
                };
            });
            const filesList = fileAnalysis.map(analysis => {
                const importSummary = analysis.imports.length > 0
                    ? `imports: ${analysis.imports.map(i => i.what).join(', ')}`
                    : 'no imports';
                const exportSummary = analysis.exports.length > 0
                    ? `exports: ${analysis.exports.map(e => e.name).join(', ')}`
                    : 'no exports';
                return `${analysis.path}: ${importSummary} | ${exportSummary} | preview: ${analysis.preview}`;
            }).join('\n');
            const summaryPrompt = `Based on these actual generated files with their imports/exports, create a concise project summary:

GENERATED FILES ANALYSIS:
${filesList}

Create a summary in this format:

**Project:** [Type based on file names and content]
**Files created:**
- src/App.tsx: {actual imports/exports found} [brief description]
- src/pages/[PageName].tsx: {actual imports/exports found} [brief description]  
- src/components/[ComponentName].tsx: {actual imports/exports found} [brief description]
- src/types/index.ts: {actual imports/exports found} [brief description]

Use the ACTUAL imports and exports I provided above. Keep under 1000 characters.`;
            let projectSummary = '';
            try {
                const summaryStartTime = Date.now();
                const summaryResult = yield anthropic.messages.create({
                    model: "claude-3-5-sonnet-20240620",
                    max_tokens: 800,
                    temperature: 0.2,
                    system: "You are a frontend developer creating concise summaries of generated React projects. Focus on what was actually created.",
                    messages: [
                        {
                            role: "user",
                            content: [{
                                    type: "text",
                                    text: summaryPrompt
                                }]
                        }
                    ]
                });
                const summaryBlocks = summaryResult.content.filter((block) => block.type === "text");
                projectSummary = summaryBlocks.map(block => block.text).join('\n');
                const summaryEndTime = Date.now();
                const summaryProcessingTime = summaryEndTime - summaryStartTime;
                console.log('📋 Project Summary Generated:', projectSummary);
                console.log(`⏱️  Summary generation completed in ${summaryProcessingTime}ms`);
            }
            catch (summaryError) {
                console.error('⚠️ Error generating summary:', summaryError);
                projectSummary = `Frontend project with ${parsedFiles.length} files: ${parsedFiles.map(f => f.path).join(', ')}`;
            }
            // Create zip and upload to Azure
            console.log(`[${buildId}] Creating zip and uploading to Azure...`);
            const zip = new adm_zip_1.default();
            zip.addLocalFolder(tempBuildDir);
            const zipBuffer = zip.toBuffer();
            const zipBlobName = `${buildId}/source.zip`;
            const zipUrl = yield (0, azure_deploy_1.uploadToAzureBlob)(process.env.AZURE_STORAGE_CONNECTION_STRING, "source-zips", zipBlobName, zipBuffer);
            console.log(zipUrl, "this is the url that is sent for deployment");
            // Update session context with project summary and zipUrl
            yield sessionManager.updateSessionContext(sessionId, {
                projectSummary: {
                    summary: projectSummary,
                    zipUrl: zipUrl,
                    buildId: buildId
                }
            });
            // Trigger Azure Container Job
            console.log(`[${buildId}] Triggering Azure Container Job...`);
            const DistUrl = yield (0, azure_deploy_1.triggerAzureContainerJob)(zipUrl, buildId, {
                resourceGroup: process.env.AZURE_RESOURCE_GROUP,
                containerAppEnv: process.env.AZURE_CONTAINER_APP_ENV,
                acrName: process.env.AZURE_ACR_NAME,
                storageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
                storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
            });
            const urls = JSON.parse(DistUrl);
            console.log(urls, "build urls");
            const builtZipUrl = urls.downloadUrl;
            // Deploy using the new deployment method
            console.log(`[${buildId}] Deploying with new Azure method...`);
            const previewUrl = yield (0, azure_deploy_1.runBuildAndDeploy)(builtZipUrl, buildId);
            // Save project summary with ZIP URL to database
            try {
                const summaryId = yield messageDB.saveProjectSummary(projectSummary, prompt, zipUrl, buildId);
                console.log('💾 Saved project summary with ZIP URL to database, ID:', summaryId);
            }
            catch (summaryError) {
                console.error('⚠️ Error saving project summary to database:', summaryError);
            }
            // Save assistant response to conversation history
            try {
                const assistantMetadata = {
                    promptType: 'frontend_generation',
                    requestType: 'claude_response',
                    relatedUserMessageId: userMessageId,
                    success: true,
                    processingTimeMs: frontendProcessingTime,
                    tokenUsage: result.usage,
                    responseLength: accumulatedResponse.length,
                    fileModifications: parsedFiles.map(f => f.path),
                    modificationApproach: "FULL_FILE_GENERATION",
                    modificationSuccess: true,
                    buildId: buildId,
                    previewUrl: previewUrl,
                    downloadUrl: urls.downloadUrl,
                    zipUrl: zipUrl,
                    sessionId: sessionId // Track session
                };
                const assistantMessageId = yield messageDB.addMessage(`Generated ${parsedFiles.length} files:\n\n${parsedFiles.map(f => f.path).join('\n')}`, 'assistant', assistantMetadata);
                console.log(`💾 Saved assistant response (ID: ${assistantMessageId}) with session: ${sessionId}`);
            }
            catch (dbError) {
                console.warn('⚠️ Failed to save assistant response to DB:', dbError);
            }
            if (projectId) {
                console.log(`📝 Updating project ${projectId} with new deployment URL`);
            }
            clearTimeout(cleanupTimer);
            yield cleanupTempDirectory(buildId);
            // Keep Redis session for potential modifications (will auto-expire)
            const totalProcessingTime = Date.now() - startTime;
            console.log(`⏱️  Total generation + build + deploy completed in ${totalProcessingTime}ms`);
            console.log(`📊 Token usage: ${((_a = result.usage) === null || _a === void 0 ? void 0 : _a.input_tokens) || 0} input, ${((_b = result.usage) === null || _b === void 0 ? void 0 : _b.output_tokens) || 0} output`);
            res.json({
                success: true,
                files: parsedFiles,
                previewUrl: previewUrl,
                downloadUrl: urls.downloadUrl,
                zipUrl: zipUrl,
                buildId: buildId,
                sessionId: sessionId, // Return session ID for future modifications
                hosting: "Azure Static Web Apps",
                features: [
                    "Global CDN",
                    "Auto SSL/HTTPS",
                    "Custom domains support",
                    "Staging environments",
                ],
                metadata: {
                    processingTime: totalProcessingTime,
                    frontendProcessingTime: frontendProcessingTime,
                    tokenUsage: result.usage,
                    filesGenerated: parsedFiles.length,
                    summary: projectSummary,
                    generatedFilesSummary: `Generated ${parsedFiles.length} files:\n\n${parsedFiles.map(f => `📁 ${f.path}: ${getFileDescription(f)}`).join('\n')}`
                }
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[${buildId}] Complete build pipeline failed:`, errorMessage);
            clearTimeout(cleanupTimer);
            yield cleanupTempDirectory(buildId);
            yield sessionManager.cleanup(sessionId); // Cleanup Redis session on error
            try {
                const errorMetadata = {
                    promptType: 'frontend_generation',
                    requestType: 'claude_response',
                    success: false,
                    error: errorMessage,
                    processingTimeMs: 0,
                    buildId: buildId,
                    sessionId: sessionId
                };
                yield messageDB.addMessage(`Frontend generation and build failed: ${errorMessage}`, 'assistant', errorMetadata);
            }
            catch (dbError) {
                console.warn('⚠️ Failed to save error to DB:', dbError);
            }
            res.status(500).json({
                success: false,
                error: 'Build process failed',
                details: errorMessage,
                buildId: buildId,
                sessionId: sessionId
            });
        }
    }));
    return router;
}
//# sourceMappingURL=generation.js.map