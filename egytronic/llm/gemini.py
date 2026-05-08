"""
Google Gemini LLM Adapter
"""

import json
import os
from typing import Any, AsyncIterator, Dict, List, Optional, Union

from egytronic.llm.base import ChatResponse, LLMAdapter


class GeminiAdapter(LLMAdapter):
    """
    Google Gemini LLM Adapter
    
    Connect to Google Gemini models (gemini-2.0-flash, gemini-pro, etc.)
    """
    
    BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: str = "gemini-2.0-flash",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs
    ):
        super().__init__(model_name, temperature, max_tokens, **kwargs)
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        
        if not self.api_key:
            raise ValueError("Gemini API key is required. Set GEMINI_API_KEY env var or pass api_key.")
    
    def _format_messages(self, messages: List[Dict[str, str]]) -> List[Dict[str, Any]]:
        """Format messages for Gemini API"""
        formatted = []
        
        for msg in messages:
            if msg["role"] == "system":
                # Gemini uses model role for system
                formatted.append({
                    "role": "model",
                    "parts": [{"text": msg["content"]}]
                })
            else:
                formatted.append({
                    "role": msg["role"],
                    "parts": [{"text": msg["content"]}]
                })
        
        return formatted
    
    def _parse_response(self, response: dict) -> ChatResponse:
        """Parse Gemini API response"""
        candidates = response.get("candidates", [])
        
        if not candidates:
            return ChatResponse(content="No response generated")
        
        parts = candidates[0].get("content", {}).get("parts", [])
        content = "".join(p.get("text", "") for p in parts)
        
        # Check for tool calls (function calls in Gemini)
        tool_calls = None
        usage = response.get("usageMetadata", {})
        
        return ChatResponse(
            content=content,
            tool_calls=tool_calls,
            usage={
                "prompt_token_count": usage.get("promptTokenCount", 0),
                "candidates_token_count": usage.get("candidatesTokenCount", 0),
                "total_token_count": usage.get("totalTokenCount", 0)
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
        """Send chat request to Gemini"""
        import aiohttp
        
        formatted_messages = self._format_messages(messages)
        
        # Build request
        payload = {
            "contents": formatted_messages,
            "generationConfig": {
                "temperature": temperature or self.temperature,
                "maxOutputTokens": max_tokens or self.max_tokens,
                "responseMimeType": "text/plain"
            }
        }
        
        # Add tools if provided
        if tools and tool_choice != "none":
            # Convert tools to Gemini format
            function_declarations = []
            for tool in tools:
                if "function" in tool:
                    function_declarations.append({
                        "name": tool["function"]["name"],
                        "description": tool["function"].get("description", ""),
                        "parameters": tool["function"].get("parameters", {})
                    })
            
            if function_declarations:
                payload["tools"] = [{"functionDeclarations": function_declarations}]
        
        # Make request
        url = f"{self.BASE_URL}/models/{self.model_name}:generateContent?key={self.api_key}"
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"Gemini API error: {error}")
                
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
        
        formatted_messages = self._format_messages(messages)
        
        payload = {
            "contents": formatted_messages,
            "generationConfig": {
                "temperature": kwargs.get("temperature", self.temperature),
                "maxOutputTokens": kwargs.get("max_tokens", self.max_tokens),
                "responseMimeType": "text/plain"
            }
        }
        
        url = f"{self.BASE_URL}/models/{self.model_name}:streamGenerateContent?alt=sse&key={self.api_key}"
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"Gemini API error: {error}")
                
                async for line in resp.content:
                    if line:
                        line = line.decode().strip()
                        if line.startswith("data:"):
                            data = json.loads(line[5:])
                            text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                            if text:
                                yield text


# Convenience function
def create_gemini_agent(api_key: str, model: str = "gemini-2.0-flash", **kwargs):
    """Create agent with Gemini"""
    from ..agent import Agent
    return Agent(model="gemini", api_key=api_key, model_name=model, **kwargs)