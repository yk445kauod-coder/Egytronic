"""
OpenAI LLM Adapter
"""

import json
import os
from typing import Any, AsyncIterator, Dict, List, Optional, Union

from egytronic.llm.base import ChatMessage, ChatResponse, LLMAdapter


class OpenAIAdapter(LLMAdapter):
    """
    OpenAI LLM Adapter
    
    Connect to OpenAI models (gpt-4o, gpt-4o-mini, etc.)
    """
    
    BASE_URL = "https://api.openai.com/v1"
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: str = "gpt-4o",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs
    ):
        super().__init__(model_name, temperature, max_tokens, **kwargs)
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        
        if not self.api_key:
            raise ValueError("OpenAI API key is required. Set OPENAI_API_KEY env var or pass api_key.")
    
    def _parse_response(self, response: dict) -> ChatResponse:
        """Parse OpenAI API response"""
        choices = response.get("choices", [])
        
        if not choices:
            return ChatResponse(content="No response generated")
        
        message = choices[0].get("message", {})
        content = message.get("content", "")
        
        # Parse tool calls
        tool_calls = None
        if message.get("tool_calls"):
            tool_calls = []
            for tc in message["tool_calls"]:
                tool_calls.append({
                    "id": tc["id"],
                    "function": {
                        "name": tc["function"]["name"],
                        "arguments": tc["function"]["arguments"]
                    }
                })
        
        usage = response.get("usage", {})
        
        return ChatResponse(
            content=content,
            tool_calls=tool_calls,
            usage={
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0)
            },
            model=self.model_name
        )
    
    async def chat(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[dict]] = None,
        tool_choice: Union[str, dict] = "auto",
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> ChatResponse:
        """Send chat request to OpenAI"""
        import aiohttp
        
        # Build request payload
        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": temperature or self.temperature,
            "max_tokens": max_tokens or self.max_tokens,
        }
        
        # Add tools if provided
        if tools and tool_choice != "none":
            payload["tools"] = tools
        
        if tool_choice != "auto":
            payload["tool_choice"] = tool_choice
        
        # Make request
        url = f"{self.BASE_URL}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"OpenAI API error: {error}")
                
                response = await resp.json()
        
        return self._parse_response(response)
    
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
            "temperature": kwargs.get("temperature", self.temperature),
            "max_tokens": kwargs.get("max_tokens", self.max_tokens),
            "stream": True
        }
        
        url = f"{self.BASE_URL}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"OpenAI API error: {error}")
                
                async for line in resp.content:
                    if line:
                        line = line.decode().strip()
                        if line.startswith("data:") and line != "data: [DONE]":
                            data = json.loads(line[6:])
                            delta = data.get("choices", [{}])[0].get("delta", {})
                            if delta.get("content"):
                                yield delta["content"]


# Convenience function
def create_openai_agent(api_key: str, model: str = "gpt-4o", **kwargs):
    """Create agent with OpenAI"""
    from ..agent import Agent
    return Agent(model="openai", api_key=api_key, model_name=model, **kwargs)