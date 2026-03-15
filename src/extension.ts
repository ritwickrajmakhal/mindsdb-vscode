import * as vscode from 'vscode';
import { MindsDBTreeProvider, ConnectionItem } from './treeProvider';
import { MindsDBNotebookSerializer, MindsDBNotebookController } from './notebookProvider';
import { MindsDBClient } from './mindsdbClient';

export function activate(context: vscode.ExtensionContext) {
    const systemProvider = new MindsDBTreeProvider('system');
    const projectsProvider = new MindsDBTreeProvider('projects');
    const datasourcesProvider = new MindsDBTreeProvider('datasources');

    vscode.window.registerTreeDataProvider('mindsdb-system', systemProvider);
    vscode.window.registerTreeDataProvider('mindsdb-projects', projectsProvider);
    vscode.window.registerTreeDataProvider('mindsdb-datasources', datasourcesProvider);

    const refreshAll = () => {
        systemProvider.refresh();
        projectsProvider.refresh();
        datasourcesProvider.refresh();
    };

    context.subscriptions.push(
        vscode.workspace.registerNotebookSerializer(
            'mindsdb-notebook',
            new MindsDBNotebookSerializer(),
            { transientOutputs: true }
        )
    );

    const controller = new MindsDBNotebookController();
    context.subscriptions.push(controller);

    context.subscriptions.push(vscode.commands.registerCommand('mindsdb.addConnection', async () => {
        const url = await vscode.window.showInputBox({
            prompt: 'Enter MindsDB Host URL',
            placeHolder: 'http://127.0.0.1:47334'
        });
        if (url) {
            try {
                await MindsDBClient.connect(url);
                refreshAll();
                vscode.window.showInformationMessage(`Connected to MindsDB at ${url}`);
            } catch (e: any) {
                vscode.window.showErrorMessage(`Failed to connect: ${e.message}`);
            }
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('mindsdb.refreshConnections', () => {
        refreshAll();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('mindsdb.deleteConnection', (node: ConnectionItem) => {
        // Simple mock for deleting connection, currently we only support 1
        vscode.window.showInformationMessage('Connection deleted');
        refreshAll();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('mindsdb.runQuery', async (query: string) => {
        const newNotebook = await vscode.workspace.openNotebookDocument(
            'mindsdb-notebook', 
            new vscode.NotebookData([
                new vscode.NotebookCellData(vscode.NotebookCellKind.Code, query, 'sql')
            ])
        );
        await vscode.window.showNotebookDocument(newNotebook);
        // Note: Execution is not automatically triggered here to allow user review, 
        // but the cell is ready at the top.
    }));

    context.subscriptions.push(vscode.commands.registerCommand('mindsdb.newNotebook', async () => {
        const newNotebook = await vscode.workspace.openNotebookDocument(
            'mindsdb-notebook', 
            new vscode.NotebookData([
                new vscode.NotebookCellData(vscode.NotebookCellKind.Code, 'SHOW DATABASES;', 'sql')
            ])
        );
        await vscode.window.showNotebookDocument(newNotebook);
    }));
}

export function deactivate() {}
