"""
Egytronic Tools - File System Tool
"""

import os
import shutil
import aiofiles
from pathlib import Path
from typing import Any, Dict, List, Optional
from egytronic.tools.base import BaseTool, register_tool


class FileSystemTool(BaseTool):
    """
    File System Tool
    
    Read, write, list, and manage files and directories.
    """
    
    name = "file_system"
    description = "Read, write, list, and manage files and directories"
    
    def __init__(self, root_dir: str = ".", **kwargs):
        super().__init__(**kwargs)
        self.root_dir = Path(root_dir).resolve()
        
        # Ensure root directory exists
        self.root_dir.mkdir(parents=True, exist_ok=True)
    
    def _resolve_path(self, path: str) -> Path:
        """Resolve path relative to root"""
        p = Path(path)
        if not p.is_absolute():
            p = self.root_dir / path
        return p.resolve()
    
    async def execute(self, action: str = "read", path: str = "", content: str = "", **kwargs) -> Any:
        """
        Execute file system action
        
        Actions:
        - read: Read file content
        - write: Write content to file
        - append: Append to file
        - list: List directory
        - mkdir: Create directory
        - delete: Delete file or directory
        - copy: Copy file
        - move: Move file
        - exists: Check if file exists
        - stat: Get file stats
        - read_json: Read JSON file
        - write_json: Write JSON file
        - read_yaml: Read YAML file
        - write_yaml: Write YAML file
        - glob: Find files by pattern
        - find: Find files by name
        """
        action = action.lower()
        path_obj = self._resolve_path(path)
        
        if action == "read":
            if path_obj.is_dir():
                raise ValueError(f"{path} is a directory")
            async with aiofiles.open(path_obj, "r") as f:
                return await f.read()
        
        elif action == "write":
            path_obj.parent.mkdir(parents=True, exist_ok=True)
            async with aiofiles.open(path_obj, "w") as f:
                await f.write(content)
            return f"Written to {path}"
        
        elif action == "append":
            async with aiofiles.open(path_obj, "a") as f:
                await f.write(content)
            return f"Appended to {path}"
        
        elif action == "list":
            if path_obj.is_file():
                return [path_obj.name]
            return [str(p.relative_to(path_obj)) for p in path_obj.iterdir()]
        
        elif action == "mkdir":
            path_obj.mkdir(parents=True, exist_ok=True)
            return f"Created directory {path}"
        
        elif action == "delete":
            if path_obj.is_dir():
                shutil.rmtree(path_obj)
            else:
                path_obj.unlink()
            return f"Deleted {path}"
        
        elif action == "copy":
            dest = kwargs.get("dest")
            if not dest:
                raise ValueError("dest required for copy")
            dest_obj = self._resolve_path(dest)
            dest_obj.parent.mkdir(parents=True, exist_ok=True)
            if path_obj.is_dir():
                shutil.copytree(path_obj, dest_obj)
            else:
                shutil.copy2(path_obj, dest_obj)
            return f"Copied {path} to {dest}"
        
        elif action == "move":
            dest = kwargs.get("dest")
            if not dest:
                raise ValueError("dest required for move")
            dest_obj = self._resolve_path(dest)
            dest_obj.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(path_obj), str(dest_obj))
            return f"Moved {path} to {dest}"
        
        elif action == "exists":
            return path_obj.exists()
        
        elif action == "stat":
            if not path_obj.exists():
                return None
            stat = path_obj.stat()
            return {
                "size": stat.st_size,
                "mtime": stat.st_mtime,
                "mode": stat.st_mode,
                "is_file": path_obj.is_file(),
                "is_dir": path_obj.is_dir()
            }
        
        elif action == "read_json":
            import json
            async with aiofiles.open(path_obj, "r") as f:
                content = await f.read()
            return json.loads(content)
        
        elif action == "write_json":
            import json
            path_obj.parent.mkdir(parents=True, exist_ok=True)
            async with aiofiles.open(path_obj, "w") as f:
                await f.write(json.dumps(content, indent=2))
            return f"Written JSON to {path}"
        
        elif action == "read_yaml":
            import yaml
            async with aiofiles.open(path_obj, "r") as f:
                content = await f.read()
            return yaml.safe_load(content)
        
        elif action == "write_yaml":
            import yaml
            path_obj.parent.mkdir(parents=True, exist_ok=True)
            async with aiofiles.open(path_obj, "w") as f:
                await f.write(yaml.dump(content))
            return f"Written YAML to {path}"
        
        elif action == "glob":
            pattern = kwargs.get("pattern", "*")
            return [str(p.relative_to(path_obj)) for p in path_obj.glob(pattern)]
        
        elif action == "find":
            name = kwargs.get("name", "")
            results = list(path_obj.rglob(name))
            return [str(p.relative_to(self.root_dir)) for p in results]
        
        else:
            raise ValueError(f"Unknown action: {action}")
    
    def _get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["read", "write", "append", "list", "mkdir", "delete", 
                            "copy", "move", "exists", "stat", "read_json", 
                            "write_json", "read_yaml", "write_yaml", "glob", "find"],
                    "description": "File system action"
                },
                "path": {"type": "string", "description": "File or directory path"},
                "content": {"type": "string", "description": "Content to write"},
                "dest": {"type": "string", "description": "Destination path for copy/move"},
                "pattern": {"type": "string", "description": "Pattern for glob"},
                "name": {"type": "string", "description": "Name for find"}
            },
            "required": ["action", "path"]
        }


register_tool("file_system", FileSystemTool)