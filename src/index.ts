import Anthropic from "@anthropic-ai/sdk";
import { BackendSystemPrompt, systemPrompt } from "./defaults/promt";
import { IntelligentFileModifier } from './services/filemodifier';
import axios from 'axios';
import type { TextBlock } from '@anthropic-ai/sdk/resources/messages';
import "dotenv/config";
import * as fs from "fs";
import express from "express";
import path from "path";
import { DrizzleMessageHistoryDB } from './db/messagesummary';
import AdmZip from "adm-zip";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { exec } from "child_process";
import { v4 as uuidv4 } from "uuid";
import userRoutes from "./routes/users";
import projectRoutes from "./routes/projects";
import messageRoutes from "./routes/messages";
import { parseFrontendCode } from "./utils/newparser";
import { Request, Response } from "express";
import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import {
  uploadToAzureBlob,
  triggerAzureContainerJob,
  deployToSWA,
} from "./services/azure-deploy";

const anthropic = new Anthropic();
const app = express();
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  // Allow requests from your frontend
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173'); // Vite dev server
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Enhanced system prompt that enforces JSON format
const pro = "You are an expert web developer creating modern websites using React, TypeScript, and Tailwind CSS. Generate clean, focused website code based on user prompts.\n" +
"\n" +
"## Your Role:\n" +
"Create functional websites with essential sections and professional design.You can use your create approch to make the website look as good as possible you can use cool colours that best suits the website requested by the user , use gradients , differnt effects with tailwind only , dont go for any expernal liberary like framer motion.\n" +
"\n" +
"- User already has a Vite React project with TypeScript setup\n" +
"- All shadcn/ui components are available in src/components/ui/\n" +
"- Focus on creating files that go inside the src/ folder\n" +
"- Use shadcn/ui components as much as possible\n" +
"- Create new custom components when needed\n" +
"-  Always keep the code moduler and divide it into different files and components\n" +
"\n" +
"## Required Files to Provide:\n" +
"\n" +
"### MANDATORY Files (provide ALL in every response):\n" +
"- **src/pages/[PageName].tsx** - Main page component\n" +
"- **src/App.tsx** - Updated with new routes ( add the / routute with the opening page of your site and also update the route for the pages need to be updated)\n" +
"- **src/types/index.ts** - TypeScript interfaces for data structures\n" +
"\n" +
"### CONDITIONAL Files (create when needed):\n" +
"- **src/components/[ComponentName].tsx** - Custom reusable components\n" +
"- **src/hooks/[hookName].ts** - Custom hooks for API calls or logic\n" +
"- **src/utils/[utilName].ts** - Utility functions if needed\n" +
"- **src/lib/api.ts** - API configuration and base functions\n" +
"\n" +
"### File Creation Rules:\n" +
"- Always create src/pages/ for main page components\n" +
"- Create src/components/ for reusable custom components (beyond shadcn/ui)\n" +
"- Create src/hooks/ for custom React hooks\n" +
"- Create src/types/ for TypeScript definitions\n" +
"- Create src/lib/ for API setup and utilities\n" +
"- Update src/App.tsx only when adding new routes\n" +
"\n" +
"## Essential Website Structure:\n" +
"\n" +
"### 1. **Hero Section**:\n" +
"- Clear headline and subheadline\n" +
"- Primary CTA button\n" +
"- Simple background (gradient or solid color)\n" +
"\n" +
"### 2. **Navigation**:\n" +
"- Header with logo/brand name\n" +
"- 3-5 navigation links\n" +
"- Mobile hamburger menu\n" +
"\n" +
"### 3. **Core Content** (Choose 2-3 based on website type):\n" +
"**Business/Service:** About, Services, Contact\n" +
"**E-commerce:** Featured Products, Categories, Reviews\n" +
"**Portfolio:** About, Projects, Skills\n" +
"**SaaS:** Features, Pricing, How It Works\n" +
"\n" +
"### 4. **Footer** (REQUIRED):\n" +
"- Basic company info\n" +
"- Quick links\n" +
"- Contact details\n" +
"\n" +
"## Content Guidelines:\n" +
"- Generate realistic but concise content (no Lorem Ipsum)\n" +
"- 2-3 testimonials maximum\n" +
"- 3-4 features/services per section\n" +
"- Keep descriptions brief but informative\n" +
"- Include 1-2 CTAs per page\n" +
"\n" +
"## Design Requirements:\n" +
"- Clean, modern design with Tailwind CSS\n" +
"- Use shadcn/ui components when appropriate\n" +
"- Mobile-responsive layouts\n" +
"- Simple hover effects and transitions\n" +
"- Consistent color scheme\n" +
"\n" +
"## Component Usage:\n" +
'- Use existing shadcn/ui components: `import { Button } from "@/components/ui/button"`\n' +
'- Use Lucide React icons: `import { ArrowRight, Star } from "lucide-react"`\n' +
"- TypeScript types within files, or in separate src/types/index.ts\n" +
"- Import custom components: `import { CustomComponent } from '@/components/CustomComponent'`\n" +
"\n" +
"## Data Fetching & State Management (CRITICAL):\n" +
'- Always use axios for API calls: `import axios from "axios"`\n' +
"- Don't use Promise.all syntax, make individual axios calls for fetching data\n" +
"- ALWAYS initialize state arrays as empty arrays: `const [items, setItems] = useState<Type[]>([])`\n" +
"- NEVER initialize arrays as undefined, null, or non-array values\n" +
"- Always check if data exists before using array methods:\n" +
"  ```typescript\n" +
"  // Good:\n" +
"  const [products, setProducts] = useState<Product[]>([]);\n" +
"  {products.length > 0 && products.slice(0, 3).map(...)}\n" +
"  \n" +
"  // Bad:\n" +
"  const [products, setProducts] = useState();\n" +
"  {products.slice(0, 3).map(...)} // Error: slice is not a function\n" +
"  ```\n" +
"- Use proper error handling with try-catch blocks\n" +
"- Always handle loading states to prevent undefined errors\n" +
"- When setting state from API responses, ensure data structure matches expected format\n" +
"\n" +
"## API Response Structure (Important):\n" +
"Backend APIs will return data in this format, handle accordingly:\n" +
"```typescript\n" +
"// For lists (GET /api/products)\n" +
"{\n" +
"  success: true,\n" +
"  data: [...], // Array of items\n" +
"  total: number\n" +
"}\n" +
"\n" +
"// For single items (GET /api/products/:id)\n" +
"{\n" +
"  success: true,\n" +
"  data: {...} // Single item object\n" +
"}\n" +
"\n" +
"// Handle responses like this:\n" +
"const response = await axios.get('/api/products');\n" +
"if (response.data.success) {\n" +
"  setProducts(response.data.data); // Access the 'data' property\n" +
"}\n" +
"```\n" +
"\n" +
"## Error Prevention Rules:\n" +
"1. **Array State Initialization**: Always initialize arrays as `useState<Type[]>([])`\n" +
"2. **Conditional Rendering**: Use `array.length > 0 &&` before array methods\n" +
"3. **Type Safety**: Define proper TypeScript interfaces for data\n" +
"4. **Loading States**: Show loading indicator while fetching data\n" +
"5. **Error Boundaries**: Handle API errors gracefully\n" +
"6. **Data Validation**: Check data structure before setState\n" +
"\n" +
"## Response Format (MANDATORY - JSON FORMAT):\n" +
"ALWAYS return your response in the following JSON format:\n" +
"\n" +
"```json\n" +
"{\n" +
'  "codeFiles": {\n' +
'    "src/types/index.ts": "// TypeScript interfaces and types code here",\n' +
'    "src/pages/PageName.tsx": "// Main page component code here",\n' +
'    "src/components/ComponentName.tsx": "// Custom component code here (if needed)",\n' +
'    "src/hooks/useDataFetching.ts": "// Custom hooks code here (if needed)",\n' +
'    "src/lib/api.ts": "// API configuration code here (if needed)",\n' +
'    "src/App.tsx": "// Updated App.tsx with routes (only if adding new routes and if you are giving only App.tsx that also also use this and give path as its path)"\n' +
"  },\n" +
'  "structureTree": {\n' +
"// here you will give me the structure  of the files that you have created with file name along with all the files that you think can be necessary in the future to understand the code base and make changes in it  , file path , its imports , its exports and the little description about the file what is does keed the name as exact that you are using " +
"example : { file : App.tsx , path: '/src/app.tsx' , imports:['chatpage.tsx'] , exports:[app] , decription:'this is the main file where  are the routes are defined ' }" +
"  }\n" +
"}\n" +
"```\n" +
"\n" +
"## JSON Response Rules:\n" +
"1. **codeFiles**: Object containing file paths as keys and complete code content as string values\n" +
"2. **structureTree**: Nested object representing the complete project structure\n" +
"3. **File Status Indicators**:\n" +
'   - "new": Files created in this response\n' +
'   - "updated": Existing files that were modified\n' +
'   - "existing": Files that already exist and weren\'t changed\n' +
"4. **Include ALL files**: Show both new/updated files and existing project structure\n" +
"5. **Proper JSON syntax**: Ensure valid JSON with proper escaping of quotes and special characters\n" +
"6. **Complete code**: Include full, working code in the codeFiles object, not truncated versions\n" +
"\n" +
"## File Organization Guidelines:\n" +
"- **src/pages/**: Main page components (HomePage.tsx, AboutPage.tsx, etc.)\n" +
"- **src/components/**: Custom reusable components (beyond shadcn/ui)\n" +
"- **src/hooks/**: Custom React hooks for data fetching and logic\n" +
"- **src/types/**: TypeScript interfaces and type definitions\n" +
"- **src/lib/**: API setup, utilities, and helper functions\n" +
"- **src/utils/**: General utility functions\n" +
"\n" +
"## Key Changes for Conciseness:\n" +
'- Generate 50-100 line components unless user requests "detailed" or "comprehensive"\n' +
"- Focus on 2-3 main sections instead of 6-8\n" +
"- Shorter content blocks with essential information\n" +
"- Minimal but effective styling\n" +
"- Organize code into appropriate files for maintainability\n" +
"\n" +
"## Expansion Triggers:\n" +
"Only create detailed, multi-file websites when user specifically mentions:\n" +
'- "Detailed" or "comprehensive"\n' +
'- "Multiple sections" or "full website"\n' +
'- "Landing page" (these can be more detailed)\n' +
"- Specific industry requirements that need extensive content\n" +
"\n" +
"## Quality Checklist:\n" +
"✅ Hero section with clear value proposition\n" +
"✅ Working navigation\n" +
"✅ 2-3 relevant content sections\n" +
"✅ Contact information or form\n" +
"✅ Mobile responsive\n" +
"✅ Professional appearance\n" +
"✅ Clean, maintainable code\n" +
"✅ Proper state initialization (arrays as [])\n" +
"✅ Error handling and loading states\n" +
"✅ Axios for data fetching\n" +
"✅ All required files provided in correct JSON format\n" +
"✅ Proper file organization\n" +
"✅ Valid JSON response with files array and structureTree\n" +
"\n" +
"Generate focused, professional websites that accomplish the user's goals efficiently. Prioritize clarity and usability over extensive content unless specifically requested. ALWAYS follow the data fetching and error prevention rules to avoid runtime errors. ALWAYS provide files in the specified format and organization.";

