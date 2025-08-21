import streamlit as st
import asyncio
from typing import Optional
import json
from datetime import datetime

# Import MCP client components
from mcp import ListToolsResult
from mcp_agent.app import MCPApp
from mcp_agent.agents.agent import Agent
from mcp_agent.workflows.llm.augmented_llm_anthropic import AnthropicAugmentedLLM
from mcp_agent.human_input.types import (
    HumanInputRequest,
    HumanInputResponse,
)

# Page config
st.set_page_config(
    page_title="Brain Assistant",
    page_icon="🧠",
    layout="wide"
)

# Custom CSS
st.markdown("""
<style>
    .approval-box {
        background-color: #f0f2f6;
        padding: 20px;
        border-radius: 10px;
        margin: 10px 0;
    }
    .tool-call {
        background-color: #e8f4f8;
        padding: 10px;
        border-left: 4px solid #1f77b4;
        margin: 5px 0;
    }
    .stButton>button {
        width: 100%;
    }
</style>
""", unsafe_allow_html=True)

# Initialize session state
if "messages" not in st.session_state:
    st.session_state.messages = []
if "pending_approvals" not in st.session_state:
    st.session_state.pending_approvals = {}
if "tool_approval_default" not in st.session_state:
    st.session_state.tool_approval_default = True
if "current_project" not in st.session_state:
    st.session_state.current_project = None

async def handle_approval_request(request: HumanInputRequest) -> HumanInputResponse:
    """Handle approval requests from the Brain system"""
    request_id = request.request_id
    
    # Store the request
    st.session_state.pending_approvals[request_id] = {
        "request": request,
        "status": "pending",
        "timestamp": datetime.now()
    }
    
    # If auto-approve is on for non-destructive operations
    if st.session_state.tool_approval_default and not is_destructive_operation(request):
        st.session_state.pending_approvals[request_id]["status"] = "approved"
        return HumanInputResponse(request_id=request_id, response="Approved")
    
    # Wait for user input
    while st.session_state.pending_approvals[request_id]["status"] == "pending":
        await asyncio.sleep(0.1)
    
    status = st.session_state.pending_approvals[request_id]["status"]
    response = "Approved" if status == "approved" else "Denied"
    
    return HumanInputResponse(request_id=request_id, response=response)

def is_destructive_operation(request: HumanInputRequest) -> bool:
    """Check if an operation is destructive and needs explicit approval"""
    destructive_keywords = ['delete', 'remove', 'clear', 'execute', 'send']
    request_text = str(request).lower()
    return any(keyword in request_text for keyword in destructive_keywords)

# Initialize the MCP app
app = MCPApp(name="brain_assistant", human_input_callback=handle_approval_request)

async def get_brain_agent():
    """Get or create the Brain assistant agent"""
    if "agent" not in st.session_state:
        brain_agent = Agent(
            name="brain_assistant",
            instruction="""You are an intelligent assistant for the Brain knowledge management system.
            Help users manage their memories, notes, tasks, and projects using natural language.
            
            Key capabilities:
            - Store and search memories
            - Create and manage notes
            - Track tasks and projects
            - Execute workflows
            - Suggest appropriate tools
            
            Always:
            - Be helpful and concise
            - Confirm before destructive operations
            - Provide clear summaries
            - Learn from user patterns
            """,
            server_names=["brain", "brain-manager", "filesystem", "gmail", "brain-assistant"],
            connection_persistence=True,
            human_input_callback=handle_approval_request,
        )
        await brain_agent.initialize()
        st.session_state["agent"] = brain_agent
        
    if "llm" not in st.session_state:
        st.session_state["llm"] = await st.session_state["agent"].attach_llm(AnthropicAugmentedLLM)
    
    return st.session_state["agent"], st.session_state["llm"]

def format_tool_list(tools: ListToolsResult) -> str:
    """Format tool list for display"""
    categories = {
        "Memory": ["brain_remember", "brain_recall", "brain_status"],
        "Notes": ["obsidian_note", "unified_search"],
        "Tasks": ["todo_add", "todo_list", "todo_update"],
        "Email": ["gmail_search", "gmail_send", "gmail_extract"],
        "Files": ["read_file", "write_file", "create_directory"],
        "Assistant": ["brain_chat", "brain_workflow", "brain_suggest", "brain_batch"]
    }
    
    output = ""
    for category, tool_names in categories.items():
        output += f"### {category}\n"
        for tool in tools.tools:
            if tool.name in tool_names:
                output += f"- **{tool.name}**: {tool.description}\n"
        output += "\n"
    
    return output

