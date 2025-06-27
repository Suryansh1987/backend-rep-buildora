import Anthropic from '@anthropic-ai/sdk';
import { promises as fs } from 'fs';
import { join, dirname, basename } from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

interface ComponentSpec {
  name: string;
  type: 'component' | 'page';
  description: string;
  userRequest: string;
}

interface ComponentTypeDecision {
  type: 'component' | 'page';
  reasoning: string;
  confidence: number;
}

interface PageIntegrationAnalysis {
  pagePath: string;
  pageName: string;
  shouldIntegrate: boolean;
  reasoning: string;
  integrationPoint: string;
  confidence: number;
}

interface FileStructureSummary {
  components: Array<{
    name: string;
    path: string;
    exports: string[];
    canAcceptChildren: boolean;
    level: number;
  }>;
  pages: Array<{
    name: string;
    path: string;
    exports: string[];
    level: number;
    elementTree?: string; // Added for component integration analysis
  }>;
  appStructure: {
    path: string;
    hasRouting: boolean;
    existingRoutes: string[];
    importedPages: string[];
  };
}

interface GenerationResult {
  success: boolean;
  generatedFile?: string;
  updatedFiles: string[];
  componentContent?: string;
  integrationPath: 'component' | 'page' | 'app';
  integratedWithPages?: string[]; // New: track which pages were updated
  error?: string;
}

export class ComponentGenerationSystem {
  private anthropic: Anthropic;
  private reactBasePath: string;
  private streamCallback?: (message: string) => void;
  private fileStructureSummary: FileStructureSummary | null = null;
  private projectSummary: string | null = null;
  private projectSummaryCallback?: (summary: string, prompt: string) => Promise<string | null>;

  constructor(anthropic: Anthropic, reactBasePath: string) {
    this.anthropic = anthropic;
    this.reactBasePath = reactBasePath;
  }

  setStreamCallback(callback: (message: string) => void) {
    this.streamCallback = callback;
  }

  private streamUpdate(message: string) {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
  }

  setProjectSummary(summary: string | null) {
    this.projectSummary = summary;
    if (summary) {
      this.streamUpdate('📋 Project summary loaded for context-aware generation');
    }
  }

  setProjectSummaryCallback(callback: (summary: string, prompt: string) => Promise<string | null>) {
    this.projectSummaryCallback = callback;
  }

