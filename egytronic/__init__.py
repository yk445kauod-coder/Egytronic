"""
Egytronic - Universal Agent Development Platform
Turn any LLM into a powerful autonomous agent with tools

© 2026 Egytronic. All rights reserved.
"""

__version__ = "1.0.0"
__author__ = "Egytronic"

from egytronic.agent.agent import Agent
from egytronic.llm.gemini import GeminiAdapter
from egytronic.llm.cloudflare import CloudflareAdapter
from egytronic.llm.ollama import OllamaAdapter
from egytronic.llm.openai import OpenAIAdapter

__all__ = [
    "Agent",
    "GeminiAdapter",
    "CloudflareAdapter",
    "OllamaAdapter",
    "OpenAIAdapter",
]