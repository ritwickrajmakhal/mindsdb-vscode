import * as vscode from 'vscode';
import * as https from 'https';

export class IntegrationExplorerPanel {
    public static currentPanel: IntegrationExplorerPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private integrations: any[] = [];

    private constructor(panel: vscode.WebviewPanel) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'openIntegration':
                        this.openIntegrationDoc(message.name);
                        return;
                    case 'goBack':
                        this.renderList();
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public static async show(url?: string, title?: string) {
        if (IntegrationExplorerPanel.currentPanel) {
            IntegrationExplorerPanel.currentPanel._panel.reveal(vscode.ViewColumn.Beside);
            if (url && title) {
                await IntegrationExplorerPanel.currentPanel.openIntegrationByUrl(url, title);
            }
        } else {
            const panel = vscode.window.createWebviewPanel(
                'mindsdbIntegrations',
                title || 'MindsDB Integrations',
                vscode.ViewColumn.Beside,
                { enableScripts: true }
            );

            IntegrationExplorerPanel.currentPanel = new IntegrationExplorerPanel(panel);
            await IntegrationExplorerPanel.currentPanel.init(url, title);
        }
    }

    private async init(url?: string, title?: string) {
        // Always try to fetch list in background if not already present
        try {
            this.integrations = await this.fetchIntegrationsList();
        } catch (e) {
            console.error('Failed to pre-fetch integrations list', e);
        }

        if (url && title) {
            await this.openIntegrationByUrl(url, title);
        } else {
            this.renderList();
        }
    }

