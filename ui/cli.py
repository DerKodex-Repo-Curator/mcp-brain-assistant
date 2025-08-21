#!/usr/bin/env python3
"""
Terminal UI for Brain Assistant
A simple command-line interface for natural language interaction with the Brain system
"""

import asyncio
import json
import sys
from datetime import datetime
from typing import Optional
import readline  # For better input handling

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.table import Table
    from rich.markdown import Markdown
    from rich.prompt import Prompt, Confirm
    from rich.live import Live
    from rich.spinner import Spinner
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False
    print("Install 'rich' for a better experience: pip install rich")

class BrainAssistantCLI:
    def __init__(self):
        self.console = Console() if RICH_AVAILABLE else None
        self.conversation_history = []
        self.current_project = None
        self.auto_approve = False
        
    def print(self, message: str, style: str = None):
        """Print with rich formatting if available"""
        if self.console and style:
            self.console.print(message, style=style)
        else:
            print(message)
    
    def print_welcome(self):
        """Display welcome message"""
        welcome = """
╭─────────────────────────────────────╮
│      🧠 Brain Assistant CLI         │
│                                     │
│  Your intelligent knowledge companion│
╰─────────────────────────────────────╯
        """
        if self.console:
            self.console.print(Panel(welcome, expand=False))
        else:
            print(welcome)
        
        self.print("\nType 'help' for commands, 'exit' to quit\n", "dim")
    
    def print_help(self):
        """Display help information"""
        help_text = """
## Available Commands

**Chat Commands:**
- Just type naturally to interact with your Brain system
- Examples:
  - "What did I work on yesterday?"
  - "Create a note about today's meeting"
  - "Show me all tasks for the API project"

**Special Commands:**
- `/project [name]` - Set current project context
- `/workflow [description]` - Execute a complex workflow
- `/suggest [task]` - Get tool suggestions
- `/batch [operation]` - Run batch operations
- `/approve` - Toggle auto-approval
- `/history` - Show conversation history
- `/clear` - Clear conversation history
- `/help` - Show this help
- `/exit` - Exit the assistant

**Quick Actions:**
- `/status` - Show Brain system status
- `/tasks` - List current tasks
- `/recent` - Show recent memories
- `/search [query]` - Quick search
        """
        
        if self.console:
            self.console.print(Markdown(help_text))
        else:
            print(help_text)
    
    async def handle_command(self, command: str) -> bool:
        """Handle special commands. Returns True if should continue, False to exit"""
        if command.startswith('/'):
            parts = command.split(' ', 1)
            cmd = parts[0].lower()
            args = parts[1] if len(parts) > 1 else ""
            
            if cmd == '/exit':
                return False
            elif cmd == '/help':
                self.print_help()
            elif cmd == '/project':
                self.current_project = args if args else None
                self.print(f"Project set to: {self.current_project or 'None'}", "green")
            elif cmd == '/approve':
                self.auto_approve = not self.auto_approve
                self.print(f"Auto-approval: {'ON' if self.auto_approve else 'OFF'}", "yellow")
            elif cmd == '/history':
                self.show_history()
            elif cmd == '/clear':
                self.conversation_history.clear()
                self.print("Conversation history cleared", "yellow")
            elif cmd == '/status':
                await self.show_status()
            elif cmd == '/tasks':
                await self.show_tasks()
            elif cmd == '/recent':
                await self.show_recent()
            elif cmd == '/search':
                if args:
                    await self.quick_search(args)
                else:
                    self.print("Usage: /search [query]", "red")
            elif cmd == '/workflow':
                if args:
                    await self.execute_workflow(args)
                else:
                    self.print("Usage: /workflow [description]", "red")
            elif cmd == '/suggest':
                if args:
                    await self.get_suggestions(args)
                else:
                    self.print("Usage: /suggest [task description]", "red")
            elif cmd == '/batch':
                if args:
                    await self.batch_operation(args)
                else:
                    self.print("Usage: /batch [operation description]", "red")
            else:
                self.print(f"Unknown command: {cmd}", "red")
        else:
            # Regular chat message
            await self.chat(command)
        
        return True
    
    def show_history(self):
        """Display conversation history"""
        if not self.conversation_history:
            self.print("No conversation history", "dim")
            return
        
        if self.console:
            table = Table(title="Conversation History")
            table.add_column("Time", style="dim")
            table.add_column("Role", style="cyan")
            table.add_column("Message")
            
            for entry in self.conversation_history[-10:]:  # Last 10 entries
                table.add_row(
                    entry['timestamp'],
                    entry['role'],
                    entry['message'][:80] + "..." if len(entry['message']) > 80 else entry['message']
                )
            
            self.console.print(table)
        else:
            print("\n=== Conversation History ===")
            for entry in self.conversation_history[-10:]:
                print(f"[{entry['timestamp']}] {entry['role']}: {entry['message']}")
    
    async def chat(self, message: str):
        """Send a chat message to the Brain assistant"""
        # Add to history
        self.conversation_history.append({
            'timestamp': datetime.now().strftime('%H:%M:%S'),
            'role': 'user',
            'message': message
        })
        
        # Show thinking indicator
        if self.console:
            with Live(Spinner('dots', text='Thinking...'), refresh_per_second=4):
                response = await self.call_brain_assistant(message)
        else:
            print("Thinking...")
            response = await self.call_brain_assistant(message)
        
        # Display response
        if self.console:
            self.console.print(Panel(response, title="Assistant", border_style="green"))
        else:
            print(f"\nAssistant: {response}\n")
        
        # Add to history
        self.conversation_history.append({
            'timestamp': datetime.now().strftime('%H:%M:%S'),
            'role': 'assistant',
            'message': response
        })
    
    async def call_brain_assistant(self, message: str) -> str:
        """Call the Brain assistant MCP server"""
        # In a real implementation, this would call the MCP server
        # For now, return a simulated response
        return f"I understand you want to: '{message}'. In a real implementation, I would process this using the Brain system tools."
    
    async def show_status(self):
        """Show Brain system status"""
        self.print("\n📊 Brain System Status", "bold")
        # Would call brain_status tool
        self.print("Memories: 523", "green")
        self.print("Projects: 12", "green")
        self.print("Active tasks: 8", "yellow")
        self.print("Notes: 147", "green")
    
    async def show_tasks(self):
        """Show current tasks"""
        self.print("\n📋 Current Tasks", "bold")
        # Would call todo_list tool
        tasks = [
            ("High", "Complete API documentation", "api-project"),
            ("Medium", "Review pull requests", "general"),
            ("High", "Fix authentication bug", "api-project"),
        ]
        
        if self.console:
            table = Table()
            table.add_column("Priority", style="cyan")
            table.add_column("Task")
            table.add_column("Project", style="dim")
            
            for priority, task, project in tasks:
                style = "red" if priority == "High" else "yellow" if priority == "Medium" else "green"
                table.add_row(priority, task, project, style=style)
            
            self.console.print(table)
        else:
            for priority, task, project in tasks:
                print(f"[{priority}] {task} ({project})")
    
    async def show_recent(self):
        """Show recent memories"""
        self.print("\n🕐 Recent Memories", "bold")
        # Would call brain_recall with recent filter
        self.print("- API design decisions (2 hours ago)", "dim")
        self.print("- Meeting notes: Team standup (5 hours ago)", "dim")
        self.print("- Bug fix: Authentication timeout (yesterday)", "dim")
    
    async def quick_search(self, query: str):
        """Perform a quick search"""
        self.print(f"\n🔍 Searching for: {query}", "bold")
        # Would call unified_search
        await asyncio.sleep(1)  # Simulate search
        self.print(f"Found 7 results for '{query}'", "green")
        self.print("- Memory: API endpoint documentation", "dim")
        self.print("- Note: Authentication flow diagram", "dim")
        self.print("- Task: Research {query} alternatives", "dim")
    
    async def execute_workflow(self, description: str):
        """Execute a workflow"""
        self.print(f"\n🔄 Executing workflow: {description}", "bold")
        
        steps = [
            "Analyzing request...",
            "Gathering relevant information...",
            "Executing step 1: Search related memories",
            "Executing step 2: Create summary note",
            "Executing step 3: Update project status"
        ]
        
        for step in steps:
            self.print(f"  → {step}", "dim")
            await asyncio.sleep(0.5)
        
        self.print("✅ Workflow completed successfully!", "green")
    
    async def get_suggestions(self, task: str):
        """Get tool suggestions"""
        self.print(f"\n💡 Suggestions for: {task}", "bold")
        # Would call brain_suggest
        suggestions = [
            ("brain_remember", "Store this information for later", "brain_remember { \"key\": \"...\", \"value\": \"...\" }"),
            ("obsidian_note", "Create a detailed note", "obsidian_note { \"action\": \"create\", \"title\": \"...\" }"),
            ("todo_add", "Add this as a task", "todo_add { \"project\": \"...\", \"title\": \"...\" }")
        ]
        
        for tool, desc, example in suggestions:
            self.print(f"\n• {tool}", "cyan")
            self.print(f"  {desc}", "dim")
            if example:
                self.print(f"  Example: {example}", "dim italic")
    
    async def batch_operation(self, operation: str):
        """Execute a batch operation"""
        self.print(f"\n📦 Batch Operation: {operation}", "bold")
        
        # Simulate preview
        self.print("\nPreview of changes:", "yellow")
        self.print("  - Would archive 15 old memories", "dim")
        self.print("  - Would update 8 note tags", "dim")
        self.print("  - Would complete 3 old tasks", "dim")
        
        if RICH_AVAILABLE:
            proceed = Confirm.ask("\nProceed with batch operation?")
        else:
            proceed = input("\nProceed with batch operation? (y/n): ").lower() == 'y'
        
        if proceed:
            self.print("\nExecuting batch operation...", "yellow")
            await asyncio.sleep(2)
            self.print("✅ Batch operation completed!", "green")
        else:
            self.print("❌ Batch operation cancelled", "red")
    
    async def run(self):
        """Main loop"""
        self.print_welcome()
        
        while True:
            try:
                # Get input
                if RICH_AVAILABLE:
                    prompt = f"[{self.current_project or 'no-project'}]> "
                    user_input = Prompt.ask(prompt)
                else:
                    prompt = f"[{self.current_project or 'no-project'}]> "
                    user_input = input(prompt)
                
                if not user_input.strip():
                    continue
                
                # Handle command
                should_continue = await self.handle_command(user_input.strip())
                if not should_continue:
                    break
                    
            except KeyboardInterrupt:
                self.print("\n\nUse '/exit' to quit", "yellow")
            except Exception as e:
                self.print(f"\n❌ Error: {str(e)}", "red")
        
        self.print("\n👋 Goodbye! Your Brain system is always here when you need it.\n", "green")

async def main():
    """Entry point"""
    cli = BrainAssistantCLI()
    await cli.run()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nGoodbye!")
        sys.exit(0)
