"""
Egytronic Tools - Playwright Tool
"""

from typing import Any, Dict, List, Optional
from egytronic.tools.base import BaseTool, register_tool


class PlaywrightTool(BaseTool):
    """
    Playwright Tool
    
    Advanced web automation using Playwright.
    """
    
    name = "playwright"
    description = "Advanced web automation using Playwright"
    
    def __init__(self, browser_type: str = "chromium", **kwargs):
        super().__init__(**kwargs)
        self.browser_type = browser_type
        self._playwright = None
        self._browser = None
        self._context = None
        self._page = None
    
    async def execute(
        self,
        action: str = "navigate",
        url: str = "",
        selector: str = "",
        text: str = "",
        **kwargs
    ) -> Any:
        """Execute Playwright action"""
        await self._ensure_browser()
        
        action = action.lower()
        
        if action == "navigate":
            await self._page.goto(url)
            return f"Navigated to {url}"
        
        elif action == "click":
            await self._page.click(selector)
            return f"Clicked {selector}"
        
        elif action == "fill":
            await self._page.fill(selector, text)
            return f"Filled {selector}"
        
        elif action == "type":
            await self._page.type(selector, text)
            return f"Typed into {selector}"
        
        elif action == "select":
            await self._page.select_option(selector, text)
            return f"Selected {text} in {selector}"
        
        elif action == "hover":
            await self._page.hover(selector)
            return f"Hovered {selector}"
        
        elif action == "drag":
            target = kwargs.get("target", "")
            await self._page.drag_to(selector, target)
            return f"Dragged {selector} to {target}"
        
        elif action == "screenshot":
            path = kwargs.get("path", "screenshot.png")
            await self._page.screenshot(path=path)
            return f"Screenshot saved to {path}"
        
        elif action == "pdf":
            path = kwargs.get("path", "output.pdf")
            await self._page.pdf(path=path)
            return f"PDF saved to {path}"
        
        elif action == "content":
            return await self._page.content()
        
        elif action == "title":
            return await self._page.title()
        
        elif action == "url":
            return self._page.url
        
        elif action == "wait":
            timeout = kwargs.get("timeout", 30000)
            await self._page.wait_for_load_state("load", timeout=timeout)
            return "Page loaded"
        
        elif action == "wait_selector":
            await self._page.wait_for_selector(selector, timeout=kwargs.get("timeout", 30000))
            return f"Found {selector}"
        
        elif action == "evaluate":
            result = await self._page.evaluate(text)
            return result
        
        elif action == "focus":
            await self._page.focus(selector)
            return f"Focused {selector}"
        
        else:
            raise ValueError(f"Unknown action: {action}")
    
    async def _ensure_browser(self):
        """Ensure browser is initialized"""
        if self._browser is None:
            try:
                from playwright.async_api import async_playwright
                self._playwright = await async_playwright().start()
                browser_cls = getattr(self._playwright, self.browser_type)
                self._browser = await browser_cls.launch()
                self._context = await self._browser.new_context()
                self._page = await self._context.new_page()
            except ImportError:
                raise ImportError("Playwright not installed. Run: pip install playwright")
    
    async def close(self):
        """Close browser"""
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
    
    def _get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "action": {"type": "string", "description": "Playwright action"},
                "url": {"type": "string", "description": "URL"},
                "selector": {"type": "string", "description": "CSS selector"},
                "text": {"type": "string", "description": "Text"}
            },
            "required": ["action"]
        }


register_tool("playwright", PlaywrightTool)