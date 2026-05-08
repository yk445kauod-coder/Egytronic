"""
Cloudflare Workers AI LLM Adapter
"""

import json
import os
from typing import Any, AsyncIterator, Dict, List, Optional, Union

from egytronic.llm.base import ChatResponse, LLMAdapter


class CloudflareAdapter(LLMAdapter):
    """
    Cloudflare Workers AI Adapter
    
    Connect to Cloudflare Workers AI models via REST API
    Supports llama-3-8b-instruct, and other CfMeta models
    """
    
    BASE_URL = "https://api.cloudflare.com/client/v4"
    
    def __init__(
        self,
        account_id: Optional[str] = None,
        api_token: Optional[str] = None,
        model_name: str = "@cf/meta/llama-3-8b-instruct",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs
    ):
        super().__init__(model_name, temperature, max_tokens, **kwargs)
        self.account_id = account_id or os.environ.get("CLOUDFLARE_ACCOUNT_ID")
        self.api_token = api_token or os.environ.get("CLOUDFLARE_API_TOKEN")
        
        if not self.account_id:
            raise ValueError("Cloudflare account ID is required. Set CLOUDFLARE_ACCOUNT_ID env var or pass account_id.")
        if not self.api_token:
            raise ValueError("Cloudflare API token is required. Set CLOUDFLARE_API_TOKEN env var or pass api_token.")
    
    def _parse_response(self, response: dict) -> ChatResponse:
        """Parse Cloudflare API response"""
        result = response.get("result", {})
        
        if not result:
            return ChatResponse(content="No response generated")
        
        content = result.get("response", "")
        
        return ChatResponse(
            content=content,
            usage=response.get("usage", {}),
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
        """Send chat request to Cloudflare Workers AI"""
        import aiohttp
        
        # Convert messages to Cloudflare format
        # Cloudflare expects: [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}]
        cf_messages = []
        for msg in messages:
            if msg["role"] != "tool":
                cf_messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
        
        # Build request
        payload = {
            "messages": cf_messages,
        }
        
        if temperature is not None:
            payload["temperature"] = temperature
        else:
            payload["temperature"] = self.temperature
        
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens
        else:
            payload["max_tokens"] = self.max_tokens
        
        # Make request
        url = f"{self.BASE_URL}/accounts/{self.account_id}/ai/run/{self.model_name}"
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"Cloudflare API error: {error}")
                
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
        
        cf_messages = []
        for msg in messages:
            if msg["role"] != "tool":
                cf_messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
        
        payload = {
            "messages": cf_messages,
            "temperature": kwargs.get("temperature", self.temperature),
            "max_tokens": kwargs.get("max_tokens", self.max_tokens),
            "stream": True
        }
        
        url = f"{self.BASE_URL}/accounts/{self.account_id}/ai/run/{self.model_name}"
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"Cloudflare API error: {error}")
                
                async for line in resp.content:
                    if line:
                        line = line.decode().strip()
                        if line.startswith("data:"):
                            data = json.loads(line[5:])
                            if "response" in data:
                                yield data["response"]


# Convenience function
def create_cloudflare_agent(
    account_id: str,
    api_token: str,
    model: str = "@cf/meta/llama-3-8b-instruct",
    **kwargs
):
    """Create agent with Cloudflare Workers AI"""
    from ..agent import Agent
    return Agent(
        model="cloudflare",
        account_id=account_id,
        api_token=api_token,
        model_name=model,
        **kwargs
    )