async def main():
    await app.initialize()
    
    # Header
    st.title("🧠 Brain Assistant")
    st.markdown("Your intelligent knowledge management companion")
    
    # Sidebar
    with st.sidebar:
        st.header("Settings")
        
        # Project selector
        project = st.text_input("Current Project", value=st.session_state.current_project or "")
        if project != st.session_state.current_project:
            st.session_state.current_project = project
        
        # Approval settings
        st.subheader("Approval Settings")
        st.session_state.tool_approval_default = st.toggle(
            "Auto-approve safe operations",
            value=True,
            help="Automatically approve non-destructive operations"
        )
        
        # Quick actions
        st.subheader("Quick Actions")
        col1, col2 = st.columns(2)
        with col1:
            if st.button("📊 Status"):
                st.session_state.messages.append({
                    "role": "user",
                    "content": "Show me my Brain system status"
                })
                st.rerun()
        
        with col2:
            if st.button("📝 Daily Note"):
                st.session_state.messages.append({
                    "role": "user",
                    "content": "Create today's daily note"
                })
                st.rerun()
        
        # Tool reference
        with st.expander("🛠️ Available Tools"):
            agent, _ = await get_brain_agent()
            tools = await agent.list_tools()
            st.markdown(format_tool_list(tools))
    
    # Pending approvals
    if st.session_state.pending_approvals:
        pending = [req for req in st.session_state.pending_approvals.values() 
                  if req["status"] == "pending"]
        if pending:
            st.warning(f"⚠️ {len(pending)} operations pending approval")
            
            for request_id, req_data in st.session_state.pending_approvals.items():
                if req_data["status"] == "pending":
                    with st.container():
                        st.markdown(f"""
                        <div class="approval-box">
                        <h4>🔔 Approval Required</h4>
                        <p>{req_data["request"].message}</p>
                        </div>
                        """, unsafe_allow_html=True)
                        
                        col1, col2, col3 = st.columns([1, 1, 3])
                        with col1:
                            if st.button("✅ Approve", key=f"approve_{request_id}"):
                                st.session_state.pending_approvals[request_id]["status"] = "approved"
                                st.rerun()
                        with col2:
                            if st.button("❌ Deny", key=f"deny_{request_id}"):
                                st.session_state.pending_approvals[request_id]["status"] = "denied"
                                st.rerun()
    
    # Chat interface
    st.subheader("Chat")
    
    # Display messages
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            if message.get("tool_calls"):
                st.markdown(message["content"])
                for tool_call in message["tool_calls"]:
                    st.markdown(f"""
                    <div class="tool-call">
                    🔧 <b>{tool_call['tool']}</b><br>
                    <code>{json.dumps(tool_call['params'], indent=2)}</code>
                    </div>
                    """, unsafe_allow_html=True)
            else:
                st.markdown(message["content"])
    
    # Chat input
    if prompt := st.chat_input("Ask me anything about your Brain system..."):
        # Add user message
        st.session_state.messages.append({"role": "user", "content": prompt})
        
        with st.chat_message("user"):
            st.markdown(prompt)
        
        # Get response
        with st.chat_message("assistant"):
            with st.spinner("Thinking..."):
                agent, llm = await get_brain_agent()
                
                # Build context
                context = {
                    "currentProject": st.session_state.current_project,
                    "conversationId": "streamlit_session"
                }
                
                # Get response using brain_chat tool
                response = await llm.generate(
                    message=f"""Use the brain_chat tool to respond to: "{prompt}"
                    
                    Context: {json.dumps(context)}""",
                    use_history=True,
                    parallel_tool_calls=False,
                )
                
                # Extract and display response
                assistant_message = ""
                tool_calls = []
                
                for msg in response:
                    if msg.stop_reason == "tool_use":
                        for content in msg.content:
                            if content.type == "tool_use":
                                tool_calls.append({
                                    "tool": content.name,
                                    "params": content.input
                                })
                    else:
                        for content in msg.content:
                            assistant_message += content.text
                
                st.markdown(assistant_message)
                
                # Display tool calls if any
                if tool_calls:
                    for tool_call in tool_calls:
                        st.markdown(f"""
                        <div class="tool-call">
                        🔧 <b>{tool_call['tool']}</b><br>
                        <code>{json.dumps(tool_call['params'], indent=2)}</code>
                        </div>
                        """, unsafe_allow_html=True)
                
                # Add to message history
                st.session_state.messages.append({
                    "role": "assistant",
                    "content": assistant_message,
                    "tool_calls": tool_calls if tool_calls else None
                })
        
        st.rerun()

if __name__ == "__main__":
    asyncio.run(main())
