import Anthropic from '@anthropic-ai/sdk';
import { ModificationScope } from './types';
export declare class ScopeAnalyzer {
    private anthropic;
    private streamCallback?;
    constructor(anthropic: Anthropic);
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    /**
     * Main scope analysis with improved decision logic
     */
    analyzeScope(prompt: string, projectSummary: string, conversationContext?: string, dbSummary?: string): Promise<ModificationScope>;
    /**
     * Heuristic analysis to guide AI decision
     */
    private performHeuristicAnalysis;
    /**
     * AI CALL: Determine which modification method to use - IMPROVED APPROACH
     */
    private determineModificationMethod;
    /**
     * Parse method determination response - IMPROVED with better fallback
     */
    private parseMethodResponse;
    /**
     * Extract component name from prompt (for COMPONENT_ADDITION)
     */
    private extractComponentName;
    /**
     * Determine component type (for COMPONENT_ADDITION)
     */
    private determineComponentType;
    shouldUseFallbackSearch(prompt: string, initialFiles: string[]): Promise<boolean>;
    determineModificationIntensity(prompt: string): 'FULL_FILE' | 'TARGETED_NODES';
    identifyDependencies(componentType: 'component' | 'page' | 'app', componentName: string, existingFiles: string[]): string[];
    validateScope(scope: ModificationScope, projectFiles: string[]): ModificationScope;
    generateReasoningText(prompt: string, scope: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION', files: string[], componentInfo?: {
        name?: string;
        type?: string;
    }): string;
}
