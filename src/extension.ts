import * as vscode from 'vscode';
import { MindsDBTreeProvider, ConnectionItem } from './treeProvider';
import { MindsDBNotebookSerializer, MindsDBNotebookController } from './notebookProvider';
import { MindsDBClient } from './mindsdbClient';
import { ChatProvider } from './chatProvider';

export function activate(context: vscode.ExtensionContext) {
    const systemProvider = new MindsDBTreeProvider('system');
    const projectsProvider = new MindsDBTreeProvider('projects');
    const datasourcesProvider = new MindsDBTreeProvider('datasources');

    vscode.window.registerTreeDataProvider('mindsdb-system', systemProvider);
    vscode.window.registerTreeDataProvider('mindsdb-projects', projectsProvider);
    vscode.window.registerTreeDataProvider('mindsdb-datasources', datasourcesProvider);

    const chatProvider = new ChatProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ChatProvider.viewType, chatProvider)
    );

    const refreshAll = () => {
        systemProvider.refresh();
        projectsProvider.refresh();
        datasourcesProvider.refresh();
    };

    const updateConnectionContext = () => {
        vscode.commands.executeCommand('setContext', 'mindsdb.connected', MindsDBClient.isConnected());
    };

    const unsubscribeConnectionState = MindsDBClient.onConnectionStateChanged(() => {
        updateConnectionContext();
        refreshAll();
    });
    context.subscriptions.push({ dispose: unsubscribeConnectionState });

    // Auto-reconnect on startup
    const storedHost = context.globalState.get<string>('mindsdb.host');
    const storedUser = context.globalState.get<string>('mindsdb.user');
    
    if (storedHost) {
        context.secrets.get('mindsdb.password').then(password => {
            MindsDBClient.connect(storedHost, storedUser, password || undefined).then(() => {
                refreshAll();
                updateConnectionContext();
            }).catch(e => {
                console.error('Failed to auto-reconnect:', e);
                updateConnectionContext();
            });
        });
    } else {
        updateConnectionContext();
    }

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
            placeHolder: 'http://127.0.0.1:47334',
            value: 'http://127.0.0.1:47334'
        });

        if (url) {
            const authOption = await vscode.window.showQuickPick(['No', 'Yes'], {
                placeHolder: 'Does this connection require authentication?'
            });

            let user: string | undefined;
            let password: string | undefined;

            if (authOption === 'Yes') {
                user = await vscode.window.showInputBox({
                    prompt: 'Enter Username',
                    placeHolder: 'mindsdb'
                });
                if (user === undefined) {return;} // User cancelled

                password = await vscode.window.showInputBox({
                    prompt: 'Enter Password',
                    password: true
                });
                if (password === undefined) {return;} // User cancelled
            }

            try {
                await MindsDBClient.connect(url, user, password);
                await context.globalState.update('mindsdb.host', url);
                await context.globalState.update('mindsdb.user', user);
                if (password) {
                    await context.secrets.store('mindsdb.password', password);
                } else {
                    await context.secrets.delete('mindsdb.password');
                }
                
                refreshAll();
                updateConnectionContext();
                vscode.window.showInformationMessage(`Connected to MindsDB at ${url}`);
            } catch (e: any) {
                vscode.window.showErrorMessage(`Failed to connect: ${e.message}`);
            }
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('mindsdb.refreshConnections', () => {
        refreshAll();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('mindsdb.deleteProject', async (node: ConnectionItem) => {
        const label = typeof node.label === 'string' ? node.label : node.label?.label;
        if (!label || label === 'mindsdb') {return;}

        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to delete the project "${label}"? This will delete all models, views, and data within it.`,
            { modal: true },
            'Delete'
        );

        if (confirm === 'Delete') {
            try {
                await MindsDBClient.runQuery(`DROP PROJECT ${label}`);
                vscode.window.showInformationMessage(`Project "${label}" deleted.`);
                refreshAll();
            } catch (e: any) {
                vscode.window.showErrorMessage(`Failed to delete project: ${e.message}`);
            }
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('mindsdb.deleteProjectItem', async (node: ConnectionItem) => {
        const itemType = node.itemType;
        const project = node.projectName;
        const label = typeof node.label === 'string' ? node.label : node.label?.label;
        
        if (!itemType || !project || !label) {
            vscode.window.showErrorMessage('Error deleting item: Metadata not found.');
            return;
        }

        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to delete the ${itemType.replace('_', ' ')} "${label}" from "${project}"?`,
            { modal: true },
            'Delete'
        );

        if (confirm === 'Delete') {
            try {
                let dropType = itemType.toUpperCase().replace('S', ''); // basic plural to singular
                if (itemType === 'knowledge_bases') {dropType = 'KNOWLEDGE_BASE';}
                if (itemType === 'queries') {dropType = 'VIEW';} // backup for views if needed
                
                // Specific drop commands as requested
                let query = `DROP ${dropType.replace('_S', 'S')} ${project}.${label}`;
                if (itemType === 'agents') {query = `DROP AGENT ${project}.${label}`;}
                if (itemType === 'jobs') {query = `DROP JOB ${project}.${label}`;}
                if (itemType === 'knowledge_bases') {query = `DROP KNOWLEDGE_BASE ${project}.${label}`;}
                if (itemType === 'models') {query = `DROP MODEL ${project}.${label}`;}
                if (itemType === 'views') {query = `DROP VIEW ${project}.${label}`;}

                await MindsDBClient.runQuery(query);
                vscode.window.showInformationMessage(`Deleted ${itemType.replace('_', ' ')} "${label}"`);
                refreshAll();
            } catch (e: any) {
                vscode.window.showErrorMessage(`Failed to delete: ${e.message}`);
            }
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('mindsdb.deleteConnection', async (node: ConnectionItem) => {
        MindsDBClient.disconnect();
        await context.globalState.update('mindsdb.host', undefined);
        await context.globalState.update('mindsdb.user', undefined);
        await context.secrets.delete('mindsdb.password');
        updateConnectionContext();
        vscode.window.showInformationMessage('Disconnected from MindsDB');
        refreshAll();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('mindsdb.uploadFile', async (node: ConnectionItem) => {
        const fileUris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: 'Upload to MindsDB',
            filters: {
                'Supported Files': ['csv', 'xlsx', 'xls', 'json', 'txt', 'pdf', 'parquet'],
                'All Files': ['*']
            }
        });

        if (fileUris && fileUris[0]) {
            const filePath = fileUris[0].fsPath;
            const path = await import('path');
            const defaultName = path.basename(filePath)
                .replace(/[^a-zA-Z0-9_]/g, '_')
                .toLowerCase();
            
            const fileName = await vscode.window.showInputBox({
                prompt: 'Enter a name for the table to store this file in MindsDB',
                value: defaultName
            });

            if (fileName) {
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Uploading ${fileName} to MindsDB...`,
                    cancellable: false
                }, async (progress) => {
                    try {
                        await MindsDBClient.uploadFile(filePath, fileName);
                        vscode.window.showInformationMessage(`File uploaded successfully as table: ${fileName}`);
                        refreshAll();
                    } catch (e: any) {
                        vscode.window.showErrorMessage(`Failed to upload file: ${e.message}`);
                    }
                });
            }
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('mindsdb.deleteDatasource', async (node: ConnectionItem) => {
        const label = typeof node.label === 'string' ? node.label : node.label?.label;
        if (!label || label === 'files') {return;}

        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to delete the datasource "${label}"?`,
            { modal: true },
            'Delete'
        );

        if (confirm === 'Delete') {
            try {
                await MindsDBClient.runQuery(`DROP DATABASE IF EXISTS ${label}`);
                vscode.window.showInformationMessage(`Datasource "${label}" deleted.`);
                refreshAll();
            } catch (e: any) {
                vscode.window.showErrorMessage(`Failed to delete datasource: ${e.message}`);
            }
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('mindsdb.deleteFile', async (node: ConnectionItem) => {
        const label = typeof node.label === 'string' ? node.label : node.label?.label;
        if (!label) {return;}

        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to delete the file "${label}"?`,
            { modal: true },
            'Delete'
        );

        if (confirm === 'Delete') {
            try {
                await MindsDBClient.runQuery(`DROP TABLE files.${label}`);
                vscode.window.showInformationMessage(`File "${label}" deleted.`);
                refreshAll();
            } catch (e: any) {
                vscode.window.showErrorMessage(`Failed to delete file: ${e.message}`);
            }
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('mindsdb.showDocumentation', async (node: ConnectionItem) => {
        const label = typeof node.label === 'string' ? node.label : node.label?.label;
        if (!label) {return;}

        const contextValue = node.contextValue;
        let url = 'https://raw.githubusercontent.com/mindsdb/mindsdb/staging/docs/what-is-mindsdb.md';
        let title = 'MindsDB Documentation';

        if (label === 'files' || contextValue === 'file-table') {
            url = 'https://raw.githubusercontent.com/mindsdb/mindsdb/refs/heads/main/docs/mindsdb_sql/sql/create/file.mdx';
            title = 'Upload a File';
        } else if (contextValue === 'project' || contextValue === 'project-deletable') {
            url = 'https://raw.githubusercontent.com/mindsdb/mindsdb/refs/heads/main/docs/mindsdb_sql/sql/create/project.mdx';
            title = 'Create Project';
        } else if (contextValue === 'project-folder-agents' || (contextValue === 'project-item' && node.itemType === 'agents')) {
            url = 'https://raw.githubusercontent.com/mindsdb/mindsdb/refs/heads/main/docs/mindsdb_sql/agents/agent.mdx';
            title = 'Agents';
        } else if (contextValue === 'project-folder-jobs' || (contextValue === 'project-item' && node.itemType === 'jobs')) {
            url = 'https://raw.githubusercontent.com/mindsdb/mindsdb/refs/heads/main/docs/mindsdb_sql/sql/create/jobs.mdx';
            title = 'Jobs';
        } else if (contextValue === 'project-folder-knowledge_bases' || (contextValue === 'project-item' && node.itemType === 'knowledge_bases')) {
            url = 'https://raw.githubusercontent.com/mindsdb/mindsdb/refs/heads/main/docs/mindsdb_sql/knowledge_bases/overview.mdx';
            title = 'Knowledge Bases';
        } else if (contextValue === 'project-folder-models' || (contextValue === 'project-item' && node.itemType === 'models')) {
            url = 'https://raw.githubusercontent.com/mindsdb/mindsdb/refs/heads/main/docs/mindsdb_sql/sql/create/model.mdx';
            title = 'Models';
        } else if (contextValue === 'project-folder-views' || (contextValue === 'project-item' && node.itemType === 'views')) {
            url = 'https://raw.githubusercontent.com/mindsdb/mindsdb/refs/heads/main/docs/mindsdb_sql/sql/create/view.mdx';
            title = 'Views';
        } else if (contextValue === 'database' || contextValue === 'database-deletable') {
            url = `https://raw.githubusercontent.com/mindsdb/mindsdb/main/mindsdb/integrations/handlers/${label}_handler/README.md`;
            title = `${label} Documentation`;
        }

        const { IntegrationExplorerPanel } = await import('./integrationProvider.js');
        IntegrationExplorerPanel.show(url, title);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('mindsdb.showIntegrations', async () => {
        const { IntegrationExplorerPanel } = await import('./integrationProvider.js');
        IntegrationExplorerPanel.show();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('mindsdb.createAgent', async (node: ConnectionItem) => {
        const project = node.projectName || 'mindsdb';
        const query = `-- we can create an agent to answer all kinds of questions over that data.\n-- Make sure to update the model and API key with your own.\nCREATE AGENT ${project}.my_agent\nUSING\n    data = {\n         --optional: "knowledge_bases": ["project_name.knowledgebase_name', ..."],\n         "tables": ["datasource_conn_name.table_name", ..."]\n    };`;
        vscode.commands.executeCommand('mindsdb.runQuery', query);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('mindsdb.createJob', async (node: ConnectionItem) => {
        const project = node.projectName || 'mindsdb';
        const query = `-- Specify your job name, statements, and schedule to create your job.\n-- After you fill all the mandatory fields, run the query with the top button or shift + enter.\n\nCREATE JOB [IF NOT EXISTS] ${project}.job_name [AS] (\n    <statement_1>[; <statement_2>][; ...]\n)\n[START <date>]\n[END <date>]\n[EVERY [number] <period>]\n[IF (<statement_1>[; <statement_2>][; ...])];`;
        vscode.commands.executeCommand('mindsdb.runQuery', query);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('mindsdb.createKnowledgeBase', async (node: ConnectionItem) => {
        const project = node.projectName || 'mindsdb';
        const query = `-- Specify your knowledge base name, and provide the embedding model, reranking model, storage, metadata columns and content columns.\n-- After you fill all the mandatory fields, run the query with the top button or shift + enter.\n\nCREATE KNOWLEDGE_BASE ${project}.<kb_name>\nUSING\n     embedding_model = {\n         "provider": "openai", -- choose one of openai, azure_openai, or custom_openai\n         "model_name" : "text-embedding-3-small",\n         "api_key": "sk-..."  -- optional, default from env variable\n     },\n     reranking_model = {\n         "provider": "openai", -- choose one of openai, azure_openai, or custom_openai\n         "model_name": 'gpt-4o',\n         "api_key": "sk-..."  -- optional, default from env variable\n     },\n     storage = my_vector_store.storage_table, -- optional, default ChromaDB\n     metadata_columns = ['date', 'creator', ...], -- optional\n     content_columns = ['review', 'content', ...], -- optional, default content\n     id_column = 'id'; -- optional`;
        vscode.commands.executeCommand('mindsdb.runQuery', query);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('mindsdb.createModel', async (node: ConnectionItem) => {
        const query = `CREATE ML_ENGINE google_gemini_engine\nFROM google_gemini\nUSING\n      api_key = 'your-api-key';\n---\nCREATE MODEL google_gemini_model\nPREDICT target_column\nUSING\n      engine = 'google_gemini_engine',  -- engine name as created via CREATE ML_ENGINE\n      question_column = 'input_column',          -- column name that stores user input\n      model_name = 'gemini-2.0-flash';             -- model name to be used`;
        vscode.commands.executeCommand('mindsdb.runQuery', query);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('mindsdb.createView', async (node: ConnectionItem) => {
        const project = node.projectName || 'mindsdb';
        const query = `-- Specify your view name and run the query to create your view.\n-- After you fill all the mandatory fields, run the query with the top button or shift + enter.\n\nCREATE VIEW [IF NOT EXISTS] ${project}.view_name AS (\n    SELECT a.column_name, ...,\n           p.model_column AS model_column\n    FROM integration_name.table_name AS a\n    JOIN mindsdb.predictor_name AS p\n);`;
        vscode.commands.executeCommand('mindsdb.runQuery', query);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('mindsdb.runQuery', async (query: string) => {
        // Split by '---' on its own line to create multiple cells
        const cellContents = query.split(/\r?\n---\r?\n/).map(q => q.trim());
        const cellData = cellContents.map(content => 
            new vscode.NotebookCellData(vscode.NotebookCellKind.Code, content, 'sql')
        );

        const newNotebook = await vscode.workspace.openNotebookDocument(
            'mindsdb-notebook', 
            new vscode.NotebookData(cellData)
        );
        await vscode.window.showNotebookDocument(newNotebook);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('mindsdb.createProject', async () => {
        const newNotebook = await vscode.workspace.openNotebookDocument(
            'mindsdb-notebook', 
            new vscode.NotebookData([
                new vscode.NotebookCellData(vscode.NotebookCellKind.Code, 'CREATE PROJECT my_new_project;', 'sql')
            ])
        );
        await vscode.window.showNotebookDocument(newNotebook);
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
