# MindsDB VS Code Extension

A powerful VS Code extension for seamlessly integrating MindsDB into your development workflow. MindsDB is an open-source query engine that enables AI analytics, allowing AI agents to answer questions directly from databases and data warehouses without ETL.

## Features

* **Connection Management** - Easily connect to MindsDB instances and manage multiple connections with secure credential storage
* **Database Explorer** - Browse System, Projects, and Datasources in dedicated tree views
* **MindsDB Notebooks** - Create and execute interactive notebooks for AI-powered queries directly in VS Code
* **Chat Interface** - Interactive chat view to query and explore your data using natural language
* **Project Management** - Create, manage, and delete projects within MindsDB
* **Datasource Management** - Browse, upload, and manage datasources
* **Auto-Reconnect** - Automatically reconnect to your last used MindsDB instance on startup
* **Secure Credential Storage** - Passwords stored securely using VS Code's secrets management

## Getting Started

### Requirements

* VS Code 1.110.0 or later
* Access to a running MindsDB instance (local or remote)
* Network connectivity to your MindsDB server

### Installation

1. Install the MindsDB extension from the VS Code Marketplace
2. Click the MindsDB icon in the Activity Bar to open the explorer
3. Click "Add Connection" to connect to your MindsDB instance
4. Enter your MindsDB host URL (e.g., `http://localhost:47334` or your remote URL)
5. Provide your username and password

### Basic Usage

**Adding a Connection:**
- Click the `+` icon in the MindsDB explorer
- Enter your connection details (host, username, password)
- Credentials are securely stored and automatically restore on restart

**Creating a Notebook:**
- Click "New MindsDB Notebook" command or use the context menu
- Write and execute MindsDB SQL queries

**Using Chat:**
- Open the MindsDB Chat view from the activity bar
- Ask natural language questions about your data
- The extension handles query translation and execution

**Managing Projects:**
- View all projects in the Projects tree
- Create new projects with the create button
- Delete projects with the delete option

**Managing Datasources:**
- Browse available datasources in the Datasources tree
- Upload new files or data sources
- Delete datasources you no longer need

## Extension Commands

* `mindsdb.addConnection` - Add a new MindsDB connection
* `mindsdb.deleteConnection` - Disconnect from MindsDB
* `mindsdb.refreshConnections` - Refresh the explorer views
* `mindsdb.newNotebook` - Create a new MindsDB notebook
* `mindsdb.uploadFile` - Upload a file as a datasource
* `mindsdb.createProject` - Create a new project
* `mindsdb.deleteProject` - Delete a project
* `mindsdb.deleteDatasource` - Delete a datasource

## Support & Issues

For bug reports, feature requests, or general support, please visit the [GitHub repository](https://github.com/ritwickrajmakhal/mindsdb-vscode).

## Learn More

* [MindsDB Documentation](https://docs.mindsdb.com)
* [MindsDB JavaScript SDK](https://github.com/mindsdb/mindsdb-js-sdk)
* [VS Code Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

---

**Enjoy building AI-powered applications with MindsDB!**
