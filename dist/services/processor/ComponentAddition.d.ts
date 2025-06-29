import { ProjectFile, ModificationResult, ModificationScope } from '../filemodifier/types';
import { RedisModificationSummary } from '../filemodifier/modification';
import { ComponentGenerationSystem } from '../filemodifier/component';
import { TokenTracker } from '../../utils/TokenTracer';
export declare class ComponentAdditionProcessor {
    private anthropic;
    private reactBasePath;
    private tokenTracker;
    private streamCallback?;
    constructor(anthropic: any, reactBasePath: string, tokenTracker: TokenTracker);
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    handleComponentAddition(prompt: string, scope: ModificationScope, projectFiles: Map<string, ProjectFile>, modificationSummary: RedisModificationSummary, componentGenerationSystem: ComponentGenerationSystem, projectSummaryCallback?: (summary: string, prompt: string) => Promise<string | null>): Promise<ModificationResult>;
    private extractComponentName;
    private fallbackExtractComponentName;
    private determineComponentTypeFromPrompt;
    private updateAppWithPages;
    private extractFileStructure;
    private validateStructurePreservation;
}
