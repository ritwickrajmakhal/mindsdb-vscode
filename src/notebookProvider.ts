import * as vscode from 'vscode';
import { MindsDBClient } from './mindsdbClient';

interface RawNotebook {
    cells: RawNotebookCell[];
}

interface RawNotebookCell {
    source: string[];
    kind: vscode.NotebookCellKind;
}

export class MindsDBNotebookSerializer implements vscode.NotebookSerializer {
    async deserializeNotebook(
        content: Uint8Array,
        _token: vscode.CancellationToken
    ): Promise<vscode.NotebookData> {
        let contents = new TextDecoder().decode(content);
        let raw: RawNotebook;

        try {
            raw = (contents.length > 0) ? JSON.parse(contents) : { cells: [] };
        } catch {
            raw = { cells: [] };
        }

        const cells = raw.cells.map(
            item =>
                new vscode.NotebookCellData(
                    item.kind,
                    item.source.join('\n'),
                    item.kind === vscode.NotebookCellKind.Code ? 'sql' : 'markdown'
                )
        );

        return new vscode.NotebookData(cells);
    }

    async serializeNotebook(
        data: vscode.NotebookData,
        _token: vscode.CancellationToken
    ): Promise<Uint8Array> {
        let contents: RawNotebook = { cells: [] };

        for (const cell of data.cells) {
            contents.cells.push({
                kind: cell.kind,
                source: cell.value.split(/\r?\n/g)
            });
        }

        return new TextEncoder().encode(JSON.stringify(contents));
    }
}

export class MindsDBNotebookController {
    readonly controllerId = 'mindsdb-notebook-controller';
    readonly notebookType = 'mindsdb-notebook';
    readonly label = 'MindsDB Execution Engine';
    readonly supportedLanguages = ['sql'];

    private readonly _controller: vscode.NotebookController;
    private _executionOrder = 0;

    constructor() {
        this._controller = vscode.notebooks.createNotebookController(
            this.controllerId,
            this.notebookType,
            this.label
        );
        this._controller.supportedLanguages = this.supportedLanguages;
        this._controller.supportsExecutionOrder = true;
        this._controller.executeHandler = this._execute.bind(this);
    }

    private async _execute(
        cells: vscode.NotebookCell[],
        _notebook: vscode.NotebookDocument,
        _controller: vscode.NotebookController
    ): Promise<void> {
        for (let cell of cells) {
            const success = await this._doExecution(cell);
            if (!success) {
                break; // Stop execution on first failure
            }
        }
    }

    private async _doExecution(cell: vscode.NotebookCell): Promise<boolean> {
        const execution = this._controller.createNotebookCellExecution(cell);
        execution.executionOrder = ++this._executionOrder;
        execution.start(Date.now());

        if (!MindsDBClient.isConnected()) {
            execution.replaceOutput([
                new vscode.NotebookCellOutput([
                    vscode.NotebookCellOutputItem.text("Error: Please connect to a MindsDB instance via the Activity Bar first.", 'text/plain')
                ])
            ]);
            execution.end(false, Date.now());
            return false;
        }

        const query = cell.document.getText();
        
        try {
            const result = await MindsDBClient.runQuery(query) as any;
            
            // Check if there's an error field in the result (some SDK versions return error instead of throwing)
            if (result.error || result.error_message) {
                throw new Error(result.error || result.error_message);
            }
            
            // Render the results into a beautiful markdown table and json payload 
            if (result.rows && result.rows.length > 0) {
                const columns = Object.keys(result.rows[0]);
                let markdownTable = `| ${columns.join(' | ')} |\n| ${columns.map(() => '---').join(' | ')} |\n`;
                
                result.rows.forEach((row: any) => {
                    markdownTable += `| ${columns.map(c => {
                        let val = row[c];
                        if (typeof val === 'object') {
                            return val === null ? 'null' : JSON.stringify(val);
                        } else if (typeof val === 'string') {
                            return val.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
                        }
                        return String(val);
                    }).join(' | ')} |\n`;
                });

                // Set multiple formats, VS Code defaults to markdown natively if available
                execution.replaceOutput([
                    new vscode.NotebookCellOutput([
                        vscode.NotebookCellOutputItem.text(markdownTable, 'text/markdown'),
                        vscode.NotebookCellOutputItem.json(result.rows, 'application/json'),
                        vscode.NotebookCellOutputItem.text(JSON.stringify(result.rows, null, 2), 'text/plain')
                    ])
                ]);
            } else {
                execution.replaceOutput([
                    new vscode.NotebookCellOutput([
                        vscode.NotebookCellOutputItem.text("Query executed successfully, but returned 0 rows.", 'text/plain')
                    ])
                ]);
            }

            execution.end(true, Date.now());
            // Refresh tree views after successful execution
            vscode.commands.executeCommand('mindsdb.refreshConnections');
            return true;
        } catch (err: any) {
            console.error("Query Execution Error", err);
            execution.replaceOutput([
                new vscode.NotebookCellOutput([
                    vscode.NotebookCellOutputItem.text(`Error: ${err.message || err}`, 'text/plain')
                ])
            ]);
            execution.end(false, Date.now());
            return false;
        }
    }

    dispose() {
        this._controller.dispose();
    }
}
