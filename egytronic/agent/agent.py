"""
Egytronic Agent - Core Agent Implementation
"""

import asyncio
import json
import os
from typing import Any, Callable, Dict, List, Optional, Union
from dataclasses import dataclass, field

from egytronic.llm.base import LLMAdapter
from egytronic.llm.gemini import GeminiAdapter
from egytronic.llm.cloudflare import CloudflareAdapter
from egytronic.tools.base import BaseTool


@dataclass
class AgentConfig:
    """Agent configuration"""
    model: str = "gemini"
    model_name: str = "gemini-2.0-flash"
    api_key: Optional[str] = None
    system_prompt: str = "You are a helpful AI assistant powered by Egytronic."
    temperature: float = 0.7
    max_tokens: int = 4096
    tools: List[BaseTool] = field(default_factory=list)
    tool_choice: Union[str, dict] = "auto"
    max_iterations: int = 10
    timeout: int = 300
    memory_enabled: bool = True
    memory_limit: int = 10


class Agent:
    """
    Egytronic Agent - Universal AI Agent
    
    Turn any LLM (local or API) into a powerful autonomous agent with tools.
    """
    
    def __init__(
        self,
        llm: Optional[LLMAdapter] = None,
        model: Optional[str] = None,
        model_name: Optional[str] = None,
        api_key: Optional[str] = None,
        api_base_url: Optional[str] = None,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        tools: Optional[List[Union[BaseTool, str]]] = None,
        tool_choice: Union[str, dict] = "auto",
        max_iterations: int = 10,
        timeout: int = 300,
        memory_enabled: bool = True,
        memory_limit: int = 10,
        **kwargs
    ):
        """
        Initialize Egytronic Agent
        
        Args:
            llm: Pre-configured LLM adapter
            model: LLM provider (gemini, cloudflare, openai, ollama, etc.)
            model_name: Model name to use
            api_key: API key for the LLM provider
            api_base_url: Custom API base URL
            system_prompt: System prompt for the agent
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            tools: List of tools to give the agent
            tool_choice: How to select tools (auto, required, none, or dict)
            max_iterations: Maximum tool use iterations
            timeout: Timeout for each iteration
            memory_enabled: Enable conversation memory
            memory_limit: Maximum conversation history to keep
        """
        self.config = AgentConfig(
            model=model or "gemini",
            model_name=model_name or "gemini-2.0-flash",
            api_key=api_key or os.environ.get("GEMINI_API_KEY"),
            system_prompt=system_prompt or "You are a helpful AI assistant powered by Egytronic.",
            temperature=temperature,
            max_tokens=max_tokens,
            tool_choice=tool_choice,
            max_iterations=max_iterations,
            timeout=timeout,
            memory_enabled=memory_enabled,
            memory_limit=memory_limit
        )
        
        # Initialize LLM adapter
        if llm is not None:
            self.llm = llm
        else:
            self.llm = self._create_llm_adapter(model, api_key, api_base_url, **kwargs)
        
        # Initialize tools
        self._tools: Dict[str, BaseTool] = {}
        self._add_default_tools()
        if tools:
            for tool in tools:
                self.add_tool(tool)
        
        # Memory
        self._messages: List[Dict[str, str]] = []
        if self.config.system_prompt:
            self._messages.append({
                "role": "system",
                "content": self.config.system_prompt
            })
        
        # Hooks
        self._hooks: Dict[str, List[Callable]] = {
            "before_think": [],
            "after_think": [],
            "before_tool": [],
            "after_tool": [],
            "on_error": [],
            "on_complete": []
        }
    
    def _create_llm_adapter(
        self,
        model: str,
        api_key: Optional[str],
        api_base_url: Optional[str],
        **kwargs
    ) -> LLMAdapter:
        """Create LLM adapter based on model type"""
        model = model or self.config.model
        
        if model == "gemini":
            return GeminiAdapter(
                api_key=api_key or self.config.api_key,
                model_name=self.config.model_name,
                **kwargs
            )
        elif model == "cloudflare":
            from egytronic.llm.cloudflare import CloudflareAdapter
            # Extract cloudflare-specific args and pass the rest
            cf_account_id = kwargs.pop("account_id", None) or os.environ.get("CLOUDFLARE_ACCOUNT_ID")
            cf_api_token = kwargs.pop("api_token", None) or os.environ.get("CLOUDFLARE_API_TOKEN")
            return CloudflareAdapter(
                account_id=cf_account_id,
                api_token=cf_api_token,
                model_name=self.config.model_name,
                **kwargs
            )
        elif model == "openai":
            from egytronic.llm.openai import OpenAIAdapter
            return OpenAIAdapter(
                api_key=api_key or os.environ.get("OPENAI_API_KEY"),
                model_name=self.config.model_name,
                **kwargs
            )
        elif model == "ollama":
            from egytronic.llm.ollama import OllamaAdapter
            return OllamaAdapter(
                base_url=api_base_url or "http://localhost:11434",
                model_name=self.config.model_name,
                **kwargs
            )
        elif model == "anthropic":
            from .llm.anthropic import AnthropicAdapter
            return AnthropicAdapter(
                api_key=api_key or os.environ.get("ANTHROPIC_API_KEY"),
                model_name=self.config.model_name,
                **kwargs
            )
        else:
            raise ValueError(f"Unknown model: {model}. Use gemini, cloudflare, openai, ollama, or anthropic")
    
    def _add_default_tools(self):
        """Add default tools"""
        # Tools are added via add_tool method
        pass
    
    def add_tool(self, tool: Union[BaseTool, str]):
        """
        Add a tool to the agent
        
        Args:
            tool: Tool instance or tool name string
        """
        if isinstance(tool, str):
            from egytronic.tools import get_tool_by_name
            tool = get_tool_by_name(tool)
        
        if tool is not None:
            self._tools[tool.name] = tool
    
    def remove_tool(self, tool_name: str):
        """Remove a tool from the agent"""
        if tool_name in self._tools:
            del self._tools[tool_name]
    
    def list_tools(self) -> List[str]:
        """List all available tools"""
        return list(self._tools.keys())
    
    def register_hook(self, event: str, callback: Callable):
        """
        Register a hook callback
        
        Args:
            event: Event name (before_think, after_think, before_tool, after_tool, on_error, on_complete)
            callback: Callback function
        """
        if event in self._hooks:
            self._hooks[event].append(callback)
    
    async def think(self, prompt: str, **kwargs) -> str:
        """
        Think - Generate a response without tool use
        
        Args:
            prompt: User prompt
            **kwargs: Additional parameters
            
        Returns:
            Generated response
        """
        # Run before_think hooks
        for hook in self._hooks["before_think"]:
            await hook(self, prompt)
        
        # Add to memory
        if self.config.memory_enabled:
            self._messages.append({"role": "user", "content": prompt})
        
        # Get tool definitions for LLM
        tool_defs = None
        if self._tools:
            tool_defs = [tool.get_definition() for tool in self._tools.values()]
        
        # Generate response
        response = await self.llm.chat(
            messages=self._messages,
            tools=tool_defs,
            tool_choice=self.config.tool_choice,
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens,
            **kwargs
        )
        
        # Add response to memory
        if self.config.memory_enabled:
            self._messages.append({"role": "assistant", "content": response.content})
        
        # Run after_think hooks
        for hook in self._hooks["after_think"]:
            await hook(self, response)
        
        return response
    
    async def execute_tool(self, tool_name: str, **kwargs) -> Any:
        """
        Execute a tool
        
        Args:
            tool_name: Name of the tool to execute
            **kwargs: Tool arguments
            
        Returns:
            Tool execution result
        """
        if tool_name not in self._tools:
            raise ValueError(f"Unknown tool: {tool_name}")
        
        tool = self._tools[tool_name]
        
        # Run before_tool hooks
        for hook in self._hooks["before_tool"]:
            await hook(self, tool_name, kwargs)
        
        # Execute tool
        result = await tool.execute(**kwargs)
        
        # Run after_tool hooks
        for hook in self._hooks["after_tool"]:
            await hook(self, tool_name, result)
        
        return result
    
    async def run(self, prompt: str, **kwargs) -> str:
        """
        Run the agent with a prompt - automatic tool use
        
        Args:
            prompt: User prompt
            **kwargs: Additional parameters
            
        Returns:
            Final response after tool use
        """
        try:
            iteration = 0
            last_response = None
            
            while iteration < self.config.max_iterations:
                # Generate response
                response = await self.think(prompt if iteration == 0 else prompt, **kwargs)
                
                # Check if we need to use tools
                if response.tool_calls:
                    # Execute each tool call
                    for tool_call in response.tool_calls:
                        tool_name = tool_call.function.name
                        tool_args = json.loads(tool_call.function.arguments)
                        
                        # Run before_tool hooks
                        for hook in self._hooks["before_tool"]:
                            await hook(self, tool_name, tool_args)
                        
                        # Execute tool
                        try:
                            result = await self.execute_tool(tool_name, **tool_args)
                            
                            # Add tool result to messages
                            if self.config.memory_enabled:
                                self._messages.append({
                                    "role": "tool",
                                    "tool_call_id": tool_call.id,
                                    "content": str(result)
                                })
                        except Exception as e:
                            # Run error hooks
                            for hook in self._hooks["on_error"]:
                                await hook(self, tool_name, e)
                            
                            # Add error to messages
                            if self.config.memory_enabled:
                                self._messages.append({
                                    "role": "tool",
                                    "tool_call_id": tool_call.id,
                                    "content": f"Error: {str(e)}"
                                })
                    
                    iteration += 1
                else:
                    # No tool calls, we're done
                    last_response = response.content
                    break
            
            # Run complete hooks
            for hook in self._hooks["on_complete"]:
                await hook(self, last_response)
            
            return last_response or "No response generated"
        
        except Exception as e:
            # Run error hooks
            for hook in self._hooks["on_error"]:
                await hook(self, "run", e)
            raise
    
    def run_sync(self, prompt: str, **kwargs) -> str:
        """
        Synchronous version of run
        
        Args:
            prompt: User prompt
            **kwargs: Additional parameters
            
        Returns:
            Final response
        """
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        return loop.run_until_complete(self.run(prompt, **kwargs))
    
    async def chat(self, message: str) -> str:
        """
        Chat - Simple chat interface
        
        Args:
            message: Chat message
            
        Returns:
            Response
        """
        return await self.run(message)
    
    def chat_sync(self, message: str) -> str:
        """
        Synchronous chat interface
        """
        return self.run_sync(message)
    
    def clear_memory(self):
        """Clear conversation memory"""
        self._messages = []
        if self.config.system_prompt:
            self._messages.append({
                "role": "system",
                "content": self.config.system_prompt
            })
    
    def get_memory(self) -> List[Dict[str, str]]:
        """Get conversation memory"""
        return self._messages.copy()
    
    async def stream(self, prompt: str, **kwargs):
        """
        Stream responses
        
        Args:
            prompt: User prompt
            **kwargs: Additional parameters
            
        Yields:
            Response chunks
        """
        async for chunk in self.llm.stream_chat(prompt, **kwargs):
            yield chunk
    
    def __repr__(self) -> str:
        return f"Agent(model={self.config.model}, tools={list(self._tools.keys())})"
    
    def __str__(self) -> str:
        return f"Egytronic Agent: {self.config.model} with {len(self._tools)} tools"


# Shortcuts
def create_agent(
    model: str = "gemini",
    api_key: Optional[str] = None,
    **kwargs
) -> Agent:
    """Quick agent creation"""
    return Agent(model=model, api_key=api_key, **kwargs)


def chat_with(
    message: str,
    model: str = "gemini",
    api_key: Optional[str] = None,
    **kwargs
) -> str:
    """Quick one-shot chat"""
    return Agent(model=model, api_key=api_key, **kwargs).run_sync(message)