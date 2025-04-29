# MongoDB MCP Server

A Model Context Protocol server for interacting with MongoDB Atlas. This project implements a Model Context Protocol (MCP) server enabling AI assistants to interact with MongoDB Atlas resources through natural language.

> [!CAUTION]
> Do not use this in production. This is a work in progress and is not intended for production use. It is meant for demonstration purposes only.

## 📚 Table of Contents

- [🚀 Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
    - [VSCode](#vscode)
    - [Claude Desktop](#claude)
- [🛠️ Supported Tools](#supported-tools)
  - [Tool List](#tool-list)
- [⚙️ Configuration](#configuration)
  - [Configuration Options](#configuration-options)
  - [Atlas API Access](#atlas-api-access)
  - [Configuration Methods](#configuration-methods)
- [👩‍💻 Client Integration](#client-integration)
  - [VSCode](#vscode)
  - [Claude](#claude)
- [🤝 Contributing](#contributing)

## Prerequisites

- Node.js (v20 or later)
- MongoDB Atlas account

## Installation

### VSCode

Prerequisites:

- Node.js v20.x

Step 1: Add the mcp server to VSCode configuration

- Press `Cmd + Shift + P` and type `MCP: Add MCP Server` and select it.
- Select command (Stdio).
- Input command `npx -y mongodb-mcp-server`.
- Choose between user / workspace
- Add arguments to the file

Note: the file should look like:

```
{
    "servers": {
        "MongoDB": {
            "type": "stdio",
            "command": "npx",
            "args": [
                "-y",
                "mongodb-mcp-server"
            ]
        }
    }
}
```

Notes: You can configure the server with atlas access, make sure to follow configuration section for more details.

Step 2: Try talking to github copilot

- Can you connect to my mongodb instance?

### Claude Desktop

Step 1: Install claude and login

Note: follow instructions at https://claude.ai/download

Step 2: Launch Claude Settings -> Developer -> Edit Config

Paste the mcp server configuration into the file

```json
{
  "mcpServers": {
    "MongoDB": {
      "command": "npx",
      "args": ["-y", "mongodb-mcp-server"]
    }
  }
}
```

Step 3: Close and Relaunch Claude Desktop and click on the hammer icon, the MongoDB MCP server should be detected.

You may experiment asking `Can you connect to my mongodb instance?`.

## 🛠️ Supported Tools

### Tool List

#### MongoDB Atlas Tools

- `atlas-list-orgs` - Lists MongoDB Atlas organizations
- `atlas-list-projects` - Lists MongoDB Atlas projects
- `atlas-create-project` - Creates a new MongoDB Atlas project
- `atlas-list-clusters` - Lists MongoDB Atlas clusters
- `atlas-inspect-cluster` - Inspect a specific MongoDB Atlas cluster
- `atlas-create-free-cluster` - Create a free MongoDB Atlas cluster
- `atlas-connect-cluster` - Connects to MongoDB Atlas cluster
- `atlas-inspect-access-list` - Inspect IP/CIDR ranges with access to MongoDB Atlas clusters
- `atlas-create-access-list` - Configure IP/CIDR access list for MongoDB Atlas clusters
- `atlas-list-db-users` - List MongoDB Atlas database users
- `atlas-create-db-user` - List MongoDB Atlas database users

NOTE: atlas tools are only available when you set credentials on [configuration](#configuration) section.

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
| `disabledTools`    | An array of tool names, operation types, and/or categories of tools that will be disabled                             |
| `readOnly`         | When set to true, only allows read and metadata operation types, disabling create/update/delete operations            |
| `telemetry`        | When set to disabled, disables telemetry collection                                                                   |

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

#### Read-Only Mode

The `readOnly` configuration option allows you to restrict the MCP server to only use tools with "read" and "metadata" operation types. When enabled, all tools that have "create", "update" or "delete" operation types will not be registered with the server.

This is useful for scenarios where you want to provide access to MongoDB data for analysis without allowing any modifications to the data or infrastructure.

You can enable read-only mode using:

- **Environment variable**: `export MDB_MCP_READ_ONLY=true`
- **Command-line argument**: `--readOnly`

When read-only mode is active, you'll see a message in the server logs indicating which tools were prevented from registering due to this restriction.

#### Telemetry

The `telemetry` configuration option allows you to disable telemetry collection. When enabled, the MCP server will collect usage data and send it to MongoDB.

You can disable telemetry using:

- **Environment variable**: `export MDB_MCP_TELEMETRY=disabled`
- **Command-line argument**: `--telemetry disabled`
- **DO_NOT_TRACK environment variable**: `export DO_NOT_TRACK=1`

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
npx -y mongodb-mcp-server --apiClientId="your-atlas-client-id" --apiClientSecret="your-atlas-client-secret" --connectionString="mongodb+srv://username:password@cluster.mongodb.net/myDatabase" --logPath=/path/to/logs
```

## 🤝 Contributing

Interested in contributing? Great! Please check our [Contributing Guide](CONTRIBUTING.md) for guidelines on code contributions, standards, adding new tools, and troubleshooting information.
