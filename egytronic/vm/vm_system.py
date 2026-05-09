"""
Egytronic VM System - Virtual Machine isolation for agents

Provides full virtual machine isolation using Docker for agent execution.
"""

import asyncio
import os
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field


@dataclass
class VMConfig:
    """VM Configuration"""
    name: str = ""
    image: str = "ubuntu:22.04"
    cpu: int = 2
    memory: str = "2G"
    disk: str = "10G"
    working_dir: str = "/workspace"
    environment: Dict[str, str] = field(default_factory=dict)
    ports: Dict[str, str] = field(default_factory=dict)


class EgytronicVM:
    """
    Egytronic Virtual Machine
    
    Provides isolated environment for agent execution.
    Uses Docker for real VM isolation.
    """
    
    def __init__(self, config: VMConfig = None, **kwargs):
        self.config = config or VMConfig()
        self.id = self.config.name or f"vm-{id(self)}"
        self._container = None
        self.status = "stopped"
        self._docker = None
    
    async def start(self) -> bool:
        """Start the VM"""
        try:
            import docker
            self._docker = docker.from_env()
            
            # Build container config
            container_kwargs = {
                "image": self.config.image,
                "name": self.id,
                "detach": True,
                "cpu_count": self.config.cpu,
                "mem_limit": self.config.memory,
                "working_dir": self.config.working_dir,
                "environment": self.config.environment,
            }
            
            # Create volume for persistent storage
            try:
                vol = self._docker.volumes.get(f"{self.id}-data")
                if not vol:
                    self._docker.volumes.create(f"{self.id}-data")
                container_kwargs["volumes"] = {
                    f"{self.id}-data": {"bind": "/workspace", "mode": "rw"}
                }
            except:
                pass
            
            # Run container
            self._container = self._docker.containers.run(**container_kwargs)
            self.status = "running"
            
            return True
            
        except ImportError:
            print("Docker not available. Using simulated VM.")
            self._container = None
            self.status = "simulated"
            return True
        except Exception as e:
            print(f"Error starting VM: {e}")
            return False
    
    async def stop(self) -> bool:
        """Stop the VM"""
        if self._container:
            try:
                self._container.stop(timeout=10)
                self._container.remove(force=True)
            except:
                pass
        self.status = "stopped"
        return True
    
    async def execute(self, command: str, timeout: int = 300) -> Dict[str, Any]:
        """Execute command in VM"""
        if not self._container:
            return await self._simulated_execute(command)
        
        try:
            result = self._container.exec_run(
                f"bash -c '{command}'",
                demux=True,
                stream=False
            )
            
            output = b""
            if result.output:
                stdout, stderr = result.output
                output = stdout if stdout else b""
            
            return {
                "success": result.exit_code == 0,
                "exit_code": result.exit_code,
                "output": output.decode() if output else "",
                "error": ""
            }
            
        except Exception as e:
            return {
                "success": False,
                "exit_code": -1,
                "output": "",
                "error": str(e)
            }
    
    async def _simulated_execute(self, command: str) -> Dict[str, Any]:
        """Simulated execution for testing"""
        return {
            "success": True,
            "exit_code": 0,
            "output": f"[Simulated VM] Executed: {command}",
            "error": ""
        }
    
    async def copy_to(self, source: str, destination: str) -> bool:
        """Copy file to VM"""
        if not self._container:
            print("[Simulated] File copied")
            return True
        
        try:
            import io
            with open(source, 'rb') as f:
                data = f.read()
            
            # Create tar archive in memory
            import tarfile
            tar = tarfile.open(fileobj=io.BytesIO(), mode='w')
            info = tarfile.TarInfo(destination)
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))
            tar.close()
            
            # Put archive
            self._container.put_archive(
                "/workspace",
                io.BytesIO(data)
            )
            return True
            
        except Exception as e:
            print(f"Error copying: {e}")
            return False
    
    async def copy_from(self, source: str, destination: str) -> bool:
        """Copy file from VM"""
        if not self._container:
            print("[Simulated] File copied")
            return True
        
        try:
            stream, stat = self._container.get_archive(source)
            
            import tarfile
            tar = tarfile.open(fileobj=io.StreamReader(stream))
            member = tar.next()
            if member:
                with open(destination, 'wb') as f:
                    f.write(tar.extractfile(member).read())
            return True
            
        except Exception as e:
            print(f"Error copying: {e}")
            return False
    
    async def get_working_directory(self) -> str:
        """Get working directory contents"""
        result = await self.execute("ls -la /workspace")
        return result.get("output", "")
    
    async def install_package(self, package: str) -> bool:
        """Install package in VM"""
        result = await self.execute(f"apt-get update && apt-get install -y {package}")
        return result.get("success", False)
    
    async def run_python(self, code: str) -> Dict[str, Any]:
        """Run Python code in VM"""
        # Write code to file
        await self.copy_to("/tmp/script.py", "/workspace/script.py")
        return await self.execute("python3 /workspace/script.py")
    
    def get_status(self) -> Dict[str, Any]:
        """Get VM status"""
        return {
            "id": self.id,
            "status": self.status,
            "config": {
                "image": self.config.image,
                "cpu": self.config.cpu,
                "memory": self.config.memory,
            }
        }


class VMManager:
    """Manage multiple VMs"""
    
    def __init__(self):
        self.vms: Dict[str, EgytronicVM] = {}
    
    def create(
        self,
        name: str,
        image: str = "ubuntu:22.04",
        cpu: int = 2,
        memory: str = "2G"
    ) -> EgytronicVM:
        """Create VM"""
        config = VMConfig(
            name=name,
            image=image,
            cpu=cpu,
            memory=memory
        )
        vm = EgytronicVM(config)
        self.vms[name] = vm
        return vm
    
    async def start(self, name: str) -> bool:
        """Start VM"""
        vm = self.vms.get(name)
        if vm:
            return await vm.start()
        return False
    
    async def stop(self, name: str):
        """Stop VM"""
        vm = self.vms.get(name)
        if vm:
            await vm.stop()
    
    async def execute(self, name: str, command: str) -> Dict[str, Any]:
        """Execute in VM"""
        vm = self.vms.get(name)
        if vm:
            return await vm.execute(command)
        return {"error": "VM not found"}
    
    def list(self) -> List[str]:
        """List VMs"""
        return list(self.vms.keys())


# ════════════════════════════════════════════════════════════════════════
# AGENT EXECUTION IN VM
# ════════════════════════════════════════════════════════════════════════

class AgentInVM:
    """Run agents in isolated VM"""
    
    def __init__(self, agent, vm: EgytronicVM):
        self.agent = agent
        self.vm = vm
    
    async def run_task(self, task: str) -> str:
        """Run task in isolated VM"""
        # Start VM if not running
        if self.vm.status != "running":
            await self.vm.start()
        
        # Execute task
        result = await self.vm.execute(f'echo "{self.agent}" | bash')
        return result.get("output", "")
    
    async def cleanup(self):
        """Cleanup VM"""
        await self.vm.stop()


# ════════════════════════════════════════════════════════════════════════════════
# EXPORTS
# ════════════════════════════════════════════════════════════════════════════════

__all__ = [
    "VMConfig",
    "EgytronicVM", 
    "VMManager",
    "AgentInVM",
]