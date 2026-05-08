"""
Egytronic OpenCLAW Integration
"""

import asyncio
import json
from typing import Any, Dict, List, Optional
from egytronic.agent import Agent


class OpenCLAW:
    """
    OpenCLAW Integration
    
    Enables command-line agent work anywhere.
    """
    
    def __init__(
        self,
        agent: Optional[Agent] = None,
        remote_endpoint: str = "https://api.openclaw.dev",
        **kwargs
    ):
        self.agent = agent
        self.remote_endpoint = remote_endpoint
        self.config = kwargs
        self._session = None
    
    async def execute(
        self,
        command: str,
        environment: str = "local",
        **kwargs
    ) -> str:
        """
        Execute command via OpenCLAW
        
        Args:
            command: Command to execute
            environment: Environment (local, cloud, server)
            **kwargs: Additional parameters
            
        Returns:
            Command output
        """
        if environment == "local":
            return await self._execute_local(command)
        elif environment == "cloud":
            return await self._execute_cloud(command)
        elif environment == "server":
            return await self._execute_server(command)
        else:
            raise ValueError(f"Unknown environment: {environment}")
    
    async def _execute_local(self, command: str) -> str:
        """Execute locally"""
        from ..tools import TerminalTool
        terminal = TerminalTool()
        return await terminal.execute(command=command, action="run")
    
    async def _execute_cloud(self, command: str) -> str:
        """Execute via cloud"""
        import aiohttp
        payload = {
            "command": command,
            "environment": "cloud",
            **self.config
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.remote_endpoint}/execute",
                json=payload
            ) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"OpenCLAW error: {error}")
                result = await resp.json()
                return result.get("output", "")
    
    async def _execute_server(self, command: str) -> str:
        """Execute on remote server"""
        import aiohttp
        payload = {
            "command": command,
            "environment": "server",
            **self.config
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.remote_endpoint}/execute",
                json=payload
            ) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"OpenCLAW error: {error}")
                result = await resp.json()
                return result.get("output", "")
    
    async def upload_file(
        self,
        file_path: str,
        destination: str = "",
        environment: str = "cloud"
    ) -> str:
        """Upload file to remote"""
        import aiohttp
        from pathlib import Path
        
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        
        data = aiohttp.FormData()
        data.add_field("file", path.open("rb"), filename=path.name)
        data.add_field("destination", destination or str(path))
        data.add_field("environment", environment)
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.remote_endpoint}/upload",
                data=data
            ) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"OpenCLAW error: {error}")
                result = await resp.json()
                return result.get("message", "File uploaded")
    
    async def download_file(
        self,
        remote_path: str,
        local_path: str = "",
        environment: str = "cloud"
    ) -> str:
        """Download file from remote"""
        import aiohttp
        params = {
            "path": remote_path,
            "environment": environment
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.remote_endpoint}/download",
                params=params
            ) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"OpenCLAW error: {error}")
                
                content = await resp.read()
                local_path = local_path or remote_path.split("/")[-1]
                
                with open(local_path, "wb") as f:
                    f.write(content)
                
                return f"Downloaded to {local_path}"
    
    async def list_environments(self) -> List[Dict[str, Any]]:
        """List available environments"""
        import aiohttp
        
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.remote_endpoint}/environments"
            ) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"OpenCLAW error: {error}")
                return await resp.json()
    
    async def get_status(self) -> Dict[str, Any]:
        """Get OpenCLAW status"""
        import aiohttp
        
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.remote_endpoint}/status"
            ) as resp:
                if resp.status != 200:
                    return {"status": "disconnected"}
                return await resp.json()


# Agent extension for OpenCLAW
class OpenCLAWAgent:
    """
    Extended Agent with OpenCLAW support
    
    Adds OpenCLAW capabilities to agent.
    """
    
    def __init__(self, agent: Agent):
        self.agent = agent
        self.openclaw = OpenCLAW(agent)
    
    async def run_with_openclaw(
        self,
        prompt: str,
        environment: str = "auto",
        **kwargs
    ) -> str:
        """Run agent with possible remote execution"""
        # First run locally
        result = await self.agent.run(prompt)
        
        # If needed, can offload to cloud via OpenCLAW
        if environment == "cloud":
            # Use OpenCLAW for heavy tasks
            pass
        
        return result
    
    def __getattr__(self, name: str):
        """Delegate to agent"""
        return getattr(self.agent, name)