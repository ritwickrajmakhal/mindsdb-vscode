import * as vscode from 'vscode';
import * as https from 'https';

export class DocumentationPanel {
    public static currentPanel: DocumentationPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, private readonly title: string) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    public static async show(url: string, title: string) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (DocumentationPanel.currentPanel) {
            DocumentationPanel.currentPanel._panel.reveal(vscode.ViewColumn.Beside);
            DocumentationPanel.currentPanel.updateContent(url, title);
        } else {
            const panel = vscode.window.createWebviewPanel(
                'mindsdbDocumentation',
                title,
                vscode.ViewColumn.Beside,
                { enableScripts: true }
            );

            DocumentationPanel.currentPanel = new DocumentationPanel(panel, title);
            await DocumentationPanel.currentPanel.updateContent(url, title);
        }
    }

    private async updateContent(url: string, title: string) {
        this._panel.title = title;
        this._panel.webview.html = this.getLoadingHtml();

        try {
            const markdown = await this.fetchMarkdown(url);
            
            // Preprocess MDX/Markdown
            const baseUrl = 'https://raw.githubusercontent.com/mindsdb/mindsdb/refs/heads/main/docs';
            let processed = markdown
                // Strip YAML frontmatter
                .replace(/^---\n[\s\S]*?\n---\n/, '')
                // Fix relative image sources
                .replace(/src="\/([^"]+)"/g, `src="${baseUrl}/$1"`)
                // Fix relative markdown links
                .replace(/\]\(\/([^)]+)\)/g, `](${baseUrl}/$1)`)
                // Remove custom JSX tags like <Note> but keep content
                .replace(/<\/?Note[^>]*>/g, '');

            const { marked } = await import('marked');
            const htmlContent = await marked.parse(processed);
            this._panel.webview.html = this.getHtmlForWebview(htmlContent as string, title);
        } catch (error: any) {
            this._panel.webview.html = this.getErrorHtml(error.message);
        }
    }

    private fetchMarkdown(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    } else {
                        reject(new Error(`Failed to fetch documentation: ${res.statusCode} ${res.statusMessage}`));
                    }
                });
            }).on('error', (err) => {
                reject(err);
            });
        });
    }

    private getHtmlForWebview(content: string, title: string) {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-editor-foreground);
                        background-color: var(--vscode-editor-background);
                        padding: 20px;
                        line-height: 1.6;
                    }
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
                    }
                    pre code { padding: 0; background-color: transparent; }
                    blockquote {
                        border-left: 4px solid var(--vscode-textBlockQuote-border);
                        padding: 0 16px;
                        color: var(--vscode-textBlockQuote-foreground);
                        margin: 0;
                    }
                </style>
            </head>
            <body>
                ${content}
            </body>
            </html>`;
    }

    private getLoadingHtml() {
        return `<!DOCTYPE html><html><body><p>Loading documentation...</p></body></html>`;
    }

    private getErrorHtml(errorStr: string) {
        return `<!DOCTYPE html><html><body>
            <h3>Error loading documentation</h3>
            <p>${errorStr}</p>
        </body></html>`;
    }

    public dispose() {
        DocumentationPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) { x.dispose(); }
        }
    }
}
