# MindsDB for VS Code

Query, manage, and explore MindsDB directly from VS Code.

This extension brings your MindsDB workspace into the editor with explorer views, notebooks, and chat-driven workflows so you can move from idea to query fast.

## Demo

![MindsDB VS Code Demo (placeholder)](resources/demo-placeholder.gif)

> Replace `resources/demo-placeholder.gif` with your recorded product walkthrough GIF.

## Step-by-Step GIF Placeholders

### 1. Add Connection

![Step 1 - Add Connection (placeholder)](resources/demo-step-1-add-connection.gif)

### 2. Explore System, Projects, and Datasources

![Step 2 - Explore Sidebar (placeholder)](resources/demo-step-2-explore-sidebar.gif)

### 3. Create and Run a Notebook Query

![Step 3 - Notebook Query (placeholder)](resources/demo-step-3-notebook-query.gif)

### 4. Ask Questions in Chat

![Step 4 - Chat Workflow (placeholder)](resources/demo-step-4-chat.gif)

### 5. Upload a File and Manage Datasources

![Step 5 - Upload and Manage Datasource (placeholder)](resources/demo-step-5-datasource.gif)

> Suggested GIF names:
> - `resources/demo-step-1-add-connection.gif`
> - `resources/demo-step-2-explore-sidebar.gif`
> - `resources/demo-step-3-notebook-query.gif`
> - `resources/demo-step-4-chat.gif`
> - `resources/demo-step-5-datasource.gif`

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