// Interfaces for TypeScript
interface FileData {
  path: string;
  content: string;
}

interface ConversationData {
  messages: any[];
  summaryCount: number;
  totalMessages: number;
}

// Simplified Conversation Helper (using your existing Drizzle methods)
class ConversationHelper {
  constructor(private messageDB: DrizzleMessageHistoryDB) {}

 async saveModification(modification: any): Promise<void> {
  await this.messageDB.saveModification(modification);
}

  async getEnhancedContext(): Promise<string> {
    return await this.messageDB.getConversationContext();
  }

  async getConversationWithSummary(): Promise<ConversationData> {
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

// Database and services initialization
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DATABASE_URL = process.env.DATABASE_URL!;
const messageDB = new DrizzleMessageHistoryDB(DATABASE_URL, anthropic);
const conversationHelper = new ConversationHelper(messageDB);

async function initializeServices() {
  try {
    await messageDB.initializeStats();
    console.log('✅ Drizzle services initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
  }
}

initializeServices();

console.log(process.env.DATABASE_URL);

app.get("/", (req, res) => {
  res.json("bckend is up");
});

// Use your existing routes
app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/messages", messageRoutes);

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: "1.0.0",
  });
});

// COMPONENT INTEGRATOR ENDPOINTS - NEW

// Generate frontend code with enhanced parsing and streaming support
  //@ts-ignore
