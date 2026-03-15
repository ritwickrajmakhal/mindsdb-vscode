import * as vscode from 'vscode';
import { MindsDBClient } from './mindsdbClient';

export class ConnectionItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        iconName?: string,
        public readonly command?: vscode.Command
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
                        if (item.name === 'information_schema') icon = 'symbol-structure';
                        if (item.name === 'log') icon = 'terminal';
                        
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
                        'project', 
                        'folder'
                    ));
                } else if (this.type === 'datasources') {
                    const items = await MindsDBClient.getDatasources();
                    return items.map(item => {
                        const icon = item.engine === 'files' ? 'file' : 'database';
                        return new ConnectionItem(item.database, vscode.TreeItemCollapsibleState.None, 'database', icon);
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
                        arguments: [`SELECT *\nFROM information_schema.${c.toUpperCase()}\nLIMIT 50;`]
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
                        arguments: [`SELECT *\nFROM log.${c}\nLIMIT 50;`]
                    }
                ));
            }
        }

        if (element.contextValue === 'project') {
            const children = ['agents', 'jobs', 'knowledge_bases', 'models', 'views'];
            return children.map(c => new ConnectionItem(c, vscode.TreeItemCollapsibleState.Collapsed, 'project-folder', 'folder'));
        }

        // Project folders (agents, jobs, etc.) - return empty for now as requested
        if (element.contextValue === 'project-folder') {
            return [];
        }

        return [];
    }
}