"""
Egytronic Tools - Browser Automation Tool
"""

import asyncio
from typing import Any, Dict, List, Optional
from egytronic.tools.base import BaseTool, register_tool


class BrowserTool(BaseTool):
    """
    Browser Automation Tool
    
    Control browser for web automation tasks.
    Uses Playwright under the hood.
    """
    
    name = "browser"
    description = "Control browser for web navigation, clicking, typing, and extraction"
    
    def __init__(
        self,
        headless: bool = True,
        viewport: Optional[Dict[str, int]] = None,
        user_agent: Optional[str] = None,
        **kwargs
    ):
        super().__init__(**kwargs)
        self.headless = headless
        self.viewport = viewport or {"width": 1920, "height": 1080}
        self.user_agent = user_agent
        self._browser = None
        self._page = None
    
    async def _ensure_browser(self):
        """Ensure browser is initialized"""
        if self._browser is None:
            try:
                from playwright.async_api import async_playwright
                self._playwright = await async_playwright().start()
                self._browser = await self._playwright.chromium.launch(headless=self.headless)
                self._context = await self._browser.new_context(
                    viewport=self.viewport,
                    user_agent=self.user_agent
                )
                self._page = await self._context.new_page()
            except ImportError:
                raise ImportError("Playwright not installed. Run: pip install playwright && playwright install chromium")
    
    async def execute(self, action: str = "navigate", url: str = "", selector: str = "", text: str = "", **kwargs) -> Any:
        """
        Execute browser action
        
        Actions:
        - navigate: Go to URL
        - click: Click element by selector
        - type: Type text into element
        - get_text: Get text content
        - get_html: Get HTML content
        - screenshot: Take screenshot
        - evaluate: Run JavaScript
        - wait_for_selector: Wait for element
        - scroll: Scroll page
        - back: Go back
        - forward: Go forward
        - reload: Reload page
        - get_cookies: Get cookies
        - set_cookies: Set cookies
        """
        await self._ensure_browser()
        
        action = action.lower()
        
        if action == "navigate":
            await self._page.goto(url)
            return f"Navigated to {url}"
        
        elif action == "click":
            await self._page.click(selector)
            return f"Clicked {selector}"
        
        elif action == "type":
            await self._page.fill(selector, text)
            return f"Typed into {selector}"
        
        elif action == "get_text":
            if selector:
                return await self._page.locator(selector).text_content()
            return await self._page.content()
        
        elif action == "get_html":
            if selector:
                return await self._page.locator(selector).inner_html()
            return await self._page.content()
        
        elif action == "screenshot":
            path = kwargs.get("path", "screenshot.png")
            await self._page.screenshot(path=path)
            return f"Screenshot saved to {path}"
        
        elif action == "evaluate":
            return await self._page.evaluate(text)
        
        elif action == "wait_for_selector":
            await self._page.wait_for_selector(selector, timeout=kwargs.get("timeout", 30000))
            return f"Found {selector}"
        
        elif action == "scroll":
            await self._page.evaluate(f"window.scrollBy(0, {kwargs.get('amount', 500)})")
            return "Scrolled"
        
        elif action == "back":
            await self._page.go_back()
            return "Went back"
        
        elif action == "forward":
            await self._page.go_forward()
            return "Went forward"
        
        elif action == "reload":
            await self._page.reload()
            return "Reloaded"
        
        elif action == "get_cookies":
            return await self._page.context.cookies()
        
        elif action == "set_cookies":
            cookies = kwargs.get("cookies", [])
            await self._page.context.add_cookies(cookies)
            return "Cookies set"
        
        elif action == "get_url":
            return self._page.url
        
        elif action == "get_title":
            return await self._page.title()
        
        else:
            raise ValueError(f"Unknown action: {action}")
    
    async def close(self):
        """Close browser"""
        if self._browser:
            await self._browser.close()
        if hasattr(self, '_playwright') and self._playwright:
            await self._playwright.stop()
    
    def _get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["navigate", "click", "type", "get_text", "get_html", "screenshot", 
                            "evaluate", "wait_for_selector", "scroll", "back", "forward", 
                            "reload", "get_cookies", "set_cookies", "get_url", "get_title"],
                    "description": "Browser action to perform"
                },
                "url": {"type": "string", "description": "URL to navigate to"},
                "selector": {"type": "string", "description": "CSS selector"},
                "text": {"type": "string", "description": "Text to type or evaluate"}
            },
            "required": ["action"]
        }


# Register tool
register_tool("browser", BrowserTool)


class BrowserBridgeTool(BaseTool):
    """
    Browser Bridge Tool
    
    Control physical browser via extension bridge.
    Uses browser extension for remote control.
    """
    
    name = "browser_bridge"
    description = "Control physical browser via extension bridge"
    
    def __init__(self, bridge_url: str = "http://localhost:3000", **kwargs):
        super().__init__(**kwargs)
        self.bridge_url = bridge_url
    
    async def execute(self, action: str = "navigate", url: str = "", selector: str = "", text: str = "", **kwargs) -> Any:
        """Execute browser bridge action"""
        import aiohttp
        
        payload = {
            "action": action,
            "url": url,
            "selector": selector,
            "text": text,
            **kwargs
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{self.bridge_url}/browser", json=payload) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"Browser bridge error: {error}")
                return await resp.json()
    
    def _get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "action": {"type": "string", "description": "Browser action"},
                "url": {"type": "string", "description": "URL"},
                "selector": {"type": "string", "description": "CSS selector"},
                "text": {"type": "string", "description": "Text"}
            },
            "required": ["action"]
        }


register_tool("browser_bridge", BrowserBridgeTool)