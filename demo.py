#!/usr/bin/env python3
"""
🤖 Egytronic AI Agent - Interactive Demo
=================================
This demo shows the framework in action. Edit the API keys below to use.

API Keys:
- Cloudflare: Get from https://dash.cloudflare.com/profile/api-tokens
- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/keys
- Gemini: https://aistudio.google.com/app/apikey
"""

import os
import sys
import asyncio

# ============================================================
# CONFIGURATION - EDIT THESE
# ============================================================

class Config:
    """Your API keys - edit these!"""
    
    # Cloudflare Workers AI (free edge inference)
    CLOUDFLARE_ACCOUNT_ID = ""  # Get from: https://dash.cloudflare.com
    CLOUDFLARE_API_TOKEN = ""  # Get from: https://dash.cloudflare.com/profile/api-tokens
    
    # OpenAI
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    
    # Anthropic (Claude)
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    
    # Google Gemini
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    
    # Groq
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
    
    # Ollama (local) - start with: `ollama serve`
    OLLAMA_HOST = "http://localhost:11434"
    OLLAMA_MODEL = "llama3"


# ============================================================
# SIMPLE LLM CLIENTS
# ============================================================

class LLMClient:
    """Base LLM client"""
    
    def __init__(self, api_key: str = "", model: str = ""):
        self.api_key = api_key
        self.model = model
    
    async def chat(self, messages: list) -> str:
        return "No client configured"


class CloudflareClient(LLMClient):
    """Cloudflare Workers AI"""
    
    async def chat(self, messages: list) -> str:
        import requests
        
        url = f"https://api.cloudflare.com/client/v4/accounts/{Config.CLOUDFLARE_ACCOUNT_ID}/ai/run/{self.model}"
        headers = {
            "Authorization": f"Bearer {self.api_key or Config.CLOUDFLARE_API_TOKEN}",
            "Content-Type": "application/json"
        }
        
        try:
            resp = requests.post(url, json={"messages": messages}, headers=headers, timeout=30)
            data = resp.json()
            if data.get("success"):
                return data["result"]["response"]
            return "Error: Unknown error"
        except Exception as e:
            return f"Error: {str(e)}"


class OpenAIClient(LLMClient):
    """OpenAI GPT"""
    
    async def chat(self, messages: list) -> str:
        import requests
        
        if not self.api_key:
            return "Error: OPENAI_API_KEY not set"
        
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        try:
            resp = requests.post(url, json={
                "model": self.model or "gpt-4o-mini",
                "messages": messages
            }, headers=headers, timeout=30)
            data = resp.json()
            if "choices" in data:
                return data["choices"][0]["message"]["content"]
            return f"Error: {data.get('error', {}).get('message', 'Unknown')}"
        except Exception as e:
            return f"Error: {str(e)}"


class ClaudeClient(LLMClient):
    """Anthropic Claude"""
    
    async def chat(self, messages: list) -> str:
        import requests
        
        if not self.api_key:
            return "Error: ANTHROPIC_API_KEY not set"
        
        # Convert messages
        system = next((m["content"] for m in messages if m["role"] == "system"), "")
        user_msgs = [m for m in messages if m["role"] != "system"]
        
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
        }
        
        try:
            resp = requests.post(url, json={
                "model": self.model or "claude-3-haiku-20240307",
                "max_tokens": 1024,
                "system": system,
                "messages": user_msgs
            }, headers=headers, timeout=30)
            data = resp.json()
            if "content" in data:
                return data["content"][0]["text"]
            return f"Error: {data.get('error', {}).get('message', 'Unknown')}"
        except Exception as e:
            return f"Error: {str(e)}"


class GeminiClient(LLMClient):
    """Google Gemini"""
    
    async def chat(self, messages: list) -> str:
        import requests
        
        if not self.api_key:
            return "Error: GEMINI_API_KEY not set"
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model or 'gemini-1.5-flash'}:generateContent?key={self.api_key}"
        
        # Convert messages
        contents = []
        for m in messages:
            if m["role"] != "system":
                contents.append({"role": m["role"], "parts": [{"text": m["content"]}]})
        
        try:
            resp = requests.post(url, json={"contents": contents}, timeout=30)
            data = resp.json()
            if "candidates" in data:
                return data["candidates"][0]["content"]["parts"][0]["text"]
            return f"Error: {data.get('error', {}).get('message', 'Unknown')}"
        except Exception as e:
            return f"Error: {str(e)}"


class GroqClient(LLMClient):
    """Groq (fast inference)"""
    
    async def chat(self, messages: list) -> str:
        import requests
        
        if not self.api_key:
            return "Error: GROQ_API_KEY not set"
        
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        try:
            resp = requests.post(url, json={
                "model": self.model or "llama3-70b-8192",
                "messages": messages
            }, headers=headers, timeout=30)
            data = resp.json()
            if "choices" in data:
                return data["choices"][0]["message"]["content"]
            return f"Error: {data.get('error', {}).get('message', 'Unknown')}"
        except Exception as e:
            return f"Error: {str(e)}"


