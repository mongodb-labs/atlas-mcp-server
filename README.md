# Atlas MCP Server

A Model Context Protocol server for interacting with MongoDB Atlas. This project implements a Model Context Protocol (MCP) server enabling AI assistants to interact with MongoDB Atlas resources through natural language.

> [!CAUTION]
> Do not use this in production. This is a work in progress and is not intended for production use. It is meant for demonstration purposes only.

## 📚 Table of Contents

- [🚀 Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the MCP Server](#running-the-mcp-server)
- [🛠️ Supported Tools](#supported-tools)
  - [Tool List](#tool-list)
- [👩‍💻 Client Integration](#client-integration)
  - [VSCode](#vscode)
  - [Claude](#claude)
- [🤝 Contributing](#contributing)

## 🚀 Getting Started

### Prerequisites

- Node.js (v20 or later)
- MongoDB Atlas account

### Installation

```shell
# Clone the repository
git clone https://github.com/mongodb-labs/mongodb-mcp-server.git
cd mongodb-mcp-server

# Install dependencies
npm install
```

### Running the MCP Server

```shell
npm run build
```

## 🛠️ Supported Tools

### Tool List

#### MongoDB Atlas Tools

- `atlas-list-clusters` - Lists MongoDB Atlas clusters
- `atlas-list-projects` - Lists MongoDB Atlas projects
- `atlas-inspect-cluster` - Inspect a specific MongoDB Atlas cluster
- `atlas-create-free-cluster` - Create a free MongoDB Atlas cluster
- `atlas-create-access-list` - Configure IP/CIDR access list for MongoDB Atlas clusters
- `atlas-inspect-access-list` - Inspect IP/CIDR ranges with access to MongoDB Atlas clusters
- `atlas-list-db-users` - List MongoDB Atlas database users
- `atlas-create-db-user` - List MongoDB Atlas database users

#### MongoDB Database Tools

- `connect` - Connect to a MongoDB instance
- `find` - Run a find query against a MongoDB collection
- `aggregate` - Run an aggregation against a MongoDB collection
- `count` - Get the number of documents in a MongoDB collection
- `insert-one` - Insert a single document into a MongoDB collection
- `insert-many` - Insert multiple documents into a MongoDB collection
- `create-index` - Create an index for a MongoDB collection
- `update-one` - Update a single document in a MongoDB collection
- `update-many` - Update multiple documents in a MongoDB collection
- `rename-collection` - Rename a MongoDB collection
- `delete-one` - Delete a single document from a MongoDB collection
- `delete-many` - Delete multiple documents from a MongoDB collection
- `drop-collection` - Remove a collection from a MongoDB database
- `drop-database` - Remove a MongoDB database
- `list-databases` - List all databases for a MongoDB connection
- `list-collections` - List all collections for a given database
- `collection-indexes` - Describe the indexes for a collection
- `collection-schema` - Describe the schema for a collection
- `collection-storage-size` - Get the size of a collection in MB
- `db-stats` - Return statistics about a MongoDB database

## 👩‍💻 Client Integration (Use the server!)

### VSCode

Prerequisites:

- Use VSCode Insiders (https://code.visualstudio.com/insiders/)
- Setup copilot in VSCode Insiders

Step 1: Add the mcp server to VSCode configuration

- Press `Cmd + Shift + P` and type `MCP: Add MCP Server` and select it.
- Select the first option for a local MCP server.
- Add the path to dist/index.js in the prompt

Step 2: Verify the created mcp file

It should look like this

```json
{
  "servers": {
    "mongodb-mcp-server": {
      "type": "stdio",
      "command": "/Users/<user>/workplace/atlas-mcp-server/dist/index.js",
      "args": []
    }
  }
}
```

Notes: You can configure the server with atlas access, make sure to follow configuration section for more details.

Step 3: Open the copilot chat and check that the toolbox icon is visible and has the mcp server listed.

Step 4: Try running a command

- Can you list my clusters?

### Claude

Step 1: Install claude and login

```shell
brew install claude
```

Step 2: Create a configuration file for your MCP server

Open the file

```shell
code ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

Paste the mcp server configuration into the file

```json
{
  "mcpServers": {
    "Demo": {
      "command": "path/to/this/repo/atlas-mc-server/dist/index.js"
    }
  }
}
```

Step 3: Launch Claude Desktop and click on the hammer icon, the Demo MCP server should be detected. Type in the chat "show me a demo of MCP" and allow the tool to get access.

Note: If you make changes to your MCP server code, rebuild the project with `npm run build` and restart the server and Claude Desktop.

## Configuration

The MongoDB MCP Server can be configured using multiple methods, with the following precedence (highest to lowest):

1. Command-line arguments
2. Environment variables

### Configuration Options

| Option             | Description                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `apiClientId`      | Atlas API client ID for authentication                                                                                |
| `apiClientSecret`  | Atlas API client secret for authentication                                                                            |
| `connectionString` | MongoDB connection string for direct database connections (optional users may choose to inform it on every tool call) |
| `logPath`          | Folder to store logs                                                                                                  |
| `disabledTools`    | An array of tool names, operation types, and/or categories of tools that will be disabled.                            |

#### `logPath`
Default log location is as follows:
- Windows: `%LOCALAPPDATA%\mongodb\mongodb-mcp\.app-logs`
- macOS/Linux: `~/.mongodb/mongodb-mcp/.app-logs`


#### Disabled Tools
You can disable specific tools or categories of tools by using the `disabledTools` option. This option accepts an array of strings,
where each string can be a tool name, operation type, or category.

The way the array is constructed depends on the type of configuration method you use:
- For **environment variable** configuration, use a comma-separated string: `export MDB_MCP_DISABLED_TOOLS="create,update,delete,atlas,collectionSchema"`.
- For **command-line argument** configuration, use a space-separated string: `--disabledTools create update delete atlas collectionSchema`.

Categories of tools:
- `atlas` - MongoDB Atlas tools, such as list clusters, create cluster, etc.
- `mongodb` - MongoDB database tools, such as find, aggregate, etc.

Operation types:
- `create` - Tools that create resources, such as create cluster, insert document, etc.
- `update` - Tools that update resources, such as update document, rename collection, etc.
- `delete` - Tools that delete resources, such as delete document, drop collection, etc.
- `read` - Tools that read resources, such as find, aggregate, list clusters, etc.
- `metadata` - Tools that read metadata, such as list databases, list collections, collection schema, etc.

### Atlas API Access

To use the Atlas API tools, you'll need to create a service account in MongoDB Atlas:

1. **Create a Service Account:**

   - Log in to MongoDB Atlas at [cloud.mongodb.com](https://cloud.mongodb.com)
   - Navigate to Access Manager > Organization Access
   - Click Add New > Applications > Service Accounts
   - Enter name, description and expiration for your service account (e.g., "MCP, MCP Server Access, 7 days")
   - Select appropriate permissions (for full access, use Organization Owner)
   - Click "Create"

2. **Save Client Credentials:**

   - After creation, you'll be shown the Client ID and Client Secret
   - **Important:** Copy and save the Client Secret immediately as it won't be displayed again

3. **Add Access List Entry (Optional but recommended):**

   - Add your IP address to the API access list

4. **Configure the MCP Server:**
   - Use one of the configuration methods below to set your `apiClientId` and `apiClientSecret`

### Configuration Methods

#### Environment Variables

Set environment variables with the prefix `MDB_MCP_` followed by the option name in uppercase with underscores:

```shell
# Set Atlas API credentials
export MDB_MCP_API_CLIENT_ID="your-atlas-client-id"
export MDB_MCP_API_CLIENT_SECRET="your-atlas-client-secret"

# Set a custom MongoDB connection string
export MDB_MCP_CONNECTION_STRING="mongodb+srv://username:password@cluster.mongodb.net/myDatabase"

export MDB_MCP_LOG_PATH="/path/to/logs"
```

#### Command-Line Arguments

Pass configuration options as command-line arguments when starting the server:

```shell
node dist/index.js --apiClientId="your-atlas-client-id" --apiClientSecret="your-atlas-client-secret" --connectionString="mongodb+srv://username:password@cluster.mongodb.net/myDatabase" --logPath=/path/to/logs
```

## 🤝 Contributing

Interested in contributing? Great! Please check our [Contributing Guide](CONTRIBUTING.md) for guidelines on code contributions, standards, adding new tools, and troubleshooting information.
