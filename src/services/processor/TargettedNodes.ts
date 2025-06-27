// ============================================================================
// ENHANCED TARGETED NODES PROCESSOR: processors/TargetedNodesProcessor.ts
// ============================================================================

import { promises as fs } from 'fs';
import { ProjectFile, ASTNode } from '../filemodifier/types';
import { ModificationSummary } from '../filemodifier/modification';
import { ASTAnalyzer } from './Astanalyzer';
import { TokenTracker } from '../../utils/TokenTracer';
import { StructureValidator } from '../../utils/Structurevalidator';
import { 
  targetedNodesPrompt, 
  replaceTemplateVariables, 
  prepareTargetedNodesVariables
} from '../filemodifier/template';

export class TargetedNodesProcessor {
  private anthropic: any;
  private tokenTracker: TokenTracker;
  private astAnalyzer: ASTAnalyzer;
  private structureValidator: StructureValidator;
  private streamCallback?: (message: string) => void;

  constructor(anthropic: any, tokenTracker: TokenTracker, astAnalyzer: ASTAnalyzer) {
    this.anthropic = anthropic;
    this.tokenTracker = tokenTracker;
    this.astAnalyzer = astAnalyzer;
    this.structureValidator = new StructureValidator();
  }

  setStreamCallback(callback: (message: string) => void): void {
    this.streamCallback = callback;
  }

  private streamUpdate(message: string): void {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
  }

  async handleTargetedModification(
    prompt: string, 
    projectFiles: Map<string, ProjectFile>, 
    modificationSummary: ModificationSummary
  ): Promise<boolean> {
    this.streamUpdate(`🎯 Starting ENHANCED TARGETED_NODES modification workflow with template prompts...`);
    
    let successCount = 0;
    const RELEVANCE_THRESHOLD = 70;
    const relevantFiles: Array<{ filePath: string; score: number; targetNodes: ASTNode[] }> = [];
    
    // Step 1: Analyze ALL files for relevant nodes
    for (const [filePath] of projectFiles) {
      const astNodes = this.astAnalyzer.parseFileWithAST(filePath, projectFiles);
      if (astNodes.length === 0) continue;
      
      const relevanceResult = await this.astAnalyzer.analyzeFileRelevance(
        prompt,
        filePath,
        astNodes,
        'TARGETED_NODES',
        projectFiles,
        this.anthropic,
        this.tokenTracker
      );
      
      if (relevanceResult.isRelevant && 
          relevanceResult.targetNodes && 
          relevanceResult.targetNodes.length > 0 &&
          relevanceResult.relevanceScore >= RELEVANCE_THRESHOLD) {
        
        relevantFiles.push({
          filePath,
          score: relevanceResult.relevanceScore,
          targetNodes: relevanceResult.targetNodes
        });
      }
    }
    
    // Step 2: Process ALL files that meet the threshold (sorted by score)
    relevantFiles.sort((a, b) => b.score - a.score);
    
    this.streamUpdate(`🎯 Processing ${relevantFiles.length} files with target elements using enhanced templates (score >= ${RELEVANCE_THRESHOLD})`);
    
    // Step 3: Apply modifications to ALL relevant files using templates
    for (const { filePath, targetNodes, score } of relevantFiles) {
      this.streamUpdate(`🎯 Processing ${filePath} (score: ${score}) with template prompts...`);
      
      const modifications = await this.modifyCodeSnippetsWithTemplate(prompt, targetNodes, filePath, projectFiles);
      
      if (modifications.size > 0) {
        const success = await this.applyModifications(filePath, targetNodes, modifications, projectFiles);
        if (success) {
          successCount++;
          modificationSummary.addChange('modified', filePath, `Enhanced AST targeted modifications: ${modifications.size} nodes updated with templates`);
          this.streamUpdate(`✅ Modified ${filePath} using templates (${modifications.size} nodes updated)`);
        }
      }
    }
    
    this.streamUpdate(`📊 ENHANCED TARGETED modification complete: ${successCount} files modified using template prompts`);
    
    const tokenStats = this.tokenTracker.getStats();
    this.streamUpdate(`💰 Session Total - ${tokenStats.totalTokens} tokens ($${tokenStats.estimatedCost.toFixed(4)})`);
    
    return successCount > 0;
  }

  private async modifyCodeSnippetsWithTemplate(
    prompt: string, 
    targetNodes: ASTNode[], 
    filePath: string, 
    projectFiles: Map<string, ProjectFile>
  ): Promise<Map<string, string>> {
    
    // Analyze file for template context
    const fileAnalysis = this.analyzeFileForTemplate(projectFiles.get(filePath));
    const projectSummary = this.generateProjectSummary(projectFiles);
    
    // Format target nodes for the template
    const targetNodesFormatted = targetNodes.map(node => 
      `**${node.id}:** (lines ${node.startLine}-${node.endLine})
\`\`\`jsx
${node.codeSnippet}
\`\`\`
`).join('\n\n');

    // Prepare template variables
    const templateVariables = prepareTargetedNodesVariables(
      prompt,
      filePath,
      fileAnalysis.componentName,
      fileAnalysis.componentPurpose,
      targetNodesFormatted,
      projectSummary
    );
    
    // Generate the enhanced prompt using template
    const enhancedPrompt = replaceTemplateVariables(targetedNodesPrompt, templateVariables);

    try {
      this.streamUpdate(`🚀 Using enhanced template for targeted nodes in ${filePath}...`);
      
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 6000,
        temperature: 0,
        messages: [{ role: 'user', content: enhancedPrompt }],
      });

