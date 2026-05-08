"""
Egytronic API Server
"""

import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
import uvicorn


class ChatRequest(BaseModel):
    prompt: str
    model: str = "gemini"
    api_key: Optional[str] = None
    model_name: str = "gemini-2.0-flash"
    tools: Optional[List[str]] = None
    temperature: float = 0.7
    max_tokens: int = 4096


class ChatResponse(BaseModel):
    response: str
    model: str
    tools_used: Optional[List[str]] = None


class ToolRequest(BaseModel):
    tool: str
    action: str
    params: Dict[str, Any] = {}


app = FastAPI(title="Egytronic API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Egytronic API", "version": "1.0.0"}


@app.get("/health")
async def health():
    """Health check"""
    return {"status": "healthy"}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Chat with agent"""
    from ..agent import Agent
    from ..tools import get_tool_by_name
    
    try:
        # Create tools
        tools = []
        if request.tools:
            for tool_name in request.tools:
                tool = get_tool_by_name(tool_name)
                if tool:
                    tools.append(tool)
        
        # Create agent
        agent = Agent(
            model=request.model,
            api_key=request.api_key,
            model_name=request.model_name,
            tools=tools,
            temperature=request.temperature,
            max_tokens=request.max_tokens
        )
        
        # Run agent
        response = agent.run_sync(request.prompt)
        
        return ChatResponse(
            response=response,
            model=request.model,
            tools_used=request.tools
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tool")
async def execute_tool(request: ToolRequest):
    """Execute tool directly"""
    from ..tools import get_tool_by_name
    
    try:
        tool = get_tool_by_name(request.tool)
        if not tool:
            raise HTTPException(status_code=404, detail=f"Tool not found: {request.tool}")
        
        result = await tool.execute(action=request.action, **request.params)
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/tools")
async def list_tools():
    """List available tools"""
    from ..tools import get_tool_by_name
    tools = [
        "browser", "browser_bridge", "file_system", "terminal",
        "mcp", "playwright", "whatsapp", "telegram",
        "github", "npm", "pip", "pacman", "vm", "api", "cloud"
    ]
    return {"tools": tools}


def run_server(model: str = "gemini", api_key: str = None, port: int = 8080):
    """Run API server"""
    uvicorn.run(app, host="0.0.0.0", port=port)