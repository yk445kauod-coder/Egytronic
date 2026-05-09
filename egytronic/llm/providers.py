"""
Egytronic LLM Adapters - Multiple Provider Support

Supports: Gemini, Cloudflare Workers AI, OpenAI, Anthropic, Ollama, 
HuggingFace, OpenRouter, Groq, ZhipuAI (GLM), Kimi, Replicate, Together AI, and more
"""

import os
import json
from typing import Any, AsyncIterator, Dict, List, Optional, Union
from .base import LLMAdapter, ChatMessage, ChatResponse


# ═══════════════════════════════════════════════════════════════════════════════
# HUGGINGFACE ADAPTER
# ═══════════════════════════════════════════════════════════════════════════════

class HuggingFaceAdapter(LLMAdapter):
    """HuggingFace Inference API Adapter"""
    
    BASE_URL = "https://api-inference.huggingface.co"
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: str = "meta-llama/Llama-3-8B-Instruct",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs
    ):
        super().__init__(model_name, temperature, max_tokens, **kwargs)
        self.api_key = api_key or os.environ.get("HUGGINGFACE_API_KEY")
        if not self.api_key:
            raise ValueError("HuggingFace API key required. Set HUGGINGFACE_API_KEY")
    
    async def chat(self, messages: List[Dict[str, str]], **kwargs) -> ChatResponse:
        import aiohttp
        
        # Convert messages to chat format
        prompt = self._format_prompt(messages)
        
        payload = {
            "inputs": prompt,
            "parameters": {
                "temperature": kwargs.get("temperature", self.temperature),
                "max_new_tokens": kwargs.get("max_tokens", self.max_tokens),
                "return_full_text": False
            }
        }
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.BASE_URL}/models/{self.model_name}",
                json=payload,
                headers=headers
            ) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"HuggingFace error: {error}")
                result = await resp.json()
        
        content = result[0]["generated_text"] if isinstance(result, list) else result.get("generated_text", "")
        
        return ChatResponse(content=content, model=self.model_name)
    
    def _format_prompt(self, messages: List[Dict[str, str]]) -> str:
        """Format messages as prompt"""
        prompt = ""
        for msg in messages:
            role = msg["role"]
            content = msg["content"]
            if role == "system":
                prompt += f"System: {content}\n\n"
            else:
                prompt += f"{role.upper()}: {content}\n"
        prompt += "ASSISTANT: "
        return prompt
    
    async def complete(self, prompt: str, **kwargs) -> str:
        response = await self.chat([{"role": "user", "content": prompt}], **kwargs)
        return response.content


# ═══════════════════════════════════════════════════════════════════════════════
# OPENROUTER ADAPTER
# ═══════════════════════════════════════════════════════════════════════════════

class OpenRouterAdapter(LLMAdapter):
    """OpenRouter AI - Access 100+ models"""
    
    BASE_URL = "https://openrouter.ai/api/v1"
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: str = "anthropic/claude-3.5-sonnet",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs
    ):
        super().__init__(model_name, temperature, max_tokens, **kwargs)
        self.api_key = api_key or os.environ.get("OPENROUTER_API_KEY")
        if not self.api_key:
            raise ValueError("OpenRouter API key required. Set OPENROUTER_API_KEY")
    
    async def chat(self, messages: List[Dict[str, str]], **kwargs) -> ChatResponse:
        import aiohttp
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://egytronic.com",
            "X-Title": "Egytronic"
        }
        
        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": kwargs.get("temperature", self.temperature),
            "max_tokens": kwargs.get("max_tokens", self.max_tokens)
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.BASE_URL}/chat/completions",
                json=payload,
                headers=headers
            ) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"OpenRouter error: {error}")
                result = await resp.json()
        
        content = result["choices"][0]["message"]["content"]
        
        return ChatResponse(content=content, model=self.model_name)
    
    async def complete(self, prompt: str, **kwargs) -> str:
        response = await self.chat([{"role": "user", "content": prompt}], **kwargs)
        return response.content


