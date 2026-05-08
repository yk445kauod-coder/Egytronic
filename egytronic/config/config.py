"""
Egytronic Configuration
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, Optional
from dataclasses import dataclass, field


@dataclass
class LLMConfig:
    """LLM configuration"""
    provider: str = "gemini"
    model: str = "gemini-2.0-flash"
    api_key: str = ""
    api_base_url: str = ""
    temperature: float = 0.7
    max_tokens: int = 4096


@dataclass
class ToolsConfig:
    """Tools configuration"""
    enabled: list = field(default_factory=lambda: ["browser", "file_system", "terminal"])
    config: Dict[str, Any] = field(default_factory=dict)


@dataclass
class OpenCLAWConfig:
    """OpenCLAW configuration"""
    enabled: bool = True
    remote_endpoint: str = "https://api.openclaw.dev"


@dataclass
class Config:
    """Egytronic configuration"""
    llm: LLMConfig = field(default_factory=LLMConfig)
    tools: ToolsConfig = field(default_factory=ToolsConfig)
    openclaw: OpenCLAWConfig = field(default_factory=OpenCLAWConfig)
    log_level: str = "INFO"
    
    def __post_init__(self):
        # Load from environment
        self._load_env()
    
    def _load_env(self):
        """Load from environment variables"""
        # LLM settings
        if provider := os.environ.get("EGYTRONIC_LLM_PROVIDER"):
            self.llm.provider = provider
        if model := os.environ.get("EGYTRONIC_LLM_MODEL"):
            self.llm.model = model
        if api_key := os.environ.get("EGYTRONIC_API_KEY"):
            self.llm.api_key = api_key
        
        # Log level
        if level := os.environ.get("EGYTRONIC_LOG_LEVEL"):
            self.log_level = level
    
    @classmethod
    def from_file(cls, path: str) -> "Config":
        """Load from file"""
        config = cls()
        
        if Path(path).exists():
            with open(path) as f:
                data = json.load(f)
            
            if "llm" in data:
                config.llm = LLMConfig(**data["llm"])
            if "tools" in data:
                config.tools = ToolsConfig(**data["tools"])
            if "openclaw" in data:
                config.openclaw = OpenCLAWConfig(**data["openclaw"])
        
        return config
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "llm": {
                "provider": self.llm.provider,
                "model": self.llm.model,
                "api_key": self.llm.api_key,
                "api_base_url": self.llm.api_base_url,
                "temperature": self.llm.temperature,
                "max_tokens": self.llm.max_tokens
            },
            "tools": {
                "enabled": self.tools.enabled,
                "config": self.tools.config
            },
            "openclaw": {
                "enabled": self.openclaw.enabled,
                "remote_endpoint": self.openclaw.remote_endpoint
            },
            "log_level": self.log_level
        }
    
    def save(self, path: str):
        """Save to file"""
        with open(path, "w") as f:
            json.dump(self.to_dict(), f, indent=2)


# Default config
_default_config = None


def get_config() -> Config:
    """Get default config"""
    global _default_config
    if _default_config is None:
        # Try to load from default locations
        for path in [
            "egytronic.json",
            os.path.expanduser("~/.egytronic.json"),
            "/etc/egytronic.json"
        ]:
            if Path(path).exists():
                _default_config = Config.from_file(path)
                break
        
        if _default_config is None:
            _default_config = Config()
    
    return _default_config


def set_config(config: Config):
    """Set default config"""
    global _default_config
    _default_config = config