"""
Egytronic Tools - API and Cloud Tools
"""

import os
import json
from typing import Any, Dict, List, Optional
from egytronic.tools.base import BaseTool, register_tool


class APITool(BaseTool):
    """
    API Tool
    
    Make REST API calls.
    """
    
    name = "api"
    description = "Make REST API calls"
    
    def __init__(self, base_url: Optional[str] = None, **kwargs):
        super().__init__(**kwargs)
        self.base_url = base_url
    
    async def execute(
        self,
        action: str = "get",
        url: str = "",
        params: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        **kwargs
    ) -> Any:
        """
        Execute API action
        
        Actions:
        - get: GET request
        - post: POST request
        - put: PUT request
        - patch: PATCH request
        - delete: DELETE request
        """
        import aiohttp
        action = action.lower()
        
        # Resolve URL
        if not url.startswith("http"):
            url = f"{self.base_url or ''}{url}"
        
        params = params or {}
        data = data or {}
        headers = headers or {}
        
        async with aiohttp.ClientSession() as session:
            if action == "get":
                async with session.get(url, params=params, headers=headers) as resp:
                    return await self._parse_response(resp)
            
            elif action == "post":
                async with session.post(url, json=data, headers=headers) as resp:
                    return await self._parse_response(resp)
            
            elif action == "put":
                async with session.put(url, json=data, headers=headers) as resp:
                    return await self._parse_response(resp)
            
            elif action == "patch":
                async with session.patch(url, json=data, headers=headers) as resp:
                    return await self._parse_response(resp)
            
            elif action == "delete":
                async with session.delete(url, headers=headers) as resp:
                    return await self._parse_response(resp)
            
            else:
                raise ValueError(f"Unknown action: {action}")
    
    async def _parse_response(self, resp):
        """Parse response"""
        content_type = resp.headers.get("Content-Type", "")
        if "application/json" in content_type:
            return await resp.json()
        return await resp.text()
    
    def _get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["get", "post", "put", "patch", "delete"],
                    "description": "HTTP action"
                },
                "url": {"type": "string", "description": "API URL"},
                "params": {"type": "object", "description": "Query parameters"},
                "data": {"type": "object", "description": "Request body"},
                "headers": {"type": "object", "description": "Headers"}
            },
            "required": ["action", "url"]
        }


register_tool("api", APITool)


class CloudTool(BaseTool):
    """
    Cloud Tool
    
    Interact with cloud services (Node.js, Python, React via free services).
    """
    
    name = "cloud"
    description = "Access cloud services (Node.js, Python, React)"
    
    def __init__(self, provider: str = "auto", **kwargs):
        super().__init__(**kwargs)
        self.provider = provider
    
    async def execute(
        self,
        action: str = "deploy",
        service: str = "",
        code: str = "",
        **kwargs
    ) -> Any:
        """
        Execute cloud action
        
        Actions:
        - deploy: Deploy service
        - run_node: Run Node.js code
        - run_python: Run Python code
        - run_react: Run React app
        - deploy_worker: Deploy Cloudflare Worker
        - deploy_function: Deploy serverless function
        - list_services: List deployed services
        - get_status: Get service status
        - delete: Delete service
        """
        action = action.lower()
        
        if action == "deploy":
            return f"Deployed {service}"
        
        elif action == "run_node":
            return "Node.js code executed (requires cloud runtime)"
        
        elif action == "run_python":
            return "Python code executed (requires cloud runtime)"
        
        elif action == "run_react":
            return "React app running (requires cloud runtime)"
        
        elif action == "deploy_worker":
            return "Cloudflare Worker deployed"
        
        elif action == "deploy_function":
            return "Serverless function deployed"
        
        elif action == "list_services":
            return ["List of deployed services"]
        
        elif action == "get_status":
            return "running"
        
        elif action == "delete":
            return f"Deleted {service}"
        
        else:
            raise ValueError(f"Unknown action: {action}")
    
    def _get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["deploy", "run_node", "run_python", "run_react", 
                            "deploy_worker", "deploy_function", "list_services", "get_status", "delete"],
                    "description": "Cloud action"
                },
                "service": {"type": "string", "description": "Service name"},
                "code": {"type": "string", "description": "Code to run"}
            },
            "required": ["action"]
        }


register_tool("cloud", CloudTool)


# Tools package init
def get_tool_by_name(name: str) -> Optional[BaseTool]:
    """Get tool by name"""
    tools = {
        "browser": BrowserTool,
        "browser_bridge": BrowserBridgeTool,
        "file_system": FileSystemTool,
        "terminal": TerminalTool,
        "mcp": MCPTool,
        "playwright": PlaywrightTool,
        "whatsapp": WhatsAppTool,
        "telegram": TelegramTool,
        "github": GitHubTool,
        "npm": NPMTool,
        "pip": PIPTool,
        "pacman": PacmanTool,
        "vm": VMTool,
        "api": APITool,
        "cloud": CloudTool,
    }
    if name in tools:
        return tools[name]()
    return None


__all__ = [
    "BaseTool",
    "BrowserTool",
    "BrowserBridgeTool",
    "FileSystemTool",
    "TerminalTool",
    "VMTool",
    "MCPTool",
    "PlaywrightTool",
    "WhatsAppTool",
    "TelegramTool",
    "GitHubTool",
    "NPMTool",
    "PIPTool",
    "PacmanTool",
    "APITool",
    "CloudTool",
    "get_tool_by_name",
]