# ═══════════════════════════════════════════════════════════════════════════════
# GROQ ADAPTER
# ═══════════════════════════════════════════════════════════════════════════════

class GroqAdapter(LLMAdapter):
    """Groq - Fast inference"""
    
    BASE_URL = "https://api.groq.com/openai/v1"
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: str = "llama-3.1-70b-versatile",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs
    ):
        super().__init__(model_name, temperature, max_tokens, **kwargs)
        self.api_key = api_key or os.environ.get("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError("Groq API key required. Set GROQ_API_KEY")
    
    async def chat(self, messages: List[Dict[str, str]], **kwargs) -> ChatResponse:
        import aiohttp
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": kwargs.get("temperature", self.temperature),
            "max_tokens": kwargs.get("max_tokens", self.max_tokens)
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.BASE_URL}/chat/completions",
                json=payload,
                headers=headers
            ) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"Groq error: {error}")
                result = await resp.json()
        
        content = result["choices"][0]["message"]["content"]
        
        return ChatResponse(content=content, model=self.model_name)
    
    async def complete(self, prompt: str, **kwargs) -> str:
        response = await self.chat([{"role": "user", "content": prompt}], **kwargs)
        return response.content


# ═══════════════════════════════════════════════════════════════════════════════
# ZHIPU AI (GLM) ADAPTER
# ═══════════════════════════════════════════════════════════════════════════════

class ZhipuAIAdapter(LLMAdapter):
    """Zhipu AI (GLM) - Chinese AI company"""
    
    BASE_URL = "https://open.bigmodel.cn/api/paas/v4"
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: str = "glm-4-flash",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs
    ):
        super().__init__(model_name, temperature, max_tokens, **kwargs)
        self.api_key = api_key or os.environ.get("ZHIPU_API_KEY")
        if not self.api_key:
            raise ValueError("Zhipu AI API key required. Set ZHIPU_API_KEY")
    
    async def chat(self, messages: List[Dict[str, str]], **kwargs) -> ChatResponse:
        import aiohttp
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        # Convert messages format
        glm_messages = []
        for msg in messages:
            if msg["role"] == "system":
                glm_messages.append({"role": "system", "content": msg["content"]})
            else:
                glm_messages.append({"role": msg["role"], "content": msg["content"]})
        
        payload = {
            "model": self.model_name,
            "messages": glm_messages,
            "temperature": kwargs.get("temperature", self.temperature),
            "max_tokens": kwargs.get("max_tokens", self.max_tokens)
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.BASE_URL}/chat/completions",
                json=payload,
                headers=headers
            ) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"Zhipu AI error: {error}")
                result = await resp.json()
        
        content = result["choices"][0]["message"]["content"]
        
        return ChatResponse(content=content, model=self.model_name)
    
    async def complete(self, prompt: str, **kwargs) -> str:
        response = await self.chat([{"role": "user", "content": prompt}], **kwargs)
        return response.content


# ═══════════════════════════════════════════════════════════════════════════════
# KIMI ADAPTER
# ═══════════════════════════════════════════════════════════════════════════════

class KimiAdapter(LLMAdapter):
    """Kimi (Moonshot AI) - Chinese AI assistant"""
    
    BASE_URL = "https://api.moonshot.cn/v1"
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: str = "kimi-flash",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs
    ):
        super().__init__(model_name, temperature, max_tokens, **kwargs)
        self.api_key = api_key or os.environ.get("KIMI_API_KEY")
        if not self.api_key:
            raise ValueError("Kimi API key required. Set KIMI_API_KEY")
    
    async def chat(self, messages: List[Dict[str, str]], **kwargs) -> ChatResponse:
        import aiohttp
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": kwargs.get("temperature", self.temperature),
            "max_tokens": kwargs.get("max_tokens", self.max_tokens)
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.BASE_URL}/chat/completions",
                json=payload,
                headers=headers
            ) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"Kimi error: {error}")
                result = await resp.json()
        
        content = result["choices"][0]["message"]["content"]
        
        return ChatResponse(content=content, model=self.model_name)
    
    async def complete(self, prompt: str, **kwargs) -> str:
        response = await self.chat([{"role": "user", "content": prompt}], **kwargs)
        return response.content


