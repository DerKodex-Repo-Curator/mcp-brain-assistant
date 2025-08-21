interface ChatContext {
    currentProject?: string;
    recentTools?: string[];
    conversationId?: string;
}
interface ChatResponse {
    message: string;
    toolCalls?: any[];
}
interface WorkflowResult {
    steps: Array<{
        description: string;
        success: boolean;
        output?: string;
    }>;
    success: boolean;
    summary?: string;
}
interface ToolSuggestion {
    tool: string;
    description: string;
    example?: string;
}
interface BatchResult {
    description: string;
    count: number;
    preview: boolean;
    changes?: any[];
    success?: number;
    failed?: number;
}
export declare class BrainAssistant {
    private anthropic;
    private server;
    private conversationHistory;
    constructor();
    initialize(): Promise<void>;
    chat(message: string, context?: ChatContext): Promise<ChatResponse>;
    executeWorkflow(workflow: string, requireApproval: boolean): Promise<WorkflowResult>;
    suggestTools(task: string, includeExamples: boolean): Promise<ToolSuggestion[]>;
    executeBatch(operation: string, preview: boolean): Promise<BatchResult>;
    private buildSystemPrompt;
    private extractToolCalls;
    private executeToolCalls;
    private executeToolCall;
    private formatResponseWithResults;
    private parseWorkflow;
    private generateWorkflowSummary;
    private parseBatchOperation;
}
export {};
//# sourceMappingURL=brain-assistant.d.ts.map