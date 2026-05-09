"""
Egytronic Test Suite

Tests for the Egytronic framework components.
"""

import asyncio
import os
import tempfile
from pathlib import Path
import pytest

# Add parent directory to path for imports
import sys
sys.path.insert(0, '/workspace/project')

from egytronic.agent.agent import Agent, AgentConfig
from egytronic.tools.base import BaseTool, get_tool_by_name, list_available_tools
from egytronic.tools.filesystem import FileSystemTool
from egytronic.tools.terminal import TerminalTool
from egytronic.llm.base import LLMAdapter, ChatResponse


# ═══════════════════════════════════════════════════════════════════════════════
# TEST AGENT
# ═══════════════════════════════════════════════════════════════════════════════

class TestAgent:
    """Test Agent class"""
    
    def test_agent_creation(self):
        """Test agent can be created"""
        agent = Agent(model="gemini", api_key="test-key")
        assert agent is not None
        assert agent.config.model == "gemini"
    
    def test_agent_config(self):
        """Test agent configuration"""
        config = AgentConfig(
            model="cloudflare",
            api_key="test-key",
            temperature=0.5
        )
        assert config.model == "cloudflare"
        assert config.temperature == 0.5
    
    def test_agent_system_prompt(self):
        """Test custom system prompt"""
        agent = Agent(
            model="gemini",
            api_key="test-key",
            system_prompt="You are a Python expert."
        )
        # Agent prepends default prompt
        assert "Python expert" in agent.config.system_prompt
    
    def test_add_tool(self):
        """Test adding tools to agent"""
        agent = Agent(model="gemini", api_key="test-key")
        fs_tool = FileSystemTool()
        agent.add_tool(fs_tool)
        assert "file_system" in agent.list_tools()
    
    def test_remove_tool(self):
        """Test removing tools"""
        agent = Agent(model="gemini", api_key="test-key")
        fs_tool = FileSystemTool()
        agent.add_tool(fs_tool)
        agent.remove_tool("file_system")
        assert "file_system" not in agent.list_tools()
    
    def test_list_tools(self):
        """Test listing tools"""
        agent = Agent(model="gemini", api_key="test-key")
        tools = agent.list_tools()
        assert isinstance(tools, list)


# ═══════════════════════════════════════════════════════════════════════════════
# TEST LLM BASE
# ═══════════════════════════════════════════════════════════════════════════════

class TestLLMBase:
    """Test LLM base adapter"""
    
    def test_chat_response(self):
        """Test ChatResponse creation"""
        response = ChatResponse(
            content="Hello!",
            model="test-model"
        )
        assert response.content == "Hello!"
        assert response.model == "test-model"
    
    def test_chat_response_with_usage(self):
        """Test ChatResponse with usage"""
        response = ChatResponse(
            content="Test",
            usage={"tokens": 10},
            model="test"
        )
        assert response.usage is not None
        assert response.usage["tokens"] == 10


# ═══════════════════════════════════════════════════════════════════════════════
# TEST TOOLS
# ═══════════════════════════════════════════════════════════════════════════════

