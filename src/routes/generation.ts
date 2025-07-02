// routes/generation.ts - Updated with proper URL manager and duplicate prevention
import express, { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import AdmZip from "adm-zip";
import axios from 'axios';
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
import { EnhancedProjectUrlManager } from '../db/url-manager';
import { systemPrompt } from "../defaults/promt";
import { parseFrontendCode } from "../utils/newparser";
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

// Helper function to download and extract existing project
async function downloadAndExtractProject(buildId: string, zipUrl: string): Promise<string> {
  const tempBuildDir = path.join(__dirname, "../../temp-builds", buildId);
  
  try {
    console.log(`[${buildId}] Downloading existing project from: ${zipUrl}`);
    
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

// IMPROVED USER RESOLUTION FUNCTION
// IMPROVED USER RESOLUTION FUNCTION - Fixed to respect provided userIds
async function resolveUserId(
  messageDB: DrizzleMessageHistoryDB,
  providedUserId?: number,
  sessionId?: string
): Promise<number> {
  try {
    // Priority 1: Use provided userId if valid (MOST IMPORTANT)
    if (providedUserId) {
      console.log(`🔍 Checking provided userId: ${providedUserId}`);
      
      // Try to validate if user exists, if not create them
      const userExists = await messageDB.validateUserExists(providedUserId);
      if (userExists) {
        console.log(`✅ Using existing provided userId: ${providedUserId}`);
        return providedUserId;
      } else {
        // Create the user with the provided ID
        console.log(`🆔 Creating new user with provided ID: ${providedUserId}`);
        await messageDB.ensureUserExists(providedUserId, {
          email: `user${providedUserId}@buildora.dev`,
          name: `User ${providedUserId}`
        });
        console.log(`✅ Created user with provided ID: ${providedUserId}`);
        return providedUserId;
      }
    }

    // Priority 2: Get userId from session's most recent project (only if no providedUserId)
    if (sessionId && !providedUserId) {
      console.log(`🔍 No userId provided, checking session: ${sessionId}`);
      const sessionProject = await messageDB.getProjectBySessionId(sessionId);
      if (sessionProject && sessionProject.userId) {
        console.log(`✅ Using userId from session: ${sessionProject.userId}`);
        return sessionProject.userId;
      }
    }

    // Priority 3: Create a completely new user (removed fallback to existing users)
    console.log(`🆔 No valid userId found, creating new unique user...`);
    const newUserId = Date.now() + Math.floor(Math.random() * 1000); // More unique than just timestamp
    
    await messageDB.ensureUserExists(newUserId, {
      email: `user${newUserId}@buildora.dev`,
      name: `User ${newUserId}`
    });
    
    console.log(`✅ Created completely new user: ${newUserId}`);
    return newUserId;
    
  } catch (error) {
    console.error('❌ Failed to resolve user ID:', error);
    
    // Last resort: create a user with current timestamp + random
    const emergencyUserId = Date.now() + Math.floor(Math.random() * 10000);
    try {
      await messageDB.ensureUserExists(emergencyUserId, {
        email: `emergency${emergencyUserId}@buildora.dev`,
        name: `Emergency User ${emergencyUserId}`
      });
      console.log(`🚨 Created emergency user: ${emergencyUserId}`);
      return emergencyUserId;
    } catch (emergencyError) {
      console.error('❌ Even emergency user creation failed:', emergencyError);
      throw new Error('Could not resolve or create user');
    }
  }
}

export function initializeGenerationRoutes(
  anthropic: Anthropic,
  messageDB: DrizzleMessageHistoryDB,
  sessionManager: StatelessSessionManager
): express.Router {

  // Initialize the enhanced URL manager
  const urlManager = new EnhancedProjectUrlManager(messageDB);

  // MAIN GENERATION ENDPOINT - USING ENHANCED URL MANAGER
  // Fixed generation route - Updates existing project instead of creating new
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
    
    // Step 1: Resolve user ID
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

    // ✅ STEP 2: CHECK FOR EXISTING PROJECT TO UPDATE
    console.log(`[${buildId}] 🔍 Checking for existing project to update...`);
    
    let currentProjectId: number | null = null;
    let currentProject: any = null;
    let isUpdatingExisting = false;
    
    try {
      // Priority 1: Get user's most recent project
      const userProjects = await messageDB.getUserProjects(userId);
      if (userProjects.length > 0) {
        currentProject = userProjects[0]; // Most recent project
        currentProjectId = currentProject.id;
        isUpdatingExisting = true;
        console.log(`[${buildId}] ✅ Found existing project to update: ${currentProjectId}`);
      }
      
      // Priority 2: Check session for project if no user projects
      if (!currentProjectId && sessionId) {
        const sessionProject = await messageDB.getProjectBySessionId(sessionId);
        if (sessionProject) {
          currentProject = sessionProject;
          currentProjectId = sessionProject.id;
          isUpdatingExisting = true;
          console.log(`[${buildId}] ✅ Found session project to update: ${currentProjectId}`);
        }
      }
    } catch (error) {
      console.warn(`[${buildId}] ⚠️ Error checking for existing projects:`, error);
    }

    // ✅ SMART DUPLICATE PREVENTION - Only prevent true duplicates
    if (isUpdatingExisting && currentProject) {
      console.log(`[${buildId}] 🔍 Checking for duplicate requests...`);
      
      try {
        const now = new Date().getTime();
        const projectTime = new Date(currentProject.updatedAt || currentProject.createdAt).getTime();
        const timeDiff = now - projectTime;
        const isVeryRecent = timeDiff < 2000;
        const isFullyDeployed = currentProject.deploymentUrl && 
                               currentProject.downloadUrl && 
                               currentProject.zipUrl && 
                               currentProject.zipUrl !== 'NO_ZIP';
        const isCompleted = currentProject.status === 'ready';
        
        if (isVeryRecent && isFullyDeployed && isCompleted) {
          console.log(`[${buildId}] 🛑 True duplicate detected - recent completed project (${timeDiff}ms ago)`);
          
          res.json({
            success: true,
            duplicate: true,
            message: `Duplicate request detected - project completed ${timeDiff}ms ago`,
            projectId: currentProjectId,
            buildId: buildId,
            sessionId: sessionId,
            userId: userId,
            isUpdate: true,
            timeDiff: timeDiff,
            duplicateReason: "very_recent_completed_project",
            existingProject: {
              id: currentProject.id,
              name: currentProject.name,
              deploymentUrl: currentProject.deploymentUrl,
              downloadUrl: currentProject.downloadUrl,
              zipUrl: currentProject.zipUrl,
              status: currentProject.status
            }
          });
          return;
        } else {
          console.log(`[${buildId}] ✅ Proceeding with update - not a duplicate:`);
          console.log(`[${buildId}]    - Recent: ${isVeryRecent} (${timeDiff}ms ago)`);
          console.log(`[${buildId}]    - Deployed: ${isFullyDeployed}`);
          console.log(`[${buildId}]    - Completed: ${isCompleted} (status: ${currentProject.status})`);
          console.log(`[${buildId}]    - zipUrl: ${currentProject.zipUrl || 'NO_ZIP'}`);
        }
      } catch (dupCheckError) {
        console.warn(`[${buildId}] ⚠️ Duplicate check failed, continuing with update:`, dupCheckError);
      }
    }
    
    console.log(`[${buildId}] Starting ${isUpdatingExisting ? 'project update' : 'new project creation'} pipeline`);
    console.log(`[${buildId}] Session: ${sessionId}, User: ${userId}, Project: ${currentProjectId || 'NEW'}`);
    console.log(`[${buildId}] Prompt: "${prompt.substring(0, 100)}..."`);
    
    const cleanupTimer = setTimeout(() => {
      cleanupTempDirectory(buildId);
      sessionManager.cleanup(sessionId);
    }, 5 * 60 * 1000);

    // ✅ PROJECT MANAGEMENT - Update existing OR create new
    let projectId: number = currentProjectId || 0;
    let projectSaved = false;
   
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
      
      // ✅ LOAD EXISTING PROJECT FILES OR USE TEMPLATE
      if (isUpdatingExisting && currentProject?.zipUrl) {
        console.log(`[${buildId}] 📦 Loading existing project files from: ${currentProject.zipUrl}`);
        try {
          // Download and extract existing project
          const extractedPath = await downloadAndExtractProject(buildId, currentProject.zipUrl);
          console.log(`[${buildId}] ✅ Loaded existing project files to: ${extractedPath}`);
        } catch (downloadError) {
          console.warn(`[${buildId}] ⚠️ Failed to load existing project, using template:`, downloadError);
          await fs.promises.cp(sourceTemplateDir, tempBuildDir, { recursive: true });
        }
      } else {
        console.log(`[${buildId}] 📋 Using base template for ${isUpdatingExisting ? 'existing project without files' : 'new project'}`);
        await fs.promises.cp(sourceTemplateDir, tempBuildDir, { recursive: true });
      }

      // Update session with temp directory
      await sessionManager.updateSessionContext(sessionId, { tempBuildDir });

      // ✅ UPDATE EXISTING PROJECT OR CREATE NEW
      if (isUpdatingExisting && currentProjectId) {
        console.log(`[${buildId}] 🔄 Updating existing project ${currentProjectId}...`);
        
        try {
          await messageDB.updateProject(currentProjectId, {
            name: projectName || currentProject.name || `Updated Project ${buildId.substring(0, 8)}`,
            description: description || `Updated: ${prompt.substring(0, 100)}...`,
            status: 'regenerating', // Show it's being updated
            buildId: buildId,
            lastSessionId: sessionId,
            framework: framework || currentProject.framework || 'react',
            template: template || currentProject.template || 'vite-react-ts',
            lastMessageAt: new Date(),
            messageCount: (currentProject.messageCount || 0) + 1,
            updatedAt: new Date()
          });
          
          projectId = currentProjectId;
          projectSaved = true;
          console.log(`[${buildId}] ✅ Updated existing project record: ${projectId}`);
          
        } catch (updateError) {
          console.error(`[${buildId}] ❌ Failed to update existing project:`, updateError);
          
          // Fallback to creating new if update fails
          isUpdatingExisting = false;
          currentProjectId = null;
        }
      }
      
      // ✅ CREATE NEW PROJECT ONLY IF NO EXISTING PROJECT OR UPDATE FAILED
      if (!isUpdatingExisting) {
        console.log(`[${buildId}] 💾 Creating new project record...`);
        
        try {
          projectId = await messageDB.createProject({
            userId,
            name: projectName || `Generated Project ${buildId.substring(0, 8)}`,
            description: description || `React project generated from prompt: ${prompt.substring(0, 100)}...`,
            status: 'generating',
            projectType: 'generated',
            deploymentUrl: '',
            downloadUrl: '',
            zipUrl: '',
            buildId: buildId,
            lastSessionId: sessionId,
            framework: framework || 'react',
            template: template || 'vite-react-ts',
            lastMessageAt: new Date(),
            messageCount: 0
          });
          
          projectSaved = true;
          console.log(`[${buildId}] ✅ Created new project record: ${projectId}`);
          
        } catch (projectError) {
          console.error(`[${buildId}] ❌ CRITICAL: Failed to create project record:`, projectError);
          
          clearTimeout(cleanupTimer);
          await sessionManager.cleanup(sessionId);
          
          res.status(500).json({
            success: false,
            error: 'Failed to create project record',
            details: projectError instanceof Error ? projectError.message : 'Unknown error',
            buildId,
            sessionId,
            userId
          });
          return;
        }
      }

      // ✅ IMMEDIATE VALIDATION - Ensure project exists
      const validatedProject = await messageDB.getProject(projectId);
      if (!validatedProject) {
        throw new Error(`Project ${projectId} not found after ${isUpdatingExisting ? 'update' : 'creation'} - database inconsistency`);
      }
      
      console.log(`[${buildId}] ✅ Validated project ${projectId} exists in database`);

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
      let parseError: any = null;

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
        
        // Mark project as failed
        if (projectId && projectSaved) {
          try {
            await messageDB.updateProject(projectId, {
              status: 'failed',
              updatedAt: new Date()
            });
          } catch (updateError) {
            console.warn(`[${buildId}] Failed to mark project as failed:`, updateError);
          }
        }

        res.status(400).json({
          success: false,
          error: 'Failed to parse generated files',
          details: parseError,
          rawResponse: accumulatedResponse.substring(0, 500) + '...',
          buildId: buildId,
          sessionId: sessionId,
          userId: userId,
          projectId: projectId,
          databaseSaved: true,
          projectSaved: projectSaved
        });
        return;
      }

      // ✅ UPDATE PROJECT STATUS - Right after parsing succeeds
      if (projectId && projectSaved) {
        try {
          console.log(`[${buildId}] 🔄 Updating project ${projectId} status to 'generated'...`);
          
          await messageDB.updateProject(projectId, {
            status: 'generated', // Mark as generated
            lastMessageAt: new Date(),
            updatedAt: new Date(),
            messageCount: validatedProject.messageCount + 1
          });
          
          console.log(`[${buildId}] ✅ Project ${projectId} marked as generated`);
        } catch (updateError) {
          console.warn(`[${buildId}] ⚠️ Failed to update project after parsing:`, updateError);
        }
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

      // ✅ CREATE ZIP IMMEDIATELY AFTER FILES ARE READY
      console.log(`[${buildId}] 📦 Creating and uploading ZIP file...`);
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

      // ✅ UPDATE PROJECT WITH ZIP URL - Before build/deploy
      if (projectId && projectSaved) {
        try {
          console.log(`[${buildId}] 🔄 Updating project ${projectId} with ZIP URL...`);
          
          await messageDB.updateProject(projectId, {
            zipUrl: zipUrl,
            description: projectSummary || description || `React project generated from prompt: ${prompt.substring(0, 100)}...`,
            status: 'ready_for_deployment', 
            updatedAt: new Date()
          });
          
          console.log(`[${buildId}] ✅ Project ${projectId} updated with ZIP URL`);
        } catch (updateError) {
          console.warn(`[${buildId}] ⚠️ Failed to update project with ZIP:`, updateError);
        }
      }
      
      // Update session context with project summary and zipUrl
      await sessionManager.updateSessionContext(sessionId, {
        projectSummary: {
          summary: projectSummary,
          zipUrl: zipUrl,
          buildId: buildId
        }
      });
      
      // NOW START THE BUILD & DEPLOY PIPELINE (this can be slower)
      console.log(`[${buildId}] 🏗️ Starting build & deploy pipeline...`);
      
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

      // ✅ FINAL UPDATE WITH DEPLOYMENT URLs - Use Enhanced URL Manager properly
      console.log(`[${buildId}] 💾 Final update with deployment URLs using Enhanced URL Manager...`);
      let projectAction = isUpdatingExisting ? 'updated_existing' : 'created_new';
      
      if (projectId && projectSaved) {
        try {
          // ✅ Use Enhanced URL Manager to UPDATE the existing project
          console.log(`[${buildId}] 🔧 Calling Enhanced URL Manager to update project ${projectId}...`);
          
          const updatedProjectId = await urlManager.saveNewProjectUrls(
            sessionId,
            projectId, // Use the resolved projectId (existing or new)
            {
              deploymentUrl: previewUrl as string,
              downloadUrl: urls.downloadUrl,
              zipUrl: zipUrl
            },
            userId,
            {
              name: projectName || validatedProject.name,
              description: projectSummary || description || validatedProject.description,
              framework: framework || validatedProject.framework || 'react',
              template: template || validatedProject.template || 'vite-react-ts'
            }
          );

          if (updatedProjectId === projectId) {
            projectAction = isUpdatingExisting ? 'existing_project_updated' : 'new_project_created';
            console.log(`[${buildId}] ✅ Enhanced URL Manager - Successfully ${isUpdatingExisting ? 'updated' : 'created'} project ${projectId}`);
          } else {
            projectAction = 'project_id_mismatch';
            console.warn(`[${buildId}] ⚠️ Enhanced URL Manager returned different project ID: ${updatedProjectId} vs ${projectId}`);
          }
          
        } catch (projectError) {
          console.error(`[${buildId}] ❌ Enhanced URL Manager failed:`, projectError);
          projectAction = 'url_manager_failed';
          
          // Fallback: Direct update
          try {
            await messageDB.updateProject(projectId, {
              deploymentUrl: previewUrl as string,
              downloadUrl: urls.downloadUrl,
              zipUrl: zipUrl,
              status: 'ready',
              updatedAt: new Date()
            });
            projectAction = isUpdatingExisting ? 'existing_fallback_updated' : 'new_fallback_updated';
            console.log(`[${buildId}] ✅ Fallback update successful for project ${projectId}`);
          } catch (fallbackError) {
            console.error(`[${buildId}] ❌ Fallback update also failed:`, fallbackError);
            projectAction = 'all_updates_failed';
          }
        }
      } else {
        console.warn(`[${buildId}] ⚠️ No valid projectId to update URLs`);
        projectAction = 'no_project_to_update';
        projectSaved = false;
      }

      // Save assistant response to conversation history
      try {
        const assistantMetadata = {
          promptType: 'frontend_generation',
          requestType: 'claude_response',
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
          projectId: projectId,
          userId: userId
        };

        const assistantMessageId = await messageDB.addMessage(
          `Generated ${parsedFiles.length} files:\n\n${parsedFiles.map(f => f.path).join('\n')}`,
          'assistant',
          assistantMetadata
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
      
      // ✅ FINAL PROJECT VERIFICATION
      console.log(`[${buildId}] 🔍 Final verification - checking project in database...`);
      try {
        const finalProject = await messageDB.getProject(projectId);
        if (finalProject) {
          console.log(`[${buildId}] ✅ Final project verification successful:`, {
            id: finalProject.id,
            name: finalProject.name,
            status: finalProject.status,
            hasUrls: {
              deployment: !!finalProject.deploymentUrl,
              download: !!finalProject.downloadUrl,
              zip: !!finalProject.zipUrl
            }
          });
        } else {
          console.error(`[${buildId}] ❌ Final project verification failed - project not found!`);
        }
      } catch (verifyError) {
        console.error(`[${buildId}] ❌ Final project verification error:`, verifyError);
      }
      
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
        projectId: projectId,
        projectAction: projectAction,
        isUpdate: isUpdatingExisting,
        originalProjectId: currentProjectId,
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
          projectSaved: projectSaved,
          duplicatePrevention: "Enhanced with 30-second window check",
          projectManagement: isUpdatingExisting ? "Updated existing project" : "Created new project",
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

      // Mark project as failed if it was created
      if (projectId && projectSaved) {
        try {
          await messageDB.updateProject(projectId, {
            status: 'failed',
            updatedAt: new Date()
          });
          console.log(`[${buildId}] 📝 Marked project ${projectId} as failed`);
        } catch (updateError) {
          console.warn(`[${buildId}] Failed to mark project as failed:`, updateError);
        }
      }

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
          userId: userId,
          projectId: projectId
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
        projectId: projectId,
        databaseSaved: true,
        isUpdate: isUpdatingExisting,
        originalProjectId: currentProjectId
      });
    }
  });

  return router;
}