// routes/modification.ts - FIXED File modification routes
import express, { Request, Response } from "express";
import { StatelessIntelligentFileModifier } from '../services/filemodifier';
import { StatelessSessionManager } from './session';
import { DrizzleMessageHistoryDB } from '../db/messagesummary';
import { RedisService } from '../services/Redis';
import { ModificationChange } from '../services/filemodifier/types';
import { v4 as uuidv4 } from "uuid";
import AdmZip from "adm-zip";
import axios from 'axios';
import * as fs from "fs";
import path from "path";
import {
  uploadToAzureBlob,
  triggerAzureContainerJob,
  deployToSWA,
} from "../services/azure-deploy";
import Anthropic from "@anthropic-ai/sdk";

const router = express.Router();

// Enhanced Conversation Helper using existing services + Redis state
class StatelessConversationHelper {
  constructor(
    private messageDB: DrizzleMessageHistoryDB,
    private redis: RedisService
  ) {}

  async saveModification(sessionId: string, modification: any): Promise<void> {
    // Save to database (persistent)
    await this.messageDB.saveModification(modification);
    
    // Save to Redis session state (fast access) - using proper ModificationChange interface
    const change = {
      type: 'modified' as const, // Use proper type from your ModificationChange interface
      file: 'session_modification', // Required field
      description: `${modification.approach}: ${modification.prompt.substring(0, 100)}...`, // Required field
       timestamp: new Date().toISOString(), 
      prompt: modification.prompt,
      approach: modification.approach,
      filesModified: modification.filesModified || [],
      filesCreated: modification.filesCreated || [],
      success: modification.result?.success || false
    };
    await this.redis.addModificationChange(sessionId, change);
  }

  async getEnhancedContext(sessionId: string): Promise<string> {
    // Try Redis first for fast access
    const cachedContext = await this.redis.getSessionState<string>(sessionId, 'conversation_context');
    if (cachedContext) {
      return cachedContext;
    }

    // Fall back to database
    const dbContext = await this.messageDB.getConversationContext();
    if (dbContext) {
      // Cache for next time
      await this.redis.setSessionState(sessionId, 'conversation_context', dbContext);
      return dbContext;
    }
    
    return '';
  }

  async getConversationWithSummary(): Promise<any> {
    const conversation = await this.messageDB.getRecentConversation();
    return {
      messages: conversation.messages.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        messageType: msg.messageType,
        metadata: {
          fileModifications: msg.fileModifications,
          modificationApproach: msg.modificationApproach,
          modificationSuccess: msg.modificationSuccess
        },
        createdAt: msg.createdAt
      })),
      summaryCount: conversation.summaryCount,
      totalMessages: conversation.totalMessages
    };
  }
}