# ═══════════════════════════════════════════════════════════════════════════════
# TOGETHER AI ADAPTER
# ═══════════════════════════════════════════════════════════════════════

class TogetherAIAdapter(LLMAdapter):
    """Together AI - Running 200+ models"""
    
    BASE_URL = "https://api.together.xyz/v1"
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: str = "meta-llama/Llama-3.1-8B-Instruct-Turbo",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs
    ):
        super().__init__(model_name, temperature, max_tokens, **kwargs)
        self.api_key = api_key or os.environ.get("TOGETHER_API_KEY")
        if not self.api_key:
            raise ValueError("Together AI API key required. Set TOGETHER_API_KEY")
    
    async def chat(self, messages: List[Dict[str, str]], **kwargs) -> ChatResponse:
        import aiohttp
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": kwargs.get("temperature", self.temperature),
            "max_tokens": kwargs.get("max_tokens", self.max_tokens)
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.BASE_URL}/chat/completions",
                json=payload,
                headers=headers
            ) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"Together AI error: {error}")
                result = await resp.json()
        
        content = result["choices"][0]["message"]["content"]
        
        return ChatResponse(content=content, model=self.model_name)
    
    async def complete(self, prompt: str, **kwargs) -> str:
        response = await self.chat([{"role": "user", "content": prompt}], **kwargs)
        return response.content


# ═══════════════════════════════════════════════════════════════════════════════
# REPLICATE ADAPTER
# ═══════════════════════════════════════════════════════════════════════

class ReplicateAdapter(LLMAdapter):
    """Replicate - Run ML models"""
    
    BASE_URL = "https://api.replicate.com/v1"
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: str = "/meta/llama-3-70b-instruct",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs
    ):
        super().__init__(model_name, temperature, max_tokens, **kwargs)
        self.api_key = api_key or os.environ.get("REPLICATE_API_KEY")
        if not self.api_key:
            raise ValueError("Replicate API key required. Set REPLICATE_API_KEY")
    
    async def chat(self, messages: List[Dict[str, str]], **kwargs) -> ChatResponse:
        import aiohttp
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        # Convert messages for prediction
        prompt = "\n".join([f"{m['role']}: {m['content']}" for m in messages])
        
        payload = {
            "version": self.model_name,
            "input": {
                "prompt": prompt,
                "temperature": kwargs.get("temperature", self.temperature),
                "max_new_tokens": kwargs.get("max_tokens", self.max_tokens)
            }
        }
        
        # Create prediction
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.BASE_URL}/predictions",
                json=payload,
                headers=headers
            ) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"Replicate error: {error}")
                pred = await resp.json()
            
            # Poll for result
            while pred["status"] == "starting" or pred["status"] == "processing":
                await asyncio.sleep(2)
                async with session.get(pred["urls"]["get"], headers=headers) as resp:
                    pred = await resp.json()
        
        content = pred.get("output", "")
        if isinstance(content, list):
            content = content[0] if content else ""
        
        return ChatResponse(content=str(content), model=self.model_name)
    
    async def complete(self, prompt: str, **kwargs) -> str:
        response = await self.chat([{"role": "user", "content": prompt}], **kwargs)
        return response.content


# ═══════════════════════════════════════════════════════════════════════════════════════
# FIREWORKS AI ADAPTER
# ═══════════════════════════════════════════════════════════════════════════════

class FireworksAdapter(LLMAdapter):
    """Fireworks AI - Fast model hosting"""
    
    BASE_URL = "https://api.fireworks.ai/v1"
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: str = "accounts/fireworks/models/llama-v3-70b-instruct",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs
    ):
        super().__init__(model_name, temperature, max_tokens, **kwargs)
        self.api_key = api_key or os.environ.get("FIREWORKS_API_KEY")
        if not self.api_key:
            raise ValueError("Fireworks AI API key required. Set FIREWORKS_API_KEY")
    
    async def chat(self, messages: List[Dict[str, str]], **kwargs) -> ChatResponse:
        import aiohttp
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": kwargs.get("temperature", self.temperature),
            "max_tokens": kwargs.get("max_tokens", self.max_tokens)
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.BASE_URL}/chat/completions",
                json=payload,
                headers=headers
            ) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"Fireworks error: {error}")
                result = await resp.json()
        
        content = result["choices"][0]["message"]["content"]
        
        return ChatResponse(content=content, model=self.model_name)
    
    async def complete(self, prompt: str, **kwargs) -> str:
        response = await self.chat([{"role": "user", "content": prompt}], **kwargs)
        return response.content


