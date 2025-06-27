// ============================================================================
// COMPONENT ADDITION PROCESSOR: processors/ComponentAdditionProcessor.ts
// ============================================================================

import { join, basename } from 'path';
import { promises as fs } from 'fs';
import { 
  ProjectFile, 
  ModificationResult, 
  ModificationScope, 
  PageInfo,
  ComponentSpec,
  ComponentGenerationResult,
  TokenUsageStats,
  ValidationResult
} from '../filemodifier/types';
import { ModificationSummary } from '../filemodifier/modification';
import { ComponentGenerationSystem } from '../filemodifier/component';
import { TokenTracker } from '../../utils/TokenTracer';
import { 
  fullFilePrompt,
  replaceTemplateVariables,
  prepareFullFileVariables
} from '../filemodifier/template';

// Additional interfaces to fix TypeScript errors
interface ExtractedFileStructure {
  imports: string[];
  exports: string[];
  componentName: string | null;
  hasDefaultExport: boolean;
  preservationPrompt: string;
}

interface StructureValidationResult {
  isValid: boolean;
  errors: string[];
}

interface AppUpdateResult {
  success: boolean;
  updatedFiles?: string[];
  error?: string;
}

export class ComponentAdditionProcessor {
  private anthropic: any;
  private reactBasePath: string;
  private tokenTracker: TokenTracker;
  private streamCallback?: (message: string) => void;

  constructor(anthropic: any, reactBasePath: string, tokenTracker: TokenTracker) {
    this.anthropic = anthropic;
    this.reactBasePath = reactBasePath;
    this.tokenTracker = tokenTracker;
  }

  setStreamCallback(callback: (message: string) => void): void {
    this.streamCallback = callback;
  }

  private streamUpdate(message: string): void {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
  }

  async handleComponentAddition(
    prompt: string,
    scope: ModificationScope,
    projectFiles: Map<string, ProjectFile>,
    modificationSummary: ModificationSummary,
    componentGenerationSystem: ComponentGenerationSystem,
    projectSummaryCallback?: (summary: string, prompt: string) => Promise<string | null>
  ): Promise<ModificationResult> {
    this.streamUpdate(`🎨 Starting MODULAR component generation workflow...`);
    
    try {
      // Extract component name
      const extractedName = await this.extractComponentName(prompt);
      this.streamUpdate(`📝 Component name: "${extractedName}"`);
      
      // Determine component type
      const componentType = this.determineComponentTypeFromPrompt(prompt);
      this.streamUpdate(`📋 Component type: ${componentType}`);
      
      // Create the component/page file
      const filePath = `src/${componentType === 'page' ? 'pages' : 'components'}/${extractedName}.tsx`;
      
      this.streamUpdate(`🔨 Creating ${componentType}: ${filePath}`);
      
      // Generate component content
      const componentSpec: ComponentSpec = {
        name: extractedName,
        type: componentType,
        description: `Generated ${componentType} for: ${prompt}`,
        userRequest: prompt
      };

      const generationResult = await componentGenerationSystem.generateComponent(componentSpec);
      
      if (!generationResult.success) {
        throw new Error(`Component generation failed: ${generationResult.error}`);
      }

      this.streamUpdate(`✅ Created ${componentType}: ${generationResult.generatedFile}`);

      // For pages, update App.tsx with proper routing
      let updatedFiles: string[] = [];
      
      if (componentType === 'page') {
        this.streamUpdate(`🔧 Updating App.tsx with new page routing...`);
        
        const appUpdateResult = await this.updateAppWithPages(extractedName, filePath, prompt, projectFiles);
        if (appUpdateResult.success && appUpdateResult.updatedFiles) {
          updatedFiles = appUpdateResult.updatedFiles;
          this.streamUpdate(`✅ App.tsx updated with routing for ${extractedName}`);
        } else {
          this.streamUpdate(`⚠️ Failed to update App.tsx: ${appUpdateResult.error}`);
        }
      }

      // Update modification summary
      modificationSummary.addChange(
        'created',
        generationResult.generatedFile || filePath,
        `Created new ${componentType}: ${extractedName}`
      );

      updatedFiles.forEach(file => {
        modificationSummary.addChange(
          'updated',
          file,
          `Updated for ${extractedName} integration`
        );
      });

      const tokenStats = this.tokenTracker.getStats();
      this.streamUpdate(`💰 Component Generation Total - ${tokenStats.totalTokens} tokens ($${tokenStats.estimatedCost.toFixed(4)})`);

      this.streamUpdate(`🎉 Component addition complete!`);
      
      return {
        success: true,
        selectedFiles: updatedFiles,
        addedFiles: [generationResult.generatedFile || filePath],
        approach: 'COMPONENT_ADDITION',
        reasoning: `Successfully created ${extractedName} ${componentType} with proper naming and integration. ${componentType === 'page' ? 'Updated App.tsx with routing.' : ''}`,
        modificationSummary: modificationSummary.getSummary(),
        componentGenerationResult: {
          success: true,
          generatedFile: generationResult.generatedFile || filePath,
          updatedFiles,
          integrationPath: 'app',
          projectSummary: ''
        },
        tokenUsage: tokenStats
      };
      
    } catch (error) {
      this.streamUpdate(`❌ Component addition failed: ${error}`);
      
      return {
        success: false,
        error: `Component addition failed: ${error}`,
        selectedFiles: [],
        addedFiles: [],
        tokenUsage: this.tokenTracker.getStats()
      };
    }
  }

