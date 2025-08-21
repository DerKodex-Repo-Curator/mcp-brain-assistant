#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const brain_assistant_js_1 = require("./brain-assistant.js");
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Tool schemas
const ChatSchema = zod_1.z.object({
    message: zod_1.z.string().describe('Natural language request or question about the Brain system'),
    context: zod_1.z.object({
        currentProject: zod_1.z.string().optional(),
        recentTools: zod_1.z.array(zod_1.z.string()).optional(),
        conversationId: zod_1.z.string().optional()
    }).optional().describe('Optional context for the conversation')
});
const ExecuteWorkflowSchema = zod_1.z.object({
    workflow: zod_1.z.string().describe('Natural language description of a workflow to execute'),
    requireApproval: zod_1.z.boolean().optional().default(true).describe('Whether to require approval for each step')
});
const SuggestToolsSchema = zod_1.z.object({
    task: zod_1.z.string().describe('Description of what you want to accomplish'),
    includeExamples: zod_1.z.boolean().optional().default(true)
});
const BatchOperationSchema = zod_1.z.object({
    operation: zod_1.z.string().describe('Natural language description of batch operation'),
    preview: zod_1.z.boolean().optional().default(true).describe('Preview changes before executing')
});
class BrainAssistantMcpServer {
    server;
    assistant;
    constructor() {
        this.server = new index_js_1.Server({ name: 'mcp-brain-assistant', version: '1.0.0' }, {
            capabilities: {
                tools: {},
                resources: {}
            }
        });
        this.assistant = new brain_assistant_js_1.BrainAssistant();
        this.setupHandlers();
    }
    setupHandlers() {
        // List available tools
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'brain_chat',
                    description: 'Chat naturally with the Brain system to manage memories, notes, and tasks',
                    inputSchema: ChatSchema
                },
                {
                    name: 'brain_workflow',
                    description: 'Execute complex workflows using natural language descriptions',
                    inputSchema: ExecuteWorkflowSchema
                },
                {
                    name: 'brain_suggest',
                    description: 'Get suggestions for which Brain tools to use for a specific task',
                    inputSchema: SuggestToolsSchema
                },
                {
                    name: 'brain_batch',
                    description: 'Perform batch operations on memories, notes, or tasks',
                    inputSchema: BatchOperationSchema
                }
            ]
        }));
        // Handle tool execution
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                switch (name) {
                    case 'brain_chat': {
                        const params = ChatSchema.parse(args);
                        const response = await this.assistant.chat(params.message, params.context);
                        return {
                            content: [{
                                    type: 'text',
                                    text: response.message
                                }],
                            // Include any tool calls made by the assistant
                            ...(response.toolCalls && {
                                toolCalls: response.toolCalls
                            })
                        };
                    }
                    case 'brain_workflow': {
                        const params = ExecuteWorkflowSchema.parse(args);
                        const result = await this.assistant.executeWorkflow(params.workflow, params.requireApproval);
                        return {
                            content: [{
                                    type: 'text',
                                    text: this.formatWorkflowResult(result)
                                }]
                        };
                    }
                    case 'brain_suggest': {
                        const params = SuggestToolsSchema.parse(args);
                        const suggestions = await this.assistant.suggestTools(params.task, params.includeExamples);
                        return {
                            content: [{
                                    type: 'text',
                                    text: this.formatSuggestions(suggestions)
                                }]
                        };
                    }
                    case 'brain_batch': {
                        const params = BatchOperationSchema.parse(args);
                        const result = await this.assistant.executeBatch(params.operation, params.preview);
                        return {
                            content: [{
                                    type: 'text',
                                    text: this.formatBatchResult(result)
                                }]
                        };
                    }
                    default:
                        throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Tool ${name} not found`);
                }
            }
            catch (error) {
                if (error instanceof zod_1.z.ZodError) {
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
                }
                throw error;
            }
        });
    }
    formatWorkflowResult(result) {
        let output = `🔄 Workflow Execution Complete\n\n`;
        output += `**Steps Executed**: ${result.steps.length}\n`;
        output += `**Status**: ${result.success ? '✅ Success' : '❌ Failed'}\n\n`;
        if (result.steps.length > 0) {
            output += `**Steps**:\n`;
            result.steps.forEach((step, i) => {
                output += `${i + 1}. ${step.description} - ${step.success ? '✅' : '❌'}\n`;
                if (step.output) {
                    output += `   Result: ${step.output}\n`;
                }
            });
        }
        if (result.summary) {
            output += `\n**Summary**: ${result.summary}`;
        }
        return output;
    }
    formatSuggestions(suggestions) {
        let output = `🛠️ Tool Suggestions\n\n`;
        suggestions.forEach((suggestion, i) => {
            output += `**${i + 1}. ${suggestion.tool}**\n`;
            output += `${suggestion.description}\n`;
            if (suggestion.example) {
                output += `Example: \`${suggestion.example}\`\n`;
            }
            output += '\n';
        });
        return output;
    }
    formatBatchResult(result) {
        let output = `📦 Batch Operation ${result.preview ? 'Preview' : 'Result'}\n\n`;
        output += `**Operation**: ${result.description}\n`;
        output += `**Items Affected**: ${result.count}\n\n`;
        if (result.preview) {
            output += `**Preview of Changes**:\n`;
            result.changes.slice(0, 5).forEach((change) => {
                output += `- ${change.description}\n`;
            });
            if (result.count > 5) {
                output += `... and ${result.count - 5} more\n`;
            }
            output += `\n⚠️ Use preview:false to execute these changes`;
        }
        else {
            output += `**Results**:\n`;
            output += `✅ Successfully processed ${result.success} items\n`;
            if (result.failed > 0) {
                output += `❌ Failed to process ${result.failed} items\n`;
            }
        }
        return output;
    }
    async start() {
        await this.assistant.initialize();
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
        console.error('Brain Assistant MCP Server started');
    }
}
// Start the server
const server = new BrainAssistantMcpServer();
server.start().catch(console.error);
//# sourceMappingURL=index.js.map