# ═══════════════════════════════════════════════════════════════════════════════
# ANTHROPIC ADAPTER (UPDATED)
# ═══════════════════════════════════════════════════════════════════════

class AnthropicAdapter(LLMAdapter):
    """Anthropic Claude - Updated with more models"""
    
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
            raise ValueError("Anthropic API key required. Set ANTHROPIC_API_KEY")
    
    async def chat(self, messages: List[Dict[str, str]], **kwargs) -> ChatResponse:
        import aiohttp
        
        # Separate system message
        system_prompt = ""
        anthropic_messages = []
        
        for msg in messages:
            if msg["role"] == "system":
                system_prompt = msg["content"]
            else:
                anthropic_messages.append(msg)
        
        payload = {
            "model": self.model_name,
            "messages": anthropic_messages,
            "max_tokens": kwargs.get("max_tokens", self.max_tokens),
            "temperature": kwargs.get("temperature", self.temperature)
        }
        
        if system_prompt:
            payload["system"] = system_prompt
        
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.BASE_URL}/messages",
                json=payload,
                headers=headers
            ) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"Anthropic error: {error}")
                result = await resp.json()
        
        content = result["content"][0]["text"]
        
        return ChatResponse(content=content, model=self.model_name)
    
    async def complete(self, prompt: str, **kwargs) -> str:
        response = await self.chat([{"role": "user", "content": prompt}], **kwargs)
        return response.content


# ═══════════════════════════════════════════════════════════════════════════════
# PROVIDER REGISTRY
# ═══════════════════════════════════════════════════════════════════════════════

PROVIDERS = {
    # Main providers
    "gemini": ("egytronic.llm.gemini", "GeminiAdapter"),
    "cloudflare": ("egytronic.llm.cloudflare", "CloudflareAdapter"),
    "openai": ("egytronic.llm.openai", "OpenAIAdapter"),
    "anthropic": (None, "AnthropicAdapter"),
    "ollama": ("egytronic.llm.ollama", "OllamaAdapter"),
    
    # Additional providers
    "huggingface": (None, "HuggingFaceAdapter"),
    "openrouter": (None, "OpenRouterAdapter"),
    "groq": (None, "GroqAdapter"),
    "zhipu": (None, "ZhipuAIAdapter"),
    "glm": (None, "ZhipuAIAdapter"),  # GLM = Zhipu
    "kimi": (None, "KimiAdapter"),
    "together": (None, "TogetherAIAdapter"),
    "replicate": (None, "ReplicateAdapter"),
    "fireworks": (None, "FireworksAdapter"),
}

IMPORT_ERRORS = {
    "gemini": "pip install aiohttp",
    "cloudflare": "pip install aiohttp",
    "openai": "pip install aiohttp",
    "anthropic": "pip install aiohttp",
    "huggingface": "pip install aiohttp",
    "openrouter": "pip install aiohttp",
    "groq": "pip install aiohttp",
    "zhipu": "pip install aiohttp",
    "kimi": "pip install aiohttp",
    "together": "pip install aiohttp",
    "replicate": "pip install aiohttp",
    "fireworks": "pip install aiohttp",
}


__all__ = [
    "HuggingFaceAdapter",
    "OpenRouterAdapter", 
    "GroqAdapter",
    "ZhipuAIAdapter",
    "KimiAdapter",
    "TogetherAIAdapter",
    "ReplicateAdapter",
    "FireworksAdapter",
    "AnthropicAdapter",
    "PROVIDERS",
    "IMPORT_ERRORS",
]