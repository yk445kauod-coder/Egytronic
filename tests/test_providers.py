"""
Test LLM Providers
"""

import pytest
import sys
sys.path.insert(0, '/workspace/project')

from egytronic.llm.providers import (
    PROVIDERS, IMPORT_ERRORS, HuggingFaceAdapter, OpenRouterAdapter,
    GroqAdapter, ZhipuAIAdapter, KimiAdapter, TogetherAIAdapter
)


class TestProviders:
    """Test LLM providers"""
    
    def test_providers_registry(self):
        """Test providers are registered"""
        assert "gemini" in PROVIDERS
        assert "cloudflare" in PROVIDERS
        assert "openai" in PROVIDERS
        assert "huggingface" in PROVIDERS
        assert "openrouter" in PROVIDERS
        assert "groq" in PROVIDERS
        assert "zhipu" in PROVIDERS
        assert "glm" in PROVIDERS  # GLM = Zhipu alias
        assert "kimi" in PROVIDERS
        assert "together" in PROVIDERS
        assert len(PROVIDERS) >= 12
    
    def test_import_errors(self):
        """Test import errors are defined"""
        assert "gemini" in IMPORT_ERRORS
        assert "huggingface" in IMPORT_ERRORS
        assert "openrouter" in IMPORT_ERRORS
    
    def test_provider_names(self):
        """Test key provider names"""
        # Check key providers exist
        assert "gemini" in PROVIDERS
        assert "cloudflare" in PROVIDERS  
        assert "openai" in PROVIDERS
        
    def test_adapter_classes(self):
        """Test adapter classes exist"""
        assert HuggingFaceAdapter is not None
        assert OpenRouterAdapter is not None
        assert GroqAdapter is not None
        assert ZhipuAIAdapter is not None
        assert KimiAdapter is not None
        assert TogetherAIAdapter is not None


class TestProviderConfigs:
    """Test provider configurations"""
    
    def test_huggingface_creation(self):
        """Test HuggingFace adapter creation"""
        try:
            adapter = HuggingFaceAdapter(
                api_key="test-key",
                model_name="meta-llama/Llama-3-8B-Instruct"
            )
            assert adapter.model_name == "meta-llama/Llama-3-8B-Instruct"
        except ValueError as e:
            # Expected if no API key
            assert "API key" in str(e)
    
    def test_openrouter_creation(self):
        """Test OpenRouter adapter creation"""
        try:
            adapter = OpenRouterAdapter(
                api_key="test-key",
                model_name="anthropic/claude-3.5-sonnet"
            )
            assert adapter.model_name == "anthropic/claude-3.5-sonnet"
        except ValueError as e:
            assert "API key" in str(e)
    
    def test_groq_creation(self):
        """Test Groq adapter creation"""
        try:
            adapter = GroqAdapter(
                api_key="test-key",
                model_name="llama-3.1-70b-versatile"
            )
            assert adapter.model_name == "llama-3.1-70b-versatile"
        except ValueError as e:
            assert "API key" in str(e)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])