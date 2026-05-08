# Egytronic Agent Framework

<div align="center">

# 🤖 Egytronic Agent Framework

**Universal Agent Development Platform**

[Python](#python) • [JavaScript](#javascript) • [CLI](#cli) • [API](#api)

Turn any LLM (local or API) into a powerful autonomous agent with tools

---

## ✨ Features

- 🌐 **Universal LLM Support** - Connect to Gemini, Claude, OpenAI, Ollama, LM Studio, Cloudflare Workers AI, and more
- 🛠️ **Rich Tool Ecosystem** - Browser automation, file system, terminal, MCP servers, APIs, web connectors
- 🎯 **Advanced Control** - Full agent customization with hooks, middleware, and plugins
- 🔌 **MCP Integration** - Model Context Protocol server support
- 🌐 **Web Automation** - Playwright, WhatsApp Web, Telegram Web integration
- ☁️ **Cloud Services** - Node.js, Python, React via free cloud services
- 📦 **Package Manager** - npm/pip/pacman integration
- 🔒 **Secure Development** - GitHub/GitLab package management
- 🖥️ **Device Access** - Physical device and browser access via extension bridge
- ⚡ **OpenCLAW Integration** - Command-line agent work anywhere

---

## 🚀 Quick Start

```python
from egytronic import Agent

# Create agent with Gemini
agent = Agent(
    model="gemini",
    model_name="gemini-2.0-flash",
    api_key="your-gemini-api-key"
)

# Add tools
agent.add_tool("browser")
agent.add_tool("file_system")
agent.add_tool("terminal")

# Run agent
result = agent.run("Search for latest AI news")
print(result)
```

---

## 📖 Documentation

### Python

```python
# Full agent with custom tools
from egytronic import Agent
from egytronic.tools import Browser, FileSystem, Terminal
from egytronic.llm import GeminiAdapter, CloudflareAdapter

# Configure LLM
llm = GeminiAdapter(api_key="your-key")

# Create agent
agent = Agent(
    llm=llm,
    tools=[Browser(), FileSystem(), Terminal()],
    system_prompt="You are a helpful AI assistant"
)

# Execute tasks
response = agent.run("Create a file called hello.txt with 'Hello World'")
```

### JavaScript/TypeScript

```javascript
import { Agent } from 'egytronic';

const agent = new Agent({
  model: 'gemini',
  modelName: 'gemini-2.0-flash',
  apiKey: process.env.GEMINI_API_KEY,
  tools: ['browser', 'filesystem', 'terminal']
});

const result = await agent.run('What is the weather today?');
console.log(result);
```

### CLI Usage

```bash
# Install CLI
npm install -g @egytronic/cli

# Run agent
egy agent "Write a Python script that prints Hello World"

# Interactive mode
egy chat

# Create new agent project
egy init my-agent

# Add tools
egy add tool browser
egy add tool filesystem
```

---

## 🛠️ Available Tools

| Tool | Description | Status |
|------|-------------|--------|
| `browser` | Browser automation with Playwright | ✅ |
| `browser_bridge` | Physical browser via extension | ✅ |
| `file_system` | Read/write files and directories | ✅ |
| `terminal` | Execute shell commands | ✅ |
| `mcp` | MCP server integration | ✅ |
| `vm` | Virtual machine access | ✅ |
| `api` | REST API calls | ✅ |
| `playwright` | Advanced web automation | ✅ |
| `whatsapp` | WhatsApp Web automation | ✅ |
| `telegram` | Telegram Web automation | ✅ |
| `github` | GitHub API integration | ✅ |
| `npm` | npm package management | ✅ |
| `pip` | Python package management | ✅ |
| `pacman` | Arch pacman integration | ✅ |
| `skills` | Custom skills system | ✅ |
| `openclaw` | OpenCLAW integration | ✅ |
| `cloud` | Cloud service access | ✅ |

---

## 🔌 LLM Adapters

| Provider | Model | Status |
|----------|------|--------|
| Google Gemini | gemini-2.0-flash, etc. | ✅ |
| Cloudflare Workers AI | llama-3-8b-instruct, etc. | ✅ |
| OpenAI | gpt-4o, gpt-4o-mini | ✅ |
| Anthropic Claude | claude-3-5-sonnet | ✅ |
| Ollama | local models | ✅ |
| LM Studio | local models | ✅ |
| HuggingFace | inference endpoints | ✅ |
| Together AI | various models | ✅ |

---

## 🏗️ Architecture

```
egytronic/
├── agent/              # Core agent logic
│   ├── agent.py         # Main Agent class
│   ├── executor.py      # Task execution
│   └── memory.py       # Agent memory
├── llm/                # LLM adapters
│   ├── base.py         # Base adapter
│   ├── gemini.py      # Gemini adapter
│   ├── cloudflare.py  # Cloudflare adapter
│   ├── openai.py      # OpenAI adapter
│   └── ollama.py      # Ollama adapter
├── tools/              # Tool integrations
│   ├── base.py        # Base tool
│   ├── browser.py     # Browser automation
│   ├── filesystem.py  # File system
│   ├── terminal.py    # Terminal
│   ├── mcp.py         # MCP integration
│   ├── playwright.py  # Playwright
│   ├── whatsapp.py    # WhatsApp Web
│   ├── telegram.py    # Telegram Web
│   └── ...
├── skills/             # Skills system
│   ├── skill.py        # Base skill
│   └── registry.py    # Skill registry
├── cli/                # CLI interface
│   └── main.py         # CLI entry
├── api/                # REST API
│   └── server.py       # API server
└── config/             # Configuration
    └── config.py       # Config management
```

---

## ⚙️ Configuration

```python
#egytronic.config
{
  "llm": {
    "provider": "gemini",
    "model": "gemini-2.0-flash",
    "api_key": "${GEMINI_API_KEY}"
  },
  "tools": {
    "enabled": ["browser", "filesystem", "terminal"],
    "config": {
      "browser": {
        "headless": false,
        "viewport": {"width": 1920, "height": 1080}
      }
    }
  },
  "openclaw": {
    "enabled": true,
    "remote_endpoint": "https://api.openclaw.dev"
  }
}
```

---

## 🌐 Environment Variables

```bash
# LLM API Keys
GEMINI_API_KEY=your-gemini-key
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-token

# GitHub
GITHUB_TOKEN=your-github-token

# MCP Servers
MCP_SERVER_URL=http://localhost:3000
```

---

## 🎓 Examples

### Basic Agent

```python
from egytronic import Agent

agent = Agent(model="gemini", api_key="key")
result = agent.run("Hello, how are you?")
```

### Agent with Tools

```python
from egytronic import Agent
from egytronic.tools import Browser, FileSystem

agent = Agent(
    model="gemini",
    api_key="key",
    tools=[Browser(), FileSystem()]
)
result = agent.run("Create a Python file that prints 'Hello World'")
```

### Cloudflare AI

```python
from egytronic import Agent
from egytronic.llm import CloudflareAdapter

llm = CloudflareAdapter(
    account_id="your-account-id",
    api_token="your-token",
    model="@cf/meta/llama-3-8b-instruct"
)
agent = Agent(llm=llm)
result = agent.run("Explain quantum computing")
```

### Custom Tool

```python
from egytronic.tools import BaseTool
from egytronic import Agent

class MyTool(BaseTool):
    name = "my_tool"
    description = "A custom tool"
    
    def execute(self, **kwargs):
        return "Tool executed!"

agent = Agent(model="gemini", api_key="key")
agent.add_tool(MyTool())
```

### MCP Server

```python
from egytronic import Agent
from egytronic.tools import MCPTool

agent = Agent(
    model="gemini",
    api_key="key",
    tools=[MCPTool(server_url="http://localhost:3000")]
)
```

---

## 🔗 OpenCLAW Integration

Egytronic fully supports OpenCLAW for command-line agent work:

```python
from egytronic import Agent
from egytronic.integrations import OpenCLAW

agent = Agent(model="gemini", api_key="key")
openclaw = OpenCLAW(agent)

# Work anywhere - local, cloud, server
result = await openclaw.execute(
    command="npm install package",
    environment="cloud"
)
```

---

## 📄 License

**Egytronic** - Universal Agent Development Platform

© 2026 Egytronic. All rights reserved.

---

<p align="center">Built with ❤️ by <a href="https://egytronic.com">Egytronic</a></p>