#!/usr/bin/env python3
"""
Egytronic CLI - Awesome ASCII CLI with Rich Styling

╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║     █████╗  ██████╗ ██████╗     ███████╗ ██████╗ ██████╗  ║
║    ██╔══██╗██╔════╝██╔═══██╗    ██╔════╝██╔═══██╗██╔══██╗ ║
║    ███████║██║     ██║   ██║    █████╗  ██║   ██║██████╔╝ ║
║    ██╔══██║██║     ██║   ██║    ██╔══╝  ██║   ██║██╔══██╗ ║
║    ██║  ██║╚██████╗╚██████╔╝    ███████╗╚██████╔╝██║  ██║ ║
║    ╚═╝  ╚═╝ ╚════╝ ╚════╝     ╚══════╝ ╚════╝ ╚═╝  ╚═╝ ║
║                          1.0                                 ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝

Author: Egytronic © 2026
License: MIT
"""

import asyncio
import os
import sys
import json
from pathlib import Path
from typing import Optional

# Try to import rich for awesome styling
try:
    from rich.console import Console
    from rich.table import Table
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False
    Console = None

console = Console() if RICH_AVAILABLE else None


# ════════════════════════════════════════════════════════════════════════════════
# ASCII ART BANNER
# ════════════════════════════════════════════════════════════════════════════

BANNER = """
╔════════════════════════════════════════════════════════════════════════════════╗
║                                                                    ║
║     █████╗  ██████╗ ██████╗     ███████╗ ██████╗ ██████╗       ║
║    ██╔══██╗██╔════╝██╔═══██╗    ██╔════╝██╔═══██╗██╔══██╗      ║
║    ███████║██║     ██║   ██║    █████╗  ██║   ██║██████╔╝      ║
║    ██╔══██║██║     ██║   ██║    ██╔══╝  ██║   ██║██╔══██╗      ║
║    ██║  ██║╚██████╗╚██████╔╝    ███████╗╚██████╔╝██║  ██║      ║
║    ╚═╝  ╚═╝ ╚════╝ ╚════╝     ╚══════╝ ╚════╝ ╚═╝  ╚═╝      ║
║                         1.0                                       ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════════╝
"""

# Provider logos
PROVIDER_LOGOS = {
    "gemini": "🔮 Google Gemini",
    "cloudflare": "☁️ Cloudflare Workers AI",
    "openai": "🧠 OpenAI",
    "anthropic": "📖 Anthropic",
    "huggingface": "🤗 HuggingFace",
    "openrouter": "🌐 OpenRouter",
    "groq": "⚡ Groq",
    "zhipu": "🐉 Zhipu AI (GLM)",
    "kimi": "🌙 Kimi (Moonshot)",
    "together": "🔥 Together AI",
    "ollama": "🐋 Ollama (Local)",
}


# ════════════════════════════════════════════════════════════════════════════
# STYLING HELPERS  
# ════════════════════════════════════════════════════════════════════════════

def print_banner():
    """Print awesome banner"""
    if RICH_AVAILABLE and console:
        console.print(BANNER, style="bold cyan")
    else:
        print(BANNER)


def print_header(text: str):
    """Print header with styling"""
    print(f"\n{'━' * 60}")
    print(f"  {text}")
    print(f"{'━' * 60}")


def print_success(text: str):
    """Print success message"""
    print(f"✓ {text}")


def print_error(text: str):
    """Print error message"""
    print(f"✗ {text}")


def print_info(text: str):
    """Print info message"""
    print(f"ℹ {text}")


def print_provider_table(providers: dict):
    """Print provider table"""
    print("\n📌 Available LLM Providers:")
    for name, info in providers.items():
        status = "✓" if info.get("available") else "✗"
        models = ", ".join(info.get("models", [])[:3])
        print(f"  {status} {PROVIDER_LOGOS.get(name, name)}: {models}")


def print_tools_table(tools: list):
    """Print tools table"""
    print("\n🛠️ Available Tools:")
    tool_info = {
        "browser": ("🌐", "Browser automation"),
        "browser_bridge": ("🔗", "Physical browser via extension"),
        "file_system": ("📁", "File operations"),
        "terminal": ("💻", "Shell commands"),
        "vm": ("🖥️", "Virtual machine access"),
        "mcp": ("🔌", "MCP server integration"),
        "playwright": ("🎭", "Advanced web automation"),
        "whatsapp": ("💬", "WhatsApp Web"),
        "telegram": ("✈️", "Telegram Web"),
        "github": ("🐙", "GitHub API"),
        "npm": ("📦", "npm package manager"),
        "pip": ("🐍", "Python packages"),
        "pacman": ("🏹", "Arch pacman"),
        "api": ("🌍", "REST API calls"),
        "cloud": ("☁️", "Cloud services"),
        "skills": ("✨", "Custom skills"),
        "openclaw": ("🦞", "OpenCLAW integration"),
    }
    
    for tool in tools:
        icon, desc = tool_info.get(tool, ("?", "Unknown"))
        print(f"  {icon} {tool}: {desc}")


