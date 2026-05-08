"""
Egytronic CLI
"""

import asyncio
import os
import sys
import json
from typing import Optional

import click
from ..agent import Agent
from ..llm import GeminiAdapter, CloudflareAdapter


@click.group()
@click.version_option(version="1.0.0")
def cli():
    """Egytronic - Universal Agent Development Platform"""
    pass


@cli.command()
@click.argument("prompt")
@click.option("--model", default="gemini", help="LLM model to use")
@click.option("--api-key", help="API key")
@click.option("--model-name", default="gemini-2.0-flash", help="Model name")
def run(prompt: str, model: str, api_key: Optional[str], model_name: str):
    """Run agent with a prompt"""
    try:
        agent = Agent(model=model, api_key=api_key, model_name=model_name)
        result = agent.run_sync(prompt)
        click.echo(result)
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.option("--model", default="gemini", help="LLM model to use")
@click.option("--api-key", help="API key")
def chat(model: str, api_key: Optional[str]):
    """Start interactive chat"""
    click.echo("Egytronic Chat (Ctrl+C to exit)")
    
    agent = Agent(model=model, api_key=api_key)
    
    while True:
        try:
            prompt = input("\nYou: ")
            if not prompt.strip():
                continue
            
            if prompt.lower() in ("exit", "quit", "bye"):
                click.echo("Goodbye!")
                break
            
            result = agent.run_sync(prompt)
            click.echo(f"\nAgent: {result}")
        except KeyboardInterrupt:
            click.echo("\nGoodbye!")
            break
        except Exception as e:
            click.echo(f"Error: {e}", err=True)


@cli.command()
@click.argument("project_name")
def init(project_name: str):
    """Initialize new agent project"""
    import shutil
    from pathlib import Path
    
    # Create project directory
    path = Path(project_name)
    path.mkdir(exist_ok=True)
    
    # Copy template
    template = Path(__file__).parent / "templates" / "agent"
    if template.exists():
        for file in template.rglob("*"):
            if file.is_file():
                dest = path / file.relative_to(template)
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(file, dest)
    
    click.echo(f"Initialized agent project: {project_name}")


@cli.command()
@click.option("--model", default="gemini", help="LLM model")
@click.option("--api-key", help="API key")
@click.option("--port", default=8080, help="Server port")
def serve(model: str, api_key: Optional[str], port: int):
    """Start API server"""
    from .server import run_server
    
    click.echo(f"Starting server on port {port}...")
    run_server(model=model, api_key=api_key, port=port)


@cli.command()
@click.argument("action")
@click.option("--tool", help="Tool name")
@click.option("--args", help="Tool arguments as JSON")
def tool(action: str, tool: Optional[str], args: Optional[str]):
    """Execute tool directly"""
    if action == "list":
        from ..tools import get_tool_by_name
        click.echo("Available tools:")
        tools = [
            "browser", "browser_bridge", "file_system", "terminal",
            "mcp", "playwright", "whatsapp", "telegram",
            "github", "npm", "pip", "pacman", "vm", "api", "cloud"
        ]
        for t in tools:
            click.echo(f"  - {t}")
    elif tool:
        from ..tools import get_tool_by_name
        tool_instance = get_tool_by_name(tool)
        if tool_instance:
            kwargs = json.loads(args) if args else {}
            result = asyncio.run(tool_instance.execute(**kwargs))
            click.echo(result)
        else:
            click.echo(f"Tool not found: {tool}", err=True)


def main():
    cli()


if __name__ == "__main__":
    main()