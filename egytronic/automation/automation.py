"""
Egytronic Automation System - Headless Browser & Workflow Automation

Automated browser control, scheduled tasks, webhooks, and cron jobs.
"""

import asyncio
import json
import os
import sched
import time
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum
import threading


# ════════════════════════════════════════════════════════════════════════════════
# AUTOMATION ENUMS
# ════════════════════════════════════════════════════════════════════════════════

class TriggerType(Enum):
    """Trigger types for automation"""
    MANUAL = "manual"
    CRON = "cron"
    INTERVAL = "interval"
    WEBHOOK = "webhook"
    EVENT = "event"


class AutomationStatus(Enum):
    """Automation status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    DISABLED = "disabled"


# ════════════════════════════════════════════════════════════════════════════════
# AUTOMATION DATA CLASSES
# ════════════════════════════════════════════════════════════════════════════════

@dataclass
class Trigger:
    """Automation trigger configuration"""
    type: TriggerType = TriggerType.MANUAL
    schedule: str = ""  # Cron expression
    interval_seconds: int = 0  # For interval triggers
    webhook_path: str = ""
    event_type: str = ""
    timezone: str = "UTC"


@dataclass
class Automation:
    """Automation definition"""
    id: str = ""
    name: str = ""
    description: str = ""
    prompt: str = ""  # Natural language prompt for the agent
    trigger: Trigger = field(default_factory=Trigger)
    enabled: bool = True
    timeout: int = 300  # Max execution seconds
    created_at: str = ""
    last_run: str = ""
    status: AutomationStatus = AutomationStatus.PENDING
    
    def __post_init__(self):
        if not self.id:
            import uuid
            self.id = str(uuid.uuid4())
        if not self.created_at:
            self.created_at = datetime.now().isoformat()


@dataclass
class AutomationResult:
    """Automation execution result"""
    automation_id: str
    status: AutomationStatus
    output: str = ""
    error: str = ""
    started_at: str = ""
    completed_at: str = ""
    duration_seconds: float = 0


# ════════════════════════════════════════════════════════════════════════════════
# HEADLESS BROWSER AUTOMATION
# ════════════════════════════════════════════════════════════════════════════════

class HeadlessBrowser:
    """Headless browser automation for agents"""
    
    def __init__(
        self,
        headless: bool = True,
        proxy: Optional[str] = None,
        user_agent: Optional[str] = None,
        viewport: Dict[str, int] = None,
        **kwargs
    ):
        self.headless = headless
        self.proxy = proxy
        self.user_agent = user_agent
        self.viewport = viewport or {"width": 1920, "height": 1080}
        self.config = kwargs
        self._browser = None
        self._context = None
        self._page = None
        self._playwright = None
    
    async def start(self):
        """Start headless browser"""
        try:
            from playwright.async_api import async_playwright
            
            self._playwright = await async_playwright().start()
            
            # Launch browser
            launch_opts = {"headless": self.headless}
            if self.proxy:
                launch_opts["proxy"] = {"server": self.proxy}
            
            self._browser = await self._playwright.chromium.launch(**launch_opts)
            
            # Create context
            context_opts = {"viewport": self.viewport}
            if self.user_agent:
                context_opts["user_agent"] = self.user_agent
            
            self._context = await self._browser.new_context(**context_opts)
            self._page = await self._context.new_page()
            
            return True
        except ImportError:
            print("Playwright not installed. Run: pip install playwright")
            return False
        except Exception as e:
            print(f"Failed to start browser: {e}")
            return False
    
    async def stop(self):
        """Stop headless browser"""
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
    
    async def navigate(self, url: str):
        """Navigate to URL"""
        if self._page:
            await self._page.goto(url, wait_until="networkidle")
            return True
        return False
    
    async def click(self, selector: str):
        """Click element"""
        if self._page:
            await self._page.click(selector)
            return True
        return False
    
    async def type_text(self, selector: str, text: str):
        """Type text into element"""
        if self._page:
            await self._page.fill(selector, text)
            return True
        return False
    
    async def get_text(self, selector: str = "") -> str:
        """Get text content"""
        if self._page:
            if selector:
                return await self._page.locator(selector).text_content()
            return await self._page.content()
        return ""
    
    async def screenshot(self, path: str = "screenshot.png") -> str:
        """Take screenshot"""
        if self._page:
            await self._page.screenshot(path=path)
            return path
        return ""
    
    async def execute_script(self, script: str) -> Any:
        """Execute JavaScript"""
        if self._page:
            return await self._page.evaluate(script)
        return None
    
    async def wait_for_selector(self, selector: str, timeout: int = 30000):
        """Wait for selector"""
        if self._page:
            await self._page.wait_for_selector(selector, timeout=timeout)
            return True
        return False
    
    async def wait_for_navigation(self, timeout: int = 30000):
        """Wait for navigation"""
        if self._page:
            await self._page.wait_for_load_state("networkidle", timeout=timeout)
            return True
        return False
    
    # High-level actions
    
    async def login(self, url: str, username_selector: str, password_selector: str, 
                username: str, password: str, submit_selector: str = "") -> bool:
        """Login to a website"""
        await self.navigate(url)
        await self.type_text(username_selector, username)
        await self.type_text(password_selector, password)
        if submit_selector:
            await self.click(submit_selector)
        await asyncio.sleep(1)
        return True
    
    async def fill_form(self, fields: Dict[str, str]) -> bool:
        """Fill form with fields dict"""
        for selector, value in fields.items():
            await self.type_text(selector, value)
        return True
    
    async def scrape(self, selectors: List[str]) -> Dict[str, str]:
        """Scrape multiple elements"""
        result = {}
        for sel in selectors:
            try:
                result[sel] = await self.get_text(sel)
            except:
                result[sel] = ""
        return result
    
    async def scroll_to_bottom(self, step: int = 500):
        """Scroll to bottom of page"""
        if self._page:
            await self._page.evaluate(f"window.scrollBy(0, {step})")
    
    async def get_cookies(self) -> List[Dict[str, str]]:
        """Get cookies"""
        if self._context:
            return await self._context.cookies()
        return []
    
    async def set_cookies(self, cookies: List[Dict]):
        """Set cookies"""
        if self._context:
            await self._context.add_cookies(cookies)


# ════════════════════════════════════════════════════════════════════════════════
# BROWSER POOL FOR MULTIPLE AGENTS
# ════════════════════════════════════════════════════════════════════════════════

class BrowserPool:
    """Pool of headless browsers for multiple agents"""
    
    def __init__(self, max_browsers: int = 5):
        self.max_browsers = max_browsers
        self.browsers: List[HeadlessBrowser] = []
        self.available: List[HeadlessBrowser] = []
        self.in_use: Dict[str, HeadlessBrowser] = {}
        self._lock = asyncio.Lock()
    
    async def acquire(self, agent_id: str = "") -> Optional[HeadlessBrowser]:
        """Acquire a browser from pool"""
        async with self._lock:
            # Reuse available browser
            if self.available:
                browser = self.available.pop()
                self.in_use[agent_id] = browser
                return browser
            
            # Create new if under limit
            if len(self.browsers) < self.max_browsers:
                browser = HeadlessBrowser()
                await browser.start()
                self.browsers.append(browser)
                self.in_use[agent_id] = browser
                return browser
        
        return None
    
    async def release(self, agent_id: str):
        """Release browser back to pool"""
        async with self._lock:
            if agent_id in self.in_use:
                browser = self.in_use.pop(agent_id)
                self.available.append(browser)
    
    async def cleanup(self):
        """Cleanup all browsers"""
        async with self._lock:
            for browser in self.browsers:
                await browser.stop()
            self.browsers.clear()
            self.available.clear()
            self.in_use.clear()


# ════════════════════════════════════════════════════════════════════════════════
# AUTOMATION RUNNER
# ════════════════════════════════════════════════════════════════════════════════

class AutomationRunner:
    """Run automations on schedule"""
    
    def __init__(self, agent=None):
        self.agent = agent
        self.automations: Dict[str, Automation] = {}
        self.results: Dict[str, List[AutomationResult]] = {}
        self._scheduler = None
        self._running = False
    
    def create_automation(
        self,
        name: str,
        prompt: str,
        trigger: Trigger = None,
        description: str = ""
    ) -> Automation:
        """Create new automation"""
        automation = Automation(
            name=name,
            description=description,
            prompt=prompt,
            trigger=trigger or Trigger()
        )
        self.automations[automation.id] = automation
        self.results[automation.id] = []
        return automation
    
    async def run(self, automation_id: str) -> AutomationResult:
        """Run automation immediately"""
        automation = self.automations.get(automation_id)
        if not automation:
            return None
        
        result = AutomationResult(
            automation_id=automation_id,
            status=AutomationStatus.RUNNING,
            started_at=datetime.now().isoformat()
        )
        
        try:
            if self.agent:
                output = await self.agent.run(automation.prompt)
                result.output = output
                result.status = AutomationStatus.COMPLETED
            else:
                result.output = "No agent configured"
                result.status = AutomationStatus.FAILED
        except Exception as e:
            result.error = str(e)
            result.status = AutomationStatus.FAILED
        
        result.completed_at = datetime.now().isoformat()
        
        # Calculate duration
        start = datetime.fromisoformat(result.started_at)
        end = datetime.fromisoformat(result.completed_at)
        result.duration_seconds = (end - start).total_seconds()
        
        # Store result
        self.results[automation_id].append(result)
        
        # Update automation
        automation.status = result.status
        automation.last_run = result.completed_at
        
        return result
    
    def run_scheduled(self):
        """Run scheduled automations (blocking)"""
        self._running = True
        import time
        
        while self._running:
            now = datetime.now()
            
            for auto_id, automation in self.automations.items():
                if not automation.enabled:
                    continue
                
                trigger = automation.trigger
                
                if trigger.type == TriggerType.CRON:
                    # Simple cron check - would use croniter in production
                    pass
                
                elif trigger.type == TriggerType.INTERVAL and trigger.interval_seconds > 0:
                    last_run = automation.last_run
                    if last_run:
                        last_dt = datetime.fromisoformat(last_run)
                        if (now - last_dt).total_seconds() >= trigger.interval_seconds:
                            asyncio.create_task(self.run(auto_id))
            
            time.sleep(60)  # Check every minute
    
    def stop(self):
        """Stop automation runner"""
        self._running = False


# ════════════════════════════════════════════════════════════════════════
# VM SYSTEM FOR AGENTS
# ════════════════════════════════════════════════════════════════════════════════

class VirtualMachine:
    """Full VM for isolated agent execution"""
    
    def __init__(
        self,
        name: str,
        image: str = "ubuntu:22.04",
        cpu: int = 2,
        memory: str = "2G",
        disk: str = "10G"
    ):
        self.name = name
        self.image = image
        self.cpu = cpu
        self.memory = memory
        self.disk = disk
        self.id = f"vm-{name}"
        self._container = None
        self.status = "stopped"
    
    async def start(self):
        """Start VM"""
        try:
            import docker
            client = docker.from_env()
            
            self._container = client.containers.run(
                self.image,
                name=self.name,
                detach=True,
                cpu_count=self.cpu,
                mem_limit=self.memory,
                volumes={f"{self.name}-data": {"bind": "/workspace", "mode": "rw"}},
                working_dir="/workspace"
            )
            
            self.status = "running"
            return True
        except ImportError:
            print("Docker not available")
            return False
        except Exception as e:
            print(f"Error starting VM: {e}")
            return False
    
    async def stop(self):
        """Stop VM"""
        if self._container:
            self._container.stop()
            self.status = "stopped"
    
    async def execute(self, command: str) -> str:
        """Execute command in VM"""
        if not self._container:
            return "VM not running"
        
        try:
            result = self._container.exec_run(command)
            return result.output.decode()
        except Exception as e:
            return f"Error: {e}"
    
    async def copy_file(self, source: str, destination: str):
        """Copy file to VM"""
        if not self._container:
            return "VM not running"
        
        try:
            import io
            with open(source, 'rb') as f:
                self._container.put_archive(io.BytesIO(f.read()), destination)
            return "Copied"
        except Exception as e:
            return f"Error: {e}"
    
    async def get_file(self, path: str) -> bytes:
        """Get file from VM"""
        if not self._container:
            return b""
        
        try:
            stream, stat = self._container.get_archive(path)
            return b"".join(stream)
        except Exception as e:
            return b""


class VMManager:
    """Manage multiple VMs"""
    
    def __init__(self):
        self.vms: Dict[str, VirtualMachine] = {}
    
    def create_vm(
        self,
        name: str,
        image: str = "ubuntu:22.04",
        cpu: int = 2,
        memory: str = "2G"
    ) -> VirtualMachine:
        """Create new VM"""
        vm = VirtualMachine(name, image, cpu, memory)
        self.vms[name] = vm
        return vm
    
    async def start_vm(self, name: str) -> bool:
        """Start VM"""
        vm = self.vms.get(name)
        if vm:
            return await vm.start()
        return False
    
    async def stop_vm(self, name: str):
        """Stop VM"""
        vm = self.vms.get(name)
        if vm:
            await vm.stop()
    
    def list_vms(self) -> List[str]:
        """List all VMs"""
        return list(self.vms.keys())


# ════════════════════════════════════════════════════════════════════════════════
# AUTOMATION COMMANDS
# ════════════════════════════════════════════════════════════════════════════════

def create_automation(
    name: str,
    prompt: str,
    schedule: str = None,
    interval: int = None,
    cron: str = None
) -> Automation:
    """Create automation helper"""
    trigger = Trigger()
    
    if cron:
        trigger.type = TriggerType.CRON
        trigger.schedule = cron
    elif interval:
        trigger.type = TriggerType.INTERVAL
        trigger.interval_seconds = interval
    else:
        trigger.type = TriggerType.MANUAL
    
    runner = AutomationRunner()
    return runner.create_automation(name, prompt, trigger)


# ════════════════════════════════════════════════════════════════════════════════
# EXPORTS
# ════════════════════════════════════════════════════════════════════════════

__all__ = [
    "TriggerType",
    "AutomationStatus", 
    "Trigger",
    "Automation",
    "AutomationResult",
    "HeadlessBrowser",
    "BrowserPool",
    "AutomationRunner",
    "VirtualMachine",
    "VMManager",
    "create_automation",
]