# ════════════════════════════════════════════════════════════════════════════
# PROVIDER MANAGEMENT
# ════════════════════════════════════════════════════════════════════════════

class ProviderManager:
    """Manage LLM providers and API keys"""
    
    def __init__(self):
        self.providers = {
            "gemini": {
                "name": "Google Gemini",
                "env_var": "GEMINI_API_KEY",
                "models": ["gemini-2.0-flash", "gemini-1.5-pro"],
                "available": False
            },
            "cloudflare": {
                "name": "Cloudflare Workers AI",
                "env_vars": ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"],
                "models": ["@cf/meta/llama-3-8b-instruct", "@cf/meta/llama-3-70b-instruct"],
                "available": False
            },
            "openai": {
                "name": "OpenAI",
                "env_var": "OPENAI_API_KEY",
                "models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
                "available": False
            },
            "anthropic": {
                "name": "Anthropic Claude",
                "env_var": "ANTHROPIC_API_KEY",
                "models": ["claude-3.5-sonnet", "claude-3-opus"],
                "available": False
            },
            "huggingface": {
                "name": "HuggingFace",
                "env_var": "HUGGINGFACE_API_KEY",
                "models": ["meta-llama/Llama-3-8B-Instruct"],
                "available": False
            },
            "openrouter": {
                "name": "OpenRouter",
                "env_var": "OPENROUTER_API_KEY",
                "models": ["anthropic/claude-3.5-sonnet", "google/gemini-pro"],
                "available": False
            },
            "groq": {
                "name": "Groq",
                "env_var": "GROQ_API_KEY",
                "models": ["llama-3.1-70b-versatile", "mixtral-8x7b-32768"],
                "available": False
            },
            "zhipu": {
                "name": "Zhipu AI (GLM)",
                "env_var": "ZHIPU_API_KEY",
                "models": ["glm-4-flash", "glm-4-plus"],
                "available": False
            },
            "kimi": {
                "name": "Kimi (Moonshot)",
                "env_var": "KIMI_API_KEY",
                "models": ["kimi-flash", "kimi-pro"],
                "available": False
            },
            "together": {
                "name": "Together AI", 
                "env_var": "TOGETHER_API_KEY",
                "models": ["meta-llama/Llama-3.1-8B-Instruct-Turbo"],
                "available": False
            },
            "ollama": {
                "name": "Ollama (Local)",
                "env_var": None,
                "models": ["llama3", "mistral", "codellama"],
                "available": False
            },
        }
        self.check_providers()
    
    def check_providers(self):
        """Check which providers have API keys configured"""
        import subprocess
        for name, info in self.providers.items():
            if name == "ollama":
                try:
                    result = subprocess.run(
                        ["curl", "-s", "http://localhost:11434/api/tags"],
                        capture_output=True, timeout=2
                    )
                    info["available"] = result.returncode == 0
                except:
                    info["available"] = False
            else:
                env_var = info.get("env_var")
                if env_var:
                    info["available"] = os.environ.get(env_var) is not None
                else:
                    env_vars = info.get("env_vars", [])
                    info["available"] = any(os.environ.get(v) for v in env_vars)
    
    def get_available(self) -> dict:
        """Get available providers"""
        return {k: v for k, v in self.providers.items() if v.get("available")}
    
    def setup(self, provider: str, api_key: str, **kwargs):
        """Setup provider with API key"""
        if provider not in self.providers:
            print_error(f"Unknown provider: {provider}")
            return False
        
        info = self.providers[provider]
        env_var = info.get("env_var")
        
        if env_var:
            os.environ[env_var] = api_key
            print_success(f"Set {env_var} for {info['name']}")
        
        if provider == "cloudflare":
            if account_id := kwargs.get("account_id"):
                os.environ["CLOUDFLARE_ACCOUNT_ID"] = account_id
            if api_token := kwargs.get("api_token"):
                os.environ["CLOUDFLARE_API_TOKEN"] = api_token
        
        self.check_providers()
        return True
    
    def setup_interactive(self):
        """Interactive provider setup"""
        print_header("Provider Setup")
        print_provider_table(self.providers)
        
        print("""
[1] Google Gemini
[2] Cloudflare Workers AI  
[3] OpenAI
[4] Anthropic Claude
[5] HuggingFace
[6] Groq
[7] Zhipu AI (GLM)
[8] Kimi
[9] Together AI
[10] Ollama (Local)
[0] Exit
""")
        
        try:
            choice = int(input("Select provider: "))
        except:
            choice = 0
        
        if choice == 1:
            key = input("GEMINI_API_KEY: ").strip()
            if key: self.setup("gemini", key)
        elif choice == 2:
            aid = input("CLOUDFLARE_ACCOUNT_ID: ").strip()
            tok = input("CLOUDFLARE_API_TOKEN: ").strip()
            if aid and tok: self.setup("cloudflare", "", account_id=aid, api_token=tok)
        elif choice == 3:
            key = input("OPENAI_API_KEY: ").strip()
            if key: self.setup("openai", key)
        elif choice == 4:
            key = input("ANTHROPIC_API_KEY: ").strip()
            if key: self.setup("anthropic", key)
        elif choice == 5:
            key = input("HUGGINGFACE_API_KEY: ").strip()
            if key: self.setup("huggingface", key)
        elif choice == 6:
            key = input("GROQ_API_KEY: ").strip()
            if key: self.setup("groq", key)
        elif choice == 7:
            key = input("ZHIPU_API_KEY: ").strip()
            if key: self.setup("zhipu", key)
        elif choice == 8:
            key = input("KIMI_API_KEY: ").strip()
            if key: self.setup("kimi", key)
        elif choice == 9:
            key = input("TOGETHER_API_KEY: ").strip()
            if key: self.setup("together", key)
        elif choice == 10:
            print_info("Install from ollama.ai, run 'ollama serve'")
        
        self.check_providers()
        available = self.get_available()
        print(f"\n✓ Available: {list(available.keys())}")


