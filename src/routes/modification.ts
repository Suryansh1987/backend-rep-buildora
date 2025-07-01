// routes/modification.ts - Updated with simple URL management by userId
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
  runBuildAndDeploy,
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
      type: 'modified' as const,
      file: 'session_modification',
      description: `${modification.approach}: ${modification.prompt.substring(0, 100)}...`,
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

// SIMPLE URL MANAGEMENT FUNCTION
async function saveProjectUrlsByUserId(
  messageDB: DrizzleMessageHistoryDB,
  userId: number,
  buildId: string,
  urls: {
    deploymentUrl: string;
    downloadUrl: string;
    zipUrl: string;
  },
  sessionId: string,
  prompt?: string
): Promise<{ projectId: number; action: 'created' | 'updated' }> {
  try {
    console.log(`📊 Simple URL Management - User: ${userId}, Build: ${buildId}`);

    // Get user's most recent project
    const userProjects = await messageDB.getUserProjects(userId);
    
    if (userProjects.length > 0) {
      // Update the most recent project
      const project = userProjects[0]; // Most recent project
      
      await messageDB.updateProjectUrls(project.id, {
        deploymentUrl: urls.deploymentUrl,
        downloadUrl: urls.downloadUrl,
        zipUrl: urls.zipUrl,
        buildId: buildId,
        status: 'ready',
        lastSessionId: sessionId,
        lastMessageAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`✅ Updated existing project ${project.id} for user ${userId}`);
      return { projectId: project.id, action: 'updated' };
      
    } else {
      // Create new project for user
      const projectId = await messageDB.createProject({
        userId: userId,
        name: `Project ${buildId.slice(0, 8)}`,
        description: prompt?.substring(0, 200) || 'Auto-generated from modification',
        status: 'ready',
        projectType: 'frontend',
        deploymentUrl: urls.deploymentUrl,
        downloadUrl: urls.downloadUrl,
        zipUrl: urls.zipUrl,
        buildId: buildId,
        lastSessionId: sessionId,
        framework: 'react',
        template: 'vite-react-ts',
        lastMessageAt: new Date(),
        messageCount: 1
      });
      
      console.log(`✅ Created new project ${projectId} for user ${userId}`);
      return { projectId, action: 'created' };
    }
  } catch (error) {
    console.error('❌ Failed to save project URLs:', error);
    throw error;
  }
}

// Utility functions (unchanged)
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
  const { 
    prompt, 
    sessionId: clientSessionId,
    userId = 1 // Default userId, should come from authentication
  } = req.body;
  
  if (!prompt) {
    res.status(400).json({
      success: false,
      error: "Prompt is required"
    });
    return;
  }

  const sessionId = clientSessionId || sessionManager.generateSessionId();
  const buildId = uuidv4();
  
  console.log(`[${buildId}] Starting modification for user: ${userId}, session: ${sessionId}`);
  console.log(`[${buildId}] Prompt: "${prompt.substring(0, 100)}..."`);

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
    sendEvent('progress', { step: 1, total: 16, message: 'Initializing modification system...', buildId, sessionId, userId });

    let sessionContext = await sessionManager.getSessionContext(sessionId);
    let tempBuildDir: string = '';
    let userProject = null;

    const userProjects = await messageDB.getUserProjects(userId);
    if (userProjects.length > 0) {
      userProject = userProjects[0];
      if (userProject.zipUrl) {
        sendEvent('progress', { step: 2, total: 16, message: `Found user's project: ${userProject.name}. Downloading...`, buildId, sessionId });
        tempBuildDir = await downloadAndExtractProject(buildId, userProject.zipUrl);
        sessionContext = {
          buildId,
          tempBuildDir,
          projectSummary: {
            summary: userProject.description || 'User project',
            zipUrl: userProject.zipUrl,
            buildId: userProject.buildId
          },
          lastActivity: Date.now()
        };
        await sessionManager.saveSessionContext(sessionId, sessionContext);
      }
    }

    if (!sessionContext || !sessionContext.projectSummary?.zipUrl) {
      sendEvent('progress', { step: 2, total: 16, message: 'No user project found. Checking Redis...', buildId, sessionId });

      sessionContext = await sessionManager.getSessionContext(sessionId);

      if (sessionContext?.projectSummary?.zipUrl) {
        tempBuildDir = await downloadAndExtractProject(buildId, sessionContext.projectSummary.zipUrl);
      } else {
        const projectSummary = await messageDB.getActiveProjectSummary();

        if (projectSummary?.zipUrl) {
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
    }

    // ✅ Now tempBuildDir is guaranteed to be defined

    sendEvent('progress', { step: 3, total: 16, message: 'Project environment ready!', buildId, sessionId });

    await sessionManager.updateSessionContext(sessionId, {
      buildId,
      tempBuildDir,
      lastActivity: Date.now()
    });

    let enhancedPrompt = prompt;
    try {
      const context = await conversationHelper.getEnhancedContext(sessionId);
      if (context) {
        enhancedPrompt = `${context}\n\n--- CURRENT REQUEST ---\n${prompt}`;
        sendEvent('progress', { step: 4, total: 16, message: 'Loaded conversation context!', buildId, sessionId });
      }
    } catch {
      sendEvent('progress', { step: 4, total: 16, message: 'Continuing with fresh modification...', buildId, sessionId });
    }

    const fileModifier = new StatelessIntelligentFileModifier(anthropic, tempBuildDir, sessionId);
    fileModifier.setStreamCallback((message) => sendEvent('progress', { step: 7, total: 16, message, buildId, sessionId }));

    sendEvent('progress', { step: 5, total: 16, message: 'Starting intelligent modification...', buildId, sessionId });

    const startTime = Date.now();

    const result = await fileModifier.processModification(
      enhancedPrompt,
      undefined,
      sessionContext?.projectSummary?.summary,
      async (summary, prompt) => {
        try {
          const summaryId = await messageDB.saveProjectSummary(summary, prompt, "", buildId);
          console.log(`💾 Saved project summary, ID: ${summaryId}`);
          return summaryId;
        } catch (err) {
          console.error('⚠️ Error saving summary:', err);
          return null;
        }
      }
    );

    const modificationDuration = Date.now() - startTime;

    if (result.success) {
      sendEvent('progress', { step: 8, total: 16, message: 'Modification complete! Building...', buildId, sessionId });

      try {
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

        sendEvent('progress', { step: 10, total: 16, message: 'Building app...', buildId, sessionId });

        const DistUrl = await triggerAzureContainerJob(zipUrl, buildId, {
          resourceGroup: process.env.AZURE_RESOURCE_GROUP!,
          containerAppEnv: process.env.AZURE_CONTAINER_APP_ENV!,
          acrName: process.env.AZURE_ACR_NAME!,
          storageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
          storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME!,
        });

        const urls = JSON.parse(DistUrl);
        const builtZipUrl = urls.downloadUrl;

        sendEvent('progress', { step: 11, total: 16, message: 'Deploying...', buildId, sessionId });
        const previewUrl = await runBuildAndDeploy(builtZipUrl, buildId);

        sendEvent('progress', { step: 12, total: 16, message: 'Updating database...', buildId, sessionId });

        await sessionManager.updateSessionContext(sessionId, {
          projectSummary: {
            ...sessionContext?.projectSummary,
            zipUrl,
            buildId
          }
        });

        if (sessionContext?.projectSummary) {
          const projectSummary = await messageDB.getActiveProjectSummary();
          if (projectSummary) {
            await messageDB.updateProjectSummary(projectSummary.id, zipUrl, buildId);
          }
        }

        sendEvent('progress', { step: 13, total: 16, message: 'Saving URLs...', buildId, sessionId });

        const urlResult = await saveProjectUrlsByUserId(
          messageDB,
          userId,
          buildId,
          {
            deploymentUrl: previewUrl as string,
            downloadUrl: urls.downloadUrl,
            zipUrl
          },
          sessionId,
          prompt
        );

        sendEvent('progress', { step: 14, total: 16, message: 'Cleaning up...', buildId, sessionId });
        clearTimeout(cleanupTimer);
        await cleanupTempDirectory(buildId);

        sendEvent('progress', { step: 15, total: 16, message: `🎉 Live at: ${previewUrl}`, buildId, sessionId });

        const totalDuration = Date.now() - startTime;

        sendEvent('complete', {
          success: true,
          data: {
            workflow: "simple-user-based-modification",
            approach: result.approach || 'UNKNOWN',
            selectedFiles: result.selectedFiles || [],
            addedFiles: result.addedFiles || [],
            modifiedRanges: typeof result.modifiedRanges === 'number' ? result.modifiedRanges : (result.modifiedRanges?.length || 0),
            reasoning: result.reasoning,
            modificationSummary: result.modificationSummary,
            modificationDuration,
            totalDuration,
            totalFilesAffected: (result.selectedFiles?.length || 0) + (result.addedFiles?.length || 0),
            previewUrl,
            downloadUrl: urls.downloadUrl,
            zipUrl,
            buildId,
            sessionId,
            userId,
            projectId: urlResult.projectId,
            projectAction: urlResult.action,
            hosting: "Azure Static Web Apps",
            features: [
              "Global CDN",
              "Auto SSL/HTTPS", 
              "Custom domains support",
              "Staging environments",
            ]
          }
        });

        await fileModifier.cleanup();

      } catch (buildError) {
        console.error(`[${buildId}] Build pipeline failed:`, buildError);
        clearTimeout(cleanupTimer);
        await cleanupTempDirectory(buildId);

        sendEvent('complete', {
          success: true,
          data: {
            workflow: "simple-user-based-modification-error",
            approach: result.approach || 'UNKNOWN',
            buildError: buildError instanceof Error ? buildError.message : 'Build failed',
            buildId,
            sessionId,
            userId,
            message: "Modification completed, but build/deploy failed"
          }
        });
      }

    } else {
      sendEvent('error', {
        success: false,
        error: result.error || 'Modification failed',
        approach: result.approach,
        reasoning: result.reasoning,
        buildId,
        sessionId,
        userId
      });

      clearTimeout(cleanupTimer);
      await cleanupTempDirectory(buildId);
      await fileModifier.cleanup();
    }

  } catch (error: any) {
    console.error(`[${buildId}] ❌ Error:`, error);
    clearTimeout(cleanupTimer);
    await cleanupTempDirectory(buildId);

    sendEvent('error', {
      success: false,
      error: 'Internal server error during modification',
      details: error.message,
      buildId,
      sessionId,
      userId
    });
  } finally {
    res.end();
  }
});


  // NON-STREAMING MODIFICATION ENDPOINT
  router.post("/", async (req: Request, res: Response): Promise<void> => {
    try {
      const { 
        prompt, 
        sessionId: clientSessionId,
        userId = 1 // Default userId, should come from authentication
      } = req.body;
      
      if (!prompt) {
        res.status(400).json({
          success: false,
          error: "Prompt is required"
        });
        return;
      }

      const sessionId = clientSessionId || sessionManager.generateSessionId();
      const buildId = uuidv4();
      console.log(`[${buildId}] Starting non-streaming modification for user: ${userId}`);

      const cleanupTimer = setTimeout(() => {
        cleanupTempDirectory(buildId);
        sessionManager.cleanup(sessionId);
      }, 5 * 60 * 1000);

      try {
        // Get user's most recent project
        let sessionContext = await sessionManager.getSessionContext(sessionId);
        let tempBuildDir: string;
        
        const userProjects = await messageDB.getUserProjects(userId);
        if (userProjects.length > 0 && userProjects[0].zipUrl) {
          console.log(`[${buildId}] Found user's project: ${userProjects[0].name}`);
          tempBuildDir = await downloadAndExtractProject(buildId, userProjects[0].zipUrl);
          sessionContext = {
            buildId,
            tempBuildDir,
            projectSummary: {
              summary: userProjects[0].description || 'User project',
              zipUrl: userProjects[0].zipUrl,
              buildId: userProjects[0].buildId
            },
            lastActivity: Date.now()
          };
          await sessionManager.saveSessionContext(sessionId, sessionContext);
        } else {
          // Fallback to existing logic
          sessionContext = await sessionManager.getSessionContext(sessionId);
          if (sessionContext && sessionContext.projectSummary && sessionContext.projectSummary.zipUrl) {
            tempBuildDir = await downloadAndExtractProject(buildId, sessionContext.projectSummary.zipUrl);
          } else {
            const projectSummary = await messageDB.getActiveProjectSummary();
            
            if (projectSummary && projectSummary.zipUrl) {
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

        // Initialize stateless file modifier
        const fileModifier = new StatelessIntelligentFileModifier(anthropic, tempBuildDir, sessionId);
        
        const startTime = Date.now();
        
        // Process modification
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
          // Save modification to conversation history
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
            console.log(`[${buildId}] Starting build pipeline...`);
            
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
            
            // Deploy
            const previewUrl = await runBuildAndDeploy(builtZipUrl, buildId);

            // Update session context with new ZIP URL
            await sessionManager.updateSessionContext(sessionId, {
              projectSummary: {
                ...sessionContext?.projectSummary,
                zipUrl: zipUrl,
                buildId: buildId
              }
            });

            // Update database project summary
            if (sessionContext?.projectSummary) {
              const projectSummary = await messageDB.getActiveProjectSummary();
              if (projectSummary) {
                await messageDB.updateProjectSummary(projectSummary.id, zipUrl, buildId);
              }
            }

            // SIMPLE URL SAVING BY USER ID
            console.log(`[${buildId}] 💾 Saving deployment URLs for user ${userId}...`);
            
            const urlResult = await saveProjectUrlsByUserId(
              messageDB,
              userId,
              buildId,
              {
                deploymentUrl: previewUrl as string,
                downloadUrl: urls.downloadUrl,
                zipUrl: zipUrl
              },
              sessionId,
              prompt
            );

            console.log(`[${buildId}] ✅ URLs ${urlResult.action} - Project ID: ${urlResult.projectId}`);

            // Cleanup
            clearTimeout(cleanupTimer);
            await cleanupTempDirectory(buildId);
            await fileModifier.cleanup();

            const totalDuration = Date.now() - startTime;

            res.json({
              success: true,
              data: {
                workflow: "simple-user-based-modification",
                approach: result.approach || 'UNKNOWN',
                selectedFiles: result.selectedFiles || [],
                addedFiles: result.addedFiles || [],
                modifiedRanges: typeof result.modifiedRanges === 'number' ? result.modifiedRanges : (result.modifiedRanges?.length || 0),
                conversationContext: "Enhanced context with Redis-backed modification history",
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
                workflow: "simple-user-based-modification-error",
                approach: result.approach || 'UNKNOWN',
                selectedFiles: result.selectedFiles || [],
                addedFiles: result.addedFiles || [],
                modifiedRanges: typeof result.modifiedRanges === 'number' ? result.modifiedRanges : (result.modifiedRanges?.length || 0),
                buildError: buildError instanceof Error ? buildError.message : 'Build failed',
                buildId: buildId,
                sessionId: sessionId,
                userId: userId,
                message: "Modification completed successfully, but build/deploy failed",
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
            error: result.error || 'Modification failed',
            approach: result.approach,
            reasoning: result.reasoning,
            selectedFiles: result.selectedFiles || [],
            workflow: "simple-user-based-modification",
            buildId: buildId,
            sessionId: sessionId,
            userId: userId,
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
          workflow: "simple-user-based-modification",
          buildId: buildId,
          sessionId: sessionId,
          userId: userId
        });
      }

    } catch (error: any) {
      const buildId = uuidv4();
      const sessionId = sessionManager.generateSessionId();
      console.error(`[${buildId}] ❌ Non-streaming modification error:`, error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during modification',
        details: error.message,
        workflow: "simple-user-based-modification",
        buildId: buildId,
        sessionId: sessionId,
        userId: req.body.userId || 1
      });
    }
  });

  // SIMPLE ENDPOINT TO GET USER'S PROJECTS
  router.get("/user/:userId/projects", async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const projects = await messageDB.getUserProjects(parseInt(userId));

      res.json({
        success: true,
        data: projects.map(project => ({
          id: project.id,
          name: project.name,
          description: project.description,
          status: project.status,
          deploymentUrl: project.deploymentUrl,
          downloadUrl: project.downloadUrl,
          zipUrl: project.zipUrl,
          buildId: project.buildId,
          framework: project.framework,
          template: project.template,
          messageCount: project.messageCount,
          lastMessageAt: project.lastMessageAt,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt
        }))
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get user projects',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}