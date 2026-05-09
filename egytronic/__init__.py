"""
Egytronic AI Agent Framework
=========================
Universal Agent Development Platform
Turn any LLM into a powerful autonomous agent with tools

© 2026 Egytronic. All rights reserved.
"""

__version__ = "1.0.0"
__author__ = "Egytronic Team"
__license__ = "MIT"

from egytronic.agent import Agent
from egytronic.config import Config
from egytronic.llm import *

__all__ = [
    "Agent",
    "Config",
]