app.post("/generateFrontend", async (req, res) => {
  const { prompt } = req.body;
  
  if (!prompt) {
    return res.status(400).json({
      success: false,
      error: "Prompt is required"
    });
  }
 
  try {
    console.log('🚀 Starting frontend generation for prompt:', prompt.substring(0, 100) + '...');

    // STEP 1: Generate frontend code directly using system prompt
    console.log('🔨 STEP 1: Generating frontend code using system prompt...');
    
    const frontendPrompt = `${prompt}

Generate a React TypeScript frontend application. Focus on creating functional, modern components with good structure.`;

    // Make the API call to Claude with streaming (to handle long requests)
    const startTime = Date.now();
    
    console.log('📡 Starting streaming request for frontend generation...');
    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-0",
      max_tokens: 25000,
      temperature: 0.1,
      system: pro, // Use your existing system prompt
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

    // Handle streaming response
    stream.on('text', (text) => {
      accumulatedResponse += text;
      responseLength += text.length;
      
      // Log progress every 10000 characters
      if (responseLength % 10000 < text.length) {
        console.log(`📊 Received ${responseLength} characters...`);
      }
    });

    // Wait for stream to complete
    const result = await stream.finalMessage();
    const frontendEndTime = Date.now();
    const frontendProcessingTime = frontendEndTime - startTime;

    console.log('🔍 Frontend generation completed. Total response length:', accumulatedResponse.length);

    // Parse the response to extract files
    let parsedFiles: FileData[] = [];
    let parseSuccess = false;
    let parseError = null;

    try {
      console.log('🔍 Attempting to parse frontend response...');
      
      let jsonContent = accumulatedResponse.trim();
      
      // Extract JSON from code blocks
      const jsonBlockMatch = jsonContent.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch) {
        jsonContent = jsonBlockMatch[1].trim();
        console.log('🔍 Extracted JSON from markdown code block');
      } else {
        // Look for JSON object boundaries
        const jsonObjectMatch = jsonContent.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          jsonContent = jsonObjectMatch[0];
          console.log('🔍 Extracted JSON object from response');
        }
      }
      
      console.log('🔍 JSON content to parse (first 200 chars):', jsonContent.substring(0, 200));
      
      // Try to fix truncated JSON
      if (!jsonContent.endsWith('}')) {
        console.log('⚠️ JSON appears truncated, attempting to fix...');
        const lastCompleteQuote = jsonContent.lastIndexOf('",');
        if (lastCompleteQuote !== -1) {
          jsonContent = jsonContent.substring(0, lastCompleteQuote + 1) + '\n  }\n}';
          console.log('🔧 Attempted to close truncated JSON');
        }
      }
      
      const parsed = JSON.parse(jsonContent);
      
      // Handle the format from your system prompt (codeFiles object)
      if (parsed.codeFiles && typeof parsed.codeFiles === 'object') {
        parsedFiles = Object.entries(parsed.codeFiles).map(([path, content]) => ({
          path,
          content: content as string
        }));
        parseSuccess = true;
        console.log(`✅ Successfully parsed ${parsedFiles.length} files from codeFiles object`);
      }
      // Handle alternative format (files array)
      else if (parsed.files && Array.isArray(parsed.files)) {
        parsedFiles = parsed.files;
        parseSuccess = true;
        console.log(`✅ Successfully parsed ${parsedFiles.length} files from files array`);
      }
      else {
        throw new Error(`JSON structure not recognized. Keys found: ${Object.keys(parsed).join(', ')}`);
      }
      
    } catch (error) {
      
      console.error('❌ Failed to parse files from response:', parseError);
      
      // Enhanced regex fallback
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
            
            // Unescape JSON content
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
      return res.status(400).json({
        success: false,
        error: 'Failed to parse generated files',
        details: parseError,
        rawResponse: accumulatedResponse.substring(0, 500) + '...'
      });
    }

    // STEP 2: Generate summary based on actual generated files
    console.log('📋 STEP 2: Generating summary based on actual files...');
    
    // Extract imports and exports from each file
    const fileAnalysis = parsedFiles.map(file => {
      const content = file.content;
      
      // Extract imports
      const importMatches = content.match(/^import\s+.*?from\s+['"](.*?)['"];?$/gm) || [];
      const imports = importMatches.map(imp => {
        // Extract what's being imported
        const fromMatch = imp.match(/from\s+['"](.*?)['"]/) || [];
        const whatMatch = imp.match(/import\s+({.*?}|\*\s+as\s+\w+|\w+)/) || [];
        return {
          what: whatMatch[1] || '',
          from: fromMatch[1] || ''
        };
      });
      
      // Extract exports
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
      
      // Get first few lines for context
      const firstLines = content.split('\n').slice(0, 3).join(' ').substring(0, 150);
      
      return {
        path: file.path,
        imports: imports,
        exports: exports,
        preview: firstLines
      };
    });

    // Create detailed analysis string
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

      // Save the summary to database like we were doing initially
      try {
        const summaryId = await messageDB.saveProjectSummary(projectSummary, prompt);
        console.log('💾 Saved project summary to database, ID:', summaryId);
      } catch (summaryError) {
        console.error('⚠️ Error saving project summary to database:', summaryError);
        // Continue anyway - this is non-critical
      }
    } catch (summaryError) {
      console.error('⚠️ Error generating summary:', summaryError);
      projectSummary = `Frontend project with ${parsedFiles.length} files: ${parsedFiles.map(f => f.path).join(', ')}`;
    }

    // Create detailed file descriptions
    let generatedFilesSummary = `Generated ${parsedFiles.length} files:\n\n`;
    
    parsedFiles.forEach(file => {
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
      
      generatedFilesSummary += `📁 ${file.path}: ${description}\n`;
    });

    // Save the result
    try {
      const assistantMetadata = {
        fileModifications: parsedFiles.map(f => f.path), 
        modificationApproach: "FULL_FILE" as const,
        modificationSuccess: true
      };

      const assistantMessageId = await messageDB.addMessage(
        generatedFilesSummary,
        'assistant',
        assistantMetadata
      );
      console.log(`💾 Saved result (ID: ${assistantMessageId})`);
    } catch (dbError) {
      console.warn('⚠️ Failed to save to DB:', dbError);
    }

    const totalProcessingTime = Date.now() - startTime;
    console.log(`⏱️  Total frontend generation completed in ${totalProcessingTime}ms`);
    console.log(`📊 Token usage: ${result.usage?.input_tokens || 0} input, ${result.usage?.output_tokens || 0} output`);
    
    // Return the results
    res.json({
      success: true,
      files: parsedFiles,
      metadata: {
        processingTime: totalProcessingTime,
        frontendProcessingTime: frontendProcessingTime,
        tokenUsage: result.usage,
        filesGenerated: parsedFiles.length,
        summary: projectSummary, // Summary based on actual generated files
        generatedFilesSummary: generatedFilesSummary
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('❌ Frontend generation failed:', errorMessage);
   
    res.status(500).json({ 
      success: false,
      error: 'Frontend generation failed',
      details: errorMessage 
    });
  }
});

//@ts-ignore
app.post("/write-files", (req, res) => {
  const { files }: { files: FileData[] } = req.body;
  const baseDir = path.join(__dirname, "../react-base");

  if (!Array.isArray(files)) {
    return res.status(400).json({ error: "Invalid files array" });
  }

  try {
    files.forEach(({ path: filePath, content }) => {
      const fullPath = path.join(baseDir, filePath);
      const dir = path.dirname(fullPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, content, "utf8");
    });

    res.json({ message: "Files written successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to write files" });
  }
});

// Generate changes with AST modification
app.post("/generateChanges", async (req, res) => {
  const { prompt } = req.body;
  
  try {
    console.log(`🚀 8-Step Modification Workflow: "${prompt}"`);
    
    const reactBasePath = path.join(__dirname, "../react-base");
    const intelligentModifier = new IntelligentFileModifier(anthropic, reactBasePath);
    const result = await intelligentModifier.processModification(prompt);
    
    if (result.success) {
      console.log(`✅ 8-Step workflow completed successfully!`);
      console.log(`📁 Modified files: ${result.selectedFiles?.join(', ')}`);
      console.log(`🎯 Approach: ${result.approach}`);
      console.log(`📊 Code ranges modified: ${Array.isArray(result.modifiedRanges) ? result.modifiedRanges.length : 0}`);
      
      res.json({
        success: true,
        workflow: "8-step-ast-modification",
        selectedFiles: result.selectedFiles,
        approach: result.approach,
        modifiedRanges: Array.isArray(result.modifiedRanges) ? result.modifiedRanges.length : 0,
        details: {
          step1: "Project tree + metadata analyzed",
          step2: `Claude selected ${result.selectedFiles?.length || 0} relevant files`,
          step3: "Files parsed with AST to create detailed trees", 
          step4: "Claude pinpointed exact AST nodes needing modification",
          step5: "Code snippets extracted from target nodes",
          step6: "Claude modified the specific code snippets",
          step7: "Mapped AST nodes to exact source code ranges",
          step8: "Replaced code ranges with modified snippets"
        },
        modifications: Array.isArray(result.modifiedRanges) ? result.modifiedRanges.map(range => ({
          file: range.file,
          linesModified: `${range.range.startLine}-${range.range.endLine}`,
          originalCode: range.range.originalCode.substring(0, 100) + "...",
          modifiedCode: range.modifiedCode.substring(0, 100) + "..."
        })) : []
      });
    } else {
      console.log(`❌ 8-Step workflow failed: ${result.error}`);
      res.status(400).json({
        success: false,
        workflow: "8-step-ast-modification",
        error: result.error || 'Modification workflow failed',
        step: "Failed during workflow execution"
      });
    }
  } catch (error) {
    console.error('Error in 8-step workflow:', error);
    res.status(500).json({
      success: false,
      workflow: "8-step-ast-modification", 
      error: 'Internal server error during workflow',
      step: "System error"
    });
  }
});

//@ts-ignore
app.post("/modify-with-history-stream", async (req, res) => {
  const { prompt } = req.body;
  
  if (!prompt) {
    return res.status(400).json({
      success: false,
      error: "Prompt is required"
    });
  }

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

  try {
    sendEvent('progress', { 
      step: 1, 
      total: 8, 
      message: 'Initializing the enhanced modular modification system. Loading conversation context and preparing AI-powered file analysis with component generation capabilities...' 
    });

    let enhancedPrompt = prompt;
    try {
      const context = await conversationHelper.getEnhancedContext();
      if (context) {
        enhancedPrompt = `${context}\n\n--- CURRENT REQUEST ---\n${prompt}`;
        sendEvent('progress', { 
          step: 2, 
          total: 8, 
          message: 'Successfully loaded conversation context! This includes previous modifications, component creations, and development patterns. Using this rich context for intelligent scope analysis and consistent code generation...' 
        });
      } else {
        sendEvent('progress', { 
          step: 2, 
          total: 8, 
          message: 'No previous conversation context found. Starting fresh analysis with the new modular system that supports component creation, full-file modifications, and targeted AST changes...' 
        });
      }
    } catch (contextError) {
      sendEvent('progress', { 
        step: 2, 
        total: 8, 
        message: 'Context loading encountered an issue, but continuing with enhanced modular system. The modification quality remains unaffected thanks to built-in fallback mechanisms...' 
      });
    }

    const reactBasePath = path.join(__dirname, "../react-base");
    const intelligentModifier = new IntelligentFileModifier(anthropic, reactBasePath);
    
    // Set up streaming callback for real-time progress
    intelligentModifier.setStreamCallback((message: string) => {
      sendEvent('progress', { 
        step: 5, 
        total: 8, 
        message: message 
      });
    });

    sendEvent('progress', { 
      step: 3, 
      total: 8, 
      message: 'Enhanced modular system initialized! This advanced system features: scope analysis, component generation, dependency management, AST parsing, and intelligent file modification with full import/export preservation...' 
    });

    // Start timing the modification
    const startTime = Date.now();
    
    // Process modification with the new modular system
    const result = await intelligentModifier.processModification(enhancedPrompt);
    
    const duration = Date.now() - startTime;
    
    if (result.success) {
      sendEvent('progress', { 
        step: 7, 
        total: 8, 
        message: `Modification completed successfully in ${duration}ms! Applied ${result.approach} approach to ${(result.selectedFiles?.length || 0) + (result.addedFiles?.length || 0)} files. ${result.addedFiles?.length ? `Created ${result.addedFiles.length} new files. ` : ''}All changes are now live in your application!` 
      });

      sendEvent('progress', { 
        step: 8, 
        total: 8, 
        message: 'Saving comprehensive modification record to conversation history. This includes approach used, files affected, success metrics, and reasoning for future context and learning...' 
      });

      // Save modification to conversation history using the helper
      try {
        await conversationHelper.saveModification({
          prompt,
          result,
          approach: result.approach || 'UNKNOWN',
          filesModified: result.selectedFiles || [],
          filesCreated: result.addedFiles || [],
          timestamp: new Date().toISOString()
        });
      } catch (saveError) {
        console.error('Failed to save modification to history:', saveError);
        // Don't fail the request if history saving fails
      }

      // Send final result with enhanced data
      sendEvent('complete', {
        success: true,
        data: {
          workflow: "enhanced-modular-modification-system",
          approach: result.approach || 'UNKNOWN',
          selectedFiles: result.selectedFiles || [],
          addedFiles: result.addedFiles || [],
          createdFiles: result.addedFiles || [], // For backward compatibility
          modifiedRanges: typeof result.modifiedRanges === 'number' ? result.modifiedRanges : (result.modifiedRanges?.length || 0),
          conversationContext: "Enhanced context with modification history and pattern learning",
          reasoning: result.reasoning,
          modificationSummary: result.modificationSummary,
          duration: duration,
          totalFilesAffected: (result.selectedFiles?.length || 0) + (result.addedFiles?.length || 0)
        }
      });

    } else {
      sendEvent('progress', { 
        step: 6, 
        total: 8, 
        message: `Modification process completed with issues: ${result.error}. This could be due to project structure differences, syntax constraints, or the request requiring clarification. The modular system provides detailed error context for troubleshooting...` 
      });

      // Still save failed attempts for learning
      try {
        await conversationHelper.saveModification({
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

      sendEvent('error', {
        success: false,
        error: result.error || 'Modification failed',
        approach: result.approach,
        reasoning: result.reasoning
      });
    }

  } catch (error: any) {
    console.error('❌ Streaming error:', error);
    sendEvent('progress', { 
      step: 0, 
      total: 8, 
      message: `System error in modular modification workflow: ${error.message}. This might be due to network connectivity, file system permissions, AI service availability, or project structure issues. The enhanced error handling provides better diagnostics...` 
    });
    
    sendEvent('error', {
      success: false,
      error: 'Internal server error during modular modification',
      details: error.message
    });
  } finally {
    res.end();
  }
});

//@ts-ignore
app.post("/modify-with-history", async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: "Prompt is required"
      });
    }

    // Get enhanced context using your existing Drizzle methods
    let enhancedPrompt = prompt;
    try {
      const context = await conversationHelper.getEnhancedContext();
      if (context) {
        enhancedPrompt = `${context}\n\n--- CURRENT REQUEST ---\n${prompt}`;
      }
    } catch (contextError) {
      console.error('Context loading error:', contextError);
      // Continue with original prompt if context loading fails
    }

    // Initialize the modular file modifier
    const reactBasePath = path.join(__dirname, "../react-base");
    const intelligentModifier = new IntelligentFileModifier(anthropic, reactBasePath);
    
    // Start timing
    const startTime = Date.now();
    
    // Process modification directly with the new modular system
    const result = await intelligentModifier.processModification(enhancedPrompt);
    
    const duration = Date.now() - startTime;

    if (result.success) {
      // Save modification to conversation history
      try {
        //@ts-ignore
        await conversationHelper.saveModification({
          prompt,
          result,
          approach: result.approach || 'UNKNOWN',
          filesModified: result.selectedFiles || [],
          filesCreated: result.addedFiles || [],
          timestamp: new Date().toISOString()
        });
      } catch (saveError) {
        console.error('Failed to save modification to history:', saveError);
        // Don't fail the request if history saving fails
      }

      return res.json({
        success: true,
        data: {
          workflow: "enhanced-modular-modification-system",
          approach: result.approach || 'UNKNOWN',
          selectedFiles: result.selectedFiles || [],
          addedFiles: result.addedFiles || [],
          createdFiles: result.addedFiles || [], // For backward compatibility
          modifiedRanges: typeof result.modifiedRanges === 'number' ? result.modifiedRanges : (result.modifiedRanges?.length || 0),
          conversationContext: "Enhanced context with modification history and pattern learning",
          reasoning: result.reasoning,
          modificationSummary: result.modificationSummary,
          duration: duration,
          totalFilesAffected: (result.selectedFiles?.length || 0) + (result.addedFiles?.length || 0),
          error: result.error // Include any non-fatal errors
        }
      });
    } else {
      // Save failed attempts for learning
      try {
        //@ts-ignore
        await conversationHelper.saveModification({
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

      return res.status(400).json({
        success: false,
        error: result.error || 'Modification failed',
        approach: result.approach,
        reasoning: result.reasoning,
        selectedFiles: result.selectedFiles || [],
        workflow: "enhanced-modular-modification-system"
      });
    }

  } catch (error: any) {
    console.error('❌ Non-streaming modification error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during modular modification',
      details: error.message,
      workflow: "enhanced-modular-modification-system"
    });
  }
});

// MESSAGE MANAGEMENT ENDPOINTS (using your existing Drizzle methods)

//@ts-ignore
app.post("/messages", async (req, res) => {
  try {
    const { content, messageType, metadata } = req.body;
    
    if (!content || !messageType || !['user', 'assistant'].includes(messageType)) {
      return res.status(400).json({
        success: false,
        error: "Valid content and messageType required"
      });
    }

    const messageId = await messageDB.addMessage(content, messageType, metadata);
    
    res.json({
      success: true,
      data: { messageId, message: "Message added successfully" }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to add message'
    });
  }
});

// Get conversation with summary (using your existing Drizzle methods)
app.get("/conversation-with-summary", async (req, res) => {
  try {
    const conversationData = await conversationHelper.getConversationWithSummary();
    res.json({
      success: true,
      data: conversationData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation'
    });
  }
});

// Get conversation stats
app.get("/conversation-stats", async (req, res) => {
  try {
    const stats = await messageDB.getConversationStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation stats'
    });
  }
});

// Get all summaries
app.get("/summaries", async (req, res) => {
  try {
    const summaries = await messageDB.getAllSummaries();
    res.json({
      success: true,
      data: summaries
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get summaries'
    });
  }
});

// Clear all conversation data
app.delete("/conversation", async (req, res) => {
  try {
    await messageDB.clearAllData();
    res.json({
      success: true,
      data: { message: "All conversation data cleared successfully" }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to clear conversation data'
    });
  }
});

// UTILITY ENDPOINTS

// Create project zip and upload to Supabase
app.get("/zipFolder", async (req, res) => {
  const zipFolderName = `project${Date.now()}.zip`;
  try {
    const zip = new AdmZip();
    const baseDir = path.join(__dirname, "../react-base");
    zip.addLocalFolder(baseDir);
    const outDir = path.join(__dirname, "../generated-sites", zipFolderName);
    zip.writeZip(outDir);
    const zipData = fs.readFileSync(outDir);
    const { data, error } = await supabase.storage
      .from("zipprojects")
      .upload(`archives/${zipFolderName}`, zipData, {
        contentType: "application/zip",
        upsert: true,
      });
    if (error) {
      console.log("supabase error ", error);
    }
    const publicUrl = await supabase.storage
      .from("zipprojects")
      .getPublicUrl(zipFolderName);

    res.json(publicUrl);
  } catch (error) {
    console.log(error);
    res.json(error);
  }
});

app.get("/current-summary", async (req, res) => {
  try {
    console.log('🔍 /current-summary endpoint hit');
    
    const summary = await messageDB.getCurrentSummary();
    console.log('🔍 getCurrentSummary result:', summary);
    
    const recentConversation = await messageDB.getRecentConversation();
    console.log('🔍 getRecentConversation result:', recentConversation);
    
    // Calculate totalMessages correctly
    const summarizedCount = summary?.messageCount || 0;
    const recentCount = recentConversation.messages.length;
    const totalMessages = summarizedCount + recentCount;
    
    const responseData = {
      summary: summary?.summary || null,
      summarizedMessageCount: summarizedCount,
      recentMessageCount: recentCount,
      totalMessages: totalMessages,
      hasSummary: !!summary && !!summary.summary
    };
    
    console.log('🔍 Sending response:', responseData);
    
    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('❌ /current-summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get current summary'
    });
  }
});

app.post("/fix-stats", async (req, res) => {
  try {
    await messageDB.fixConversationStats();
    const stats = await messageDB.getConversationStats();
    
    res.json({
      success: true,
      data: {
        message: "Stats fixed successfully",
        stats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fix stats'
    });
  }
});

// Updated function to retrieve recent frontend prompts with comprehensive data
async function getRecentFrontendPrompts(limit: number = 10) {
  try {
    const recentConversation = await messageDB.getRecentConversation();
    
    const frontendPrompts = recentConversation.messages
      .filter((msg) => {
        if (!msg.reasoning) return false;
        
        try {
          const metadata = JSON.parse(msg.reasoning);
          return metadata.promptType === 'frontend_generation';
        } catch {
          return false;
        }
      })
      .slice(0, limit * 2) // Get more to account for user/assistant pairs
      .reduce((acc, msg) => {
        try {
          const metadata = JSON.parse(msg.reasoning || '{}');
          
          if (metadata.requestType === 'user_prompt') {
            // This is a user prompt, look for corresponding response
            const response = recentConversation.messages.find(m => {
              try {
                const respMetadata = JSON.parse(m.reasoning || '{}');
                return respMetadata.promptType === 'frontend_generation' && 
                       respMetadata.requestType === 'claude_response' &&
                       respMetadata.relatedUserMessageId === msg.id;
              } catch {
                return false;
              }
            });

            acc.push({
              id: msg.id,
              prompt: msg.content,
              response: response?.content || null,
              success: response ? JSON.parse(response.reasoning || '{}').success : false,
              timestamp: msg.createdAt,
              processingTime: response ? JSON.parse(response.reasoning || '{}').processingTimeMs : null,
              tokenUsage: response ? JSON.parse(response.reasoning || '{}').tokenUsage : null,
              contextInfo: metadata.contextInfo,
              error: response ? JSON.parse(response.reasoning || '{}').error : null,
              responseLength: response ? JSON.parse(response.reasoning || '{}').responseLength : null
            });
          }
        } catch (parseError) {
          console.error('Error parsing message metadata:', parseError);
        }
        
        return acc;
      }, [] as any[])
      .slice(0, limit);

    return frontendPrompts;
  } catch (error) {
    console.error('Failed to retrieve recent frontend prompts:', error);
    return [];
  }
}

// New endpoint to get recent frontend generation history
app.get("/frontend-history", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const frontendHistory = await getRecentFrontendPrompts(limit);
    
    res.json({
      success: true,
      data: {
        history: frontendHistory,
        count: frontendHistory.length
      }
    });
  } catch (error) {
    console.error('Failed to get frontend history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve frontend generation history'
    });
  }
});