    private async openIntegrationByUrl(url: string, title: string) {
        this._panel.title = title;
        this._panel.webview.html = this.getLoadingHtml(`Loading ${title}...`);
        
        try {
            const markdown = await this.fetchUrl(url);
            const { marked } = await import('marked');
            
            // Preprocess logic for MDX/Markdown
            const baseUrl = 'https://raw.githubusercontent.com/mindsdb/mindsdb/refs/heads/main/docs';
            let processed = markdown
                .replace(/^---\n[\s\S]*?\n---\n/, '')
                .replace(/src="\/([^"]+)"/g, `src="${baseUrl}/$1"`)
                .replace(/\]\(\/([^)]+)\)/g, `](${baseUrl}/$1)`)
                .replace(/<\/?Note[^>]*>/g, '');
            
            const htmlContent = await marked.parse(processed);
            this._panel.webview.html = this.getDetailHtml(title, htmlContent as string);
        } catch (error: any) {
            this._panel.webview.html = this.getErrorHtml(error.message);
        }
    }

    private renderList() {
        this._panel.title = 'MindsDB Integrations';
        this._panel.webview.html = this.getListHtml(this.integrations);
    }

    private async openIntegrationDoc(name: string) {
        this._panel.title = `Integration: ${name}`;
        this._panel.webview.html = this.getLoadingHtml(`Loading ${name}...`);
        
        try {
            const url = `https://raw.githubusercontent.com/mindsdb/mindsdb/main/mindsdb/integrations/handlers/${name}/README.md`;
            const markdown = await this.fetchUrl(url);
            
            // Re-use logic from docProvider conditionally
            const { marked } = await import('marked');
            
            // Preprocess relative image sources specific to GitHub
            const baseUrl = `https://raw.githubusercontent.com/mindsdb/mindsdb/main/mindsdb/integrations/handlers/${name}`;
            const processed = markdown.replace(/src="\.\/([^"]+)"/g, `src="${baseUrl}/$1"`);
            
            const htmlContent = await marked.parse(processed);
            this._panel.webview.html = this.getDetailHtml(name, htmlContent as string);
        } catch (error: any) {
            this._panel.webview.html = `
                <!DOCTYPE html><html><body style="padding:20px;font-family:sans-serif;">
                    <a href="#" onclick="vscode.postMessage({command: 'goBack'})" style="color:var(--vscode-textLink-foreground);">← Back</a>
                    <h3>Error loading documentation for ${name}</h3>
                    <p>${error.message}</p>
                    <script>const vscode = acquireVsCodeApi();</script>
                </body></html>`;
        }
    }

    private fetchIntegrationsList(): Promise<any[]> {
        const url = 'https://api.github.com/repos/mindsdb/mindsdb/contents/mindsdb/integrations/handlers?ref=main';
        return new Promise((resolve, reject) => {
            const options = {
                headers: { 'User-Agent': 'MindsDB-VSCode-Extension' }
            };
            https.get(url, options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            const json = JSON.parse(data);
                            // Filter only directories (the integration folders)
                            const dirs = json.filter((i: any) => i.type === 'dir' && i.name.endsWith('_handler'));
                            resolve(dirs);
                        } catch (e) {
                            reject(e);
                        }
                    } else {
                        reject(new Error(`GitHub API Error: ${res.statusCode} ${res.statusMessage}`));
                    }
                });
            }).on('error', (err) => {
                reject(err);
            });
        });
    }

    private fetchUrl(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    } else {
                        reject(new Error(`Failed to fetch: ${res.statusCode} ${res.statusMessage}`));
                    }
                });
            }).on('error', (err) => reject(err));
        });
    }

    private getListHtml(integrations: any[]) {
        // Generate grid items
        const cardsHtml = integrations.map(i => {
            const displayName = i.name.replace('_handler', '');
            const iconUrl = `https://raw.githubusercontent.com/mindsdb/mindsdb/refs/heads/main/mindsdb/integrations/handlers/${i.name}/icon.svg`;
            
            return `
                <div class="card" onclick="openIntegration('${i.name}')">
                    <img class="card-icon" src="${iconUrl}" onerror="if(this.src.endsWith('.svg')){this.src=this.src.replace('.svg', '.png')}else{this.src='https://raw.githubusercontent.com/mindsdb/mindsdb/main/assets/mindsdb_logo.png'; this.onerror=null;}" />
                    <div class="card-title">${displayName}</div>
                </div>
            `;
        }).join('');

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-editor-foreground);
                        background-color: var(--vscode-editor-background);
                        padding: 20px;
                    }
                    .search-container {
                        margin-bottom: 20px;
                        position: sticky;
                        top: 0;
                        background-color: var(--vscode-editor-background);
                        padding-top: 10px;
                        padding-bottom: 10px;
                        z-index: 10;
                    }
                    input[type="text"] {
                        width: 100%;
                        padding: 8px;
                        box-sizing: border-box;
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 4px;
                    }
                    .grid {
                        display: flex;
                        flex-direction: column;
                        gap: 10px;
                    }
                    .card {
                        display: flex;
                        align-items: center;
                        padding: 12px;
                        background-color: var(--vscode-editorWidget-background);
                        border: 1px solid var(--vscode-widget-border, transparent);
                        border-radius: 6px;
                        cursor: pointer;
                        transition: background-color 0.2s;
                    }
                    .card:hover {
                        background-color: var(--vscode-list-hoverBackground);
                    }
                    .card-icon {
                        width: 32px;
                        height: 32px;
                        border-radius: 4px;
                        margin-right: 12px;
                        object-fit: contain;
                        background: white;
                        padding: 2px;
                    }
                    .card-title {
                        flex-grow: 1;
                        font-size: 14px;
                        font-weight: 500;
                    }
                </style>
            </head>
            <body>
                <div class="search-container">
                    <input type="text" id="searchInput" placeholder="Search Integration..." onkeyup="filterCards()">
                </div>
                <div class="grid" id="grid">
                    ${cardsHtml}
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    
                    function openIntegration(name) {
                        vscode.postMessage({ command: 'openIntegration', name: name });
                    }

                    function filterCards() {
                        const input = document.getElementById('searchInput');
                        const filter = input.value.toLowerCase();
                        const grid = document.getElementById('grid');
                        const cards = grid.getElementsByClassName('card');

                        for (let i = 0; i < cards.length; i++) {
                            const title = cards[i].getElementsByClassName('card-title')[0];
                            const txtValue = title.textContent || title.innerText;
                            if (txtValue.toLowerCase().indexOf(filter) > -1) {
                                cards[i].style.display = "flex";
                            } else {
                                cards[i].style.display = "none";
                            }
                        }
                    }
                </script>
            </body>
            </html>`;
    }

    private getDetailHtml(name: string, content: string) {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-editor-foreground);
                        background-color: var(--vscode-editor-background);
                        padding: 20px;
                        line-height: 1.6;
                    }
                    .back-btn {
                        display: inline-block;
                        margin-bottom: 20px;
                        cursor: pointer;
                        color: var(--vscode-textLink-foreground);
                        text-decoration: none;
                        font-size: 14px;
                    }
                    .back-btn:hover { text-decoration: underline; }
                    h1, h2, h3, h4 { color: var(--vscode-editor-foreground); }
                    a { color: var(--vscode-textLink-foreground); text-decoration: none; }
                    a:hover { text-decoration: underline; }
                    code {
                        background-color: var(--vscode-textCodeBlock-background);
                        font-family: var(--vscode-editor-font-family);
                        padding: 2px 4px;
                        border-radius: 4px;
                    }
                    pre {
                        background-color: var(--vscode-textCodeBlock-background);
                        padding: 16px;
                        border-radius: 6px;
                        overflow-x: auto;
                        position: relative;
                    }
                    pre code { padding: 0; background-color: transparent; }
                    img { max-width: 100%; border-radius: 4px; }
                    .copy-btn {
                        position: absolute;
                        top: 8px;
                        right: 8px;
                        padding: 4px 8px;
                        font-size: 11px;
                        cursor: pointer;
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        border-radius: 3px;
                        opacity: 0.8;
                    }
                    .copy-btn:hover { opacity: 1; }
                </style>
            </head>
            <body>
                <a class="back-btn" onclick="goBack()">← Back to list</a>
                ${content}
                <script>
                    const vscode = acquireVsCodeApi();
                    function goBack() {
                        vscode.postMessage({ command: 'goBack' });
                    }

                    // Add copy buttons to pre blocks
                    document.querySelectorAll('pre').forEach(pre => {
                        const button = document.createElement('button');
                        button.className = 'copy-btn';
                        button.innerText = 'Copy';
                        button.addEventListener('click', () => {
                            const code = pre.querySelector('code').innerText;
                            navigator.clipboard.writeText(code).then(() => {
                                button.innerText = 'Copied!';
                                setTimeout(() => button.innerText = 'Copy', 2000);
                            });
                        });
                        pre.appendChild(button);
                    });
                </script>
            </body>
            </html>`;
    }

    private getLoadingHtml(msg: string) {
        return `<!DOCTYPE html><html><body style="padding:20px;font-family:sans-serif;"><p>${msg}</p></body></html>`;
    }

    private getErrorHtml(errorStr: string) {
        return `<!DOCTYPE html><html><body style="padding:20px;font-family:sans-serif;">
            <h3>Error loading integrations</h3>
            <p>${errorStr}</p>
        </body></html>`;
    }

    public dispose() {
        IntegrationExplorerPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) { x.dispose(); }
        }
    }
}
