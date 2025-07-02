"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScopeAnalyzer = void 0;
class ScopeAnalyzer {
    constructor(anthropic) {
        this.anthropic = anthropic;
    }
    setStreamCallback(callback) {
        this.streamCallback = callback;
    }
    streamUpdate(message) {
        if (this.streamCallback) {
            this.streamCallback(message);
        }
    }
    /**
     * Main scope analysis with improved decision logic
     */
    analyzeScope(prompt, projectSummary, conversationContext, dbSummary) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('🤖 Starting improved AI-based method determination...');
            // First do a quick heuristic check
            const heuristicResult = this.performHeuristicAnalysis(prompt);
            this.streamUpdate(`💡 Heuristic analysis suggests: ${heuristicResult.suggestedScope} (confidence: ${heuristicResult.confidence}%)`);
            // AI CALL: Determine modification method with improved prompt
            const method = yield this.determineModificationMethod(prompt, dbSummary || projectSummary, conversationContext, heuristicResult);
            const finalScope = Object.assign({ scope: method.scope, files: [], reasoning: method.reasoning }, (method.scope === "COMPONENT_ADDITION" && {
                componentName: this.extractComponentName(prompt),
                componentType: this.determineComponentType(prompt),
                dependencies: [] // Dependencies will be determined later
            }));
            this.streamUpdate(`✅ Final method determination: ${finalScope.scope}`);
            return finalScope;
        });
    }
    /**
     * Heuristic analysis to guide AI decision
     */
    performHeuristicAnalysis(prompt) {
        const promptLower = prompt.toLowerCase();
        // Strong indicators for COMPONENT_ADDITION
        const componentAdditionKeywords = [
            'create', 'add new', 'build new', 'make new', 'new component',
            'new page', 'new feature', 'add a', 'build a', 'create a'
        ];
        // Strong indicators for TARGETED_NODES
        const targetedKeywords = [
            'change button', 'make button', 'button color', 'button text',
            'change text', 'update text', 'modify text', 'text to',
            'change color', 'make red', 'make blue', 'make green',
            'change label', 'update label', 'modify label',
            'one button', 'single button', 'this button', 'the button',
            'specific', 'only', 'just change', 'just update'
        ];
        // Strong indicators for FULL_FILE
        const fullFileKeywords = [
            'redesign', 'overhaul', 'complete', 'entire', 'whole',
            'layout', 'theme', 'styling', 'responsive', 'mobile',
            'restructure', 'rearrange', 'organize', 'reorder',
            'multiple', 'several', 'all buttons', 'all text',
            'dark mode', 'light mode', 'header', 'footer', 'navigation'
        ];
        let targetedScore = 0;
        let fullFileScore = 0;
        let componentScore = 0;
        // Score each category
        for (const keyword of componentAdditionKeywords) {
            if (promptLower.includes(keyword)) {
                componentScore += 20;
            }
        }
        for (const keyword of targetedKeywords) {
            if (promptLower.includes(keyword)) {
                targetedScore += 15;
            }
        }
        for (const keyword of fullFileKeywords) {
            if (promptLower.includes(keyword)) {
                fullFileScore += 10;
            }
        }
        // Additional scoring logic
        const wordCount = prompt.split(' ').length;
        if (wordCount <= 5) {
            targetedScore += 20; // Short requests are usually targeted
        }
        else if (wordCount > 15) {
            fullFileScore += 10; // Long requests often need full file changes
        }
        // Check for specific patterns
        if (promptLower.match(/\b(one|single|specific|this|that)\s+(button|text|color|element)/)) {
            targetedScore += 25;
        }
        if (promptLower.match(/\b(all|every|multiple|several)\s+(button|text|element)/)) {
            fullFileScore += 20;
        }
        // Determine winner
        const maxScore = Math.max(targetedScore, fullFileScore, componentScore);
        let suggestedScope;
        let confidence;
        let reasoning;
        if (componentScore === maxScore && componentScore > 0) {
            suggestedScope = "COMPONENT_ADDITION";
            confidence = Math.min(95, componentScore);
            reasoning = "Keywords suggest creating new component/page";
        }
        else if (targetedScore === maxScore && targetedScore > 0) {
            suggestedScope = "TARGETED_NODES";
            confidence = Math.min(95, targetedScore);
            reasoning = "Keywords suggest specific element modification";
        }
        else {
            suggestedScope = "FULL_FILE";
            confidence = Math.min(95, Math.max(50, fullFileScore)); // Minimum 50% for fallback
            reasoning = fullFileScore > 0 ? "Keywords suggest comprehensive changes" : "Default for unclear requests";
        }
        return { suggestedScope, confidence, reasoning };
    }
    /**
     * AI CALL: Determine which modification method to use - IMPROVED APPROACH
     */
    determineModificationMethod(prompt, projectSummary, conversationContext, heuristicResult) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const methodPrompt = `
**USER REQUEST:** "${prompt}"

**PROJECT SUMMARY:**
${projectSummary}

${conversationContext ? `**CONVERSATION CONTEXT:**\n${conversationContext}\n` : ''}

${heuristicResult ? `**HEURISTIC ANALYSIS:**\nSuggested: ${heuristicResult.suggestedScope} (${heuristicResult.confidence}% confidence)\nReason: ${heuristicResult.reasoning}\n` : ''}

**TASK:** Choose the MOST SPECIFIC modification method that can fulfill this request.

**METHOD OPTIONS (in order of preference - choose the most specific that applies):**

1. TARGETED_NODES – For specific existing element changes:
✅ CHOOSE THIS IF the request targets:
A specific existing element like a button, text, color, image, or style.
Modifying a single UI component or element (not adding).
Requests with words like:
“change the button color”
“make this text bold”
“update heading font”
“replace the image”
“make title larger”
“change button style”
Paragraph or text content changes.
Requests related to modifying existing components.
🚫 DO NOT CHOOSE THIS if:
The request says “add a new button”, “add”, “create”, “build”.
The intent is to introduce a new UI element that doesn’t already exist.
❌ Examples:
"add a new button to the header" → ❌ Not TARGETED_NODES
"change the submit button color" → ✅ TARGETED_NODES
"make the login button red" → ✅ TARGETED_NODES
"replace the welcome text" → ✅ TARGETED_NODES
"make title bold and centered" → ✅ TARGETED_NODES

2. COMPONENT_ADDITION – For creating new UI elements or features or pages:
✅ CHOOSE THIS IF the request involves:
Adding new components, pages, or UI elements.
Creating something that doesn’t exist yet.
Phrases like:
“add a button”
“create a card”
“make a new page”
"make about page"
“add new section/component/header”
“build user profile component”
✅ Includes:
Adding new buttons (e.g., “add a new button to all pages”).
Creating entire sections, layout blocks, or UI structures.
✅ Examples:
"add a new login button" → ✅ COMPONENT_ADDITION
"create a contact form component" → ✅ COMPONENT_ADDITION
"add a testimonial card to the homepage" → ✅ COMPONENT_ADDITION


❌ Examples: "create a contact page", "add new user dashboard", "build login component"

**3. FULL_FILE** - For comprehensive changes (LAST RESORT):
✅ CHOOSE THIS ONLY IF the request requires:
-a specific button
- Multiple related changes across a file
- Layout restructuring or major design changes
- Theme changes affecting multiple elements
- Changes that impact file structure or organization
-add a paragraph "nanajn"
-add a image ""
❌ Examples: "redesign the header", "add dark mode", "restructure the layout" , "change a icon"
"changes in mock data" "mock data addition"
**DECISION PRIORITY:**
1. If it's about ONE specific thing → TARGETED_NODES
2. If it's creating something NEW → COMPONENT_ADDITION  
3. If it needs MULTIPLE changes → FULL_FILE

**CRITICAL:** Be conservative with FULL_FILE. Only use it when TARGETED_NODES genuinely cannot handle the request.

**EXAMPLES:**
- "make signin button red" → TARGETED_NODES (specific button change)
- "change welcome text to hello" → TARGETED_NODES (specific text change)
- "create contact page" → COMPONENT_ADDITION (new page)
- "add dark mode theme" → FULL_FILE (affects multiple elements)
- "update header layout and add navigation" → FULL_FILE (multiple changes)

**RESPOND WITH JSON:**
\`\`\`json
{
  "scope": "TARGETED_NODES",
  "reasoning": "This request targets a specific [button/text/element] which can be modified precisely without affecting the entire file structure."
}
\`\`\`
    `.trim();
            try {
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 400,
                    temperature: 0,
                    messages: [{ role: 'user', content: methodPrompt }],
                });
                const text = ((_a = response.content[0]) === null || _a === void 0 ? void 0 : _a.type) === 'text' ? response.content[0].text : '';
                return this.parseMethodResponse(text, heuristicResult);
            }
            catch (error) {
                this.streamUpdate(`❌ Method determination failed: ${error}`);
                // Use heuristic result as fallback instead of always defaulting to FULL_FILE
                const fallbackScope = (heuristicResult === null || heuristicResult === void 0 ? void 0 : heuristicResult.suggestedScope) || "FULL_FILE";
                return {
                    scope: fallbackScope,
                    reasoning: `API error - using heuristic fallback: ${(heuristicResult === null || heuristicResult === void 0 ? void 0 : heuristicResult.reasoning) || "Default to FULL_FILE"}`
                };
            }
        });
    }
    /**
     * Parse method determination response - IMPROVED with better fallback
     */
    parseMethodResponse(text, heuristicResult) {
        try {
            const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            const response = JSON.parse(jsonMatch[1]);
            const validScopes = ["FULL_FILE", "TARGETED_NODES", "COMPONENT_ADDITION"];
            if (!validScopes.includes(response.scope)) {
                throw new Error(`Invalid scope: ${response.scope}`);
            }
            // Validate that the AI choice makes sense
            if (heuristicResult && heuristicResult.confidence > 80) {
                // If heuristic is very confident and AI disagrees, log this
                if (response.scope !== heuristicResult.suggestedScope) {
                    this.streamUpdate(`⚠️ AI choice (${response.scope}) differs from high-confidence heuristic (${heuristicResult.suggestedScope})`);
                }
            }
            return {
                scope: response.scope,
                reasoning: response.reasoning || "AI-determined method without detailed reasoning"
            };
        }
        catch (error) {
            this.streamUpdate(`⚠️ Method parsing failed: ${error}`);
            // Improved fallback: use heuristic result if available
            if (heuristicResult && heuristicResult.confidence > 60) {
                this.streamUpdate(`🔄 Using heuristic fallback: ${heuristicResult.suggestedScope}`);
                return {
                    scope: heuristicResult.suggestedScope,
                    reasoning: `Parsing failed, using heuristic: ${heuristicResult.reasoning}`
                };
            }
            // Last resort fallback with better logic
            return {
                scope: "TARGETED_NODES", // Default to most specific, not most comprehensive
                reasoning: "Parsing failed, defaulting to TARGETED_NODES for safer, more precise modifications"
            };
        }
    }
    /**
     * Extract component name from prompt (for COMPONENT_ADDITION)
     */
    extractComponentName(prompt) {
        const patterns = [
            /(?:add|create|build|make|new)\s+(?:a\s+)?([A-Z][a-zA-Z]+)/i,
            /([A-Z][a-zA-Z]+)\s+(?:component|page)/i,
            /(?:component|page)\s+(?:called|named)\s+([A-Z][a-zA-Z]+)/i
        ];
        for (const pattern of patterns) {
            const match = prompt.match(pattern);
            if (match && match[1]) {
                const name = match[1].trim();
                return name.charAt(0).toUpperCase() + name.slice(1);
            }
        }
        return 'NewComponent'; // Default name
    }
    /**
     * Determine component type (for COMPONENT_ADDITION)
     */
    determineComponentType(prompt) {
        const promptLower = prompt.toLowerCase();
        if (promptLower.includes('page') || promptLower.includes('route') || promptLower.includes('screen')) {
            return 'page';
        }
        if (promptLower.includes('app') || promptLower.includes('main') || promptLower.includes('application')) {
            return 'app';
        }
        return 'component';
    }
    // Legacy methods for backward compatibility - improved logic
    shouldUseFallbackSearch(prompt, initialFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            return false;
        });
    }
    determineModificationIntensity(prompt) {
        const heuristic = this.performHeuristicAnalysis(prompt);
        return heuristic.suggestedScope === 'TARGETED_NODES' ? 'TARGETED_NODES' : 'FULL_FILE';
    }
    identifyDependencies(componentType, componentName, existingFiles) {
        if (componentType === 'page') {
            return existingFiles.filter(f => f.includes('App.tsx') || f.includes('App.jsx'));
        }
        return [];
    }
    validateScope(scope, projectFiles) {
        return Object.assign(Object.assign({}, scope), { files: [] });
    }
    generateReasoningText(prompt, scope, files, componentInfo) {
        const baseReasoning = `Method determination: ${scope} approach selected for request: "${prompt}"`;
        if (scope === 'COMPONENT_ADDITION' && componentInfo) {
            return `${baseReasoning}. Will create new ${componentInfo.type}: ${componentInfo.name}`;
        }
        return `${baseReasoning}. File analysis and element tree generation will determine specific targets.`;
    }
}
exports.ScopeAnalyzer = ScopeAnalyzer;
//# sourceMappingURL=scopeanalyzer.js.map