# Brain Assistant MCP Server

A natural language interface for the Brain knowledge management system. Talk to your Brain system like you would talk to a helpful assistant.

## 🧠 What is Brain Assistant?

Brain Assistant provides a conversational interface to all Brain system tools, allowing you to:
- Use natural language instead of JSON commands
- Execute complex workflows with simple requests
- Get intelligent suggestions for tools to use
- Batch operations with preview and approval
- Maintain conversation context across interactions

## 🚀 Features

### Natural Language Commands
Instead of:
```json
brain_remember { "key": "meeting_notes_2024", "value": "..." }
```

Just say:
```
"Remember that we discussed API redesign in today's meeting"
```

### Intelligent Workflows
```
"Create a summary of this week's work and email it to me"
```
The assistant will:
1. Search relevant memories and notes
2. Generate a summary
3. Create a formatted email
4. Send it (with your approval)

### Smart Suggestions
```
"I need to organize my project notes"
```
Get suggestions for:
- Which tools to use
- Example commands
- Best practices

### Batch Operations
```
"Archive all memories older than 6 months except the important ones"
```
- Preview changes before executing
- Intelligent filtering
- Safety checks

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/[your-username]/mcp-brain-assistant.git
cd mcp-brain-assistant

# Install dependencies
npm install

# Build the project
npm run build
```

## 🔧 Configuration

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "brain-assistant": {
      "command": "node",
      "args": ["/path/to/mcp-brain-assistant/dist/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## 🎯 Usage

### Basic Chat
```
brain_chat {
  "message": "What did I work on yesterday?",
  "context": {
    "currentProject": "api-redesign"
  }
}
```

### Execute Workflows
```
brain_workflow {
  "workflow": "Prepare weekly status report with tasks completed and blockers",
  "requireApproval": true
}
```

### Get Tool Suggestions
```
brain_suggest {
  "task": "I want to track my daily habits",
  "includeExamples": true
}
```

### Batch Operations
```
brain_batch {
  "operation": "Tag all notes about machine learning with #ml tag",
  "preview": true
}
```

## 🖥️ Streamlit UI

Run the interactive UI:

```bash
npm run streamlit
```

Features:
- Chat interface with message history
- Visual approval system for operations
- Quick action buttons
- Tool reference panel
- Project context management

## 💡 Example Conversations

### Morning Routine
```
You: "Good morning! What's on my plate today?"
Assistant: *Checks tasks, calendar, and recent work*
"Good morning! Here's your day:
- 3 high-priority tasks in the API project
- Meeting notes from yesterday need review
- 2 pending emails about the design spec
Would you like me to create today's daily note?"
```

### Project Context Switch
```
You: "Switch to the mobile app project"
Assistant: *Loads project context*
"Switched to mobile app project. Last worked on: 3 days ago
- Status: In development
- Next milestone: Authentication implementation
- 5 open tasks
Would you like to see the task list?"
```

### Smart Search
```
You: "Find everything about the authentication bug"
Assistant: *Searches across memories, notes, and emails*
"Found 12 items about the authentication bug:
- 3 memories with debugging notes
- 2 Obsidian notes with solutions
- 5 emails discussing the issue
- 2 tasks related to the fix
The main issue was token expiration. Solution implemented on July 20."
```

## 🤝 Human Approval System

The assistant requires approval for:
- Sending emails
- Deleting content
- Executing code
- Batch modifications

Auto-approval available for:
- Read operations
- Creating drafts
- Non-destructive searches
- Status checks

## 🧩 Integration with Brain Tools

The assistant seamlessly integrates with:
- **brain** - Core memory and execution
- **brain-manager** - Project management
- **filesystem** - File operations
- **todo-manager** - Task tracking
- **obsidian** - Note management
- Claude's built-in tools (web search, gmail, etc.)

## 🔐 Security

- All operations respect Brain system permissions
- Approval required for sensitive operations
- Conversation history stored locally
- No data sent to external services (except Anthropic for NLP)

## 🚧 Roadmap

- [ ] Voice input support
- [ ] Scheduled workflows
- [ ] Learning from user patterns
- [ ] Multi-user support
- [ ] Mobile app
- [ ] Webhook integrations

## 🤔 Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

Transform your Brain system from a powerful tool into an intelligent companion! 🧠✨
