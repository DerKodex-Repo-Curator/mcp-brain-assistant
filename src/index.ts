#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { BrainAssistant } from './brain-assistant.js';
import { z } from 'zod';
import dotenv from 'dotenv';

// Safe JSON helper to handle emojis and special characters
function safeJsonStringify(obj, space) {
  try {
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'string') {
        // Replace problematic Unicode characters
        return value.replace(/[😀-🙏]|[🌀-🗿]|[🚀-🛿]|[🇠-🇿]|[☀-⛿]|[✀-➿]|[🤀-🧿]/gu, (match) => {
          const codePoint = match.codePointAt(0);
          return `\\u{${codePoint.toString(16)}}`;
        });
      }
      return value;
    }, space);
  } catch (error) {
    console.error('JSON stringify error:', error);
    return JSON.stringify({ error: 'Serialization failed', message: error.message });
  }
}



dotenv.config();

// Tool schemas
const ChatSchema = z.object({
  message: z.string().describe('Natural language request or question about the Brain system'),
  context: z.object({
    currentProject: z.string().optional(),
    recentTools: z.array(z.string()).optional(),
    conversationId: z.string().optional()
  }).optional().describe('Optional context for the conversation')
});

const ExecuteWorkflowSchema = z.object({
  workflow: z.string().describe('Natural language description of a workflow to execute'),
  requireApproval: z.boolean().optional().default(true).describe('Whether to require approval for each step')
});

const SuggestToolsSchema = z.object({
  task: z.string().describe('Description of what you want to accomplish'),
  includeExamples: z.boolean().optional().default(true)
});

const BatchOperationSchema = z.object({
  operation: z.string().describe('Natural language description of batch operation'),
  preview: z.boolean().optional().default(true).describe('Preview changes before executing')
});

class BrainAssistantMcpServer {
  private server: Server;
  private assistant: BrainAssistant;

  constructor() {
    this.server = new Server(
      { name: 'mcp-brain-assistant', version: '1.0.0' },
      { 
        capabilities: { 
          tools: {},
          resources: {}
        } 
      }
    );
    this.assistant = new BrainAssistant();
    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
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
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
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
            const result = await this.assistant.executeWorkflow(
              params.workflow,
              params.requireApproval
            );
            return {
              content: [{
                type: 'text',
                text: this.formatWorkflowResult(result)
              }]
            };
          }

          case 'brain_suggest': {
            const params = SuggestToolsSchema.parse(args);
            const suggestions = await this.assistant.suggestTools(
              params.task,
              params.includeExamples
            );
            return {
              content: [{
                type: 'text',
                text: this.formatSuggestions(suggestions)
              }]
            };
          }

          case 'brain_batch': {
            const params = BatchOperationSchema.parse(args);
            const result = await this.assistant.executeBatch(
              params.operation,
              params.preview
            );
            return {
              content: [{
                type: 'text',
                text: this.formatBatchResult(result)
              }]
            };
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Tool ${name} not found`
            );
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`
          );
        }
        throw error;
      }
    });
  }

  private formatWorkflowResult(result: any): string {
    let output = `(workflow) Workflow Execution Complete\n\n`;
    
    output += `**Steps Executed**: ${result.steps.length}\n`;
    output += `**Status**: ${result.success ? '(ok) Success' : '(error) Failed'}\n\n`;
    
    if (result.steps.length > 0) {
      output += `**Steps**:\n`;
      result.steps.forEach((step: any, i: number) => {
        output += `${i + 1}. ${step.description} - ${step.success ? '(ok)' : '(error)'}\n`;
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

  private formatSuggestions(suggestions: any): string {
    let output = `(tools) Tool Suggestions\n\n`;
    
    suggestions.forEach((suggestion: any, i: number) => {
      output += `**${i + 1}. ${suggestion.tool}**\n`;
      output += `${suggestion.description}\n`;
      
      if (suggestion.example) {
        output += `Example: \`${suggestion.example}\`\n`;
      }
      
      output += '\n';
    });
    
    return output;
  }

  private formatBatchResult(result: any): string {
    let output = `(batch) Batch Operation ${result.preview ? 'Preview' : 'Result'}\n\n`;
    
    output += `**Operation**: ${result.description}\n`;
    output += `**Items Affected**: ${result.count}\n\n`;
    
    if (result.preview) {
      output += `**Preview of Changes**:\n`;
      result.changes.slice(0, 5).forEach((change: any) => {
        output += `- ${change.description}\n`;
      });
      
      if (result.count > 5) {
        output += `... and ${result.count - 5} more\n`;
      }
      
      output += `\n(warn) Use preview:false to execute these changes`;
    } else {
      output += `**Results**:\n`;
      output += `(ok) Successfully processed ${result.success} items\n`;
      if (result.failed > 0) {
        output += `(error) Failed to process ${result.failed} items\n`;
      }
    }
    
    return output;
  }

  async start() {
    await this.assistant.initialize();
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error('Brain Assistant MCP Server started');
  }
}

// Start the server
const server = new BrainAssistantMcpServer();
server.start().catch(console.error);
