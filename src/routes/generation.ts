// routes/generation.ts - Project generation routes
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
} from "../services/azure-deploy";
import { DrizzleMessageHistoryDB } from '../db/messagesummary';
import { StatelessSessionManager } from './session';
import { systemPrompt } from "../defaults/promt";
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

export function initializeGenerationRoutes(
  anthropic: Anthropic,
  messageDB: DrizzleMessageHistoryDB,
  sessionManager: StatelessSessionManager
): express.Router {

  // MAIN GENERATION ENDPOINT (enhanced with Redis session support)
  router.post("/", async (req: Request, res: Response): Promise<void> => {
    const { prompt, projectId } = req.body;
    if (!prompt) {
      res.status(400).json({
        success: false,
        error: "Prompt is required"
      });
      return;
    }

    const buildId = uuidv4();
    const sessionId = sessionManager.generateSessionId(); // Generate stateless session
    
    console.log(`[${buildId}] Starting stateless build pipeline for prompt: "${prompt.substring(0, 100)}..."`);
    console.log(`[${buildId}] Session ID: ${sessionId}`);
    
    const cleanupTimer = setTimeout(() => {
      cleanupTempDirectory(buildId);
      sessionManager.cleanup(sessionId); // Cleanup Redis session
    }, 5 * 60 * 1000);
   
    try {
      // Save initial session context
      await sessionManager.saveSessionContext(sessionId, {
        buildId,
        tempBuildDir: '',
        lastActivity: Date.now()
      });

      console.log('🚀 Starting frontend generation for prompt:', prompt.substring(0, 100) + '...');

      const sourceTemplateDir = path.join(__dirname, "../../react-base");
      const tempBuildDir = path.join(__dirname, "../../temp-builds", buildId);

      await fs.promises.mkdir(tempBuildDir, { recursive: true });
      await fs.promises.cp(sourceTemplateDir, tempBuildDir, { recursive: true });
      console.log(`[${buildId}] Template copied to temp directory`);

      // Update session with temp directory
      await sessionManager.updateSessionContext(sessionId, { tempBuildDir });

      const userMessageId = await messageDB.addMessage(prompt, 'user', {
        promptType: 'frontend_generation',
        requestType: 'user_prompt',
        timestamp: new Date().toISOString(),
        sessionId: sessionId // Track session in DB
      }as any);

      console.log('🔨 Generating frontend code using system prompt...');
      
      const frontendPrompt = `${prompt}

Generate a React TypeScript frontend application. Focus on creating functional, modern components with good structure.`;

      const startTime = Date.now();
      
      console.log('📡 Starting streaming request for frontend generation...');
      const stream = await anthropic.messages.stream({
        model: "claude-sonnet-4-0",
        max_tokens: 25000,
        temperature: 0.1,
        system: systemPrompt, // Use imported system prompt
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

      const result = await stream.finalMessage();
      const frontendEndTime = Date.now();
      const frontendProcessingTime = frontendEndTime - startTime;

      console.log('🔍 Frontend generation completed. Total response length:', accumulatedResponse.length);

      // Parse files (same logic as your working code)
      let parsedFiles: FileData[] = [];
      let parseSuccess = false;
      let parseError = null;

      try {
        console.log('🔍 Attempting to parse frontend response...');
        
        let jsonContent = accumulatedResponse.trim();
        
        const jsonBlockMatch = jsonContent.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonBlockMatch) {
          jsonContent = jsonBlockMatch[1].trim();
          console.log('🔍 Extracted JSON from markdown code block');
        } else {
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
            content: content as string
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
        
      } catch (error) {
        parseError = error;
        console.error('❌ Failed to parse files from response:', parseError);
        
        try {
          console.log('🔧 Attempting enhanced regex fallback...');
          const extractedFiles: FileData[] = [];
          
          const filePatterns = [
            /"([^"]+\.(?:tsx?|jsx?|js|ts))"\s*:\s*"((?:[^"\\]|\\.)*)"/g,
            /(?:path|file):\s*"([^"]+\.(?:tsx?|jsx?|js|ts))"\s*,?\s*content:\s*"((?:[^"\\]|\\.)*)"/g
          ];
          
          for (const pattern of filePatterns) {
            let match;
            while ((match = pattern.exec(accumulatedResponse)) !== null) {
              const path = match[1];
              let content = match[2];
              
              content = content.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
              
              if (path && content && !extractedFiles.find(f => f.path === path)) {
                extractedFiles.push({ path, content });
              }
            }
          }
          
          if (extractedFiles.length > 0) {
            parsedFiles = extractedFiles;
            parseSuccess = true;
            console.log(`✅ Successfully extracted ${parsedFiles.length} files using enhanced regex fallback`);
          }
        } catch (regexError) {
          console.error('❌ Enhanced regex fallback also failed:', regexError);
        }
      }

      if (!parseSuccess) {
        clearTimeout(cleanupTimer);
        await sessionManager.cleanup(sessionId);
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
      const fileMap: { [path: string]: string } = {};
      
      for (const file of parsedFiles) {
        const fullPath = path.join(tempBuildDir, file.path);
        await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.promises.writeFile(fullPath, file.content, "utf8");
        console.log(`✅ Written to temp: ${file.path}`);
        
        // Cache in Redis for potential future modifications
        fileMap[file.path] = file.content;
      }

      // Cache all files in Redis
      await sessionManager.cacheProjectFiles(sessionId, fileMap);
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
        const summaryResult = await anthropic.messages.create({
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

        const summaryBlocks = summaryResult.content.filter(
          (block): block is TextBlock => block.type === "text"
        );

        projectSummary = summaryBlocks.map(block => block.text).join('\n');
        const summaryEndTime = Date.now();
        const summaryProcessingTime = summaryEndTime - summaryStartTime;
        
        console.log('📋 Project Summary Generated:', projectSummary);
        console.log(`⏱️  Summary generation completed in ${summaryProcessingTime}ms`);

      } catch (summaryError) {
        console.error('⚠️ Error generating summary:', summaryError);
        projectSummary = `Frontend project with ${parsedFiles.length} files: ${parsedFiles.map(f => f.path).join(', ')}`;
      }

      // Create zip and upload to Azure
      console.log(`[${buildId}] Creating zip and uploading to Azure...`);
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
      console.log(zipUrl, "this is the url that is sent for deployment");
      
      // Update session context with project summary and zipUrl
      await sessionManager.updateSessionContext(sessionId, {
        projectSummary: {
          summary: projectSummary,
          zipUrl: zipUrl,
          buildId: buildId
        }
      });
      
      // Trigger Azure Container Job
      console.log(`[${buildId}] Triggering Azure Container Job...`);

      const DistUrl = await triggerAzureContainerJob(zipUrl, buildId, {
        resourceGroup: process.env.AZURE_RESOURCE_GROUP!,
        containerAppEnv: process.env.AZURE_CONTAINER_APP_ENV!,
        acrName: process.env.AZURE_ACR_NAME!,
        storageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
        storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME!,
      });

      const urls = JSON.parse(DistUrl);
      console.log(urls, "build urls");
      const builtZipUrl = urls.downloadUrl;
      
      // Deploy to Static Web Apps
      console.log(`[${buildId}] Deploying to SWA...`);
      const { previewUrl, downloadUrl } = await deployToSWA(builtZipUrl, buildId);

      // Save project summary with ZIP URL to database
      try {
        const summaryId = await messageDB.saveProjectSummary(
          projectSummary, 
          prompt, 
          zipUrl, 
          buildId
        );
        console.log('💾 Saved project summary with ZIP URL to database, ID:', summaryId);
      } catch (summaryError) {
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
          modificationApproach: "FULL_FILE_GENERATION" as const,
          modificationSuccess: true,
          buildId: buildId,
          previewUrl: previewUrl,
          downloadUrl: downloadUrl,
          zipUrl: zipUrl,
          sessionId: sessionId // Track session
        };

        const assistantMessageId = await messageDB.addMessage(
          `Generated ${parsedFiles.length} files:\n\n${parsedFiles.map(f => f.path).join('\n')}`,
          'assistant',
          assistantMetadata
        );
        console.log(`💾 Saved assistant response (ID: ${assistantMessageId}) with session: ${sessionId}`);
      } catch (dbError) {
        console.warn('⚠️ Failed to save assistant response to DB:', dbError);
      }

      if (projectId) {
        console.log(`📝 Updating project ${projectId} with new deployment URL`);
      }

      clearTimeout(cleanupTimer);
      await cleanupTempDirectory(buildId);
      // Keep Redis session for potential modifications (will auto-expire)

      const totalProcessingTime = Date.now() - startTime;
      console.log(`⏱️  Total generation + build + deploy completed in ${totalProcessingTime}ms`);
      console.log(`📊 Token usage: ${result.usage?.input_tokens || 0} input, ${result.usage?.output_tokens || 0} output`);
      
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

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`[${buildId}] Complete build pipeline failed:`, errorMessage);

      clearTimeout(cleanupTimer);
      await cleanupTempDirectory(buildId);
      await sessionManager.cleanup(sessionId); // Cleanup Redis session on error

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

        await messageDB.addMessage(
          `Frontend generation and build failed: ${errorMessage}`,
          'assistant',
          errorMetadata
        );
      } catch (dbError) {
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
  });

  return router;
}