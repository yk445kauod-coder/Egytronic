"""
Egytronic Tools - GitHub Tool
"""

import os
from typing import Any, Dict, List, Optional
from egytronic.tools.base import BaseTool, register_tool


class GitHubTool(BaseTool):
    """
    GitHub Tool
    
    Interact with GitHub API for repositories, issues, PRs, and more.
    """
    
    name = "github"
    description = "Interact with GitHub API"
    
    def __init__(
        self,
        token: Optional[str] = None,
        base_url: str = "https://api.github.com",
        **kwargs
    ):
        super().__init__(**kwargs)
        self.token = token or os.environ.get("GITHUB_TOKEN")
        self.base_url = base_url
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers for GitHub API"""
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers
    
    async def execute(
        self,
        action: str = "get_user",
        owner: str = "",
        repo: str = "",
        number: int = 0,
        **kwargs
    ) -> Any:
        """
        Execute GitHub action
        
        Actions:
        - get_user: Get user info
        - get_repo: Get repository info
        - list_repos: List user repositories
        - get_issue: Get issue
        - list_issues: List issues
        - create_issue: Create issue
        - get_pr: Get pull request
        - list_prs: List pull requests
        - create_pr: Create pull request
        - get_file: Get file content
        - create_file: Create file
        - update_file: Update file
        - search: Search
        """
        import aiohttp
        action = action.lower()
        
        async with aiohttp.ClientSession() as session:
            headers = self._get_headers()
            
            if action == "get_user":
                async with session.get(
                    f"{self.base_url}/users/{owner}",
                    headers=headers
                ) as resp:
                    return await resp.json()
            
            elif action == "get_repo":
                async with session.get(
                    f"{self.base_url}/repos/{owner}/{repo}",
                    headers=headers
                ) as resp:
                    return await resp.json()
            
            elif action == "list_repos":
                async with session.get(
                    f"{self.base_url}/user/repos",
                    headers=headers
                ) as resp:
                    return await resp.json()
            
            elif action == "get_issue":
                async with session.get(
                    f"{self.base_url}/repos/{owner}/{repo}/issues/{number}",
                    headers=headers
                ) as resp:
                    return await resp.json()
            
            elif action == "list_issues":
                async with session.get(
                    f"{self.base_url}/repos/{owner}/{repo}/issues",
                    headers=headers
                ) as resp:
                    return await resp.json()
            
            elif action == "create_issue":
                data = kwargs.get("data", {})
                async with session.post(
                    f"{self.base_url}/repos/{owner}/{repo}/issues",
                    json=data,
                    headers=headers
                ) as resp:
                    return await resp.json()
            
            elif action == "get_pr":
                async with session.get(
                    f"{self.base_url}/repos/{owner}/{repo}/pulls/{number}",
                    headers=headers
                ) as resp:
                    return await resp.json()
            
            elif action == "list_prs":
                async with session.get(
                    f"{self.base_url}/repos/{owner}/{repo}/pulls",
                    headers=headers
                ) as resp:
                    return await resp.json()
            
            elif action == "create_pr":
                data = kwargs.get("data", {})
                async with session.post(
                    f"{self.base_url}/repos/{owner}/{repo}/pulls",
                    json=data,
                    headers=headers
                ) as resp:
                    return await resp.json()
            
            elif action == "get_file":
                async with session.get(
                    f"{self.base_url}/repos/{owner}/{repo}/contents/{kwargs.get('path')}",
                    headers=headers
                ) as resp:
                    return await resp.json()
            
            elif action == "search":
                query = kwargs.get("query", "")
                async with session.get(
                    f"{self.base_url}/search/code?q={query}",
                    headers=headers
                ) as resp:
                    return await resp.json()
            
            else:
                raise ValueError(f"Unknown action: {action}")
    
    def _get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["get_user", "get_repo", "list_repos", "get_issue", "list_issues", 
                            "create_issue", "get_pr", "list_prs", "create_pr", "get_file", "search"],
                    "description": "GitHub action"
                },
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "number": {"type": "integer", "description": "Issue or PR number"}
            },
            "required": ["action"]
        }


register_tool("github", GitHubTool)


class NPMTool(BaseTool):
    """
    NPM Tool
    
    Interact with npm for package management.
    """
    
    name = "npm"
    description = "Interact with npm package manager"
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._terminal = None
    
    async def execute(
        self,
        action: str = "install",
        package: str = "",
        options: str = "",
        **kwargs
    ) -> Any:
        """
        Execute npm action
        
        Actions:
        - install: Install package
        - uninstall: Uninstall package
        - update: Update package
        - search: Search packages
        - publish: Publish package
        - info: Get package info
        - list: List installed packages
        - init: Initialize package
        - run: Run script
        """
        action = action.lower()
        
        if not self._terminal:
            from .terminal import TerminalTool
            self._terminal = TerminalTool()
        
        if action == "install":
            cmd = f"npm install {package} {options}"
            return await self._terminal.execute(command=cmd, action="run")
        
        elif action == "uninstall":
            cmd = f"npm uninstall {package}"
            return await self._terminal.execute(command=cmd, action="run")
        
        elif action == "update":
            cmd = f"npm update {package}"
            return await self._terminal.execute(command=cmd, action="run")
        
        elif action == "search":
            cmd = f"npm search {package}"
            return await self._terminal.execute(command=cmd, action="run")
        
        elif action == "publish":
            cmd = "npm publish"
            return await self._terminal.execute(command=cmd, action="run")
        
        elif action == "info":
            cmd = f"npm view {package}"
            return await self._terminal.execute(command=cmd, action="run")
        
        elif action == "list":
            cmd = "npm list"
            return await self._terminal.execute(command=cmd, action="run")
        
        elif action == "init":
            cmd = "npm init"
            return await self._terminal.execute(command=cmd, action="run")
        
        elif action == "run":
            script = kwargs.get("script", "start")
            cmd = f"npm run {script}"
            return await self._terminal.execute(command=cmd, action="run")
        
        else:
            raise ValueError(f"Unknown action: {action}")
    
    def _get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["install", "uninstall", "update", "search", "publish", "info", "list", "init", "run"],
                    "description": "npm action"
                },
                "package": {"type": "string", "description": "Package name"}
            },
            "required": ["action"]
        }


register_tool("npm", NPMTool)


class PIPTool(BaseTool):
    """
    PIP Tool
    
    Interact with pip for Python package management.
    """
    
    name = "pip"
    description = "Interact with pip package manager"
    
    def __init__(self, python: str = "python3", **kwargs):
        super().__init__(**kwargs)
        self.python = python
    
    async def execute(
        self,
        action: str = "install",
        package: str = "",
        **kwargs
    ) -> Any:
        """
        Execute pip action
        
        Actions:
        - install: Install package
        - uninstall: Uninstall package
        - update: Update package
        - freeze: List installed packages
        - search: Search packages (via PyPI)
        - info: Get package info
        """
        from .terminal import TerminalTool
        terminal = TerminalTool()
        action = action.lower()
        
        if action == "install":
            cmd = f"{self.python} -m pip install {package}"
            return await terminal.execute(command=cmd, action="run")
        
        elif action == "uninstall":
            cmd = f"{self.python} -m pip uninstall {package} -y"
            return await terminal.execute(command=cmd, action="run")
        
        elif action == "update":
            cmd = f"{self.python} -m pip install --upgrade {package}"
            return await terminal.execute(command=cmd, action="run")
        
        elif action == "freeze":
            cmd = f"{self.python} -m pip freeze"
            return await terminal.execute(command=cmd, action="run")
        
        elif action == "info":
            cmd = f"{self.python} -m pip show {package}"
            return await terminal.execute(command=cmd, action="run")
        
        else:
            raise ValueError(f"Unknown action: {action}")
    
    def _get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["install", "uninstall", "update", "freeze", "search", "info"],
                    "description": "pip action"
                },
                "package": {"type": "string", "description": "Package name"}
            },
            "required": ["action"]
        }


register_tool("pip", PIPTool)


class PacmanTool(BaseTool):
    """
    Pacman Tool
    
    Interact with Arch pacman package manager.
    """
    
    name = "pacman"
    description = "Interact with Arch pacman package manager"
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
    
    async def execute(
        self,
        action: str = "sync",
        package: str = "",
        **kwargs
    ) -> Any:
        """
        Execute pacman action
        
        Actions:
        - sync: Install package (-S)
        - remove: Remove package (-R)
        - update: Update system (-Syu)
        - search: Search packages
        - info: Get package info
        - list: List installed packages
        - clean: Clean cache
        """
        from .terminal import TerminalTool
        terminal = TerminalTool()
        action = action.lower()
        
        if action == "sync":
            cmd = f"pacman -S {package}"
            return await terminal.execute(command=cmd, action="run", **kwargs)
        
        elif action == "remove":
            cmd = f"pacman -R {package}"
            return await terminal.execute(command=cmd, action="run", **kwargs)
        
        elif action == "update":
            cmd = "pacman -Syu"
            return await terminal.execute(command=cmd, action="run", **kwargs)
        
        elif action == "search":
            cmd = f"pacman -Ss {package}"
            return await terminal.execute(command=cmd, action="run", **kwargs)
        
        elif action == "info":
            cmd = f"pacman -Qi {package}"
            return await terminal.execute(command=cmd, action="run", **kwargs)
        
        elif action == "list":
            cmd = "pacman -Q"
            return await terminal.execute(command=cmd, action="run", **kwargs)
        
        else:
            raise ValueError(f"Unknown action: {action}")
    
    def _get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["sync", "remove", "update", "search", "info", "list", "clean"],
                    "description": "pacman action"
                },
                "package": {"type": "string", "description": "Package name"}
            },
            "required": ["action"]
        }


register_tool("pacman", PacmanTool)