      this.tokenTracker.logUsage(response.usage, `Enhanced Template Targeted Nodes: ${targetNodes.length} nodes in ${filePath}`);

      const firstBlock = response.content[0];
      if (firstBlock?.type === 'text') {
        const text = firstBlock.text;
        const jsonMatch = text.match(/```json\n([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          const jsonText = jsonMatch[1] || jsonMatch[0];
          const modifications = JSON.parse(jsonText);
          const modMap = new Map<string, string>();
          
          // Handle both old format and new template format with requiredImports
          for (const [nodeId, nodeData] of Object.entries(modifications)) {
            let modifiedCode: string;
            let requiredImports: string[] = [];
            
            if (typeof nodeData === 'string') {
              // Old format: direct string
              modifiedCode = nodeData;
            } else if (typeof nodeData === 'object' && nodeData !== null) {
              // New template format: object with modifiedCode and requiredImports
              const data = nodeData as any;
              modifiedCode = data.modifiedCode || '';
              requiredImports = data.requiredImports || [];
              
              // Log required imports for potential future use
              if (requiredImports.length > 0) {
                this.streamUpdate(`📦 Node ${nodeId} requires imports: ${requiredImports.join(', ')}`);
              }
            } else {
              continue;
            }
            
            if (modifiedCode && modifiedCode.trim()) {
              modMap.set(nodeId, modifiedCode);
            }
          }
          
          this.streamUpdate(`✅ Template processed ${modMap.size} modifications for ${filePath}`);
          return modMap;
        } else {
          this.streamUpdate(`⚠️ Could not parse JSON response from template for ${filePath}`);
        }
      }
      
      return new Map();
    } catch (error) {
      this.streamUpdate(`❌ Error modifying code snippets with template for ${filePath}: ${error}`);
      return new Map();
    }
  }

  private async applyModifications(
    filePath: string, 
    targetNodes: ASTNode[], 
    modifications: Map<string, string>, 
    projectFiles: Map<string, ProjectFile>
  ): Promise<boolean> {
    const file = projectFiles.get(filePath);
    if (!file) {
      return false;
    }

    const structure = this.structureValidator.extractFileStructure(file.content);
    let modifiedContent = file.content;
    const lines = modifiedContent.split('\n');
    
    // Sort nodes by line number (descending) to avoid offset issues
    const sortedNodes = targetNodes
      .filter(node => modifications.has(node.id))
      .sort((a, b) => b.startLine - a.startLine);
    
    this.streamUpdate(`🔧 Applying ${sortedNodes.length} template-generated modifications to ${filePath}...`);
    
    for (const node of sortedNodes) {
      const modifiedCode = modifications.get(node.id);
      if (modifiedCode) {
        const startIndex = node.startLine - 1;
        const endIndex = node.endLine - 1;
        const newLines = modifiedCode.split('\n');
        
        // Replace the original node lines with the modified code
        lines.splice(startIndex, endIndex - startIndex + 1, ...newLines);
        
        this.streamUpdate(`✅ Applied template modification to node ${node.id} (lines ${node.startLine}-${node.endLine})`);
      }
    }
    
    modifiedContent = lines.join('\n');
    
    // Validate structure preservation
    const validation = this.structureValidator.validateStructurePreservation(modifiedContent, structure);
    
    if (!validation.isValid) {
      this.streamUpdate(`⚠️ Structure validation failed for ${filePath}, attempting repair...`);
      
      const repairedContent = this.structureValidator.repairFileStructure(modifiedContent, structure, file.content);
      if (repairedContent) {
        modifiedContent = repairedContent;
        this.streamUpdate(`✅ Successfully repaired structure for ${filePath}`);
      } else {
        this.streamUpdate(`❌ Could not repair structure for ${filePath}`);
        return false;
      }
    }
    
    try {
      await fs.writeFile(file.path, modifiedContent, 'utf8');
      this.streamUpdate(`💾 Successfully saved template modifications to ${filePath}`);
      return true;
    } catch (error) {
      this.streamUpdate(`❌ Failed to save ${filePath}: ${error}`);
      return false;
    }
  }

  private analyzeFileForTemplate(file: ProjectFile | undefined): {
    componentName: string;
    componentPurpose: string;
  } {
    if (!file) {
      return {
        componentName: 'Unknown',
        componentPurpose: 'React component'
      };
    }
    
    const content = file.content;
    
    // Extract component name
    let componentName = 'Component';
    const componentMatch = content.match(/(?:export\s+(?:default\s+)?(?:function|const)\s+(\w+)|(?:function|const)\s+(\w+)\s*[=:])/);
    if (componentMatch) {
      componentName = componentMatch[1] || componentMatch[2];
    }
    
    // Determine component purpose based on content analysis
    let componentPurpose = 'React component';
    
    if (content.includes('useState') && content.includes('useEffect')) {
      componentPurpose = 'Interactive React component with state management and side effects';
    } else if (content.includes('useState')) {
      componentPurpose = 'Interactive React component with state management';
    } else if (content.includes('useEffect')) {
      componentPurpose = 'React component with side effects and lifecycle management';
    } else if (content.includes('Router') || content.includes('Route')) {
      componentPurpose = 'React routing component for navigation';
    } else if (content.includes('nav') || content.includes('Nav') || content.includes('header') || content.includes('Header')) {
      componentPurpose = 'Navigation or header component';
    } else if (content.includes('form') || content.includes('Form') || content.includes('input') || content.includes('Input')) {
      componentPurpose = 'Form or input component for user interaction';
    } else if (content.includes('card') || content.includes('Card') || content.includes('modal') || content.includes('Modal')) {
      componentPurpose = 'UI display component (card, modal, or layout element)';
    } else if (content.includes('button') || content.includes('Button')) {
      componentPurpose = 'Interactive button or action component';
    } else if (content.includes('list') || content.includes('List') || content.includes('map(')) {
      componentPurpose = 'List or data display component';
    } else if (file.path.includes('page') || file.path.includes('Page')) {
      componentPurpose = 'Full page component with multiple sections';
    } else if (file.path.includes('layout') || file.path.includes('Layout')) {
      componentPurpose = 'Layout wrapper component';
    }
    
    return {
      componentName,
      componentPurpose
    };
  }

  private generateProjectSummary(projectFiles: Map<string, ProjectFile>): string {
    const totalFiles = projectFiles.size;
    const componentFiles = Array.from(projectFiles.keys()).filter(path => 
      path.includes('.tsx') || path.includes('.jsx')
    ).length;
    
    const pageFiles = Array.from(projectFiles.keys()).filter(path => 
      path.toLowerCase().includes('page')
    ).length;
    
    const hasRouting = Array.from(projectFiles.values()).some(file => 
      file.content.includes('Router') || file.content.includes('Route')
    );
    
    const hasStateManagement = Array.from(projectFiles.values()).some(file => 
      file.content.includes('useState') || file.content.includes('useContext')
    );
    
    const keyFiles = Array.from(projectFiles.keys())
      .filter(path => 
        path.includes('App.') || 
        path.includes('index.') || 
        path.includes('main.') ||
        path.toLowerCase().includes('nav')
      )
      .slice(0, 5);
    
    let summary = `React TypeScript project with ${totalFiles} files (${componentFiles} components`;
    
    if (pageFiles > 0) {
      summary += `, ${pageFiles} pages`;
    }
    
    summary += `). `;
    
    if (hasRouting) {
      summary += `Features: React Router navigation, `;
    }
    
    if (hasStateManagement) {
      summary += `state management, `;
    }
    
    summary += `modern UI components. `;
    
    if (keyFiles.length > 0) {
      summary += `Key files: ${keyFiles.join(', ')}.`;
    }
    
    return summary;
  }

  // Helper method for legacy compatibility
  private async modifyCodeSnippets(prompt: string, targetNodes: ASTNode[]): Promise<Map<string, string>> {
    // This is kept for backward compatibility but now just calls the template version
    const snippetsInfo = targetNodes.map(node => 
      `**${node.id}:** (lines ${node.startLine}-${node.endLine})
\`\`\`jsx
${node.codeSnippet}
\`\`\`
`).join('\n\n');

    const claudePrompt = `
**USER REQUEST:** "${prompt}"

**Code Snippets to Modify:**
${snippetsInfo}

**TASK:** Modify each code snippet according to the request.

**RESPONSE FORMAT:** Return ONLY this JSON:
\`\`\`json
{
  "node_1": "<modified JSX code here>",
  "node_5": "<modified JSX code here>"
}
\`\`\`
    `;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 6000,
        temperature: 0,
        messages: [{ role: 'user', content: claudePrompt }],
      });

      this.tokenTracker.logUsage(response.usage, `Legacy Code Snippets Modification: ${targetNodes.length} nodes`);

      const firstBlock = response.content[0];
      if (firstBlock?.type === 'text') {
        const text = firstBlock.text;
        const jsonMatch = text.match(/```json\n([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          const jsonText = jsonMatch[1] || jsonMatch[0];
          const modifications = JSON.parse(jsonText);
          const modMap = new Map<string, string>();
          
          for (const [nodeId, modifiedCode] of Object.entries(modifications)) {
            if (typeof modifiedCode === 'string' && modifiedCode.trim()) {
              modMap.set(nodeId, modifiedCode as string);
            }
          }
          
          return modMap;
        }
      }
      
      return new Map();
    } catch (error) {
      this.streamUpdate(`❌ Error modifying code snippets (legacy): ${error}`);
      return new Map();
    }
  }
}