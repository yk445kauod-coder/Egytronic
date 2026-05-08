"""
Egytronic Tools - Terminal Tool
"""

import asyncio
import os
import subprocess
from typing import Any, Dict, List, Optional
from egytronic.tools.base import BaseTool, register_tool


class TerminalTool(BaseTool):
    """
    Terminal Tool
    
    Execute shell commands and manage terminal sessions.
    """
    
    name = "terminal"
    description = "Execute shell commands and manage terminal sessions"
    
    def __init__(
        self,
        shell: str = "/bin/bash",
        cwd: Optional[str] = None,
        env: Optional[Dict[str, str]] = None,
        timeout: int = 300,
        **kwargs
    ):
        super().__init__(**kwargs)
        self.shell = shell
        self.cwd = cwd or os.getcwd()
        self.env = env or os.environ.copy()
        self.timeout = timeout
        self._process = None
    
    async def execute(
        self,
        command: str = "",
        action: str = "run",
        **kwargs
    ) -> Any:
        """
        Execute terminal action
        
        Actions:
        - run: Run command
        - run_background: Run command in background
        - run_interactive: Run interactive command
        - kill: Kill running process
        - get_output: Get output from background process
        - pwd: Get current directory
        - env: Get environment variables
        """
        action = action.lower()
        
        if action == "run":
            return await self._run_command(command, **kwargs)
        
        elif action == "run_background":
            return await self._run_background(command, **kwargs)
        
        elif action == "run_interactive":
            return await self._run_interactive(command, **kwargs)
        
        elif action == "kill":
            if self._process:
                self._process.terminate()
                return "Process terminated"
            return "No process running"
        
        elif action == "get_output":
            # Get output from background process
            pid = kwargs.get("pid")
            if pid:
                try:
                    proc = await asyncio.create_subprocess_exec(
                        "ps", "-p", str(pid), "-o", "pid,stat,cmd",
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    stdout, _ = await proc.communicate()
                    return stdout.decode()
                except:
                    return "Process not found"
            return "No PID provided"
        
        elif action == "pwd":
            return self.cwd
        
        elif action == "env":
            return dict(self.env)
        
        else:
            raise ValueError(f"Unknown action: {action}")
    
    async def _run_command(
        self,
        command: str,
        timeout: Optional[int] = None,
        shell: bool = True,
        **kwargs
    ) -> str:
        """Run a command and return output"""
        timeout = timeout or self.timeout
        
        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=self.cwd,
                env=self.env
            )
            
            try:
                stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            except asyncio.TimeoutError:
                proc.kill()
                raise TimeoutError(f"Command timed out after {timeout} seconds")
            
            output = stdout.decode().strip()
            return output or "Command completed successfully"
        
        except Exception as e:
            return f"Error: {str(e)}"
    
    async def _run_background(
        self,
        command: str,
        **kwargs
    ) -> Dict[str, Any]:
        """Run command in background"""
        self._process = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=self.cwd,
            env=self.env
        )
        
        return {
            "pid": self._process.pid,
            "command": command,
            "status": "started"
        }
    
    async def _run_interactive(self, command: str, **kwargs) -> str:
        """Run interactive command (requires tty)"""
        proc = await asyncio.create_subprocess_exec(
            self.shell,
            "-c",
            command,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=self.cwd,
            env=self.env
        )
        
        stdout, _ = await proc.communicate()
        return stdout.decode()
    
    def _get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "Command to run"},
                "action": {
                    "type": "string",
                    "enum": ["run", "run_background", "run_interactive", "kill", "get_output", "pwd", "env"],
                    "description": "Terminal action"
                },
                "timeout": {"type": "integer", "description": "Timeout in seconds"}
            },
            "required": ["action"]
        }


register_tool("terminal", TerminalTool)


class VMTool(BaseTool):
    """
    Virtual Machine Tool
    
    Manage and access virtual machines.
    """
    
    name = "vm"
    description = "Manage and access virtual machines"
    
    def __init__(self, connection: Optional[str] = None, **kwargs):
        super().__init__(**kwargs)
        self.connection = connection
    
    async def execute(
        self,
        action: str = "list",
        vm_name: str = "",
        command: str = "",
        **kwargs
    ) -> Any:
        """
        Execute VM action
        
        Actions:
        - list: List available VMs
        - start: Start a VM
        - stop: Stop a VM
        - exec: Execute command in VM
        - ssh: SSH into VM
        - status: Get VM status
        """
        action = action.lower()
        
        if action == "list":
            # List VMs (this would connect to hypervisor)
            return ["List of VMs would be retrieved from hypervisor"]
        
        elif action == "start":
            return f"Started VM: {vm_name}"
        
        elif action == "stop":
            return f"Stopped VM: {vm_name}"
        
        elif action == "exec":
            return f"Executed in {vm_name}: {command}"
        
        elif action == "ssh":
            return f"SSH session to {vm_name}"
        
        elif action == "status":
            return "running"
        
        else:
            raise ValueError(f"Unknown action: {action}")
    
    def _get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["list", "start", "stop", "exec", "ssh", "status"],
                    "description": "VM action"
                },
                "vm_name": {"type": "string", "description": "VM name"},
                "command": {"type": "string", "description": "Command to execute"}
            },
            "required": ["action"]
        }


register_tool("vm", VMTool)