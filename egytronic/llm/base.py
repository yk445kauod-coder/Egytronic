"""
LLM Base Adapter - Abstract interface for all LLM providers
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, AsyncIterator, Dict, List, Optional, Union


@dataclass
class ChatMessage:
    """Chat message"""
    role: str
    content: str
    tool_call_id: Optional[str] = None


@dataclass
class ChatResponse:
    """Chat response"""
    content: str
    tool_calls: Optional[List[dict]] = None
    usage: Optional[Dict[str, int]] = None
    model: Optional[str] = None


@dataclass
class ToolCall:
    """Tool call"""
    id: str
    function: Any


class LLMAdapter(ABC):
    """
    Abstract base class for LLM adapters
    
    All LLM providers must implement this interface.
    """
    
    def __init__(
        self,
        model_name: str = "default",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs
    ):
        self.model_name = model_name
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.extra_kwargs = kwargs
    
    @abstractmethod
    async def chat(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[dict]] = None,
        tool_choice: Union[str, dict] = "auto",
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> ChatResponse:
        """
        Send a chat request
        
        Args:
            messages: List of messages
            tools: List of tool definitions
            tool_choice: Tool choice strategy
            temperature: Override default temperature
            max_tokens: Override default max tokens
            **kwargs: Additional parameters
            
        Returns:
            ChatResponse
        """
        pass
    
    @abstractmethod
    async def complete(
        self,
        prompt: str,
        **kwargs
    ) -> str:
        """
        Complete a prompt (non-chat)
        
        Args:
            prompt: Prompt text
            **kwargs: Additional parameters
            
        Returns:
            Completion text
        """
        pass
    
    async def stream_chat(
        self,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> AsyncIterator[str]:
        """
        Stream chat responses
        
        Args:
            messages: List of messages
            **kwargs: Additional parameters
            
        Yields:
            Response chunks
        """
        response = await self.chat(messages, **kwargs)
        yield response.content
    
    def get_name(self) -> str:
        """Get adapter name"""
        return self.__class__.__name__.replace("Adapter", "").lower()
    
    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} model={self.model_name}>"