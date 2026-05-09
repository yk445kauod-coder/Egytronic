"""
Egytronic GUI - Web-based Graphical Interface

Rich web GUI for agent interaction with dark theme.
"""

from flask import Flask, render_template_string, request, jsonify
from typing import Dict, List, Optional
import os


# ════════════════════════════════════════════════════════════════════════════
# FLASK APP
# ════════════════════════════════════════════════════════════════════════

app = Flask(__name__)

# HTML Template with Awesome Dark Theme
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Egytronic 1.0 - Agent Platform</title>
    <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;600&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        /* ═══════════════════════════════════════════════════════════════════════════ */
        :root {
            --bg-primary: #0a0e14;
            --bg-secondary: #111820;
            --bg-tertiary: #1a222e;
            --accent-cyan: #00d9ff;
            --accent-green: #00ff88;
            --accent-purple: #a855f7;
            --accent-orange: #ff7b00;
            --text-primary: #e6edf3;
            --text-secondary: #8b949e;
            --border-color: #30363d;
            --glow-cyan: 0 0 20px rgba(0, 217, 255, 0.3);
            --glow-green: 0 0 20px rgba(0, 255, 136, 0.3);
        }
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Inter', sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            min-height: 100vh;
            overflow-x: hidden;
        }
        
        /* Animated Background */
        body::before {
            content: '';
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: 
                radial-gradient(ellipse at 20% 20%, rgba(0, 217, 255, 0.08) 0%, transparent 50%),
                radial-gradient(ellipse at 80% 80%, rgba(168, 85, 247, 0.08) 0%, transparent 50%);
            pointer-events: none;
            z-index: -1;
        }
        
        /* Layout */
        .container { display: flex; min-height: 100vh; }
        
        /* Sidebar */
        .sidebar {
            width: 260px;
            background: var(--bg-secondary);
            border-right: 1px solid var(--border-color);
            padding: 20px 0;
            display: flex;
            flex-direction: column;
        }
        
        .logo {
            padding: 0 24px 24px;
            border-bottom: 1px solid var(--border-color);
            margin-bottom: 16px;
        }
        
        .logo h1 {
            font-family: 'Fira Code', monospace;
            font-size: 20px;
            background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-shadow: var(--glow-cyan);
        }
        
        .logo span {
            font-size: 11px;
            color: var(--accent-orange);
            letter-spacing: 2px;
        }
        
        .nav-item {
            padding: 12px 24px;
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .nav-item:hover, .nav-item.active {
            background: var(--bg-tertiary);
            color: var(--accent-cyan);
            border-left: 3px solid var(--accent-cyan);
        }
        
        .nav-item .icon { font-size: 18px; }
        
        /* Main Content */
        .main {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        .header {
            height: 64px;
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 24px;
        }
        
        .header-title {
            font-size: 18px;
            font-weight: 600;
        }
        
        .status-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: var(--text-secondary);
        }
        
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--accent-green);
            box-shadow: var(--glow-green);
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        /* Chat Area */
        .chat-area {
            flex: 1;
            overflow-y: auto;
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        
        .message {
            max-width: 80%;
            padding: 16px 20px;
            border-radius: 12px;
            line-height: 1.6;
        }
        
        .message.user {
            background: var(--bg-tertiary);
            align-self: flex-end;
            border: 1px solid var(--border-color);
        }
        
        .message.agent {
            background: linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary));
            align-self: flex-start;
            border: 1px solid var(--accent-cyan);
            box-shadow: var(--glow-cyan);
        }
        
        .message .label {
            font-size: 11px;
            color: var(--text-secondary);
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        /* Input Area */
        .input-area {
            background: var(--bg-secondary);
            border-top: 1px solid var(--border-color);
            padding: 20px 24px;
            display: flex;
            gap: 12px;
        }
        
        .input-area input {
            flex: 1;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 14px 18px;
            color: var(--text-primary);
            font-size: 15px;
            outline: none;
            transition: border-color 0.2s;
        }
        
        .input-area input:focus {
            border-color: var(--accent-cyan);
            box-shadow: var(--glow-cyan);
        }
        
        .input-area button {
            background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
            border: none;
            border-radius: 8px;
            padding: 14px 28px;
            color: var(--bg-primary);
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .input-area button:hover {
            transform: translateY(-2px);
            box-shadow: var(--glow-cyan);
        }
        
        /* Provider Badge */
        .provider-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 12px;
            background: var(--bg-tertiary);
            border-radius: 20px;
            font-size: 12px;
            color: var(--accent-green);
        }
        
        /* Tools Grid */
        .tools-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 12px;
            padding: 24px;
        }
        
        .tool-card {
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 16px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .tool-card:hover {
            border-color: var(--accent-cyan);
            box-shadow: var(--glow-cyan);
        }
        
        .tool-card .name {
            font-weight: 600;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .tool-card .desc {
            font-size: 13px;
            color: var(--text-secondary);
        }
        
        /* Scrollbar */
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: var(--bg-primary); }
        ::-webkit-scrollbar-thumb { 
            background: var(--border-color);
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover { background: var(--text-secondary); }
    </style>
</head>
<body>
    <div class="container">
        <!-- Sidebar -->
        <div class="sidebar">
            <div class="logo">
                <h1>Egytronic</h1>
                <span>1.0 AGENT PLATFORM</span>
            </div>
            
            <div class="nav-item active" onclick="showChat()">
                <span class="icon">💬</span>
                <span>Chat</span>
            </div>
            <div class="nav-item" onclick="showTools()">
                <span class="icon">🛠️</span>
                <span>Tools</span>
            </div>
            <div class="nav-item" onclick="showProviders()">
                <span class="icon">🤖</span>
                <span>Providers</span>
            </div>
            <div class="nav-item" onclick="showSettings()">
                <span class="icon">⚙️</span>
                <span>Settings</span>
            </div>
        </div>
        
        <!-- Main Content -->
        <div class="main">
            <div class="header">
                <div class="header-title" id="pageTitle">Chat</div>
                <div class="status-indicator">
                    <div class="status-dot"></div>
                    <span id="providerStatus">Cloudflare Ready</span>
                </div>
            </div>
            
            <!-- Chat View -->
            <div class="chat-area" id="chatView">
                <div class="message agent">
                    <div class="label">Egytronic Agent</div>
                    Hello! I'm your AI agent assistant powered by Egytronic 1.0. How can I help you today?
                </div>
            </div>
            
            <div class="input-area" id="inputView">
                <input type="text" id="userInput" placeholder="Type your message..." onkeypress="handleKeyPress(event)">
                <button onclick="sendMessage()">Send</button>
            </div>
        </div>
    </div>
    
    <script>
        let currentProvider = 'cloudflare';
        
        function handleKeyPress(e) {
            if (e.key === 'Enter') sendMessage();
        }
        
        function sendMessage() {
            const input = document.getElementById('userInput');
            const message = input.value.trim();
            if (!message) return;
            
            // Add user message
            const chatArea = document.getElementById('chatView');
            chatArea.innerHTML += `
                <div class="message user">
                    <div class="label">You</div>
                    ${message}
                </div>
            `;
            
            // Clear input
            input.value = '';
            
            // Add loading indicator
            chatArea.innerHTML += `
                <div class="message agent">
                    <div class="label">Egytronic Agent</div>
                    <span style="color: var(--accent-cyan)">● ● ●</span> Processing...
                </div>
            `;
            
            // Scroll to bottom
            chatArea.scrollTop = chatArea.scrollHeight;
        }
        
        function showChat() {
            document.getElementById('pageTitle').innerText = 'Chat';
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            event.target.closest('.nav-item').classList.add('active');
        }
        
        function showTools() {
            document.getElementById('pageTitle').innerText = 'Tools';
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            event.target.closest('.nav-item').classList.add('active');
        }
        
        function showProviders() {
            document.getElementById('pageTitle').innerText = 'Providers';
        }
        
        function showSettings() {
            document.getElementById('pageTitle').innerText = 'Settings';
        }
    </script>
</body>
</html>
"""


# ════════════════════════════════════════════════════════════════════════════
# ROUTES
# ════════════════════════════════════════════════════════════════════════

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)


@app.route('/api/chat', methods=['POST'])
def chat():
    """Chat endpoint"""
    data = request.get_json()
    message = data.get('message', '')
    provider = data.get('provider', 'cloudflare')
    
    # Get credentials
    account_id = os.environ.get('CLOUDFLARE_ACCOUNT_ID')
    api_token = os.environ.get('CLOUDFLARE_API_TOKEN')
    
    if account_id and api_token:
        try:
            from egytronic import Agent
            agent = Agent(model='cloudflare', account_id=account_id, api_token=api_token)
            response = agent.run_sync(message)
            return jsonify({'response': response, 'provider': provider})
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    return jsonify({'error': 'Provider not configured'}), 400


@app.route('/api/providers', methods=['GET'])
def providers():
    """List providers"""
    return jsonify({
        'providers': [
            {'id': 'cloudflare', 'name': 'Cloudflare Workers AI', 'status': 'ready'},
            {'id': 'gemini', 'name': 'Google Gemini', 'status': 'not_configured'},
            {'id': 'openai', 'name': 'OpenAI', 'status': 'not_configured'},
        ]
    })


@app.route('/api/tools', methods=['GET'])
def tools():
    """List tools"""
    return jsonify({
        'tools': [
            {'id': 'browser', 'name': 'Browser', 'icon': '🌐', 'desc': 'Browser automation'},
            {'id': 'file_system', 'name': 'File System', 'icon': '📁', 'desc': 'File operations'},
            {'id': 'terminal', 'name': 'Terminal', 'icon': '💻', 'desc': 'Shell commands'},
            {'id': 'github', 'name': 'GitHub', 'icon': '🐙', 'desc': 'GitHub API'},
        ]
    })


def run_gui(host='0.0.0.0', port=5000):
    """Run GUI server"""
    app.run(host=host, port=port, debug=True)


if __name__ == '__main__':
    run_gui()