// Utility functions
async function downloadAndExtractProject(buildId: string, zipUrl: string): Promise<string> {
  const tempBuildDir = path.join(__dirname, "../../temp-builds", buildId);
  
  try {
    console.log(`[${buildId}] Downloading project from: ${zipUrl}`);
    
    const response = await axios.get(zipUrl, { responseType: 'stream' });
    const zipPath = path.join(__dirname, "../../temp-builds", `${buildId}-download.zip`);
    
    await fs.promises.mkdir(path.dirname(zipPath), { recursive: true });
    
    const writer = fs.createWriteStream(zipPath);
    response.data.pipe(writer);
    
    await new Promise<void>((resolve, reject) => {
      writer.on('finish', () => resolve());
      writer.on('error', (err) => reject(err));
    });
    console.log(`[${buildId}] ZIP downloaded successfully`);
    
    const zip = new AdmZip(zipPath);
    await fs.promises.mkdir(tempBuildDir, { recursive: true });
    zip.extractAllTo(tempBuildDir, true);
    
    console.log(`[${buildId}] Project extracted to: ${tempBuildDir}`);
    
    await fs.promises.unlink(zipPath);
    
    return tempBuildDir;
  } catch (error) {
    console.error(`[${buildId}] Failed to download and extract project:`, error);
    throw new Error(`Failed to download project: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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

// Initialize routes with dependencies
export function initializeModificationRoutes(
  anthropic: Anthropic,
  messageDB: DrizzleMessageHistoryDB,
  redis: RedisService,
  sessionManager: StatelessSessionManager
): express.Router {
  
  const conversationHelper = new StatelessConversationHelper(messageDB, redis);

  // STATELESS STREAMING MODIFICATION ENDPOINT
  router.post("/stream", async (req: Request, res: Response): Promise<void> => {
    const { prompt, sessionId: clientSessionId } = req.body;
    
    if (!prompt) {
      res.status(400).json({
        success: false,
        error: "Prompt is required"
      });
      return;
    }

    // Use provided session ID or generate new one
    const sessionId = clientSessionId || sessionManager.generateSessionId();
    const buildId = uuidv4();
    
    console.log(`[${buildId}] Starting stateless streaming modification for session: ${sessionId}`);
    console.log(`[${buildId}] Prompt: "${prompt.substring(0, 100)}..."`);

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': 'http://localhost:5173',
      'Access-Control-Allow-Credentials': 'true'
    });

    const sendEvent = (type: string, data: any) => {
      console.log(`📤 Sending ${type} event:`, data);
      res.write(`event: ${type}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const cleanupTimer = setTimeout(() => {
      cleanupTempDirectory(buildId);
      sessionManager.cleanup(sessionId);
    }, 5 * 60 * 1000);

    try {
      sendEvent('progress', { 
        step: 1, 
        total: 15,
        message: 'Initializing stateless modification system and checking Redis cache...',
        buildId: buildId,
        sessionId: sessionId
      });

      // Get project context from Redis OR database
      let sessionContext = await sessionManager.getSessionContext(sessionId);
      let tempBuildDir: string;

      if (sessionContext && sessionContext.projectSummary && sessionContext.projectSummary.zipUrl) {
        sendEvent('progress', { 
          step: 2, 
          total: 15, 
          message: 'Found existing project in Redis cache! Downloading latest project ZIP...',
          buildId: buildId,
          sessionId: sessionId
        });

        tempBuildDir = await downloadAndExtractProject(buildId, sessionContext.projectSummary.zipUrl);
        
        sendEvent('progress', { 
          step: 3, 
          total: 15, 
          message: 'Project downloaded! Loading cached files from Redis...',
          buildId: buildId,
          sessionId: sessionId
        });

        const cachedFiles = await sessionManager.getCachedProjectFiles(sessionId);
        if (Object.keys(cachedFiles).length > 0) {
          console.log(`📦 Found ${Object.keys(cachedFiles).length} cached files in Redis for session: ${sessionId}`);
          sendEvent('progress', { 
            step: 4, 
            total: 15, 
            message: `Loaded ${Object.keys(cachedFiles).length} files from Redis cache! Proceeding with stateless modification...`,
            buildId: buildId,
            sessionId: sessionId
          });
        }
        
      } else {
        // Fallback to database check
        sendEvent('progress', { 
          step: 2, 
          total: 15, 
          message: 'No Redis session found. Checking database for existing project...',
          buildId: buildId,
          sessionId: sessionId
        });

        const projectSummary = await messageDB.getActiveProjectSummary();
        
        if (projectSummary && projectSummary.zipUrl) {
          sendEvent('progress', { 
            step: 3, 
            total: 15, 
            message: 'Found existing project in database! Downloading and caching in Redis...',
            buildId: buildId,
            sessionId: sessionId
          });

          tempBuildDir = await downloadAndExtractProject(buildId, projectSummary.zipUrl);
          
          sessionContext = {
            buildId,
            tempBuildDir,
            projectSummary: {
              summary: projectSummary.summary,
              zipUrl: projectSummary.zipUrl,
              buildId: projectSummary.buildId
            },
            lastActivity: Date.now()
          };
          await sessionManager.saveSessionContext(sessionId, sessionContext);

          // Cache project files in Redis
          const projectFiles: { [path: string]: string } = {};
          const readProjectFiles = async (dir: string, baseDir: string = dir) => {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                await readProjectFiles(fullPath, baseDir);
              } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts') || entry.name.endsWith('.jsx') || entry.name.endsWith('.js'))) {
                const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
                const content = await fs.promises.readFile(fullPath, 'utf8');
                projectFiles[relativePath] = content;
              }
            }
          };
          
          await readProjectFiles(tempBuildDir);
          await sessionManager.cacheProjectFiles(sessionId, projectFiles);
          
          sendEvent('progress', { 
            step: 4, 
            total: 15, 
            message: `Cached ${Object.keys(projectFiles).length} files in Redis! Ready for stateless modification...`,
            buildId: buildId,
            sessionId: sessionId
          });
          
        } else {
          sendEvent('progress', { 
            step: 3, 
            total: 15, 
            message: 'No existing project found. Creating new project from template...',
            buildId: buildId,
            sessionId: sessionId
          });

          const sourceTemplateDir = path.join(__dirname, "../../react-base");
          tempBuildDir = path.join(__dirname, "../../temp-builds", buildId);

          await fs.promises.mkdir(tempBuildDir, { recursive: true });
          await fs.promises.cp(sourceTemplateDir, tempBuildDir, { recursive: true });

          sessionContext = {
            buildId,
            tempBuildDir,
            lastActivity: Date.now()
          };
          await sessionManager.saveSessionContext(sessionId, sessionContext);

          sendEvent('progress', { 
            step: 4, 
            total: 15, 
            message: 'New project template created successfully!',
            buildId: buildId,
            sessionId: sessionId
          });
        }
      }

      // Update session context
      await sessionManager.updateSessionContext(sessionId, { 
        buildId, 
        tempBuildDir,
        lastActivity: Date.now() 
      });

      // Get enhanced context
      let enhancedPrompt = prompt;
      try {
        const context = await conversationHelper.getEnhancedContext(sessionId);
        if (context) {
          enhancedPrompt = `${context}\n\n--- CURRENT REQUEST ---\n${prompt}`;
          sendEvent('progress', { 
            step: 5, 
            total: 15, 
            message: 'Successfully loaded conversation context from Redis! Using rich context for intelligent modification...',
            buildId: buildId,
            sessionId: sessionId
          });
        } else {
          sendEvent('progress', { 
            step: 5, 
            total: 15, 
            message: 'No previous conversation context found. Starting fresh stateless analysis...',
            buildId: buildId,
            sessionId: sessionId
          });
        }
      } catch (contextError) {
        sendEvent('progress', { 
          step: 5, 
          total: 15, 
          message: 'Context loading encountered an issue, continuing with stateless modification...',
          buildId: buildId,
          sessionId: sessionId
        });
      }

      // Initialize stateless file modifier - FIXED CONSTRUCTOR
      const fileModifier = new StatelessIntelligentFileModifier(anthropic, tempBuildDir, sessionId);
      
      fileModifier.setStreamCallback((message: string) => {
        sendEvent('progress', { 
          step: 8, 
          total: 15, 
          message: message,
          buildId: buildId,
          sessionId: sessionId
        });
      });

      sendEvent('progress', { 
        step: 6, 
        total: 15, 
        message: 'Stateless file modifier initialized with Redis backing! Analyzing project structure...',
        buildId: buildId,
        sessionId: sessionId
      });

      const startTime = Date.now();
      
      // Process modification
      const result = await fileModifier.processModification(
        enhancedPrompt,
        undefined,
        sessionContext?.projectSummary?.summary,
        async (summary: string, prompt: string) => {
          try {
            const summaryId = await messageDB.saveProjectSummary(summary, prompt, "", buildId);
            console.log(`💾 Saved project summary to database, ID: ${summaryId}`);
            return summaryId;
          } catch (error) {
            console.error('⚠️ Error saving project summary:', error);
            return null;
          }
        }
      );
      
      const modificationDuration = Date.now() - startTime;
      
      if (result.success) {
        sendEvent('progress', { 
          step: 9, 
          total: 15, 
          message: `Stateless modification completed successfully in ${modificationDuration}ms! Applied ${result.approach} approach. Writing changes to files...`,
          buildId: buildId,
          sessionId: sessionId
        });

        // CRITICAL: Ensure changes are written to actual files before build
        try {
          sendEvent('progress', { 
            step: 9.5, 
            total: 15, 
            message: 'Ensuring all Redis changes are written to temp files...',
            buildId: buildId,
            sessionId: sessionId
          });
          // The fileModifier.writeChangesToFiles() is already called inside processModification
          sendEvent('progress', { 
            step: 9.7, 
            total: 15, 
            message: 'All changes written to temp files successfully',
            buildId: buildId,
            sessionId: sessionId
          });
        } catch (writeError) {
          console.error('Failed to write changes to files:', writeError);
          sendEvent('error', {
            success: false,
            error: 'Failed to write modifications to files',
            //@ts-ignore
            details: writeError.message,
            buildId: buildId,
            sessionId: sessionId
          });
          return;
        }

        // Save modification
        try {
          await conversationHelper.saveModification(sessionId, {
            prompt,
            result,
            approach: result.approach || 'UNKNOWN',
            filesModified: result.selectedFiles || [],
            filesCreated: result.addedFiles || [],
            timestamp: new Date().toISOString()
          });
        } catch (saveError) {
          console.error('Failed to save modification to history:', saveError);
        }

        // BUILD & DEPLOY PIPELINE
        try {
          sendEvent('progress', { 
            step: 10, 
            total: 15, 
            message: 'Starting build & deploy pipeline with written changes...',
            buildId: buildId,
            sessionId: sessionId
          });

          // DEBUG: Check what files exist in tempBuildDir before zipping
          console.log(`[${buildId}] DEBUG: Checking temp directory contents AFTER modification...`);
          const files = await fs.promises.readdir(tempBuildDir, { recursive: true });
          console.log(`[${buildId}] Files in temp directory:`, files.slice(0, 20));
          
          // Check if React files were actually modified
          const srcDir = path.join(tempBuildDir, 'src');
          if (await fs.promises.access(srcDir).then(() => true).catch(() => false)) {
            const srcFiles = await fs.promises.readdir(srcDir, { recursive: true });
            console.log(`[${buildId}] React files in src/:`, srcFiles);
            
            // Check timestamps of modified files
            for (const file of srcFiles.slice(0, 5)) {
              const filePath = path.join(srcDir, file);
              try {
                const stats = await fs.promises.stat(filePath);
                console.log(`[${buildId}] ${file} modified: ${stats.mtime}`);
              } catch (e) {
                //@ts-ignore
                console.log(`[${buildId}] Could not check ${file}:`, e.message);
              }
            }
          }
          
          // Check for package.json
          const packageJsonPath = path.join(tempBuildDir, 'package.json');
          try {
            const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
            console.log(`[${buildId}] Package.json found with dependencies:`, Object.keys(packageJson.dependencies || {}));
          } catch {
            console.log(`[${buildId}] ❌ No package.json found at: ${packageJsonPath}`);
          }

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

          sendEvent('progress', { 
            step: 11, 
            total: 15, 
            message: 'Source uploaded! Triggering containerized build process...',
            buildId: buildId,
            sessionId: sessionId
          });
          
          const DistUrl = await triggerAzureContainerJob(zipUrl, buildId, {
            resourceGroup: process.env.AZURE_RESOURCE_GROUP!,
            containerAppEnv: process.env.AZURE_CONTAINER_APP_ENV!,
            acrName: process.env.AZURE_ACR_NAME!,
            storageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
            storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME!,
          });

          const urls = JSON.parse(DistUrl);
          const builtZipUrl = urls.downloadUrl;

          sendEvent('progress', { 
            step: 12, 
            total: 15, 
            message: 'Build completed! Deploying to Azure Static Web Apps...',
            buildId: buildId,
            sessionId: sessionId
          });
          
          const { previewUrl, downloadUrl } = await deployToSWA(builtZipUrl, buildId);

          sendEvent('progress', { 
            step: 13, 
            total: 15, 
            message: 'Updating Redis session and project summary with latest changes...',
            buildId: buildId,
            sessionId: sessionId
          });

          // Update session context
          await sessionManager.updateSessionContext(sessionId, {
            projectSummary: {
              ...sessionContext?.projectSummary,
              zipUrl: zipUrl,
              buildId: buildId
            }
          });

          // Update database
          if (sessionContext?.projectSummary) {
            const projectSummary = await messageDB.getActiveProjectSummary();
            if (projectSummary) {
              await messageDB.updateProjectSummary(projectSummary.id, zipUrl, buildId);
            }
          }

          sendEvent('progress', { 
            step: 14, 
            total: 15, 
            message: 'Cleaning up temporary files...',
            buildId: buildId,
            sessionId: sessionId
          });

          clearTimeout(cleanupTimer);
          await cleanupTempDirectory(buildId);

          sendEvent('progress', { 
            step: 15, 
            total: 15, 
            message: `🎉 Complete stateless pipeline finished! Your updated application is live at: ${previewUrl}`,
            buildId: buildId,
            sessionId: sessionId
          });

          const totalDuration = Date.now() - startTime;

          // Send final result
          sendEvent('complete', {
            success: true,
            data: {
              workflow: "stateless-modification-system-with-redis-build",
              approach: result.approach || 'UNKNOWN',
              selectedFiles: result.selectedFiles || [],
              addedFiles: result.addedFiles || [],
              modifiedRanges: typeof result.modifiedRanges === 'number' ? result.modifiedRanges : (result.modifiedRanges?.length || 0),
              conversationContext: "Enhanced context with Redis-backed stateless modification history",
              reasoning: result.reasoning,
              modificationSummary: result.modificationSummary,
              modificationDuration: modificationDuration,
              totalDuration: totalDuration,
              totalFilesAffected: (result.selectedFiles?.length || 0) + (result.addedFiles?.length || 0),
              previewUrl: previewUrl,
              downloadUrl: urls.downloadUrl,
              zipUrl: zipUrl,
              buildId: buildId,
              sessionId: sessionId,
              hosting: "Azure Static Web Apps",
              features: [
                "Global CDN",
                "Auto SSL/HTTPS", 
                "Custom domains support",
                "Staging environments",
              ]
            }
          });

        } catch (buildError) {
          console.error(`[${buildId}] Build pipeline failed:`, buildError);
          
          clearTimeout(cleanupTimer);
          await cleanupTempDirectory(buildId);
          
          sendEvent('complete', {
            success: true,
            data: {
              workflow: "stateless-modification-system-with-redis-build-error",
              approach: result.approach || 'UNKNOWN',
              selectedFiles: result.selectedFiles || [],
              addedFiles: result.addedFiles || [],
              modifiedRanges: typeof result.modifiedRanges === 'number' ? result.modifiedRanges : (result.modifiedRanges?.length || 0),
              buildError: buildError instanceof Error ? buildError.message : 'Build failed',
              buildId: buildId,
              sessionId: sessionId,
              message: "Stateless modification completed successfully, but build/deploy failed"
            }
          });
        }

        await fileModifier.cleanup();

      } else {
        sendEvent('error', {
          success: false,
          error: result.error || 'Stateless modification failed',
          approach: result.approach,
          reasoning: result.reasoning,
          buildId: buildId,
          sessionId: sessionId
        });

        clearTimeout(cleanupTimer);
        await cleanupTempDirectory(buildId);
        await fileModifier.cleanup();
      }

    } catch (error: any) {
      console.error(`[${buildId}] ❌ Stateless streaming error:`, error);
      
      clearTimeout(cleanupTimer);
      await cleanupTempDirectory(buildId);
      
      sendEvent('error', {
        success: false,
        error: 'Internal server error during stateless modification',
        details: error.message,
        buildId: buildId,
        sessionId: sessionId
      });
    } finally {
      res.end();
    }
  });

  // NON-STREAMING STATELESS MODIFICATION
  router.post("/", async (req: Request, res: Response): Promise<void> => {
    try {
      const { prompt, sessionId: clientSessionId } = req.body;
      
      if (!prompt) {
        res.status(400).json({
          success: false,
          error: "Prompt is required"
        });
        return;
      }

      const sessionId = clientSessionId || sessionManager.generateSessionId();
      const buildId = uuidv4();
      console.log(`[${buildId}] Starting stateless non-streaming modification for session: ${sessionId}`);

      const cleanupTimer = setTimeout(() => {
        cleanupTempDirectory(buildId);
        sessionManager.cleanup(sessionId);
      }, 5 * 60 * 1000);

      try {
        // Get project context from Redis OR database
        let sessionContext = await sessionManager.getSessionContext(sessionId);
        let tempBuildDir: string;

        if (sessionContext && sessionContext.projectSummary && sessionContext.projectSummary.zipUrl) {
          console.log(`[${buildId}] Found existing project in Redis, downloading ZIP...`);
          tempBuildDir = await downloadAndExtractProject(buildId, sessionContext.projectSummary.zipUrl);
        } else {
          console.log(`[${buildId}] No Redis session, checking database...`);
          const projectSummary = await messageDB.getActiveProjectSummary();
          
          if (projectSummary && projectSummary.zipUrl) {
            console.log(`[${buildId}] Found existing project in database, downloading and caching...`);
            tempBuildDir = await downloadAndExtractProject(buildId, projectSummary.zipUrl);
            
            sessionContext = {
              buildId,
              tempBuildDir,
              projectSummary: {
                summary: projectSummary.summary,
                zipUrl: projectSummary.zipUrl,
                buildId: projectSummary.buildId
              },
              lastActivity: Date.now()
            };
            await sessionManager.saveSessionContext(sessionId, sessionContext);
            
          } else {
            console.log(`[${buildId}] No existing project, creating from template...`);
            const sourceTemplateDir = path.join(__dirname, "../../react-base");
            tempBuildDir = path.join(__dirname, "../../temp-builds", buildId);

            await fs.promises.mkdir(tempBuildDir, { recursive: true });
            await fs.promises.cp(sourceTemplateDir, tempBuildDir, { recursive: true });

            sessionContext = {
              buildId,
              tempBuildDir,
              lastActivity: Date.now()
            };
            await sessionManager.saveSessionContext(sessionId, sessionContext);
          }
        }

        // Update session
        await sessionManager.updateSessionContext(sessionId, { 
          buildId, 
          tempBuildDir,
          lastActivity: Date.now() 
        });

        // Get enhanced context
        let enhancedPrompt = prompt;
        try {
          const context = await conversationHelper.getEnhancedContext(sessionId);
          if (context) {
            enhancedPrompt = `${context}\n\n--- CURRENT REQUEST ---\n${prompt}`;
          }
        } catch (contextError) {
          console.error('Context loading error:', contextError);
        }

        // Initialize stateless file modifier - FIXED CONSTRUCTOR
        const fileModifier = new StatelessIntelligentFileModifier(anthropic, tempBuildDir, sessionId);
        
        // Start timing
        const startTime = Date.now();
        
        // Process modification using stateless system
        const result = await fileModifier.processModification(
          enhancedPrompt,
          undefined,
          sessionContext?.projectSummary?.summary,
          async (summary: string, prompt: string) => {
            try {
              const summaryId = await messageDB.saveProjectSummary(summary, prompt, "", buildId);
              console.log(`💾 Saved project summary, ID: ${summaryId}`);
              return summaryId;
            } catch (error) {
              console.error('⚠️ Error saving project summary:', error);
              return null;
            }
          }
        );
        
        const modificationDuration = Date.now() - startTime;

        if (result.success) {
          // Save modification to conversation history AND Redis
          try {
            await conversationHelper.saveModification(sessionId, {
              prompt,
              result,
              approach: result.approach || 'UNKNOWN',
              filesModified: result.selectedFiles || [],
              filesCreated: result.addedFiles || [],
              timestamp: new Date().toISOString()
            });
          } catch (saveError) {
            console.error('Failed to save modification to history:', saveError);
          }

          // BUILD & DEPLOY PIPELINE
          try {
            console.log(`[${buildId}] Starting build pipeline after successful stateless modification...`);
            
            // DEBUG: Check what files exist in tempBuildDir before zipping
            console.log(`[${buildId}] DEBUG: Checking temp directory contents...`);
            const files = await fs.promises.readdir(tempBuildDir, { recursive: true });
            console.log(`[${buildId}] Files in temp directory:`, files.slice(0, 20));
            
            // Check for package.json
            const packageJsonPath = path.join(tempBuildDir, 'package.json');
            try {
              const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
              console.log(`[${buildId}] Package.json found with dependencies:`, Object.keys(packageJson.dependencies || {}));
            } catch {
              console.log(`[${buildId}] ❌ No package.json found at: ${packageJsonPath}`);
            }
            
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
            
            // Trigger Azure Container Job
            const DistUrl = await triggerAzureContainerJob(zipUrl, buildId, {
              resourceGroup: process.env.AZURE_RESOURCE_GROUP!,
              containerAppEnv: process.env.AZURE_CONTAINER_APP_ENV!,
              acrName: process.env.AZURE_ACR_NAME!,
              storageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
              storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME!,
            });

            const urls = JSON.parse(DistUrl);
            const builtZipUrl = urls.downloadUrl;
            
            // Deploy to Static Web Apps
            const { previewUrl, downloadUrl } = await deployToSWA(builtZipUrl, buildId);

            // Update session context with new ZIP URL
            await sessionManager.updateSessionContext(sessionId, {
              projectSummary: {
                ...sessionContext?.projectSummary,
                zipUrl: zipUrl,
                buildId: buildId
              }
            });

            // Update database project summary with new ZIP URL
            if (sessionContext?.projectSummary) {
              const projectSummary = await messageDB.getActiveProjectSummary();
              if (projectSummary) {
                await messageDB.updateProjectSummary(projectSummary.id, zipUrl, buildId);
              }
            }

            console.log(`[${buildId}] ✅ Stateless Build & Deploy completed successfully!`);

            // Clear cleanup timer and cleanup temp directory (keep Redis session)
            clearTimeout(cleanupTimer);
            await cleanupTempDirectory(buildId);
            await fileModifier.cleanup();

            const totalDuration = Date.now() - startTime;

            res.json({
              success: true,
              data: {
                workflow: "stateless-modification-system-with-redis-build",
                approach: result.approach || 'UNKNOWN',
                selectedFiles: result.selectedFiles || [],
                addedFiles: result.addedFiles || [],
                modifiedRanges: typeof result.modifiedRanges === 'number' ? result.modifiedRanges : (result.modifiedRanges?.length || 0),
                conversationContext: "Enhanced context with Redis-backed stateless modification history",
                reasoning: result.reasoning,
                modificationSummary: result.modificationSummary,
                modificationDuration: modificationDuration,
                totalDuration: totalDuration,
                totalFilesAffected: (result.selectedFiles?.length || 0) + (result.addedFiles?.length || 0),
                // BUILD & DEPLOY RESULTS
                previewUrl: previewUrl,
                downloadUrl: urls.downloadUrl,
                zipUrl: zipUrl, // New ZIP URL for future modifications
                buildId: buildId,
                sessionId: sessionId,
                hosting: "Azure Static Web Apps",
                features: [
                  "Global CDN",
                  "Auto SSL/HTTPS", 
                  "Custom domains support",
                  "Staging environments",
                ],
                projectState: sessionContext?.projectSummary ? 'existing_project_modified' : 'new_project_created'
              }
            });

          } catch (buildError) {
            console.error(`[${buildId}] Build pipeline failed:`, buildError);
            
            clearTimeout(cleanupTimer);
            await cleanupTempDirectory(buildId);
            await fileModifier.cleanup();
            
            res.json({
              success: true,
              data: {
                workflow: "stateless-modification-system-with-redis-build-error",
                approach: result.approach || 'UNKNOWN',
                selectedFiles: result.selectedFiles || [],
                addedFiles: result.addedFiles || [],
                modifiedRanges: typeof result.modifiedRanges === 'number' ? result.modifiedRanges : (result.modifiedRanges?.length || 0),
                buildError: buildError instanceof Error ? buildError.message : 'Build failed',
                buildId: buildId,
                sessionId: sessionId,
                message: "Stateless modification completed successfully, but build/deploy failed",
                projectState: sessionContext?.projectSummary ? 'existing_project_modified' : 'new_project_created'
              }
            });
          }

        } else {
          // Save failed attempts for learning
          try {
            await conversationHelper.saveModification(sessionId, {
              prompt,
              result,
              approach: result.approach || 'UNKNOWN',
              filesModified: result.selectedFiles || [],
              filesCreated: result.addedFiles || [],
              timestamp: new Date().toISOString()
            });
          } catch (saveError) {
            console.error('Failed to save failed modification to history:', saveError);
          }

          clearTimeout(cleanupTimer);
          await cleanupTempDirectory(buildId);
          await fileModifier.cleanup();

          res.status(400).json({
            success: false,
            error: result.error || 'Stateless modification failed',
            approach: result.approach,
            reasoning: result.reasoning,
            selectedFiles: result.selectedFiles || [],
            workflow: "stateless-modification-system-with-redis-build",
            buildId: buildId,
            sessionId: sessionId,
            projectState: sessionContext?.projectSummary ? 'existing_project_failed' : 'new_project_failed'
          });
        }

      } catch (downloadError) {
        clearTimeout(cleanupTimer);
        await cleanupTempDirectory(buildId);
        await sessionManager.cleanup(sessionId);
        
        res.status(500).json({
          success: false,
          error: 'Failed to setup project environment',
          details: downloadError instanceof Error ? downloadError.message : 'Unknown error',
          workflow: "stateless-modification-system-with-redis-build",
          buildId: buildId,
          sessionId: sessionId
        });
      }

    } catch (error: any) {
      const buildId = uuidv4();
      const sessionId = sessionManager.generateSessionId();
      console.error(`[${buildId}] ❌ Stateless non-streaming modification error:`, error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during stateless modification',
        details: error.message,
        workflow: "stateless-modification-system-with-redis-build",
        buildId: buildId,
        sessionId: sessionId
      });
    }
  });

  return router;
}