class OllamaClient(LLMClient):
    """Ollama (local)"""
    
    async def chat(self, messages: list) -> str:
        import requests
        
        try:
            resp = requests.post(
                f"{Config.OLLAMA_HOST}/api/chat",
                json={"model": self.model or Config.OLLAMA_MODEL, "messages": messages, "stream": False},
                timeout=120
            )
            data = resp.json()
            if "message" in data:
                return data["message"]["content"]
            return f"Error: Make sure Ollama is running (ollama serve)"
        except Exception as e:
            return f"Error: Ollama not running. Start with 'ollama serve'"


# ============================================================
# MAIN DEMO
# ============================================================

# ANSI Colors
C = {"R": "\033[0m", "RED": "\033[91m", "GREEN": "\033[92m", "YELLOW": "\033[93m",
     "BLUE": "\033[94m", "CYAN": "\033[96m", "WHITE": "\033[97m", "BOLD": "\033[1m"}


def print_header():
    print(f"""
{C['CYAN']}╭──────────────────────────────────────────────────────────────────────╮{C['R']}
{C['CYAN']}│                                                              {C['CYAN']}│{C['R']}
{C['CYAN']}│   {C['BOLD']}{C['BLUE']}████{C['R']}{C['CYAN']}╗  {C['BOLD']}{C['CYAN']}████{C['R']}{C['CYAN']}╗  {C['BOLD']}{C['BLUE']}████{C['R']}{C['CYAN']}╗  {C['BOLD']}{C['BLUE']}████{C['R']}{C['CYAN']}╗  {C['GREEN']}Demo Token Expired{C['R']}               {C['CYAN']}│{C['R']}
{C['CYAN']}│{C['R']}                                                              {C['CYAN']}│{C['R']}
{C['CYAN']}╰──────────────────────────────────────────────────────────────────────╯{C['R']}
{C['RED']}⚠️  The demo token is expired or invalid.{C['R']}
{C['YELLOW']}Please set your own API key:{C['R']}
  1. Edit demo.py and add your API key in the Config class
  2. Or export: export CLOUDFLARE_API_TOKEN=your_token
  3. Or choose another provider (Ollama, OpenAI, etc.)
""")


def get_client(choice: str) -> tuple:
    """Get LLM client for chosen provider"""
    clients = {
        "1": (CloudflareClient("", "@cf/meta/llama-3-8b-instruct"), "Cloudflare AI"),
        "2": (OllamaClient(), "Ollama (local)"),
        "3": (OpenAIClient(Config.OPENAI_API_KEY, "gpt-4o-mini"), "OpenAI GPT-4"),
        "4": (ClaudeClient(Config.ANTHROPIC_API_KEY, "claude-3-haiku-20240307"), "Claude"),
        "5": (GeminiClient(Config.GEMINI_API_KEY, "gemini-1.5-flash"), "Gemini"),
        "6": (GroqClient(Config.GROQ_API_KEY, "llama3-70b-8192"), "Groq"),
    }
    return clients.get(choice, (None, None))


async def main():
    print_header()
    
    print(f"\n{C['YELLOW']}Choose your AI provider:{C['R']}\n")
    print(f"  {C['CYAN']}[1]{C['R']} Cloudflare AI (free, fast)")
    print(f"  {C['CYAN']}[2]{C['R']} Ollama (local, offline)")
    print(f"  {C['CYAN']}[3]{C['R']} OpenAI GPT-4")
    print(f"  {C['CYAN']}[4]{C['R']} Claude")
    print(f"  {C['CYAN']}[5]{C['R']} Gemini")
    print(f"  {C['CYAN']}[6]{C['R']} Groq")
    print(f"  {C['CYAN']}[0]{C['R']} Exit\n")
    
    choice = input(f"{C['CYAN']}Egytronic>{C['R']} ").strip()
    
    if choice == "0":
        print(f"\n{C['YELLOW']}Goodbye! 🧙‍♂️{C['R']}\n")
        return
    
    client, name = get_client(choice)
    if not client:
        print(f"\n{C['RED']}Invalid choice!{C['R']}\n")
        return
    
    print(f"\n{C['GREEN']}Connected to {name}{C['R']}")
    print(f"{C['GREEN']}Start chatting! (type 'exit' to switch providers){C['R']}\n")
    
    messages = [{"role": "system", "content": "You are Egytronic AI, a helpful AI assistant. Respond in a friendly, concise manner."}]
    
    while True:
        user_input = input(f"{C['CYAN']}You:{C['R']} ").strip()
        if not user_input:
            continue
        if user_input.lower() in ["exit", "quit"]:
            break
        
        messages.append({"role": "user", "content": user_input})
        
        print(f"\n{C['YELLOW']}Egytronic: {C['R']}", end=" ", flush=True)
        
        response = await client.chat(messages)
        
        if response.startswith("Error"):
            print(f"\n{C['RED']}{response}{C['R']}\n")
        else:
            print(f"{C['GREEN']}{response}{C['R']}\n")
            messages.append({"role": "assistant", "content": response})
    
    print(f"\n{C['YELLOW']}Back to menu!{C['R']}\n")
    await main()


if __name__ == "__main__":
    asyncio.run(main())