"""
Egytronic Examples
"""

# Example 1: Basic Agent with Gemini
"""
from egytronic import Agent

agent = Agent(
    model="gemini",
    api_key="your-gemini-api-key"
)

result = agent.run("Hello, how are you?")
print(result)
"""

# Example 2: Agent with Cloudflare Workers AI
"""
import os
from egytronic import Agent
from egytronic.llm import CloudflareAdapter

# Set up Cloudflare credentials
os.environ["CLOUDFLARE_ACCOUNT_ID"] = "your-account-id"
os.environ["CLOUDFLARE_API_TOKEN"] = "your-api-token"

agent = Agent(
    model="cloudflare",
    model_name="@cf/meta/llama-3-8b-instruct"
)

result = agent.run("Explain quantum computing in simple terms")
print(result)
"""

# Example 3: Agent with Tools
"""
from egytronic import Agent
from egytronic.tools import Browser, FileSystem, Terminal

agent = Agent(
    model="gemini",
    api_key="your-gemini-api-key",
    tools=[
        Browser(),
        FileSystem(),
        Terminal()
    ]
)

# Create a file
result = agent.run("Create a file called hello.py that prints 'Hello World'")
print(result)

# Browse the web
result = agent.run("Search for the latest AI news")
print(result)
"""

# Example 4: Custom Tool
"""
from egytronic.tools import BaseTool
from egytronic import Agent

class MyWeatherTool(BaseTool):
    name = "weather"
    description = "Get weather information for a city"
    
    async def execute(self, city: str = "", **kwargs):
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"https://api.weather.com/{city}"
            ) as resp:
                return await resp.json()

agent = Agent(
    model="gemini",
    api_key="your-gemini-api-key"
)
agent.add_tool(MyWeatherTool())

result = agent.run("What's the weather in London?")
print(result)
"""

# Example 5: OpenCLAW Integration
"""
from egytronic import Agent
from egytronic.integrations import OpenCLAW

agent = Agent(
    model="gemini",
    api_key="your-gemini-api-key"
)

openclaw = OpenCLAW(agent)

# Execute command in cloud
result = await openclaw.execute(
    command="npm install package",
    environment="cloud"
)
print(result)
"""

# Example 6: CLI Usage
"""
# Install CLI
# pip install egytronic

# Run agent
# egy run "Write a hello world program"

# Interactive chat
# egy chat --model gemini

# Initialize project
# egy init my-agent
"""

# Example 7: API Server
"""
from egytronic.api.server import run_server

# Run server
run_server(model="gemini", api_key="your-key", port=8080)

# Then call API
# curl -X POST http://localhost:8080/chat \
#   -H "Content-Type: application/json" \
#   -d '{"prompt": "Hello", "model": "gemini"}'
"""

# Example 8: Chat with Custom System Prompt
"""
from egytronic import Agent

agent = Agent(
    model="gemini",
    api_key="your-gemini-api-key",
    system_prompt="""You are a Python programming assistant.
    Always provide code examples when possible.
    Keep responses concise and practical."""
)

result = agent.run("How do I read a file in Python?")
print(result)
"""

# Example 9: Using Hooks
"""
from egytronic import Agent

async def before_think(agent, prompt):
    print(f"Thinking about: {prompt[:50]}...")

async def after_think(agent, response):
    print(f"Response length: {len(response.content)}")

agent = Agent(
    model="gemini",
    api_key="your-gemini-api-key"
)
agent.register_hook("before_think", before_think)
agent.register_hook("after_think", after_think)

result = agent.run("Hello!")
print(result)
"""

# Example 10: Memory Management
"""
from egytronic import Agent

agent = Agent(
    model="gemini",
    api_key="your-gemini-api-key",
    memory_enabled=True
)

# First interaction
result = agent.run("My name is John")
print(result)

# Second - agent remembers
result = agent.run("What's my name?")
print(result)

# Get memory
memory = agent.get_memory()
print(f"Memory length: {len(memory)}")

# Clear memory
agent.clear_memory()
"""