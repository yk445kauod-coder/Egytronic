"""
Egytronic Skills System
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional
from pathlib import Path


@dataclass
class SkillDefinition:
    """Skill definition"""
    name: str
    description: str
    version: str = "1.0.0"
    author: str = "Egytronic"
    triggers: List[str] = None
    actions: List[str] = None
    
    def __post_init__(self):
        if self.triggers is None:
            self.triggers = []
        if self.actions is None:
            self.actions = []


class BaseSkill(ABC):
    """
    Abstract base class for skills
    
    Skills extend agent capabilities with specific domains.
    """
    
    name: str = "base"
    description: str = "Base skill"
    version: str = "1.0.0"
    author: str = "Egytronic"
    
    def __init__(self, **kwargs):
        self.config = kwargs
        self._agent = None
    
    @abstractmethod
    async def execute(self, action: str, **kwargs) -> Any:
        """
        Execute skill action
        
        Args:
            action: Skill action to execute
            **kwargs: Action arguments
            
        Returns:
            Execution result
        """
        pass
    
    def register(self, agent):
        """Register skill with agent"""
        self._agent = agent
    
    def get_definition(self) -> SkillDefinition:
        """Get skill definition"""
        return SkillDefinition(
            name=self.name,
            description=self.description,
            version=self.version,
            author=self.author
        )
    
    def __repr__(self) -> str:
        return f"<Skill {self.name} v{self.version}>"


class SkillRegistry:
    """
    Skill Registry
    
    Manages registered skills.
    """
    
    _skills: Dict[str, type] = {}
    _instances: Dict[str, BaseSkill] = {}
    
    @classmethod
    def register(cls, name: str, skill_class: type):
        """Register a skill class"""
        cls._skills[name] = skill_class
    
    @classmethod
    def get(cls, name: str) -> Optional[BaseSkill]:
        """Get skill instance"""
        if name not in cls._instances:
            if name in cls._skills:
                cls._instances[name] = cls._skills[name]()
        return cls._instances.get(name)
    
    @classmethod
    def list_all(cls) -> List[str]:
        """List all registered skills"""
        return list(cls._skills.keys())
    
    @classmethod
    def load_from_directory(cls, directory: str):
        """Load skills from directory"""
        path = Path(directory)
        if not path.exists():
            return
        
        for file in path.glob("*.py"):
            if file.stem.startswith("_"):
                continue
            # Skills would be loaded dynamically
            pass


# Built-in skills
class WebSearchSkill(BaseSkill):
    """Web search skill"""
    name = "web_search"
    description = "Search the web for information"
    version = "1.0.0"
    
    async def execute(self, action: str = "search", query: str = "", **kwargs) -> Any:
        """Execute web search"""
        if action == "search":
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"https://api.duckduckgo.com/",
                    params={"q": query, "format": "json"}
                ) as resp:
                    return await resp.json()
        return None


class CodeSkill(BaseSkill):
    """Code execution skill"""
    name = "code"
    description = "Execute code in various languages"
    version = "1.0.0"
    
    async def execute(
        self,
        action: str = "run",
        language: str = "python",
        code: str = "",
        **kwargs
    ) -> Any:
        """Execute code"""
        if action == "run":
            if language == "python":
                return await self._run_python(code)
            elif language == "javascript":
                return await self._run_javascript(code)
            elif language == "bash":
                return await self._run_bash(code)
        return None
    
    async def _run_python(self, code: str) -> str:
        """Run Python code"""
        from ..tools import TerminalTool
        terminal = TerminalTool()
        return await terminal.execute(
            command=f"python3 -c '{code}'",
            action="run"
        )
    
    async def _run_javascript(self, code: str) -> str:
        """Run JavaScript code"""
        from ..tools import TerminalTool
        terminal = TerminalTool()
        return await terminal.execute(
            command=f"node -e '{code}'",
            action="run"
        )
    
    async def _run_bash(self, code: str) -> str:
        """Run bash code"""
        from ..tools import TerminalTool
        terminal = TerminalTool()
        return await terminal.execute(command=code, action="run")


class FileSkill(BaseSkill):
    """File operations skill"""
    name = "file"
    description = "File operations skill"
    version = "1.0.0"
    
    async def execute(
        self,
        action: str = "read",
        path: str = "",
        content: str = "",
        **kwargs
    ) -> Any:
        """Execute file operation"""
        from ..tools import FileSystemTool
        fs = FileSystemTool()
        return await fs.execute(action=action, path=path, content=content, **kwargs)


# Register skills
SkillRegistry.register("web_search", WebSearchSkill)
SkillRegistry.register("code", CodeSkill)
SkillRegistry.register("file", FileSkill)