# MindsDB for VS Code

Query, manage, and explore MindsDB directly from VS Code.

This extension brings your MindsDB workspace into the editor with explorer views, notebooks, and chat-driven workflows so you can move from idea to query fast.

## Demo

### 1. Add Connection

![demo-step-1-add-connection](https://github.com/user-attachments/assets/63652533-ce3a-43a4-9f7d-481443358ce8)

### 2. Explore System, Projects, and Datasources

![demo-step-2-explore-sidebar](https://github.com/user-attachments/assets/bfa5956f-29e7-4ce7-8238-e9ae0c27592b)

### 3. Create and Run a Notebook Query

![demo-step-3-notebook-query](https://github.com/user-attachments/assets/18da5cce-b014-43c3-961d-f719386be88b)

### 4. Upload a File and Manage Datasources

![demo-step-5-file-datasource](https://github.com/user-attachments/assets/0cc269e6-5ee5-4088-88d5-8c16b12a76ac)

### 5. Explore MindsDB Integrations

![explore-docs](https://github.com/user-attachments/assets/916a38ff-7732-4de5-a808-eda22fac08e8)

### 6. Ask Questions in Chat

![demo-step-4-chat](https://github.com/user-attachments/assets/65460932-ebc8-4e1d-94df-aabccd6240ed)

## Highlights

- Connection management with secure credential storage
- Explorer views for System, Projects, and Datasources
- MindsDB notebooks for interactive SQL workflows
- Chat interface for natural language exploration
- Project and datasource management actions
- Auto-reconnect on VS Code startup

## Requirements

- VS Code 1.110.0 or later
- Access to a running MindsDB instance
- Network connectivity to your MindsDB server

## Quick Start

1. Install the extension from VS Code Marketplace.
2. Open the MindsDB icon in the Activity Bar.
3. Select Add Connection.
4. Enter your host URL, for example `http://127.0.0.1:47334`.
5. Provide credentials if required.

## Core Workflows

### Connect to MindsDB

- Select the plus icon in the MindsDB explorer.
- Enter host, username, and password details.
- Credentials are stored securely and restored on restart.

### Create and Run Notebooks

- Run the New MindsDB Notebook command.
- Write SQL cells and execute directly in VS Code.

### Use Chat

- Open MindsDB Chat from the Activity Bar.
- Ask questions in natural language to explore data.

### Manage Projects and Datasources

- Create and delete projects from the Projects tree.
- Upload and remove files or datasources from Datasources.

## Commands

- `mindsdb.addConnection`: Add a new MindsDB connection
- `mindsdb.deleteConnection`: Disconnect from MindsDB
- `mindsdb.refreshConnections`: Refresh explorer views
- `mindsdb.newNotebook`: Create a new MindsDB notebook
- `mindsdb.uploadFile`: Upload a file as a datasource
- `mindsdb.createProject`: Create a project
- `mindsdb.deleteProject`: Delete a project
- `mindsdb.deleteDatasource`: Delete a datasource

## Links

- [MindsDB Documentation](https://docs.mindsdb.com)
- [MindsDB JavaScript SDK](https://github.com/mindsdb/mindsdb-js-sdk)
- [Repository and Issues](https://github.com/ritwickrajmakhal/mindsdb-vscode)

## Contributors

Thanks to everyone who contributes to this project.

[![Contributors](https://contrib.rocks/image?repo=ritwickrajmakhal/mindsdb-vscode)](https://github.com/ritwickrajmakhal/mindsdb-vscode/graphs/contributors)

---

Build AI-native data workflows with MindsDB in your editor.
