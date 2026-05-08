"""
Ollama LLM Adapter - Local LLM support
"""

import json
import os
from typing import Any, AsyncIterator, Dict, List, Optional, Union

from egytronic.llm.base import ChatResponse, LLMAdapter


class OllamaAdapter(LLMAdapter):
    """
    Ollama LLM Adapter
    
    Connect to local Ollama models
    Supports llama3, mistral, codellama, and more
    """
    
    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model_name: str = "llama3",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs
    ):
        super().__init__(model_name, temperature, max_tokens, **kwargs)
        self.base_url = base_url
    
    async def chat(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[dict]] = None,
        tool_choice: Union[str, dict] = "auto",
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> ChatResponse:
        """Send chat request to Ollama"""
        import aiohttp
        
        # Build request
        payload = {
            "model": self.model_name,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature or self.temperature,
                "num_predict": max_tokens or self.max_tokens,
            }
        }
        
        # Make request
        url = f"{self.base_url}/api/chat"
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"Ollama API error: {error}")
                
                response = await resp.json()
        
        return ChatResponse(
            content=response.get("message", {}).get("content", ""),
            model=self.model_name
        )
    
    async def complete(
        self,
        prompt: str,
        **kwargs
    ) -> str:
        """Complete a prompt"""
        response = await self.chat([{"role": "user", "content": prompt}], **kwargs)
        return response.content
    
    async def stream_chat(
        self,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> AsyncIterator[str]:
        """Stream chat responses"""
        import aiohttp
        
        payload = {
            "model": self.model_name,
            "messages": messages,
            "stream": True,
        }
        
        url = f"{self.base_url}/api/chat"
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"Ollama API error: {error}")
                
                async for line in resp.content:
                    if line:
                        data = json.loads(line.decode())
                        if "message" in data and "content" in data["message"]:
                            yield data["message"]["content"]


class AnthropicAdapter(LLMAdapter):
    """
    Anthropic Claude Adapter
    
    Connect to Claude models (claude-3-5-sonnet, etc.)
    """
    
    BASE_URL = "https://api.anthropic.com/v1"
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: str = "claude-sonnet-4-20250514",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs
    ):
        super().__init__(model_name, temperature, max_tokens, **kwargs)
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        
        if not self.api_key:
            raise ValueError("Anthropic API key is required.")
    
    async def chat(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[dict]] = None,
        tool_choice: Union[str, dict] = "auto",
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> ChatResponse:
        """Send chat request to Anthropic"""
        import aiohttp
        
        # Convert messages to Anthropic format
        anthropic_messages = []
        system_prompt = ""
        
        for msg in messages:
            if msg["role"] == "system":
                system_prompt = msg["content"]
            else:
                anthropic_messages.append(msg)
        
        # Build request
        payload = {
            "model": self.model_name,
            "messages": anthropic_messages,
            "max_tokens": max_tokens or self.max_tokens,
        }
        
        if system_prompt:
            payload["system"] = system_prompt
        
        if temperature is not None:
            payload["temperature"] = temperature
        
        if tools and tool_choice != "none":
            payload["tools"] = tools
        
        # Make request
        url = f"{self.BASE_URL}/messages"
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"Anthropic API error: {error}")
                
                response = await resp.json()
        
        content = response.get("content", [{}])[0].get("text", "")
        
        return ChatResponse(
            content=content,
            model=self.model_name
        )
    
    async def complete(
        self,
        prompt: str,
        **kwargs
    ) -> str:
        """Complete a prompt"""
        response = await self.chat([{"role": "user", "content": prompt}], **kwargs)
        return response.content