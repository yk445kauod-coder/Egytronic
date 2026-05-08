"""
Egytronic Tools - MCP Tool
"""

import json
from typing import Any, Dict, List, Optional
from egytronic.tools.base import BaseTool, register_tool


class MCPTool(BaseTool):
    """
    MCP (Model Context Protocol) Tool
    
    Connect to MCP servers and execute tools.
    """
    
    name = "mcp"
    description = "Connect to MCP servers and execute tools"
    
    def __init__(
        self,
        server_url: str = "http://localhost:3000",
        **kwargs
    ):
        super().__init__(**kwargs)
        self.server_url = server_url
        self._tools = None
    
    async def _discover_tools(self):
        """Discover available tools from MCP server"""
        import aiohttp
        
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{self.server_url}/tools") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    self._tools = data.get("tools", [])
    
    async def execute(
        self,
        action: str = "list",
        tool_name: str = "",
        tool_args: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> Any:
        """
        Execute MCP action
        
        Actions:
        - list: List available tools
        - call: Call a tool
        - call_tool: Call a specific tool (alias)
        """
        import aiohttp
        
        action = action.lower()
        tool_args = tool_args or {}
        
        if action == "list":
            await self._discover_tools()
            return self._tools or []
        
        elif action == "call" or action == "call_tool":
            if not tool_name:
                raise ValueError("tool_name required")
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.server_url}/tools/{tool_name}",
                    json=tool_args
                ) as resp:
                    if resp.status != 200:
                        error = await resp.text()
                        raise Exception(f"MCP error: {error}")
                    return await resp.json()
        
        else:
            raise ValueError(f"Unknown action: {action}")
    
    def _get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["list", "call", "call_tool"],
                    "description": "MCP action"
                },
                "tool_name": {"type": "string", "description": "Tool name to call"},
                "tool_args": {"type": "object", "description": "Tool arguments"}
            },
            "required": ["action"]
        }


register_tool("mcp", MCPTool)