  /**
   * ENHANCED: Main component generation workflow with intelligent type detection
   */
  async generateComponent(spec: ComponentSpec): Promise<GenerationResult> {
    this.streamUpdate(`🎨 Starting enhanced component generation for: ${spec.name}`);

    try {
      // Step 1: Extract and analyze file structure
      await this.extractFileStructure();
      
      // Step 2: Intelligently decide component vs page using Claude
      const typeDecision = await this.intelligentlyDecideComponentType(spec.userRequest);
      this.streamUpdate(`🧠 Intelligent decision: ${typeDecision.type} (confidence: ${typeDecision.confidence}%)`);
      this.streamUpdate(`📝 Reasoning: ${typeDecision.reasoning}`);
      
      // Override the spec type with intelligent decision
      const enhancedSpec = {
        ...spec,
        type: typeDecision.type
      };

      // Step 3: Generate component content
      const componentContent = await this.generateComponentContent(enhancedSpec);
      if (!componentContent) {
        return { success: false, error: 'Failed to generate component content', updatedFiles: [], integrationPath: 'component' };
      }

      // Step 4: Create the component file
      const componentPath = await this.createComponentFile(enhancedSpec, componentContent);
      if (!componentPath) {
        return { success: false, error: 'Failed to create component file', updatedFiles: [], integrationPath: 'component' };
      }

      // Step 5: Update file structure summary
      await this.updateFileStructureSummary(enhancedSpec, componentPath);

      // Step 6: FIXED integration logic based on type
      let integrationResult: {
        integrationPath: 'component' | 'page' | 'app';
        updatedFiles: string[];
        integratedWithPages?: string[];
      };

      if (enhancedSpec.type === 'page') {
        // PAGE: Use existing app-level integration (ONLY PAGES go to App.tsx)
        this.streamUpdate(`📄 Integrating PAGE with App.tsx routing...`);
        integrationResult = await this.integratePageWithApp(enhancedSpec, componentPath);
      } else {
        // COMPONENT: Use new page-level integration (NEVER update App.tsx for components)
        this.streamUpdate(`🧩 Integrating COMPONENT with existing pages...`);
        integrationResult = await this.integrateComponentWithPages(enhancedSpec, componentPath);
      }

      // Step 7: Update project summary
      await this.updateProjectSummaryAfterCreation(enhancedSpec, {
        success: true,
        generatedFile: componentPath,
        updatedFiles: integrationResult.updatedFiles,
        componentContent,
        integrationPath: integrationResult.integrationPath,
        integratedWithPages: integrationResult.integratedWithPages,
      });

      this.streamUpdate(`✅ Enhanced generation complete! Created ${enhancedSpec.name} ${enhancedSpec.type} and updated ${integrationResult.updatedFiles.length} files`);

      return {
        success: true,
        generatedFile: componentPath,
        updatedFiles: integrationResult.updatedFiles,
        componentContent,
        integrationPath: integrationResult.integrationPath,
        integratedWithPages: integrationResult.integratedWithPages,
      };

    } catch (error) {
      this.streamUpdate(`❌ Enhanced generation failed: ${error}`);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        updatedFiles: [],
        integrationPath: 'component'
      };
    }
  }

  /**
   * NEW: Intelligent component vs page decision using Claude
   */
  private async intelligentlyDecideComponentType(userRequest: string): Promise<ComponentTypeDecision> {
    this.streamUpdate(`🤖 Analyzing request to determine component vs page...`);

    const existingComponents = this.fileStructureSummary?.components.map(c => c.name) || [];
    const existingPages = this.fileStructureSummary?.pages.map(p => p.name) || [];

    const decisionPrompt = `
**TASK:** Analyze the user request and decide whether to create a COMPONENT or PAGE

**USER REQUEST:** "${userRequest}"

**PROJECT CONTEXT:**
- Existing Components: ${existingComponents.join(', ') || 'None'}
- Existing Pages: ${existingPages.join(', ') || 'None'}
- Has App Routing: ${this.fileStructureSummary?.appStructure.hasRouting ? 'Yes' : 'No'}

**DECISION CRITERIA:**

**CREATE PAGE when:**
- User explicitly mentions "page", "route", "screen", "view"
- Request is for a complete standalone screen (About, Contact, Services, etc.)
- Content would be a full page that users navigate to
- Would need its own URL/route
- Examples: "add contact page", "create about us page", "make services page"

**CREATE COMPONENT when:**
- User mentions "component", "section", "widget", "element"
- Request is for a reusable UI piece that goes WITHIN pages
- Content is a specific feature/section to be embedded
- Would be used across multiple pages or sections
- Examples: "add contact form", "create pricing table", "make testimonials section"

**SMART ANALYSIS:**
- If request is ambiguous, consider what would be more useful
- Components are reusable, pages are destinations
- Consider existing project structure

**RESPONSE FORMAT:**
TYPE: component|page
CONFIDENCE: 0-100
REASONING: [detailed explanation of decision]

**EXAMPLE:**
TYPE: component
CONFIDENCE: 85
REASONING: User requested "contact form" which is typically a reusable component that can be embedded in contact pages, modals, or other locations. Not a full page.
    `;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 500,
        temperature: 0.3,
        messages: [{ role: 'user', content: decisionPrompt }],
      });

      const firstBlock = response.content[0];
      if (firstBlock?.type === 'text') {
        const text = firstBlock.text;
        
        const typeMatch = text.match(/TYPE:\s*(component|page)/i);
        const confidenceMatch = text.match(/CONFIDENCE:\s*(\d+)/);
        const reasoningMatch = text.match(/REASONING:\s*(.*?)(?:\n|$)/);

        const type = (typeMatch?.[1]?.toLowerCase() as 'component' | 'page') || 'component';
        const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 70;
        const reasoning = reasoningMatch?.[1]?.trim() || 'No specific reasoning provided';

        return {
          type,
          confidence: Math.min(100, Math.max(0, confidence)),
          reasoning
        };
      }
      
      // Fallback to pattern matching
      return this.fallbackComponentTypeDecision(userRequest);
      
    } catch (error) {
      this.streamUpdate(`❌ Error in type decision: ${error}`);
      return this.fallbackComponentTypeDecision(userRequest);
    }
  }

  /**
   * Fallback component type decision using pattern matching
   */
  private fallbackComponentTypeDecision(userRequest: string): ComponentTypeDecision {
    const request = userRequest.toLowerCase();
    
    // Strong page indicators
    if (request.includes('page') || request.includes('route') || request.includes('screen') || request.includes('view')) {
      return {
        type: 'page',
        confidence: 80,
        reasoning: 'Request explicitly mentions page-related terms'
      };
    }
    
    // Strong component indicators
    if (request.includes('component') || request.includes('section') || request.includes('widget') || request.includes('form')) {
      return {
        type: 'component',
        confidence: 80,
        reasoning: 'Request explicitly mentions component-related terms'
      };
    }
    
    // Page-like content patterns
    const pagePatterns = ['about', 'contact', 'services', 'portfolio', 'blog', 'news', 'dashboard', 'profile', 'settings'];
    for (const pattern of pagePatterns) {
      if (request.includes(pattern) && !request.includes('form') && !request.includes('section')) {
        return {
          type: 'page',
          confidence: 70,
          reasoning: `Content "${pattern}" typically represents a full page destination`
        };
      }
    }
    
    // Component-like content patterns
    const componentPatterns = ['form', 'table', 'list', 'card', 'modal', 'dropdown', 'button', 'input', 'chart'];
    for (const pattern of componentPatterns) {
      if (request.includes(pattern)) {
        return {
          type: 'component',
          confidence: 75,
          reasoning: `Content "${pattern}" typically represents a reusable component`
        };
      }
    }
    
    // Default to component for reusability
    return {
      type: 'component',
      confidence: 60,
      reasoning: 'Defaulting to component for maximum reusability across pages'
    };
  }

  /**
   * ENHANCED: Extract file structure with page element trees
   */
  private async extractFileStructure(): Promise<void> {
    this.streamUpdate('📊 Extracting enhanced file structure with page analysis...');

    const srcPath = join(this.reactBasePath, 'src');
    const summary: FileStructureSummary = {
      components: [],
      pages: [],
      appStructure: {
        path: '',
        hasRouting: false,
        existingRoutes: [],
        importedPages: []
      }
    };

    // Scan components directory
    const componentsPath = join(srcPath, 'components');
    try {
      await fs.access(componentsPath);
      const componentFiles = await this.scanDirectory(componentsPath, /\.(jsx|tsx)$/);
      
      for (const filePath of componentFiles) {
        const analysis = await this.analyzeComponentFile(filePath, 1);
        if (analysis) {
          summary.components.push(analysis);
        }
      }
      this.streamUpdate(`✅ Found ${summary.components.length} components`);
    } catch {
      this.streamUpdate('⚠️ No components directory found - will create it');
    }

    // ENHANCED: Scan pages directory with element tree analysis
    const pagesPath = join(srcPath, 'pages');
    try {
      await fs.access(pagesPath);
      const pageFiles = await this.scanDirectory(pagesPath, /\.(jsx|tsx)$/);
      
      for (const filePath of pageFiles) {
        const analysis = await this.analyzePageFileWithElementTree(filePath, 1);
        if (analysis) {
          summary.pages.push(analysis);
        }
      }
      this.streamUpdate(`✅ Found ${summary.pages.length} pages with element trees`);
    } catch {
      this.streamUpdate('⚠️ No pages directory found - will create it');
    }

    // Analyze App file
    const appPaths = [
      join(srcPath, 'App.tsx'),
      join(srcPath, 'App.jsx'),
      join(srcPath, 'app.tsx'),
      join(srcPath, 'app.jsx')
    ];

    for (const appPath of appPaths) {
      try {
        await fs.access(appPath);
        const appAnalysis = await this.analyzeAppFile(appPath);
        summary.appStructure = appAnalysis;
        this.streamUpdate(`✅ Analyzed App file: ${appPath.replace(this.reactBasePath, '')}`);
        break;
      } catch {
        continue;
      }
    }

    this.fileStructureSummary = summary;
    this.streamUpdate('📊 Enhanced file structure analysis complete');
  }

  /**
   * NEW: Analyze page file with element tree for component integration
   */
  private async analyzePageFileWithElementTree(filePath: string, level: number): Promise<any> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const relativePath = filePath.replace(this.reactBasePath + '/', '').replace(/\\/g, '/');
      
      const ast = parse(content, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      const exports: string[] = [];
      let pageName = '';
      const elementTree: string[] = [];
const self = this;
    traverse(ast, {
  ExportDefaultDeclaration(path: any) {
    if (path.node.declaration.name) {
      pageName = path.node.declaration.name;
      exports.push(pageName);
    }
  },
  FunctionDeclaration(path: any) {
    if (path.node.id?.name && content.includes(`export default ${path.node.id.name}`)) {
      pageName = path.node.id.name;
      if (!exports.includes(pageName)) {
        exports.push(pageName);
      }
    }
  },
  JSXElement(path: any) {
    const tagName = path.node.openingElement.name.name;
    const depth = self.calculateJSXDepth(path); // ✅ Fix here

    if (depth <= 3) {
      elementTree.push(`${'  '.repeat(depth)}<${tagName}>`);
    }
  }
});

      // Create a structured element tree string
      const elementTreeString = elementTree.slice(0, 20).join('\n'); // Limit for performance

      return {
        name: pageName || this.extractNameFromPath(filePath),
        path: relativePath,
        exports,
        level,
        elementTree: elementTreeString
      };
    } catch (error) {
      this.streamUpdate(`⚠️ Failed to analyze page ${filePath}: ${error}`);
      return null;
    }
  }

  /**
   * Calculate JSX nesting depth
   */
  private calculateJSXDepth(path: any): number {
    let depth = 0;
    let currentPath = path.parentPath;
    
    while (currentPath) {
      if (currentPath.node && currentPath.node.type === 'JSXElement') {
        depth++;
      }
      currentPath = currentPath.parentPath;
    }
    
    return depth;
  }

  /**
   * NEW: Integrate component with existing pages using intelligent analysis
   */
  private async integrateComponentWithPages(
    spec: ComponentSpec, 
    componentPath: string
  ): Promise<{
    integrationPath: 'component' | 'page' | 'app';
    updatedFiles: string[];
    integratedWithPages?: string[];
  }> {
    this.streamUpdate(`🧩 Starting intelligent component integration with pages...`);

    if (!this.fileStructureSummary || this.fileStructureSummary.pages.length === 0) {
      this.streamUpdate(`⚠️ No pages found for component integration`);
      return {
        integrationPath: 'component',
        updatedFiles: [],
        integratedWithPages: []
      };
    }

    const updatedFiles: string[] = [];
    const integratedWithPages: string[] = [];

    // Analyze each page for integration potential
    for (const page of this.fileStructureSummary.pages) {
      this.streamUpdate(`🔍 Analyzing page ${page.name} for integration potential...`);
      
      const integrationAnalysis = await this.analyzePageIntegration(page, spec);
      
      if (integrationAnalysis.shouldIntegrate && integrationAnalysis.confidence >= 70) {
        this.streamUpdate(`✅ Integrating component ${spec.name} with page ${page.name} (confidence: ${integrationAnalysis.confidence}%)`);
        this.streamUpdate(`📝 Reasoning: ${integrationAnalysis.reasoning}`);
        
        const success = await this.updatePageWithComponent(page.path, spec, integrationAnalysis.integrationPoint);
        
        if (success) {
          updatedFiles.push(page.path);
          integratedWithPages.push(page.name);
          this.streamUpdate(`✅ Successfully integrated with ${page.name}`);
        } else {
          this.streamUpdate(`❌ Failed to integrate with ${page.name}`);
        }
      } else {
        this.streamUpdate(`❌ Skipping ${page.name} - not suitable for integration (confidence: ${integrationAnalysis.confidence}%)`);
        this.streamUpdate(`📝 Reasoning: ${integrationAnalysis.reasoning}`);
      }
    }

    this.streamUpdate(`📊 Component integration complete: ${integratedWithPages.length} pages updated`);

    return {
      integrationPath: 'page',
      updatedFiles,
      integratedWithPages
    };
  }

  /**
   * NEW: Analyze if a component should be integrated with a specific page
   */
  private async analyzePageIntegration(
    page: any, 
    spec: ComponentSpec
  ): Promise<PageIntegrationAnalysis> {
    this.streamUpdate(`🤖 Analyzing integration potential for ${spec.name} with page ${page.name}...`);

    const analysisPrompt = `
**TASK:** Determine if component "${spec.name}" should be integrated with page "${page.name}"

**COMPONENT DETAILS:**
- Name: ${spec.name}
- User Request: "${spec.userRequest}"
- Type: ${spec.type}

**PAGE DETAILS:**
- Name: ${page.name}
- Path: ${page.path}
- Element Structure:
${page.elementTree || 'No element tree available'}

**INTEGRATION CRITERIA:**
1. **Semantic Match**: Does the component's purpose align with the page's content?
2. **User Intent**: Does the user request suggest this component belongs on this page?
3. **Technical Fit**: Can this component be logically placed in the page structure?
4. **User Experience**: Would adding this component improve the page's functionality?

**EXAMPLES:**
- Contact form → Contact page (HIGH confidence)
- Pricing table → Services/Pricing page (HIGH confidence)
- Newsletter signup → Multiple pages (MEDIUM confidence)
- Testimonials → About/Home page (MEDIUM confidence)
- Login form → Login page (HIGH confidence)
- Search bar → Header/Dashboard (LOW confidence for specific pages)

**RESPONSE FORMAT:**
INTEGRATE: YES/NO
CONFIDENCE: 0-100
REASONING: [detailed explanation]
INTEGRATION_POINT: [where in the page to add it - be specific about JSX location]

**EXAMPLE:**
INTEGRATE: YES
CONFIDENCE: 90
REASONING: Contact form is highly relevant for Contact page - users expect to find contact forms on contact pages
INTEGRATION_POINT: After the contact information section, before the footer
    `;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 600,
        temperature: 0.2,
        messages: [{ role: 'user', content: analysisPrompt }],
      });

      const firstBlock = response.content[0];
      if (firstBlock?.type === 'text') {
        const text = firstBlock.text;
        
        const integrateMatch = text.match(/INTEGRATE:\s*(YES|NO)/i);
        const confidenceMatch = text.match(/CONFIDENCE:\s*(\d+)/);
        const reasoningMatch = text.match(/REASONING:\s*(.*?)(?=\nINTEGRATION_POINT:|$)/);
        const integrationPointMatch = text.match(/INTEGRATION_POINT:\s*(.*?)(?:\n|$)/);

        const shouldIntegrate = integrateMatch?.[1]?.toUpperCase() === 'YES';
        const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 0;
        const reasoning = reasoningMatch?.[1]?.trim() || 'No reasoning provided';
        const integrationPoint = integrationPointMatch?.[1]?.trim() || 'At the end of the main content';

        return {
          pagePath: page.path,
          pageName: page.name,
          shouldIntegrate,
          reasoning,
          integrationPoint,
          confidence: Math.min(100, Math.max(0, confidence))
        };
      }
      
      // Fallback analysis
      return this.fallbackPageIntegrationAnalysis(page, spec);
      
    } catch (error) {
      this.streamUpdate(`❌ Error in page integration analysis: ${error}`);
      return this.fallbackPageIntegrationAnalysis(page, spec);
    }
  }

  /**
   * Fallback page integration analysis using pattern matching
   */
  private fallbackPageIntegrationAnalysis(page: any, spec: ComponentSpec): PageIntegrationAnalysis {
    const pageName = page.name.toLowerCase();
    const userRequest = spec.userRequest.toLowerCase();
    const componentName = spec.name.toLowerCase();

    // High confidence matches
    const highConfidenceMatches = [
      { pagePattern: 'contact', componentPatterns: ['contact', 'form'], confidence: 90 },
      { pagePattern: 'about', componentPatterns: ['team', 'testimonial', 'story'], confidence: 85 },
      { pagePattern: 'service', componentPatterns: ['pricing', 'feature', 'service'], confidence: 85 },
      { pagePattern: 'home', componentPatterns: ['hero', 'banner', 'testimonial', 'feature'], confidence: 80 },
      { pagePattern: 'portfolio', componentPatterns: ['gallery', 'project', 'work'], confidence: 85 },
      { pagePattern: 'blog', componentPatterns: ['post', 'article', 'comment'], confidence: 85 },
    ];

    for (const match of highConfidenceMatches) {
      if (pageName.includes(match.pagePattern)) {
        for (const componentPattern of match.componentPatterns) {
          if (componentName.includes(componentPattern) || userRequest.includes(componentPattern)) {
            return {
              pagePath: page.path,
              pageName: page.name,
              shouldIntegrate: true,
              reasoning: `Strong semantic match: ${componentPattern} component fits well on ${match.pagePattern} page`,
              integrationPoint: 'In the main content area',
              confidence: match.confidence
            };
          }
        }
      }
    }

    // Medium confidence - universal components
    const universalComponents = ['newsletter', 'search', 'navigation', 'footer', 'header'];
    for (const universal of universalComponents) {
      if (componentName.includes(universal) || userRequest.includes(universal)) {
        return {
          pagePath: page.path,
          pageName: page.name,
          shouldIntegrate: true,
          reasoning: `Universal component ${universal} can be added to most pages`,
          integrationPoint: universal.includes('header') || universal.includes('nav') ? 'At the top' : 'At the bottom',
          confidence: 65
        };
      }
    }

    // Low confidence - no clear match
    return {
      pagePath: page.path,
      pageName: page.name,
      shouldIntegrate: false,
      reasoning: `No clear semantic relationship between ${spec.name} component and ${page.name} page`,
      integrationPoint: 'Not applicable',
      confidence: 30
    };
  }

  /**
   * NEW: Update page file with component integration
   */
  private async updatePageWithComponent(
    pagePath: string, 
    spec: ComponentSpec, 
    integrationPoint: string
  ): Promise<boolean> {
    try {
      // Fix path resolution - pagePath is already relative, just join with base
      const fullPath = join(this.reactBasePath, pagePath.replace(/\\/g, '/'));
      this.streamUpdate(`🔧 Updating page file at: ${fullPath}`);
      
      const content = await fs.readFile(fullPath, 'utf8');

      const updatePrompt = `
**TASK:** Integrate component "${spec.name}" into page "${pagePath}"

**CURRENT PAGE:**
\`\`\`tsx
${content}
\`\`\`

**COMPONENT TO INTEGRATE:**
- Name: ${spec.name}
- Import: import ${spec.name} from '../components/${spec.name}';
- User Request: "${spec.userRequest}"
- Integration Point: ${integrationPoint}

**REQUIREMENTS:**
1. Add import statement at the top with other imports
2. Add <${spec.name} /> component in the specified integration point
3. Keep all existing functionality and structure intact
4. Ensure proper JSX structure and formatting
5. Place the component logically within the page flow

**RESPONSE:** Return ONLY the complete updated page:

\`\`\`tsx
[UPDATED PAGE CODE]
\`\`\`
      `;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 6000,
        temperature: 0,
        messages: [{ role: 'user', content: updatePrompt }],
      });

      const firstBlock = response.content[0];
      if (firstBlock?.type === 'text') {
        const text = firstBlock.text;
        const codeMatch = text.match(/```(?:tsx|jsx|typescript|javascript)\n([\s\S]*?)```/);
        
        if (codeMatch) {
          const updatedContent = codeMatch[1].trim();
          await fs.writeFile(fullPath, updatedContent, 'utf8');
          this.streamUpdate(`✅ Successfully updated page: ${pagePath}`);
          return true;
        }
      }
      
      this.streamUpdate(`❌ Failed to extract updated code for ${pagePath}`);
      return false;
    } catch (error) {
      this.streamUpdate(`❌ Failed to update page file ${pagePath}: ${error}`);
      return false;
    }
  }

  /**
   * EXISTING: Page integration with App.tsx (unchanged)
   */
  private async integratePageWithApp(
    spec: ComponentSpec, 
    componentPath: string
  ): Promise<{
    integrationPath: 'component' | 'page' | 'app';
    updatedFiles: string[];
  }> {
    this.streamUpdate(`📄 Integrating page with App.tsx routing...`);
    
    if (this.fileStructureSummary?.appStructure.path) {
      const appIntegration = await this.integrateWithApp(spec);
      if (appIntegration.length > 0) {
        return {
          integrationPath: 'app',
          updatedFiles: appIntegration
        };
      }
    } else {
      this.streamUpdate(`⚠️ No App.jsx found - page created but not integrated with routing`);
    }

    return {
      integrationPath: 'app',
      updatedFiles: []
    };
  }

  // ... [Keep all existing methods: generateComponentContent, createComponentFile, 
  //      updateFileStructureSummary, analyzeComponentFile, analyzeAppFile, 
  //      integrateWithApp, updateAppFile, etc.]

  /**
   * EXISTING METHODS (unchanged for backward compatibility)
   */
  
  private async generateComponentContent(spec: ComponentSpec): Promise<string | null> {
    this.streamUpdate(`🤖 Generating ${spec.type} content for ${spec.name}...`);

    const existingComponents = this.fileStructureSummary?.components.map(c => c.name) || [];
    const existingPages = this.fileStructureSummary?.pages.map(p => p.name) || [];
    
    if (spec.type === 'component' && existingComponents.includes(spec.name)) {
      this.streamUpdate(`⚠️ Component ${spec.name} already exists, creating unique variant...`);
    }
    if (spec.type === 'page' && existingPages.includes(spec.name)) {
      this.streamUpdate(`⚠️ Page ${spec.name} already exists, creating unique variant...`);
    }

    const projectContext = this.projectSummary ? `
**PROJECT CONTEXT:**
${this.projectSummary}

**EXISTING COMPONENTS:** ${existingComponents.join(', ') || 'None'}
**EXISTING PAGES:** ${existingPages.join(', ') || 'None'}
` : `
**EXISTING COMPONENTS:** ${existingComponents.join(', ') || 'None'}
**EXISTING PAGES:** ${existingPages.join(', ') || 'None'}
`;

    const contentGuidance = this.getContentGuidanceForRequest(spec.userRequest, spec.name, spec.type);

    const componentPrompt = `
**TASK:** Generate a UNIQUE React ${spec.type} ${spec.type === 'component' ? 'component' : 'page'}

**SPECIFICATION:**
- Name: ${spec.name}
- Type: ${spec.type}
- User Request: "${spec.userRequest}"
- Description: ${spec.description}

${projectContext}

**CRITICAL REQUIREMENTS:**
1. **MAKE IT UNIQUE** - Do NOT recreate existing components/pages
2. **NO NAVBAR/FOOTER** - These are layout components, focus on specific content
3. **ONLY use these imports:**
   - React hooks: import { useState, useEffect, etc. } from 'react';
   - Lucide React icons: import { IconName } from 'lucide-react';
   - NO other component imports unless absolutely necessary

4. **Component Structure:**
   - Function component with proper TypeScript
   - Use modern React patterns (hooks, functional components)
   - Export as default
   - Create SPECIFIC content for the ${spec.name} ${spec.type}

5. **Styling & Design:**
   - Use Tailwind CSS classes
   - Modern, clean aesthetic
   - Responsive design
   - Professional design appropriate for the request

6. **Content Guidelines:**
   - Make content SPECIFIC to "${spec.userRequest}"
   - ${contentGuidance}
   - Add meaningful content, not just placeholders
   - Include appropriate interactive elements

**RESPONSE:** Return ONLY the complete component code:

\`\`\`tsx
[COMPLETE COMPONENT CODE HERE]
\`\`\`
    `;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 3000,
        temperature: 0.4,
        messages: [{ role: 'user', content: componentPrompt }],
      });

      const firstBlock = response.content[0];
      if (firstBlock?.type === 'text') {
        const text = firstBlock.text;
        const codeMatch = text.match(/```(?:tsx|jsx|typescript|javascript)\n([\s\S]*?)```/);
        
        if (codeMatch) {
          const componentContent = codeMatch[1].trim();
          this.streamUpdate(`✅ Generated unique ${spec.type} content for ${spec.name}`);
          return componentContent;
        }
      }
      
      this.streamUpdate(`❌ Failed to extract component code from Claude response`);
      return null;
    } catch (error) {
      this.streamUpdate(`❌ Component generation failed: ${error}`);
      return null;
    }
  }

  private getContentGuidanceForRequest(userRequest: string, componentName: string, type: string): string {
    const request = userRequest.toLowerCase();
    
    if (request.includes('contact')) {
      return `- Contact form with fields: name, email, phone, subject, message
      - Contact information display
      - Map or location section
      - Business hours
      - Call-to-action buttons`;
    }
    
    if (request.includes('about')) {
      return `- Company/personal story section
      - Mission and values
      - Team information
      - Timeline or milestones
      - Skills or expertise display`;
    }
    
    if (request.includes('service') || request.includes('product')) {
      return `- Service/product listings
      - Feature highlights
      - Pricing information
      - Benefits and features
      - Call-to-action for booking/purchase`;
    }
    
    if (request.includes('gallery') || request.includes('portfolio')) {
      return `- Image grid or carousel
      - Category filters
      - Lightbox functionality
      - Project descriptions
      - Before/after comparisons`;
    }
    
    if (request.includes('testimonial') || request.includes('review')) {
      return `- Customer testimonials
      - Rating displays
      - Customer photos/names
      - Review carousel
      - Trust indicators`;
    }
    
    if (request.includes('blog') || request.includes('news')) {
      return `- Article previews
      - Category tags
      - Read more functionality
      - Author information
      - Publication dates`;
    }
    
    return `- Create relevant sections for "${userRequest}"
    - Include appropriate forms or interactive elements
    - Add call-to-action buttons where relevant
    - Make content specific to the request purpose`;
  }

  private async createComponentFile(spec: ComponentSpec, content: string): Promise<string | null> {
    try {
      const directory = spec.type === 'component' ? 'components' : 'pages';
      const extension = content.includes('interface') || content.includes(': React.FC') ? 'tsx' : 'jsx';
      
      const dirPath = join(this.reactBasePath, 'src', directory);
      const filePath = join(dirPath, `${spec.name}.${extension}`);

      await fs.mkdir(dirPath, { recursive: true });
      await fs.writeFile(filePath, content, 'utf8');
      
      const relativePath = filePath.replace(this.reactBasePath + '/', '').replace(/\\/g, '/');
      this.streamUpdate(`✅ Created ${spec.type} file: ${relativePath}`);
      
      return relativePath;
    } catch (error) {
      this.streamUpdate(`❌ Failed to create component file: ${error}`);
      return null;
    }
  }

  private async updateFileStructureSummary(spec: ComponentSpec, componentPath: string): Promise<void> {
    if (!this.fileStructureSummary) return;

    const newEntry = {
      name: spec.name,
      path: componentPath,
      exports: [spec.name],
      level: 1
    };

    if (spec.type === 'component') {
      this.fileStructureSummary.components.push({
        ...newEntry,
        canAcceptChildren: false
      });
    } else {
      this.fileStructureSummary.pages.push(newEntry);
    }

    this.streamUpdate(`✅ Updated file structure summary with ${spec.name}`);
  }

  private async scanDirectory(dirPath: string, pattern: RegExp): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);
        
        if (entry.isFile() && pattern.test(entry.name)) {
          files.push(fullPath);
        } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'ui') {
          const subFiles = await this.scanDirectory(fullPath, pattern);
          files.push(...subFiles);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
    
    return files;
  }

  private async analyzeComponentFile(filePath: string, level: number): Promise<any> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const relativePath = filePath.replace(this.reactBasePath + '/', '').replace(/\\/g, '/');
      
      const ast = parse(content, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      const exports: string[] = [];
      let componentName = '';
      let canAcceptChildren = false;

      traverse(ast, {
        ExportDefaultDeclaration(path: any) {
          if (path.node.declaration.name) {
            componentName = path.node.declaration.name;
            exports.push(componentName);
          }
        },
        FunctionDeclaration(path: any) {
          if (path.node.id?.name && content.includes(`export default ${path.node.id.name}`)) {
            componentName = path.node.id.name;
            if (!exports.includes(componentName)) {
              exports.push(componentName);
            }
          }
          
          if (path.node.params) {
            const hasChildrenProp = path.node.params.some((param: any) => {
              if (param.type === 'ObjectPattern') {
                return param.properties.some((prop: any) => 
                  prop.key?.name === 'children'
                );
              }
              return false;
            });
            if (hasChildrenProp) canAcceptChildren = true;
          }
        },
        JSXElement(path: any) {
          if (path.node.children && path.node.children.length > 0) {
            const hasNonTextChildren = path.node.children.some((child: any) => 
              child.type === 'JSXElement' || child.type === 'JSXExpressionContainer'
            );
            if (hasNonTextChildren) canAcceptChildren = true;
          }
          
          if (path.node.openingElement.name.name === 'main' || 
              path.node.openingElement.name.name === 'section') {
            canAcceptChildren = true;
          }
        }
      });

      return {
        name: componentName || this.extractNameFromPath(filePath),
        path: relativePath,
        exports,
        canAcceptChildren,
        level
      };
    } catch (error) {
      this.streamUpdate(`⚠️ Failed to analyze component ${filePath}: ${error}`);
      return null;
    }
  }

  private async analyzeAppFile(appPath: string): Promise<any> {
    try {
      const content = await fs.readFile(appPath, 'utf8');
      const relativePath = appPath.replace(this.reactBasePath, '').replace(/\\/g, '/').replace(/^\//, '');
      
      const ast = parse(content, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      const importedPages: string[] = [];
      const existingRoutes: string[] = [];
      let hasRouting = false;

      traverse(ast, {
        ImportDeclaration(path: any) {
          const source = path.node.source.value;
          if (source.includes('./pages/') || source.includes('../pages/')) {
            const importedName = path.node.specifiers[0]?.local?.name;
            if (importedName) {
              importedPages.push(importedName);
            }
          }
          
          if (source.includes('react-router') || source.includes('router')) {
            hasRouting = true;
          }
        },
        JSXElement(path: any) {
          if (path.node.openingElement.name.name === 'Route') {
            const pathAttr = path.node.openingElement.attributes.find((attr: any) => 
              attr.name?.name === 'path'
            );
            if (pathAttr && pathAttr.value) {
              existingRoutes.push(pathAttr.value.value);
            }
            hasRouting = true;
          }
        }
      });

      return {
        path: relativePath,
        hasRouting,
        existingRoutes,
        importedPages
      };
    } catch (error) {
      this.streamUpdate(`⚠️ Failed to analyze App file ${appPath}: ${error}`);
      return {
        path: '',
        hasRouting: false,
        existingRoutes: [],
        importedPages: []
      };
    }
  }

  private async integrateWithApp(spec: ComponentSpec): Promise<string[]> {
    if (!this.fileStructureSummary?.appStructure.path) {
      this.streamUpdate(`⚠️ No App.jsx found for page integration`);
      return [];
    }

    this.streamUpdate(`🎯 Integrating with App.jsx for page: ${spec.name}`);
    
    const success = await this.updateAppFile(spec);
    
    if (success) {
      this.streamUpdate(`✅ Successfully integrated page ${spec.name} with App.jsx routing`);
      return [this.fileStructureSummary.appStructure.path];
    } else {
      this.streamUpdate(`❌ Failed to integrate page ${spec.name} with App.jsx`);
    }

    return [];
  }

  private async updateAppFile(spec: ComponentSpec): Promise<boolean> {
    try {
      const appPath = this.fileStructureSummary?.appStructure.path;
      if (!appPath) return false;

      const fullPath = join(this.reactBasePath, appPath);
      
      this.streamUpdate(`🔧 Updating App file at: ${fullPath}`);
      
      const content = await fs.readFile(fullPath, 'utf8');

      const existingRoutes = this.fileStructureSummary?.appStructure.existingRoutes.join(', ') || 'None';
      const hasRouting = this.fileStructureSummary?.appStructure.hasRouting || false;

      const updatePrompt = `
**TASK:** Update App.jsx to include routing for the new page "${spec.name}"

**CURRENT APP.JSX:**
\`\`\`tsx
${content}
\`\`\`

**NEW PAGE TO ADD:**
- Name: ${spec.name}
- Import: import ${spec.name} from './pages/${spec.name}';
- Route path: /${spec.name.toLowerCase()}
- User Request: "${spec.userRequest}"

**EXISTING ROUTES:** ${existingRoutes}
**HAS ROUTING:** ${hasRouting ? 'Yes' : 'No'}

**REQUIREMENTS:**
1. Add import statement for the new page
2. ${hasRouting ? 'Add new Route to existing Routes' : 'Set up React Router with BrowserRouter and Routes if not present'}
3. Create route: <Route path="/${spec.name.toLowerCase()}" element={<${spec.name} />} />
4. Keep all existing routes and functionality
5. If no routing exists, add: import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

**RESPONSE:** Return ONLY the complete updated App.jsx:

\`\`\`tsx
[UPDATED APP.JSX CODE]
\`\`\`
      `;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 4000,
        temperature: 0,
        messages: [{ role: 'user', content: updatePrompt }],
      });

      const firstBlock = response.content[0];
      if (firstBlock?.type === 'text') {
        const text = firstBlock.text;
        const codeMatch = text.match(/```(?:tsx|jsx|typescript|javascript)\n([\s\S]*?)```/);
        
        if (codeMatch) {
          const updatedContent = codeMatch[1].trim();
          await fs.writeFile(fullPath, updatedContent, 'utf8');
          this.streamUpdate(`✅ Successfully updated App.jsx`);
          return true;
        }
      }
      
      this.streamUpdate(`❌ Failed to parse App.jsx update response`);
      return false;
    } catch (error) {
      this.streamUpdate(`❌ Failed to update App.jsx: ${error}`);
      return false;
    }
  }

  private async updateProjectSummaryAfterCreation(spec: ComponentSpec, result: GenerationResult): Promise<void> {
    if (!this.projectSummary || !this.projectSummaryCallback) {
      this.streamUpdate('⚠️ No project summary or callback available for update');
      return;
    }

    this.streamUpdate('📝 Updating project summary with new component information...');

    const integrationDetails = result.integratedWithPages && result.integratedWithPages.length > 0 
      ? `\n- Integrated with pages: ${result.integratedWithPages.join(', ')}`
      : '';

    const updatePrompt = `
**TASK:** Update the existing project summary to include the newly created component/page

**EXISTING PROJECT SUMMARY:**
${this.projectSummary}

**NEW ${spec.type.toUpperCase()} DETAILS:**
- Name: ${spec.name}
- Type: ${spec.type}
- User Request: "${spec.userRequest}"
- Created File: ${result.generatedFile || 'N/A'}
- Updated Files: ${result.updatedFiles.join(', ') || 'None'}
- Integration Level: ${result.integrationPath}${integrationDetails}
- Success: ${result.success}

**REQUIREMENTS:**
1. Add the new ${spec.type} to the appropriate section of the summary
2. Update the list of available ${spec.type === 'component' ? 'components' : 'pages'}
3. Update the "Recent changes" section with this new addition
4. ${spec.type === 'component' && result.integratedWithPages ? 'Mention which pages now include this component' : ''}
5. Keep ALL existing information intact - only ADD new information
6. Maintain the same structure and format as the original summary

**RESPONSE:** Return ONLY the updated project summary text (no JSON, no code blocks, no explanations):

[COMPLETE UPDATED PROJECT SUMMARY]
    `;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 2500,
        temperature: 0,
        messages: [{ role: 'user', content: updatePrompt }],
      });

      const firstBlock = response.content[0];
      if (firstBlock?.type === 'text') {
        const updatedSummary = firstBlock.text.trim();
        
        const summaryId = await this.projectSummaryCallback(
          updatedSummary, 
          `Updated after creating ${spec.type}: ${spec.name} for "${spec.userRequest}"`
        );
        
        if (summaryId) {
          this.streamUpdate(`✅ Project summary updated successfully (ID: ${summaryId})`);
          this.projectSummary = updatedSummary;
        } else {
          this.streamUpdate('⚠️ Failed to save updated project summary to database');
        }
      } else {
        this.streamUpdate('❌ Failed to generate updated project summary');
      }
      
    } catch (error) {
      this.streamUpdate(`❌ Error updating project summary: ${error}`);
    }
  }

  private extractNameFromPath(filePath: string): string {
    const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || '';
    const nameWithoutExt = fileName.replace(/\.(jsx|tsx)$/, '');
    return nameWithoutExt.charAt(0).toUpperCase() + nameWithoutExt.slice(1);
  }

  /**
   * Public methods for external access
   */
  getFileStructureSummary(): FileStructureSummary | null {
    return this.fileStructureSummary;
  }

  async refreshFileStructure(): Promise<void> {
    await this.extractFileStructure();
  }

  async generateComponentWithUniqueNaming(spec: ComponentSpec): Promise<GenerationResult> {
    if (!this.fileStructureSummary) {
      await this.extractFileStructure();
    }
    
    const uniqueName = this.generateUniqueComponentName(spec.name, spec.type);
    
    const uniqueSpec = {
      ...spec,
      name: uniqueName
    };
    
    return this.generateComponent(uniqueSpec);
  }

  private isComponentNameTaken(name: string, type: 'component' | 'page'): boolean {
    if (!this.fileStructureSummary) return false;
    
    if (type === 'component') {
      return this.fileStructureSummary.components.some(c => c.name.toLowerCase() === name.toLowerCase());
    } else {
      return this.fileStructureSummary.pages.some(p => p.name.toLowerCase() === name.toLowerCase());
    }
  }

  private generateUniqueComponentName(baseName: string, type: 'component' | 'page'): string {
    let uniqueName = baseName;
    let counter = 1;
    
    while (this.isComponentNameTaken(uniqueName, type)) {
      uniqueName = `${baseName}${counter}`;
      counter++;
    }
    
    if (uniqueName !== baseName) {
      this.streamUpdate(`⚠️ ${baseName} already exists, using ${uniqueName} instead`);
    }
    
    return uniqueName;
  }

  /**
   * NEW: Get integration analytics for debugging
   */
  async getIntegrationAnalytics(): Promise<{
    totalComponents: number;
    totalPages: number;
    hasRouting: boolean;
    pagesWithElementTrees: number;
    averagePageComplexity: number;
  }> {
    const summary = this.fileStructureSummary;
    
    if (!summary) {
      await this.extractFileStructure();
      const refreshedSummary = this.fileStructureSummary;
      
      return {
        totalComponents: refreshedSummary?.components.length || 0,
        totalPages: refreshedSummary?.pages.length || 0,
        hasRouting: refreshedSummary?.appStructure.hasRouting || false,
        pagesWithElementTrees: refreshedSummary?.pages.filter(p => p.elementTree).length || 0,
        averagePageComplexity: 0
      };
    }
    
    const pagesWithTrees = summary.pages.filter(p => p.elementTree);
    const averageComplexity = pagesWithTrees.length > 0 
      ? pagesWithTrees.reduce((sum, page) => sum + (page.elementTree?.split('\n').length || 0), 0) / pagesWithTrees.length
      : 0;
    
    return {
      totalComponents: summary.components.length,
      totalPages: summary.pages.length,
      hasRouting: summary.appStructure.hasRouting,
      pagesWithElementTrees: pagesWithTrees.length,
      averagePageComplexity: Math.round(averageComplexity)
    };
  }

  /**
   * NEW: Force analyze specific page for integration testing
   */
  async forceAnalyzePageIntegration(
    pageName: string, 
    componentSpec: ComponentSpec
  ): Promise<PageIntegrationAnalysis | null> {
    if (!this.fileStructureSummary) {
      await this.extractFileStructure();
    }

    const page = this.fileStructureSummary?.pages.find(p => 
      p.name.toLowerCase() === pageName.toLowerCase()
    );

    if (!page) {
      this.streamUpdate(`❌ Page ${pageName} not found`);
      return null;
    }

    return await this.analyzePageIntegration(page, componentSpec);
  }
}