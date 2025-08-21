import Anthropic from '@anthropic-ai/sdk';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';

interface ChatContext {
  currentProject?: string;
  recentTools?: string[];
  conversationId?: string;
}

interface ChatResponse {
  message: string;
  toolCalls?: any[];
}

interface WorkflowStep {
  description: string;
  tool: string;
  params: any;
  requiresApproval: boolean;
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

export class BrainAssistant {
  private anthropic: Anthropic;
  private server: Server;
  private conversationHistory: Map<string, any[]> = new Map();

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    });
    
    this.server = new Server(
      {
        name: 'brain-assistant',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );
  }

  async initialize() {
    // Initialize MCP connections to Brain tools
    const brainTools = ['brain', 'brain-manager', 'filesystem', 'gmail'];
    
    for (const tool of brainTools) {
      try {
        // In real implementation, connect to MCP servers
        console.error(`Initializing connection to ${tool}`);
      } catch (error) {
        console.error(`Failed to connect to ${tool}:`, error);
      }
    }
  }

  async chat(message: string, context?: ChatContext): Promise<ChatResponse> {
    const conversationId = context?.conversationId || 'default';
    const history = this.conversationHistory.get(conversationId) || [];
    
    // Build the prompt with context
    const systemPrompt = this.buildSystemPrompt(context);
    
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          ...history,
          { role: 'user', content: message }
        ]
      });

      // Parse the response and extract any tool calls
      const firstContent = response.content[0];
      const assistantMessage = firstContent.type === 'text' ? firstContent.text : JSON.stringify(firstContent);
      const toolCalls = this.extractToolCalls(assistantMessage);
      
      // Execute tool calls if any
      let finalResponse = assistantMessage;
      if (toolCalls.length > 0) {
        const results = await this.executeToolCalls(toolCalls);
        finalResponse = this.formatResponseWithResults(assistantMessage, results);
      }
      
      // Update conversation history
      history.push(
        { role: 'user', content: message },
        { role: 'assistant', content: finalResponse }
      );
      this.conversationHistory.set(conversationId, history.slice(-20)); // Keep last 20 messages
      
      return {
        message: finalResponse,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined
      };
    } catch (error: unknown) {
      console.error('Chat error:', error);
      return {
        message: 'I encountered an error while processing your request. Please try again.'
      };
    }
  }

  async executeWorkflow(workflow: string, requireApproval: boolean): Promise<WorkflowResult> {
    // Parse the workflow into steps
    const steps = await this.parseWorkflow(workflow);
    const results: WorkflowResult = {
      steps: [],
      success: true
    };
    
    for (const step of steps) {
      if (requireApproval && step.requiresApproval) {
        // In real implementation, would request approval
        console.error(`[APPROVAL NEEDED] ${step.description}`);
      }
      
      try {
        // Execute the step
        const output = await this.executeToolCall(step.tool, step.params);
        results.steps.push({
          description: step.description,
          success: true,
          output
        });
      } catch (error) {
        results.steps.push({
          description: step.description,
          success: false,
          output: error instanceof Error ? error.message : String(error)
        });
        results.success = false;
        break; // Stop on first failure
      }
    }
    
    results.summary = this.generateWorkflowSummary(results);
    return results;
  }

  async suggestTools(task: string, includeExamples: boolean): Promise<ToolSuggestion[]> {
    // Analyze the task and suggest appropriate tools
    const suggestions: ToolSuggestion[] = [];
    
    // Simple keyword-based suggestions (in production, use NLP)
    if (task.toLowerCase().includes('remember') || task.toLowerCase().includes('store')) {
      suggestions.push({
        tool: 'brain_remember',
        description: 'Store information in Brain memory',
        example: includeExamples ? 'brain_remember { "key": "project_idea", "value": "..." }' : undefined
      });
    }
    
    if (task.toLowerCase().includes('search') || task.toLowerCase().includes('find')) {
      suggestions.push({
        tool: 'brain_recall',
        description: 'Search through Brain memories',
        example: includeExamples ? 'brain_recall { "query": "project" }' : undefined
      });
      
      suggestions.push({
        tool: 'unified_search',
        description: 'Search across memories and notes',
        example: includeExamples ? 'unified_search { "query": "api design" }' : undefined
      });
    }
    
    if (task.toLowerCase().includes('note') || task.toLowerCase().includes('document')) {
      suggestions.push({
        tool: 'obsidian_note',
        description: 'Create or manage Obsidian notes',
        example: includeExamples ? 'obsidian_note { "action": "create", "title": "Meeting Notes" }' : undefined
      });
    }
    
    if (task.toLowerCase().includes('email')) {
      suggestions.push({
        tool: 'gmail_search',
        description: 'Search emails in Gmail',
        example: includeExamples ? 'gmail_search { "query": "from:boss" }' : undefined
      });
    }
    
    if (task.toLowerCase().includes('task') || task.toLowerCase().includes('todo')) {
      suggestions.push({
        tool: 'todo_add',
        description: 'Add a task to your todo list',
        example: includeExamples ? 'todo_add { "project": "api", "title": "Write tests" }' : undefined
      });
    }
    
    return suggestions;
  }

  async executeBatch(operation: string, preview: boolean): Promise<BatchResult> {
    // Parse the batch operation
    const parsed = await this.parseBatchOperation(operation);
    
    if (preview) {
      // Return preview of what would happen
      return {
        description: parsed.description,
        count: parsed.items.length,
        preview: true,
        changes: parsed.items.slice(0, 10).map((item: any) => ({
          description: `Would ${parsed.action} ${item.description}`
        }))
      };
    } else {
      // Execute the batch operation
      let success = 0;
      let failed = 0;
      
      for (const item of parsed.items as any[]) {
        try {
          await this.executeToolCall(item.tool, item.params);
          success++;
        } catch (error: unknown) {
          failed++;
        }
      }
      
      return {
        description: parsed.description,
        count: parsed.items.length,
        preview: false,
        success,
        failed
      };
    }
  }

  private buildSystemPrompt(context?: ChatContext): string {
    let prompt = `You are an intelligent assistant for the Brain knowledge management system.
    
Your role is to help users interact with their Brain system using natural language.
You have access to various tools for managing memories, notes, tasks, and more.

Available tool categories:
- Memory management (brain_remember, brain_recall)
- Note management (obsidian_note, unified_search)
- Task management (todo_add, todo_list, todo_update)
- File operations (read_file, write_file)
- Email integration (gmail_search, gmail_send)
- Code execution (brain_execute)

Guidelines:
1. Interpret user requests and suggest appropriate tools
2. Always confirm before destructive operations
3. Provide helpful summaries of operations
4. Learn from user patterns and preferences
5. Be concise but informative`;

    if (context?.currentProject) {
      prompt += `\n\nCurrent project: ${context.currentProject}`;
    }
    
    if (context?.recentTools && context.recentTools.length > 0) {
      prompt += `\n\nRecently used tools: ${context.recentTools.join(', ')}`;
    }
    
    return prompt;
  }

  private extractToolCalls(response: string): any[] {
    // Extract tool calls from the assistant's response
    // In production, this would parse actual tool call syntax
    const toolCalls = [];
    const toolPattern = /(\w+)\s*\{([^}]+)\}/g;
    const matches = response.matchAll(toolPattern);
    
    for (const match of matches) {
      try {
        const paramString = `{${match[2]}}`;
        const params = this.safeJsonParse(paramString, {});
        toolCalls.push({
          tool: match[1],
          params: params
        });
      } catch (e) {
        // Invalid JSON, skip
        console.warn(`Failed to parse tool call for ${match[1]}:`, e.message);
      }
    }
    
    return toolCalls;
  }

  private safeJsonParse(jsonString: string, fallback: any = null): any {
    try {
      // First attempt: direct parse
      return JSON.parse(jsonString);
    } catch (error) {
      try {
        // Second attempt: clean emojis and retry
        const cleanString = jsonString.replace(
          /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]/gu,
          ''
        );
        return JSON.parse(cleanString);
      } catch (secondError) {
        console.error('JSON parse failed:', {
          original: (error as Error).message,
          afterCleaning: (secondError as Error).message,
          input: jsonString.substring(0, 100) + '...'
        });
        return fallback;
      }
    }
  }

  private safeJsonStringify(obj: any, space: number | null = null): string {
    try {
      return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'string') {
          // Convert emojis to Unicode escape sequences for JSON safety
          return value.replace(
            /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]/gu,
            (match) => {
              const codePoint = match.codePointAt(0);
              return `\\u{${codePoint?.toString(16)}}`;
            }
          );
        }
        return value;
      }, space);
    } catch (error) {
      console.error('JSON stringify error:', error);
      return JSON.stringify({ 
        error: 'Serialization failed', 
        message: (error as Error).message,
        type: typeof obj
      });
    }
  }

  private async executeToolCalls(toolCalls: any[]): Promise<any[]> {
    const results = [];
    
    for (const call of toolCalls) {
      try {
        const result = await this.executeToolCall(call.tool, call.params);
        results.push({ success: true, result });
      } catch (error: unknown) {
        results.push({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
    
    return results;
  }

  private async executeToolCall(tool: string, params: any): Promise<string> {
    // In real implementation, this would call the actual MCP tools
    console.error(`Executing tool: ${tool}`, params);
    
    // Simulate tool execution
    return `Executed ${tool} successfully`;
  }

  private formatResponseWithResults(message: string, results: any[]): string {
    let formatted = message + '\n\n';
    
    if (results.length > 0) {
      formatted += '**Tool Results:**\n';
      results.forEach((result, i) => {
        if (result.success) {
          formatted += `(ok) ${result.result}\n`;
        } else {
          formatted += `(error) Error: ${result.error}\n`;
        }
      });
    }
    
    return formatted;
  }

  private async parseWorkflow(workflow: string): Promise<WorkflowStep[]> {
    // In production, use NLP to parse natural language workflows
    // For now, return a simple example
    return [
      {
        description: 'Search for related memories',
        tool: 'brain_recall',
        params: { query: 'workflow' },
        requiresApproval: false
      },
      {
        description: 'Create summary note',
        tool: 'obsidian_note',
        params: { action: 'create', title: 'Workflow Summary' },
        requiresApproval: true
      }
    ];
  }

  private generateWorkflowSummary(result: WorkflowResult): string {
    const successful = result.steps.filter(s => s.success).length;
    const failed = result.steps.filter(s => !s.success).length;
    
    if (failed === 0) {
      return `Successfully completed all ${successful} steps`;
    } else {
      return `Completed ${successful} steps, ${failed} failed`;
    }
  }

  private async parseBatchOperation(operation: string): Promise<any> {
    // Parse natural language batch operations
    // In production, use NLP
    return {
      description: 'Archive old memories',
      action: 'archive',
      items: [
        { description: 'memory_1', tool: 'brain_remember', params: {} },
        { description: 'memory_2', tool: 'brain_remember', params: {} }
      ]
    };
  }
}

// MCP Server setup
const brainAssistant = new BrainAssistant();

const server = new Server(
  {
    name: 'brain-assistant',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'brain_chat',
        description: 'Natural language interface to Brain system',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Your message or question',
            },
            context: {
              type: 'object',
              description: 'Optional context (currentProject, recentTools, conversationId)',
              properties: {
                currentProject: { type: 'string' },
                recentTools: { type: 'array', items: { type: 'string' } },
                conversationId: { type: 'string' }
              }
            }
          },
          required: ['message'],
        },
      },
      {
        name: 'brain_suggest_tools',
        description: 'Get tool suggestions for a task',
        inputSchema: {
          type: 'object',
          properties: {
            task: {
              type: 'string',
              description: 'Description of what you want to accomplish',
            },
            includeExamples: {
              type: 'boolean',
              description: 'Include usage examples',
              default: false
            }
          },
          required: ['task'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'brain_chat': {
        const { message, context } = args as { message: string; context?: ChatContext };
        const response = await brainAssistant.chat(message, context);
        return {
          content: [
            {
              type: 'text',
              text: this.safeJsonStringify(response, 2),
            },
          ],
        };
      }

      case 'brain_suggest_tools': {
        const { task, includeExamples } = args as { task: string; includeExamples?: boolean };
        const suggestions = await brainAssistant.suggestTools(task, includeExamples || false);
        return {
          content: [
            {
              type: 'text',
              text: this.safeJsonStringify(suggestions, 2),
            },
          ],
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`,
        );
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Error executing tool: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
});

async function main() {
  try {
    await brainAssistant.initialize();
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    console.error('Server failed to start:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
