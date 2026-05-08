"""
Egytronic Tools - Base Tool Interface
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class ToolDefinition:
    """Tool definition for LLM"""
    name: str
    description: str
    parameters: Dict[str, Any]


class BaseTool(ABC):
    """
    Abstract base class for all tools
    
    All tools must implement this interface.
    """
    
    name: str = "base"
    description: str = "Base tool"
    
    def __init__(self, **kwargs):
        self.config = kwargs
    
    @abstractmethod
    async def execute(self, **kwargs) -> Any:
        """
        Execute the tool
        
        Args:
            **kwargs: Tool-specific arguments
            
        Returns:
            Tool execution result
        """
        pass
    
    def get_definition(self) -> ToolDefinition:
        """
        Get tool definition for LLM
        
        Returns:
            Tool definition
        """
        return ToolDefinition(
            name=self.name,
            description=self.description,
            parameters=self._get_parameters()
        )
    
    def _get_parameters(self) -> Dict[str, Any]:
        """Get parameter schema"""
        return {
            "type": "object",
            "properties": {},
            "required": []
        }
    
    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}>"
    
    def __str__(self) -> str:
        return f"{self.name}: {self.description}"


# Tool registry
_TOOL_REGISTRY = {}


def register_tool(name: str, tool_class):
    """Register a tool"""
    _TOOL_REGISTRY[name] = tool_class


def get_tool_by_name(name: str):
    """Get tool by name"""
    if name in _TOOL_REGISTRY:
        return _TOOL_REGISTRY[name]()
    return None


def list_available_tools() -> List[str]:
    """List all available tools"""
    return [
        "browser", "browser_bridge", "file_system", "terminal",
        "mcp", "playwright", "whatsapp", "telegram",
        "github", "npm", "pip", "pacman", "vm", "api", "cloud"
    ]