  private async extractComponentName(prompt: string): Promise<string> {
    this.streamUpdate(`🤖 Intelligently extracting component name from: "${prompt}"`);
    
    const extractionPrompt = `
**USER REQUEST:** "${prompt}"

**TASK:** Extract the EXACT component/page name the user wants to create.

**CRITICAL NAMING RULES:**
1. Use DESCRIPTIVE, SPECIFIC names based on the content/purpose
2. DO NOT use generic words like "Information", "Section", "Component"
3. Use PascalCase format (FirstLetterCapital)
4. Extract the MAIN subject/feature from the request
5. Be precise about what the user actually wants

**EXAMPLES:**
- "add a contact page" → Contact
- "create about us page" → About  
- "make services page" → Services
- "add pricing section" → Pricing
- "create user dashboard" → Dashboard
- "add shopping cart" → Cart
- "make product listing" → Products
- "create team members page" → Team
- "add testimonials" → Testimonials
- "make FAQ section" → FAQ
- "create login form" → Login
- "add newsletter signup" → Newsletter
- "make blog posts" → Blog
- "create portfolio gallery" → Portfolio
- "add booking system" → Booking
- "make inventory manager" → Inventory
- "create analytics dashboard" → Analytics
- "add help center" → Help
- "make user profile" → Profile
- "create admin panel" → Admin

**RESPONSE:** Return ONLY the component name, nothing else. No explanations.

Component name for "${prompt}":`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 30,
        temperature: 0,
        messages: [{ role: 'user', content: extractionPrompt }],
      });

      this.tokenTracker.logUsage(response.usage, `Component Name Extraction`);

      const firstBlock = response.content[0];
      if (firstBlock?.type === 'text') {
        let extractedName = firstBlock.text.trim();
        
        // Clean up the response
        extractedName = extractedName.replace(/[^a-zA-Z]/g, '');
        
        // Validate the extracted name
        if (extractedName && extractedName.length > 0 && extractedName.length <= 20) {
          // Ensure PascalCase
          extractedName = extractedName.charAt(0).toUpperCase() + extractedName.slice(1).toLowerCase();
          this.streamUpdate(`✅ Extracted component name: ${extractedName}`);
          return extractedName;
        }
      }
      
      // Fallback if Claude fails
      this.streamUpdate(`⚠️ Claude extraction failed, using pattern matching`);
      return this.fallbackExtractComponentName(prompt);
      
    } catch (error) {
      this.streamUpdate(`❌ Error in name extraction: ${error}`);
      return this.fallbackExtractComponentName(prompt);
    }
  }

  private fallbackExtractComponentName(prompt: string): string {
    const promptLower = prompt.toLowerCase();
    
    // Specific mappings for common requests
    const nameMap: { [key: string]: string } = {
      'contact': 'Contact',
      'about': 'About',
      'service': 'Services',
      'portfolio': 'Portfolio',
      'gallery': 'Gallery',
      'testimonial': 'Testimonials',
      'review': 'Reviews',
      'blog': 'Blog',
      'news': 'News',
      'pricing': 'Pricing',
      'price': 'Pricing',
      'team': 'Team',
      'staff': 'Team',
      'faq': 'FAQ',
      'question': 'FAQ',
      'dashboard': 'Dashboard',
      'login': 'Login',
      'signin': 'Login',
      'signup': 'Signup',
      'register': 'Signup',
      'profile': 'Profile',
      'settings': 'Settings',
      'product': 'Products',
      'cart': 'Cart',
      'shopping': 'Cart',
      'checkout': 'Checkout',
      'inventory': 'Inventory',
      'analytics': 'Analytics',
      'report': 'Reports',
      'help': 'Help',
      'support': 'Help',
      'booking': 'Booking',
      'appointment': 'Booking',
      'newsletter': 'Newsletter',
      'admin': 'Admin',
      'management': 'Admin'
    };

    // Find the best match
    for (const [key, value] of Object.entries(nameMap)) {
      if (promptLower.includes(key)) {
        return value;
      }
    }

    // Extract meaningful words
    const words = prompt
      .toLowerCase()
      .split(/\s+/)
      .filter(word => 
        word.length > 2 && 
        !['the', 'and', 'for', 'with', 'add', 'create', 'make', 'new', 'build', 'page', 'component', 'section'].includes(word)
      );
    
    if (words.length > 0) {
      const name = words[0].charAt(0).toUpperCase() + words[0].slice(1);
      return name;
    }

    return 'NewPage';
  }

  private determineComponentTypeFromPrompt(prompt: string): 'component' | 'page' {
    const promptLower = prompt.toLowerCase();
    
    if (promptLower.includes('page') || 
        promptLower.includes('route') || 
        promptLower.includes('screen') ||
        promptLower.includes('view')) {
      return 'page';
    }
    
    return 'component';
  }

  private async updateAppWithPages(
    extractedName: string,
    filePath: string,
    originalPrompt: string,
    projectFiles: Map<string, ProjectFile>
  ): Promise<AppUpdateResult> {
    
    this.streamUpdate(`🔧 Updating App.tsx with new page routing...`);
    
    // Find App.tsx
    let appFile = projectFiles.get('src/App.tsx') || projectFiles.get('src/App.jsx');
    
    if (!appFile) {
      const appPaths = ['src/App.tsx', 'src/App.jsx'];
      for (const appPath of appPaths) {
        try {
          const fullPath = join(this.reactBasePath, appPath.replace('src/', ''));
          const content = await fs.readFile(fullPath, 'utf8');
          const stats = await fs.stat(fullPath);
          
          appFile = {
            name: basename(fullPath),
            path: fullPath,
            relativePath: appPath,
            content,
            lines: content.split('\n').length,
            size: stats.size,
            snippet: content.substring(0, 500),
            componentName: 'App',
            hasButtons: false,
            hasSignin: false,
            isMainFile: true
          };
          
          projectFiles.set(appPath, appFile);
          break;
        } catch {
          continue;
        }
      }
    }

    if (!appFile) {
      return { success: false, error: 'App.tsx not found' };
    }

    const structure: ExtractedFileStructure = this.extractFileStructure(appFile.content);
    
    // Create detailed integration requirements
    const integrationRequirements: string = `
**PAGE TO INTEGRATE:**
- Component: ${extractedName}
- Import: import ${extractedName} from './pages/${extractedName}';
- Route: <Route path="/${extractedName.toLowerCase()}" element={<${extractedName} />} />
- File: ${filePath}

**INTEGRATION RULES:**
1. Add import at the top with existing imports
2. Add route in the <Routes> section (create if doesn't exist)
3. If no React Router, add: import { BrowserRouter, Routes, Route } from 'react-router-dom';
4. Wrap content in <BrowserRouter> if not already wrapped
5. Maintain all existing functionality and routes
6. Only add lucide-react imports if needed for icons
`;

    // Use the template helper functions from template.ts
    const fullUserRequest: string = `${originalPrompt}\n\nIntegrate new page with routing:\n${integrationRequirements}`;
    
    // Use the prepareFullFileVariables helper function
    const templateVariables: Record<string, string> = prepareFullFileVariables(
      fullUserRequest,
      appFile.relativePath,
      appFile.content,
      'Project summary truncated for brevity...',
      {
        componentName: structure.componentName || 'App',
        lineCount: appFile.lines,
        fileType: appFile.name.endsWith('.tsx') ? 'TypeScript React' : 'JavaScript React',
        filePurpose: 'Main application component with routing'
      },
      structure.preservationPrompt,
      'Adding new page routing...'
    );
    
    const modificationPrompt: string = replaceTemplateVariables(fullFilePrompt, templateVariables);

    try {
      this.streamUpdate(`🤖 Using fullFilePrompt template for App.tsx routing integration...`);
      
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 6000,
        temperature: 0,
        messages: [{ role: 'user', content: modificationPrompt }],
      });

      this.tokenTracker.logUsage(response.usage, `App.tsx Routing Integration`);

      const firstBlock = response.content[0];
      if (firstBlock?.type === 'text') {
        const text: string = firstBlock.text;
        const codeMatch: RegExpMatchArray | null = text.match(/```(?:jsx|tsx|javascript|typescript)\n([\s\S]*?)```/);
        
        if (codeMatch) {
          const modifiedContent: string = codeMatch[1].trim();
          
          const validation: StructureValidationResult = this.validateStructurePreservation(modifiedContent, structure);
          
          if (validation.isValid) {
            await fs.writeFile(appFile.path, modifiedContent, 'utf8');
            this.streamUpdate(`✅ Successfully updated ${appFile.relativePath} with strict preservation`);
            return {
              success: true,
              updatedFiles: [appFile.relativePath]
            };
          } else {
            this.streamUpdate(`❌ STRICT App.tsx validation failed`);
            this.streamUpdate(`❌ Errors: ${validation.errors.join(', ')}`);
            return { success: false, error: 'Strict validation failed for App.tsx' };
          }
        } else {
          return { success: false, error: 'No code block found in App.tsx response' };
        }
      }
      
      return { success: false, error: 'No response from Claude for App.tsx' };
    } catch (error) {
      this.streamUpdate(`❌ Error updating App.tsx: ${error}`);
      return { success: false, error: `App.tsx update error: ${error}` };
    }
  }

  private extractFileStructure(content: string): ExtractedFileStructure {
    const lines = content.split('\n');
    const imports: string[] = [];
    const exports: string[] = [];
    let componentName: string | null = null;
    let hasDefaultExport = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('import ')) {
        imports.push(lines[i]); // Keep original formatting
      }
      
      if (line.startsWith('export ')) {
        exports.push(lines[i]); // Keep original formatting
        
        if (line.includes('export default')) {
          hasDefaultExport = true;
          const defaultMatch = line.match(/export\s+default\s+(\w+)/);
          if (defaultMatch) {
            componentName = defaultMatch[1];
          }
        }
      }
    }
    
    if (!componentName) {
      const functionMatch = content.match(/(?:function|const)\s+([A-Z]\w+)/);
      if (functionMatch) {
        componentName = functionMatch[1];
      }
    }
    
    // Generate comprehensive preservation prompt
    const preservationPrompt = `
**🚨 CRITICAL PRESERVATION REQUIREMENTS:**

**ALL IMPORTS (${imports.length}) - MUST BE PRESERVED EXACTLY:**
${imports.map((imp, idx) => `${idx + 1}. ${imp}`).join('\n') || '(No imports found)'}

**ALL EXPORTS (${exports.length}) - MUST BE PRESERVED EXACTLY:**
${exports.map((exp, idx) => `${idx + 1}. ${exp}`).join('\n') || '(No exports found)'}

**COMPONENT IDENTITY:**
✓ Main component: ${componentName || 'Not detected'}
✓ Has default export: ${hasDefaultExport ? 'Yes' : 'No'}

**🔒 STRICT RULES:**
1. Keep ALL import statements exactly as they are
2. Keep ALL export statements exactly as they are
3. Only modify JSX content and component logic
4. Preserve component names and function signatures
5. If you need new imports, add them in the same style
    `;

    return {
      imports,
      exports,
      componentName,
      hasDefaultExport,
      preservationPrompt
    };
  }

  private validateStructurePreservation(modifiedContent: string, structure: ExtractedFileStructure): StructureValidationResult {
    const errors: string[] = [];
    
    for (const originalImport of structure.imports) {
      if (!modifiedContent.includes(originalImport.trim())) {
        errors.push(`Missing import: ${originalImport.trim()}`);
      }
    }
    
    for (const originalExport of structure.exports) {
      if (!modifiedContent.includes(originalExport.trim())) {
        errors.push(`Missing export: ${originalExport.trim()}`);
      }
    }
    
    if (structure.componentName) {
      const componentRegex = new RegExp(`\\b${structure.componentName}\\b`);
      if (!componentRegex.test(modifiedContent)) {
        errors.push(`Component name '${structure.componentName}' not found`);
      }
    }
    
    if (structure.hasDefaultExport && !modifiedContent.includes('export default')) {
      errors.push('Default export statement missing');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}