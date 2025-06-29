import Anthropic from '@anthropic-ai/sdk';
import { ModificationResult } from './filemodifier/types';
export declare class StatelessIntelligentFileModifier {
    private anthropic;
    private reactBasePath;
    private sessionId;
    private streamCallback?;
    private redis;
    private scopeAnalyzer;
    private componentGenerationSystem;
    private dependencyManager;
    private fallbackMechanism;
    private astAnalyzer;
    private projectAnalyzer;
    private fullFileProcessor;
    private targetedNodesProcessor;
    private componentAdditionProcessor;
    private tokenTracker;
    constructor(anthropic: Anthropic, reactBasePath: string, sessionId: string, redisUrl?: string);
    private initializeComponents;
    private setupStreamCallbacks;
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    initializeSession(): Promise<void>;
    private verifyDirectoryStructure;
    buildProjectTree(): Promise<void>;
    private getProjectFiles;
    private setProjectFiles;
    private getModificationSummary;
    private getModificationContextualSummary;
    private getMostModifiedFiles;
    private handleComponentAddition;
    private handleFullFileModification;
    private handleTargetedModification;
    processModification(prompt: string, conversationContext?: string, dbSummary?: string, projectSummaryCallback?: (summary: string, prompt: string) => Promise<string | null>): Promise<ModificationResult>;
    /**
     * Write Redis cached changes back to actual files
     */
    writeChangesToFiles(): Promise<void>;
    /**
     * Resolve file path to current build directory
     */
    private resolveCurrentFilePath;
    cleanup(): Promise<void>;
}