class TestFileSystemTool:
    """Test FileSystemTool"""
    
    @pytest.mark.asyncio
    async def test_write_and_read(self):
        """Test writing and reading files"""
        with tempfile.TemporaryDirectory() as tmpdir:
            fs = FileSystemTool(root_dir=tmpdir)
            
            # Write file
            await fs.execute(
                action="write",
                path="test.txt",
                content="Hello World"
            )
            
            # Read file
            content = await fs.execute(
                action="read",
                path="test.txt"
            )
            
            assert content == "Hello World"
    
    @pytest.mark.asyncio
    async def test_exists(self):
        """Test file exists check"""
        with tempfile.TemporaryDirectory() as tmpdir:
            fs = FileSystemTool(root_dir=tmpdir)
            
            # Write file first
            await fs.execute(
                action="write",
                path="exists.txt",
                content="test"
            )
            
            # Check exists
            exists = await fs.execute(action="exists", path="exists.txt")
            assert exists is True
    
    @pytest.mark.asyncio
    async def test_delete(self):
        """Test file deletion"""
        with tempfile.TemporaryDirectory() as tmpdir:
            fs = FileSystemTool(root_dir=tmpdir)
            
            # Write then delete
            await fs.execute(action="write", path="delete.txt", content="test")
            await fs.execute(action="delete", path="delete.txt")
            
            # Verify deleted
            exists = await fs.execute(action="exists", path="delete.txt")
            assert exists is False
    
    @pytest.mark.asyncio
    async def test_list_directory(self):
        """Test listing directory"""
        with tempfile.TemporaryDirectory() as tmpdir:
            fs = FileSystemTool(root_dir=tmpdir)
            
            # Create files
            await fs.execute(action="write", path="file1.txt", content="1")
            await fs.execute(action="write", path="file2.txt", content="2")
            
            # List
            files = await fs.execute(action="list", path=".")
            assert "file1.txt" in files
            assert "file2.txt" in files


class TestTerminalTool:
    """Test TerminalTool"""
    
    @pytest.mark.asyncio
    async def test_execute_command(self):
        """Test executing a command"""
        terminal = TerminalTool()
        
        result = await terminal.execute(
            command="echo 'test'",
            action="run"
        )
        
        assert "test" in result
    
    @pytest.mark.asyncio
    async def test_pwd(self):
        """Test getting current directory"""
        terminal = TerminalTool()
        
        pwd = await terminal.execute(action="pwd")
        
        assert pwd is not None
    
    @pytest.mark.asyncio  
    async def test_env(self):
        """Test getting environment"""
        terminal = TerminalTool()
        
        env = await terminal.execute(action="env")
        
        assert env is not None
        assert isinstance(env, dict)


class TestToolRegistry:
    """Test tool registry"""
    
    def test_get_tool_by_name(self):
        """Test getting tool by name"""
        tool = get_tool_by_name("file_system")
        assert tool is not None
        assert tool.name == "file_system"
    
    def test_list_available_tools(self):
        """Test listing available tools"""
        tools = list_available_tools()
        assert "browser" in tools
        assert "file_system" in tools
        assert "terminal" in tools
        assert len(tools) >= 10


# ═══════════════════════════════════════════════════════════════════════════════
# TEST CONFIG
# ═══════════════════════════════════════════════════════════════════════

class TestConfig:
    """Test configuration"""
    
    def test_config_creation(self):
        """Test config can be created"""
        from egytronic.config.config import Config, LLMConfig
        
        config = Config()
        assert config is not None
        assert config.llm is not None
    
    def test_llm_config(self):
        """Test LLM config"""
        from egytronic.config.config import LLMConfig
        
        llm_config = LLMConfig(
            provider="gemini",
            model="gemini-2.0-flash"
        )
        assert llm_config.provider == "gemini"
        assert llm_config.model == "gemini-2.0-flash"


# ═══════════════════════════════════════════════════════════════════════════════
# INTEGRATION TESTS
# ═══════════════════════════════════════════════════════════════════════

class TestIntegration:
    """Integration tests"""
    
    @pytest.mark.asyncio
    async def test_agent_with_tools(self):
        """Test agent creation with tools"""
        agent = Agent(model="gemini", api_key="test-key")
        
        # Add multiple tools
        agent.add_tool("file_system")
        agent.add_tool("terminal")
        
        assert len(agent.list_tools()) >= 2
    
    def test_agent_config_serialization(self):
        """Test agent config to dict"""
        agent = Agent(model="gemini", api_key="test-key")
        
        # Config should have expected attributes
        assert agent.config.model == "gemini"
        assert hasattr(agent.config, "max_iterations")


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN TEST RUNNER
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    pytest.main([__file__, "-v"])