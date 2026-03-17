import * as vscode from 'vscode';
import { MindsDBClient } from './mindsdbClient';

export class ChatProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'mindsdb.chatView';
    private _view?: vscode.WebviewView;
    private _sessionId: string = Math.random().toString(36).substring(7);

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data: any) => {
            switch (data.type) {
                case 'getAgents':
                    {
                        if (!MindsDBClient.isConnected()) {
                            this._view?.webview.postMessage({ type: 'error', value: 'Please connect to MindsDB first.' });
                            this._view?.webview.postMessage({ type: 'agentsList', value: [] });
                            return;
                        }
                        try {
                            const result = await MindsDBClient.runQuery('SELECT * FROM information_schema.AGENTS LIMIT 50;');
                            const agents = (result.rows || []).map((row: any) => ({
                                name: row.name,
                                project: row.project // Agent's project
                            }));
                            this._view?.webview.postMessage({ type: 'agentsList', value: agents });
                        } catch (error: any) {
                            this._view?.webview.postMessage({ type: 'error', value: `Error fetching agents: ${error.message}` });
                            this._view?.webview.postMessage({ type: 'agentsList', value: [] });
                        }
                        break;
                    }
                case 'chat':
                    {
                        if (!MindsDBClient.isConnected()) {
                            this._view?.webview.postMessage({ type: 'error', value: 'Please connect to MindsDB first.' });
                            return;
                        }
                        const { agentName, project, question } = data.value;
                        if (!agentName || !project || !question) {
                            this._view?.webview.postMessage({ type: 'error', value: 'Missing agent selection or question.' });
                            return;
                        }

                        try {
                            // Escape single quotes in the question
                            const safeQuestion = question.replace(/'/g, "''");
                            // Use SELECT * to match notebook behavior and capture all potential columns
                            const query = `SELECT * FROM ${project}.${agentName} WHERE question = '${safeQuestion}';`;
                            
                            // Log query to webview for debugging if needed (hidden by default or in console)
                            this._view?.webview.postMessage({ type: 'log', value: `Running query: ${query}` });

                            const result = await MindsDBClient.runQuery(query);
                            
                            let rawAnswer = "";
                            if (result.rows && result.rows.length > 0) {
                                const firstRow = result.rows[0];
                                // 1. Try to find a clear conversational answer column
                                let potentialAnswer = firstRow.answer || firstRow.ANSWER || firstRow.response || firstRow.RESPONSE || firstRow.result || firstRow.RESULT;
                                
                                if (potentialAnswer && typeof potentialAnswer === 'string') {
                                    rawAnswer = potentialAnswer;
                                } else {
                                    // 2. If no clear answer column, and we have data, format it as a markdown table
                                    // Filter out columns we don't want to show (like the input question)
                                    const columns = Object.keys(firstRow).filter(k => k.toLowerCase() !== 'question');
                                    
                                    if (columns.length > 0) {
                                        // Header
                                        rawAnswer = `| ${columns.join(' | ')} |\n`;
                                        rawAnswer += `| ${columns.map(() => '---').join(' | ')} |\n`;
                                        // Rows (showing all results)
                                        result.rows.forEach((row: any) => {
                                            rawAnswer += `| ${columns.map(col => {
                                                const val = row[col];
                                                if (val === null || val === undefined) {return '';}
                                                if (typeof val === 'object') {return JSON.stringify(val);}
                                                return String(val);
                                            }).join(' | ')} |\n`;
                                        });
                                    }
                                }
                            }

                            if (!rawAnswer) {rawAnswer = "Agent returned no answer.";}
                            
                            // Render markdown on the extension side using dynamic import for ESM module
                            const { marked } = await import('marked');
                            const htmlAnswer = await marked.parse(rawAnswer);
                            
                            this._view?.webview.postMessage({ type: 'chatResponse', value: htmlAnswer });
                        } catch (error: any) {
                            this._view?.webview.postMessage({ type: 'error', value: `Error parsing agent response: ${error.message}` });
                        }
                        break;
                    }
                case 'clearChat':
                    {
                        this._sessionId = Math.random().toString(36).substring(7);
                        break;
                    }
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Simple UI matching the screenshot conceptually.
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MindsDB Agents</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-sideBar-background);
            color: var(--vscode-sideBarTitle-foreground);
            margin: 0;
            padding: 10px;
            display: flex;
            flex-direction: column;
            height: 100vh;
            box-sizing: border-box;
        }
        .header {
            margin-bottom: 10px;
        }
        select {
            width: 100%;
            padding: 8px;
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 4px;
            outline: none;
        }
        .chat-container {
            flex-grow: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding-bottom: 10px;
        }
        .message {
            padding: 10px;
            border-radius: 6px;
            max-width: 90%;
            word-wrap: break-word;
        }
        .message.user {
            align-self: flex-end;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-bottom-right-radius: 0;
        }
        .message.agent {
            align-self: flex-start;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-editorGroup-border);
            border-bottom-left-radius: 0;
        }
        .message.agent p {
            margin: 0 0 10px 0;
        }
        .message.agent p:last-child {
            margin-bottom: 0;
        }
        .message.agent ul, .message.agent ol {
            margin: 5px 0;
            padding-left: 20px;
        }
        .message.agent a {
            color: var(--vscode-textLink-foreground);
        }
        .message.agent table {
            border-collapse: collapse;
            width: 100%;
            margin: 10px 0;
            font-size: 0.9em;
            display: block;
            overflow-x: auto;
            white-space: nowrap;
        }
        .message.agent th, .message.agent td {
            border: 1px solid var(--vscode-editorGroup-border);
            padding: 4px 8px;
            text-align: left;
        }
        .message.agent th {
            background-color: var(--vscode-editor-background);
            font-weight: bold;
        }
        .input-container {
            display: flex;
            gap: 5px;
            margin-top: 10px;
        }
        .toolbar {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 5px;
        }
        .toolbar button {
            background: transparent;
            color: var(--vscode-descriptionForeground);
            font-size: 0.8em;
            padding: 2px 5px;
        }
        .toolbar button:hover {
            color: var(--vscode-foreground);
            background: var(--vscode-toolbar-hoverBackground);
        }
        input {
            flex-grow: 1;
            padding: 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            outline: none;
        }
        button {
            padding: 8px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .loading {
            align-self: flex-start;
            font-style: italic;
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="header">
        <select id="agentSelect">
            <option value="">Loading agents...</option>
        </select>
    </div>

    <div class="toolbar">
        <button id="clearChatBtn">Clear Chat</button>
    </div>
    
    <div class="chat-container" id="chatContainer">
        <div class="message agent">Select an agent above to start chatting.</div>
    </div>
    
    <div class="input-container">
        <input type="text" id="chatInput" placeholder="Ask a question..." disabled />
        <button id="sendBtn" disabled>Send</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        const agentSelect = document.getElementById('agentSelect');
        const chatContainer = document.getElementById('chatContainer');
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendBtn');
        const clearChatBtn = document.getElementById('clearChatBtn');
        
        let loadedAgents = [];
        let isWaitingForResponse = false;

        // Request agents on load
        vscode.postMessage({ type: 'getAgents' });

        agentSelect.addEventListener('change', () => {
            if (agentSelect.value) {
                chatInput.disabled = false;
                sendBtn.disabled = false;
                chatContainer.innerHTML = '';
                addMessage('agent', '<p>Hello! How can I help you today?</p>');
            } else {
                chatInput.disabled = true;
                sendBtn.disabled = true;
            }
        });

        clearChatBtn.addEventListener('click', () => {
            chatContainer.innerHTML = '';
            addMessage('agent', '<p>Chat cleared. How can I help you?</p>');
            vscode.postMessage({ type: 'clearChat' });
        });

        function sendMessage() {
            const text = chatInput.value.trim();
            if (!text || isWaitingForResponse || !agentSelect.value) return;
            
            const selectedAgent = loadedAgents.find(a => a.name === agentSelect.value);
            if (!selectedAgent) return;

            addMessage('user', text);
            chatInput.value = '';
            
            isWaitingForResponse = true;
            setUiState(true);
            
            // Add loading indicator
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'loading';
            loadingDiv.id = 'loadingIndicator';
            loadingDiv.textContent = 'Agent is typing...';
            chatContainer.appendChild(loadingDiv);
            scrollToBottom();

            vscode.postMessage({
                type: 'chat',
                value: {
                    agentName: selectedAgent.name,
                    project: selectedAgent.project,
                    question: text
                }
            });
        }

        sendBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        function addMessage(sender, content) {
            const div = document.createElement('div');
            div.className = 'message ' + sender;
            if (sender === 'agent') {
                div.innerHTML = content;
            } else {
                div.textContent = content;
            }
            chatContainer.appendChild(div);
            scrollToBottom();
        }

        function scrollToBottom() {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        
        function setUiState(disabled) {
            chatInput.disabled = disabled;
            sendBtn.disabled = disabled;
            if (!disabled && agentSelect.value) {
                chatInput.focus();
            }
        }

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'agentsList':
                    loadedAgents = message.value;
                    agentSelect.innerHTML = '<option value="">Select an agent...</option>';
                    if (loadedAgents.length === 0) {
                        agentSelect.innerHTML = '<option value="">No agents found.</option>';
                    } else {
                        loadedAgents.forEach(agent => {
                            const option = document.createElement('option');
                            option.value = agent.name;
                            option.textContent = agent.name + ' (' + agent.project + ')';
                            agentSelect.appendChild(option);
                        });
                    }
                    break;
                case 'chatResponse':
                    const loading = document.getElementById('loadingIndicator');
                    if (loading) loading.remove();
                    
                    isWaitingForResponse = false;
                    setUiState(false);
                    
                    addMessage('agent', message.value);
                    break;
                case 'error':
                    const l = document.getElementById('loadingIndicator');
                    if (l) l.remove();
                    
                    isWaitingForResponse = false;
                    setUiState(false);
                    
                    addMessage('agent', '<p><strong>Error:</strong> ' + message.value + '</p>');
                    break;
                case 'log':
                    console.log('[MindsDB Chat Log]', message.value);
                    break;
            }
        });
    </script>
</body>
</html>`;
    }
}