// Keep your existing Azure deployment endpoint
//@ts-ignore
app.post("/api/projects/generate", async (req: Request, res: Response) => {
  const { prompt, projectId } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  const buildId = uuidv4();
  console.log(`[${buildId}] Starting Azure build for prompt: "${prompt}"`);

  const sourceTemplateDir = path.join(__dirname, "../react-base");
  const tempBuildDir = path.join(__dirname, "../temp-builds", buildId);

  try {
    // 1. Copy template and generate code
    await fs.promises.mkdir(tempBuildDir, { recursive: true });
    await fs.promises.cp(sourceTemplateDir, tempBuildDir, { recursive: true });

    console.log(`[${buildId}] Generating code from LLM...`);
    const frontendResult = await anthropic.messages.create({
      model: "claude-sonnet-4-0",
      max_tokens: 20000,
      temperature: 1,
      system: pro,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: prompt }],
        },
      ],
    });

    const parsedFrontend = parseFrontendCode(
      (frontendResult.content[0] as any).text
    );

    // Write generated files
    for (const file of parsedFrontend.codeFiles) {
      const fullPath = path.join(tempBuildDir, file.path);
      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.promises.writeFile(fullPath, file.content, "utf8");
    }

    // 2. Create zip and upload to Azure
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
    console.log(zipUrl, "this is the url that is send for deployment");
    
    // 3. Trigger Azure Container Job
    console.log(`[${buildId}] Triggering Azure Container Job...`);

    const DistUrl = await triggerAzureContainerJob(zipUrl, buildId, {
      resourceGroup: process.env.AZURE_RESOURCE_GROUP!,
      containerAppEnv: process.env.AZURE_CONTAINER_APP_ENV!,
      acrName: process.env.AZURE_ACR_NAME!,
      storageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
      storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME!,
    });

    const urls = JSON.parse(DistUrl);
    console.log(urls, "urll");
    const builtZipUrl = urls.downloadUrl;
    console.log(`[${buildId}] Deploying to SWA...`);
    const { previewUrl, downloadUrl } = await deployToSWA(builtZipUrl, buildId);

    if (projectId) {
      // Update your database with the new URL
    }

    res.json({
      success: true,
      previewUrl: previewUrl, // SWA preview URL
      downloadUrl: urls.downloadUrl, // ZIP download URL
      buildId: buildId,
      hosting: "Azure Static Web Apps",
      features: [
        "Global CDN",
        "Auto SSL/HTTPS",
        "Custom domains support",
        "Staging environments",
      ],
    });
  } catch (error) {
    console.error(`[${buildId}] Build process failed:`, error);
    res.status(500).json({
      success: false,
      error: "Build process failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    // Clean up temp directory
    await fs.promises
      .rm(tempBuildDir, { recursive: true, force: true })
      .catch(() => {});
  }
});

function execPromise(
  command: string,
  options?: any
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        //@ts-ignore
        resolve({ stdout, stderr });
      }
    });
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});