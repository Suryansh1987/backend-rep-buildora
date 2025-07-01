// routes/generation.ts - Fixed to prevent duplicate project creation
import express, { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import AdmZip from "adm-zip";
import * as fs from "fs";
import path from "path";
import type { TextBlock } from '@anthropic-ai/sdk/resources/messages';
import {
  uploadToAzureBlob,
  triggerAzureContainerJob,
  deployToSWA,
  runBuildAndDeploy,
} from "../services/azure-deploy";
import { DrizzleMessageHistoryDB } from '../db/messagesummary';
import { StatelessSessionManager } from './session';
import { systemPrompt } from "../defaults/promt";
import { parseFrontendCode } from "../utils/newparser";
import { EnhancedProjectUrlManager } from '../db/url-manager';
import Anthropic from "@anthropic-ai/sdk";

const router = express.Router();

interface FileData {
  path: string;
  content: string;
}

function getFileDescription(file: FileData): string {
  const content = file.content;
  let description = '';
  
  if (file.path.includes('App.tsx')) {
    description = 'Main app with routing and navigation setup';
  } else if (file.path.includes('pages/')) {
    if (content.includes('Hero') || content.includes('hero')) description = 'Landing page with hero section';
    else if (content.includes('About')) description = 'About page with company info';
    else if (content.includes('Contact')) description = 'Contact page with form';
    else if (content.includes('Services')) description = 'Services page with offerings';
    else if (content.includes('Gallery')) description = 'Gallery page with images';
    else description = 'Page component with content sections';
  } else if (file.path.includes('components/')) {
    if (content.includes('Header') || content.includes('nav')) description = 'Header/navigation component';
    else if (content.includes('Footer')) description = 'Footer component with links';
    else if (content.includes('Card')) description = 'Card component for displaying content';
    else if (content.includes('Button')) description = 'Button component with variants';
    else if (content.includes('Form')) description = 'Form component with validation';
    else if (content.includes('Modal')) description = 'Modal/dialog component';
    else description = 'Reusable UI component';
  } else if (file.path.includes('types/')) {
    description = 'TypeScript type definitions and interfaces';
  } else if (file.path.includes('hooks/')) {
    description = 'Custom React hooks for state/logic';
  } else if (file.path.includes('lib/')) {
    description = 'Utility functions and helpers';
  } else {
    description = 'Frontend utility file';
  }
  
  return description;
}

async function cleanupTempDirectory(buildId: string): Promise<void> {
  const tempBuildDir = path.join(__dirname, "../../temp-builds", buildId);
  try {
    await fs.promises.rm(tempBuildDir, { recursive: true, force: true });
    console.log(`[${buildId}] 🧹 Temp directory cleaned up`);
  } catch (error) {
    console.warn(`[${buildId}] ⚠️ Failed to cleanup temp directory:`, error);
  }
}

// DYNAMIC USER RESOLUTION FUNCTION
async function resolveUserId(
  messageDB: DrizzleMessageHistoryDB,
  providedUserId?: number,
  sessionId?: string
): Promise<number> {
  try {
    // Priority 1: Use provided userId if valid
    if (providedUserId && await messageDB.validateUserExists(providedUserId)) {
      return providedUserId;
    }

    // Priority 2: Get userId from session's most recent project
    if (sessionId) {
      const sessionProject = await messageDB.getProjectBySessionId(sessionId);
      if (sessionProject && sessionProject.userId) {
        return sessionProject.userId;
      }
    }

    // Priority 3: Get most recent user from any project
    const mostRecentUserId = await messageDB.getMostRecentUserId();
    if (mostRecentUserId && await messageDB.validateUserExists(mostRecentUserId)) {
      return mostRecentUserId;
    }

    // Priority 4: Create a new user with current timestamp
    const newUserId = Date.now() % 1000000;
    await messageDB.ensureUserExists(newUserId, {
      email: `user${newUserId}@buildora.dev`,
      name: `User ${newUserId}`
    });
    
    console.log(`✅ Created new user ${newUserId} as fallback`);
    return newUserId;
  } catch (error) {
    console.error('❌ Failed to resolve user ID:', error);
    throw new Error('Could not resolve or create user');
  }
}

export function initializeGenerationRoutes(
  anthropic: Anthropic,
  messageDB: DrizzleMessageHistoryDB,
  sessionManager: StatelessSessionManager
): express.Router {

  // Initialize Enhanced Project URL Manager
  const projectUrlManager = new EnhancedProjectUrlManager(messageDB);

  // MAIN GENERATION ENDPOINT - SINGLE PROJECT CREATION ONLY
  router.post("/", async (req: Request, res: Response): Promise<void> => {
    const { 
      prompt, 
      userId: providedUserId,
      projectName,
      framework,
      template,
      description
    } = req.body;
    
    if (!prompt) {
      res.status(400).json({
        success: false,
        error: "Prompt is required"
      });
      return;
    }

    const buildId = uuidv4();
    const sessionId = sessionManager.generateSessionId();
    
    // Step 1: Resolve user ID ONLY (no project creation)
    let userId: number;
    try {
      userId = await resolveUserId(messageDB, providedUserId, sessionId);
      console.log(`[${buildId}] Resolved user ID: ${userId} (provided: ${providedUserId})`);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to resolve user for project generation',
        details: error instanceof Error ? error.message : 'Unknown error',
        buildId,
        sessionId
      });
      return;
    }
    
    console.log(`[${buildId}] Starting new project generation pipeline`);
    console.log(`[${buildId}] Session: ${sessionId}, User: ${userId}`);
    console.log(`[${buildId}] Prompt: "${prompt.substring(0, 100)}..."`);
    
    const cleanupTimer = setTimeout(() => {
      cleanupTempDirectory(buildId);
      sessionManager.cleanup(sessionId);
    }, 5 * 60 * 1000);
   
    try {
      // Save initial session context
      await sessionManager.saveSessionContext(sessionId, {
        buildId,
        tempBuildDir: '',
        lastActivity: Date.now()
      });

      console.log(`[${buildId}] 🚀 Starting frontend generation...`);

      // Setup temp build directory
      const sourceTemplateDir = path.join(__dirname, "../../react-base");
      const tempBuildDir = path.join(__dirname, "../../temp-builds", buildId);

      await fs.promises.mkdir(tempBuildDir, { recursive: true });
      await fs.promises.cp(sourceTemplateDir, tempBuildDir, { recursive: true });
      console.log(`[${buildId}] Template copied to temp directory`);

      // Update session with temp directory
      await sessionManager.updateSessionContext(sessionId, { tempBuildDir });

      // Save user message to database
      const userMessageId = await messageDB.addMessage(prompt, 'user', {
        promptType: 'frontend_generation',
        requestType: 'user_prompt',
        timestamp: new Date().toISOString(),
        sessionId: sessionId,
        userId: userId
      } as any);

      console.log(`[${buildId}] 🔨 Generating frontend code using Claude...`);
      
      const frontendPrompt = `${prompt}

Generate a React TypeScript frontend application. Focus on creating functional, modern components with good structure.`;

      const startTime = Date.now();
      
      console.log(`[${buildId}] 📡 Starting streaming request for frontend generation...`);
      const stream = await anthropic.messages.stream({
        model: "claude-sonnet-4-0",
        max_tokens: 25000,
        temperature: 0.1,
        system: systemPrompt,
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
          console.log(`[${buildId}] 📊 Received ${responseLength} characters...`);
        }
      });

      const result = await stream.finalMessage();
      const frontendEndTime = Date.now();
      const frontendProcessingTime = frontendEndTime - startTime;

      console.log(`[${buildId}] 🔍 Frontend generation completed. Response length: ${accumulatedResponse.length}`);

      // Parse files using the new parser
      let parsedFiles: FileData[] = [];
      let parseSuccess = false;
      let parseError = null;

      try {
        console.log(`[${buildId}] 🔍 Parsing frontend response with new parser...`);
        const parsedFrontend = parseFrontendCode(accumulatedResponse);
        parsedFiles = parsedFrontend.codeFiles;
        parseSuccess = true;
        console.log(`[${buildId}] ✅ Successfully parsed ${parsedFiles.length} files`);
      } catch (error) {
        parseError = error;
        console.error(`[${buildId}] ❌ Failed to parse files:`, parseError);
        
        // Fallback parsing logic
        try {
          console.log(`[${buildId}] 🔧 Attempting fallback parsing...`);
          let jsonContent = accumulatedResponse.trim();
          
          const jsonBlockMatch = jsonContent.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonBlockMatch) {
            jsonContent = jsonBlockMatch[1].trim();
          } else {
            const jsonObjectMatch = jsonContent.match(/\{[\s\S]*\}/);
            if (jsonObjectMatch) {
              jsonContent = jsonObjectMatch[0];
            }
          }
          
          if (!jsonContent.endsWith('}')) {
            console.log(`[${buildId}] ⚠️ JSON appears truncated, attempting to fix...`);
            const lastCompleteQuote = jsonContent.lastIndexOf('",');
            if (lastCompleteQuote !== -1) {
              jsonContent = jsonContent.substring(0, lastCompleteQuote + 1) + '\n  }\n}';
            }
          }
          
          const parsed = JSON.parse(jsonContent);
          
          if (parsed.codeFiles && typeof parsed.codeFiles === 'object') {
            parsedFiles = Object.entries(parsed.codeFiles).map(([path, content]) => ({
              path,
              content: content as string
            }));
            parseSuccess = true;
            console.log(`[${buildId}] ✅ Fallback parsing successful: ${parsedFiles.length} files`);
          }
          else if (parsed.files && Array.isArray(parsed.files)) {
            parsedFiles = parsed.files;
            parseSuccess = true;
            console.log(`[${buildId}] ✅ Fallback parsing successful: ${parsedFiles.length} files`);
          }
          else {
            throw new Error(`JSON structure not recognized. Keys: ${Object.keys(parsed).join(', ')}`);
          }
          
        } catch (fallbackError) {
          console.error(`[${buildId}] ❌ Fallback parsing also failed:`, fallbackError);
        }
      }

      if (!parseSuccess) {
        clearTimeout(cleanupTimer);
        await sessionManager.cleanup(sessionId);
        
        // Save error to database
        await messageDB.addMessage(
          `Frontend generation failed: Failed to parse generated files`,
          'assistant',
          {
            promptType: 'frontend_generation',
            requestType: 'claude_response',
            relatedUserMessageId: userMessageId,
            success: false,
            error: 'Parse failure',
            buildId: buildId,
            sessionId: sessionId,
            userId: userId
          } as any
        );

        res.status(400).json({
          success: false,
          error: 'Failed to parse generated files',
          details: parseError,
          rawResponse: accumulatedResponse.substring(0, 500) + '...',
          buildId: buildId,
          sessionId: sessionId,
          userId: userId,
          databaseSaved: true,
          projectUrlsSaved: false
        });
        return;
      }

      // Write files to temp directory AND cache in Redis
      console.log(`[${buildId}] 💾 Writing ${parsedFiles.length} files to temp directory and caching...`);
      const fileMap: { [path: string]: string } = {};
      
      for (const file of parsedFiles) {
        const fullPath = path.join(tempBuildDir, file.path);
        await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.promises.writeFile(fullPath, file.content, "utf8");
        
        // Cache in Redis for potential future modifications
        fileMap[file.path] = file.content;
      }

      // Cache all files in Redis
      await sessionManager.cacheProjectFiles(sessionId, fileMap);
      console.log(`[${buildId}] 📦 Cached ${Object.keys(fileMap).length} files in Redis`);

      // Generate project summary
      console.log(`[${buildId}] 📋 Generating project summary...`);
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
          } else if (exp.includes('export const') || exp.includes('export function')) {
            const namedMatch = exp.match(/export\s+(?:const|function)\s+(\w+)/) || [];
            return { type: 'named', name: namedMatch[1] || 'unknown' };
          } else if (exp.includes('export interface') || exp.includes('export type')) {
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

      const summaryPrompt = `Based on these generated files, create a concise project summary:

GENERATED FILES ANALYSIS:
${filesList}

Create a summary in this format:

**Project:** [Type based on file names and content]
**Files created:**
- src/App.tsx: {actual imports/exports} [description]
- src/pages/[PageName].tsx: {actual imports/exports} [description]  
- src/components/[ComponentName].tsx: {actual imports/exports} [description]

Use the ACTUAL imports and exports provided. Keep under 1000 characters.`;

      let projectSummary = '';
      
      try {
        const summaryStartTime = Date.now();
        const summaryResult = await anthropic.messages.create({
          model: "claude-3-5-sonnet-20240620",
          max_tokens: 800,
          temperature: 0.2,
          system: "You are a frontend developer creating concise summaries of generated React projects.",
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

        const summaryBlocks = summaryResult.content.filter(
          (block): block is TextBlock => block.type === "text"
        );

        projectSummary = summaryBlocks.map(block => block.text).join('\n');
        const summaryEndTime = Date.now();
        
        console.log(`[${buildId}] 📋 Project summary generated in ${summaryEndTime - summaryStartTime}ms`);

      } catch (summaryError) {
        console.error(`[${buildId}] ⚠️ Error generating summary:`, summaryError);
        projectSummary = `Frontend project with ${parsedFiles.length} files: ${parsedFiles.map(f => f.path).join(', ')}`;
      }

      // BUILD & DEPLOY PIPELINE
      console.log(`[${buildId}] 🏗️ Starting build & deploy pipeline...`);

      // Create zip and upload to Azure
      const zip = new AdmZip();
      zip.addLocalFolder(tempBuildDir);
      const zipBuffer = zip.toBuffer();

      const zipBlobName = `${buildId}/source.zip`;
      const zipUrl = await uploadToAzureBlob(
        process.env.AZURE_STORAGE_CONNECTION_STRING!,
        "source-zips",
        zipBlobName,
        zipBuffer
      );
      console.log(`[${buildId}] ✅ Source uploaded to Azure: ${zipUrl}`);
      
      // Update session context with project summary and zipUrl
      await sessionManager.updateSessionContext(sessionId, {
        projectSummary: {
          summary: projectSummary,
          zipUrl: zipUrl,
          buildId: buildId
        }
      });
      
      // Trigger Azure Container Job
      console.log(`[${buildId}] 🔧 Triggering Azure Container Job...`);
      const DistUrl = await triggerAzureContainerJob(zipUrl, buildId, {
        resourceGroup: process.env.AZURE_RESOURCE_GROUP!,
        containerAppEnv: process.env.AZURE_CONTAINER_APP_ENV!,
        acrName: process.env.AZURE_ACR_NAME!,
        storageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
        storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME!,
      });

      const urls = JSON.parse(DistUrl);
      const builtZipUrl = urls.downloadUrl;
      
      // Deploy using the new deployment method
      console.log(`[${buildId}] 🚀 Deploying with Azure Static Web Apps...`);
      const previewUrl = await runBuildAndDeploy(builtZipUrl, buildId);

      // *** SINGLE PROJECT CREATION POINT - USE ONLY URL MANAGER ***
      console.log(`[${buildId}] 💾 Creating project record using URL manager ONLY...`);
      
      let urlResult: { projectId: number | null; action: 'created' | 'updated' | 'failed' } = { 
        projectId: null, 
        action: 'failed' 
      };
      let projectUrlsSaved = false;
      
      try {
        const result = await projectUrlManager.saveOrUpdateProjectUrls(sessionId, buildId, {
          deploymentUrl: previewUrl as string,
          downloadUrl: urls.downloadUrl,
          zipUrl: zipUrl
        }, {
          projectId: undefined,                         // No existing project for new generation
          userId: userId,                               // Resolved user ID
          isModification: false,                        // This is new generation
          prompt: prompt,
          name: projectName,
          description: description || projectSummary,
          framework: framework || 'react',
          template: template || 'vite-react-ts'
        });
        
        urlResult = { 
          projectId: result.projectId, 
          action: result.action
        };
        projectUrlsSaved = true;
        
        console.log(`[${buildId}] ✅ Project ${result.action} - Project ID: ${result.projectId}`);
        
      } catch (projectError) {
        console.error(`[${buildId}] ❌ Failed to save/update project URLs:`, projectError);
        urlResult = { projectId: null, action: 'failed' };
        
        // Log the specific error for debugging
        if (projectError instanceof Error) {
          if (projectError.message.includes('foreign key constraint')) {
            console.warn(`[${buildId}] Foreign key constraint violation - attempting to resolve user issue`);
            
            // Try to ensure user exists and retry once
            try {
              await messageDB.ensureUserExists(userId);
              console.log(`[${buildId}] User ${userId} ensured, retrying project creation...`);
              
              const retryResult = await projectUrlManager.saveOrUpdateProjectUrls(sessionId, buildId, {
                deploymentUrl: previewUrl as string,
                downloadUrl: urls.downloadUrl,
                zipUrl: zipUrl
              }, {
                projectId: undefined,
                userId: userId,
                isModification: false,
                prompt: prompt,
                name: projectName,
                description: description || projectSummary,
                framework: framework || 'react',
                template: template || 'vite-react-ts'
              });
              
              urlResult = { 
                projectId: retryResult.projectId, 
                action: retryResult.action
              };
              projectUrlsSaved = true;
              console.log(`[${buildId}] ✅ Retry successful - Project ${retryResult.action} - ID: ${retryResult.projectId}`);
              
            } catch (retryError) {
              console.error(`[${buildId}] ❌ Retry also failed:`, retryError);
            }
          } else {
            console.error(`[${buildId}] Database error:`, projectError.message);
          }
        }
      }

      // Save project summary to database (for backwards compatibility)
      try {
        const summaryId = await messageDB.saveProjectSummary(
          projectSummary, 
          prompt, 
          zipUrl, 
          buildId,
          userId
        );
        console.log(`[${buildId}] 💾 Saved project summary to database, ID: ${summaryId}`);
      } catch (summaryError) {
        console.error(`[${buildId}] ⚠️ Error saving project summary:`, summaryError);
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
          modificationApproach: "FULL_FILE_GENERATION" as const,
          modificationSuccess: true,
          buildId: buildId,
          previewUrl: previewUrl as string,
          downloadUrl: urls.downloadUrl,
          zipUrl: zipUrl,
          sessionId: sessionId,
          projectId: urlResult.projectId,
          userId: userId
        };

        const assistantMessageId = await messageDB.addMessage(
          `Generated ${parsedFiles.length} files:\n\n${parsedFiles.map(f => f.path).join('\n')}`,
          'assistant'
                );
        console.log(`[${buildId}] 💾 Saved assistant response (ID: ${assistantMessageId})`);
      } catch (dbError) {
        console.warn(`[${buildId}] ⚠️ Failed to save assistant response:`, dbError);
      }

      // Cleanup
      clearTimeout(cleanupTimer);
      await cleanupTempDirectory(buildId);
      // Keep Redis session for potential modifications (will auto-expire)

      const totalProcessingTime = Date.now() - startTime;
      console.log(`[${buildId}] ⏱️ Total generation completed in ${totalProcessingTime}ms`);
      console.log(`[${buildId}] 📊 Token usage: ${result.usage?.input_tokens || 0} input, ${result.usage?.output_tokens || 0} output`);
      
      // SUCCESS RESPONSE - Project generation succeeded
      res.json({
        success: true,
        files: parsedFiles,
        previewUrl: previewUrl,
        downloadUrl: urls.downloadUrl,
        zipUrl: zipUrl,
        buildId: buildId,
        sessionId: sessionId,
        userId: userId,
        projectId: urlResult.projectId,
        projectAction: urlResult.action,
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
          generatedFilesSummary: `Generated ${parsedFiles.length} files:\n\n${parsedFiles.map(f => `📁 ${f.path}: ${getFileDescription(f)}`).join('\n')}`,
          databaseSaved: true,
          projectUrlsSaved: projectUrlsSaved,
          identificationStrategy: 'single_url_manager_creation',
          duplicatePrevention: 'url_manager_only',
          userProvided: {
            userId: providedUserId,
            resolvedUserId: userId,
            projectName: projectName,
            framework: framework,
            template: template,
            description: description
          }
        }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`[${buildId}] ❌ Complete build pipeline failed:`, errorMessage);

      clearTimeout(cleanupTimer);
      await cleanupTempDirectory(buildId);
      await sessionManager.cleanup(sessionId);

      // Save error to database
      try {
        const errorMetadata = {
          promptType: 'frontend_generation',
          requestType: 'claude_response',
          success: false,
          error: errorMessage,
          processingTimeMs: 0,
          buildId: buildId,
          sessionId: sessionId,
          userId: userId
        };

        await messageDB.addMessage(
          `Frontend generation and build failed: ${errorMessage}`,
          'assistant',
          errorMetadata
        );
      } catch (dbError) {
        console.warn(`[${buildId}] ⚠️ Failed to save error to DB:`, dbError);
      }
     
      // ERROR RESPONSE
      res.status(500).json({ 
        success: false,
        error: 'Build process failed',
        details: errorMessage,
        buildId: buildId,
        sessionId: sessionId,
        userId: userId,
        databaseSaved: true,
        projectUrlsSaved: false,
        projectId: null,
        projectAction: 'failed'
      });
    }
  });

  return router;
}