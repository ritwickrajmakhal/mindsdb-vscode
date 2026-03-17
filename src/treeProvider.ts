import * as vscode from 'vscode';
import { MindsDBClient } from './mindsdbClient';

export class ConnectionItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        iconName?: string,
        public readonly command?: vscode.Command,
        public readonly projectName?: string,
        public readonly itemType?: string
    ) {
        super(label, collapsibleState);
        if (iconName === 'none') {
            this.iconPath = undefined;
        } else if (iconName) {
            this.iconPath = new vscode.ThemeIcon(iconName);
        } else {
            this.iconPath = new vscode.ThemeIcon(contextValue === 'group' ? 'folder' : 'database');
        }
    }
}

export class MindsDBTreeProvider implements vscode.TreeDataProvider<ConnectionItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ConnectionItem | undefined | void> = new vscode.EventEmitter<ConnectionItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<ConnectionItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private type: 'system' | 'projects' | 'datasources') {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ConnectionItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ConnectionItem): Promise<ConnectionItem[]> {
        if (!MindsDBClient.isConnected()) {
            return [];
        }

        if (!element) {
            try {
                if (this.type === 'system') {
                    const items = await MindsDBClient.getSystemDatabases();
                    return items.map(item => {
                        let icon = 'database';
                        if (item.name === 'information_schema') {icon = 'symbol-structure';}
                        if (item.name === 'log') {icon = 'terminal';}
                        
                        return new ConnectionItem(
                            item.name, 
                            vscode.TreeItemCollapsibleState.Collapsed, 
                            'system-db', 
                            icon
                        );
                    });
                } else if (this.type === 'projects') {
                    const items = await MindsDBClient.getProjects();
                    return items.map(item => new ConnectionItem(
                        item.name, 
                        vscode.TreeItemCollapsibleState.Collapsed, 
                        item.name === 'mindsdb' ? 'project' : 'project-deletable', 
                        'package'
                    ));
                } else if (this.type === 'datasources') {
                    const items = await MindsDBClient.getDatasources();
                    return items.map(item => {
                        const icon = item.engine === 'files' ? 'file' : 'database';
                        return new ConnectionItem(
                            item.database, 
                            vscode.TreeItemCollapsibleState.Collapsed, 
                            item.engine === 'files' ? 'database-files' : 'database-deletable', 
                            icon
                        );
                    });
                }
                return [];
            } catch (error) {
                vscode.window.showErrorMessage(`Error fetching ${this.type}: ` + error);
                return [];
            }
        }

        const label = typeof element.label === 'string' ? element.label : element.label?.label;

        // Handle expanding items
        if (element.contextValue === 'system-db') {
            if (label === 'information_schema') {
                const children = [
                    'models', 'databases', 'ml_engines', 'handlers', 'jobs', 
                    'chatbots', 'knowledge_bases', 'agents', 'views', 'triggers', 'queries'
                ];
                return children.map(c => new ConnectionItem(
                    c, 
                    vscode.TreeItemCollapsibleState.None, 
                    'system-child', 
                    'none',
                    {
                        command: 'mindsdb.runQuery',
                        title: 'Run Query',
                        arguments: [`SELECT *\nFROM information_schema.${c.toUpperCase()}\nLIMIT 10;`]
                    }
                ));
            } else if (label === 'log') {
                const children = ['llm_log', 'jobs_history'];
                return children.map(c => new ConnectionItem(
                    c, 
                    vscode.TreeItemCollapsibleState.None, 
                    'system-child', 
                    'none',
                    {
                        command: 'mindsdb.runQuery',
                        title: 'Run Query',
                        arguments: [`SELECT *\nFROM log.${c}\nLIMIT 10;`]
                    }
                ));
            }
        }

        if (element.contextValue === 'project' || element.contextValue === 'project-deletable') {
            const children = [
                { name: 'agents', icon: 'robot' },
                { name: 'jobs', icon: 'history' },
                { name: 'knowledge_bases', icon: 'library' },
                { name: 'models', icon: 'circuit-board' },
                { name: 'views', icon: 'layers' }
            ];
            return children.map(c => new ConnectionItem(
                c.name, 
                vscode.TreeItemCollapsibleState.Collapsed, 
                `project-folder-${c.name}`, 
                c.icon,
                undefined,
                label
            ));
        }

        if (element.contextValue.startsWith('project-folder')) {
            const project = element.projectName;
            if (!project) {return [];}
            
            const type = label || '';
            const items = await MindsDBClient.getProjectItems(project, type);
            
            if (items.length === 0) {
                return [new ConnectionItem('empty', vscode.TreeItemCollapsibleState.None, 'empty', 'none')];
            }

            return items.map(item => {
                let name = item.name || item.database || item.model_name || item.TABLE_NAME;
                // Some queries return results in different formats
                if (type === 'views') {name = item.name || item.table_name;}
                
                let query = '';
                if (type === 'agents') {query = `DESCRIBE AGENT ${project}.${name};`;}
                if (type === 'jobs') {query = `SELECT * FROM information_schema.JOBS WHERE name = '${name}';`;}
                if (type === 'models') {query = `DESCRIBE ${project}.${name};`;}
                if (type === 'knowledge_bases') {query = `DESCRIBE KNOWLEDGE_BASE ${project}.${name};`;}
                if (type === 'views') {query = `SELECT * FROM ${project}.${name} LIMIT 10;`;}

                let icon = 'symbol-field';
                if (type === 'agents') {icon = 'account';}
                if (type === 'jobs') {icon = 'play';}
                if (type === 'models') {icon = 'symbol-class';}
                if (type === 'knowledge_bases') {icon = 'book';}
                if (type === 'views') {icon = 'table';}

                return new ConnectionItem(
                    name,
                    vscode.TreeItemCollapsibleState.None,
                    'project-item',
                    icon,
                    {
                        command: 'mindsdb.runQuery',
                        title: 'Run Query',
                        arguments: [query]
                    },
                    project,
                    type
                );
            });
        }

        if (element.contextValue === 'database' || element.contextValue === 'database-deletable' || element.contextValue === 'database-files') {
            try {
                let tables: any[] = [];
                if (label === 'files') {
                    // Files use a specialized API/query which we've handled before
                    const items = await MindsDBClient.getProjectItems('files', 'tables');
                    tables = items;
                } else {
                    // Regular datasources: Fetch tables directly
                    const tableResult = await MindsDBClient.runQuery(`SHOW TABLES FROM ${label}`);
                    tables = tableResult.rows || [];
                }

                if (tables.length === 0) {
                    return [new ConnectionItem('empty', vscode.TreeItemCollapsibleState.None, 'empty', 'none')];
                }

                return tables.map(t => {
                    const tName = t.table_name || t.name || t.TABLE_NAME || t.tables_in_files || Object.values(t)[0];
                    return new ConnectionItem(
                        String(tName),
                        vscode.TreeItemCollapsibleState.None,
                        label === 'files' ? 'file-table' : 'table',
                        'table',
                        {
                            command: 'mindsdb.runQuery',
                            title: 'Run Query',
                            arguments: [`SELECT * FROM ${label}.${tName} LIMIT 10;`]
                        }
                    );
                });

            } catch (error) {
                vscode.window.showErrorMessage(`Error fetching tables for ${label}: ` + error);
                return [];
            }
        }

        return [];
    }
}