# ════════════════════════════════════════════════════════════════════════════
# MAIN CLI
# ════════════════════════════════════════════════════════════════════════════

class EgytronicCLI:
    """Egytronic CLI"""
    
    def __init__(self):
        self.pm = ProviderManager()
        self.running = True
    
    def print_welcome(self):
        """Print welcome banner"""
        print_banner()
        print("\nWelcome to Egytronic 1.0!")
        print("Universal Agent Development Platform\n")
        
        available = self.pm.get_available()
        if available:
            print(f"✓ Configured: {', '.join(available.keys())}")
        else:
            print("⚠ No providers configured")
    
    def run(self):
        """Run CLI"""
        self.print_welcome()
        
        while self.running:
            print_header("Main Menu")
            print("""
[1] Chat with Agent
[2] Setup Providers
[3] List Providers
[4] List Tools
[5] Run API Server
[6] Install Dependencies
[0] Exit
""")
            
            choice = input("Choice: ").strip()
            
            if not choice or choice == "0":
                print("\nGoodbye! 👋")
                break
            
            if choice == "1":
                self.chat()
            elif choice == "2":
                self.pm.setup_interactive()
            elif choice == "3":
                print_provider_table(self.pm.providers)
            elif choice == "4":
                print_tools_table([
                    "browser", "browser_bridge", "file_system", "terminal", "vm",
                    "mcp", "playwright", "whatsapp", "telegram", "github",
                    "npm", "pip", "pacman", "api", "cloud", "skills", "openclaw"
                ])
            elif choice == "5":
                self.start_server()
            elif choice == "6":
                self.install_deps()
    
    def chat(self):
        """Chat with agent"""
        print_header("Chat Mode")
        
        available = self.pm.get_available()
        if not available:
            print_error("No providers! Run setup first")
            return
        
        print(f"Available: {list(available.keys())}")
        
        # Use Cloudflare as default
        cf_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
        cf_tok = os.environ.get("CLOUDFLARE_API_TOKEN")
        
        if cf_id and cf_tok:
            try:
                from egytronic import Agent
                agent = Agent(model="cloudflare", account_id=cf_id, api_token=cf_tok)
                
                print("\n🤖 Chat (Ctrl+C to quit)")
                while True:
                    try:
                        msg = input("\nYou: ")
                        if msg.lower() in ("exit", "quit", "bye"):
                            break
                        if not msg.strip():
                            continue
                        
                        result = agent.run_sync(msg)
                        print(f"\nAgent: {result}")
                    except KeyboardInterrupt:
                        break
            except Exception as e:
                print_error(f"Error: {e}")
        else:
            print_error("Cloudflare not configured!")
            print_info("Run setup to configure providers")
    
    def start_server(self):
        """Start API server"""
        print_header("API Server")
        try:
            from egytronic.api.server import run_server
            print_info("Starting at http://localhost:8080")
            run_server(port=8080)
        except Exception as e:
            print_error(f"Error: {e}")
    
    def install_deps(self):
        """Install dependencies"""
        print_header("Installing Dependencies")
        import subprocess
        
        deps = ["aiohttp", "click", "fastapi", "uvicorn", "pydantic", "aiofiles", "pyyaml", "playwright"]
        
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install"] + deps)
            print_success("Installed!")
        except:
            print_error("Install failed")


def main():
    """Main entry point"""
    cli = EgytronicCLI()
    cli.run()


if __name__ == "__main__":
    main()