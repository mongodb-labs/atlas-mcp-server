# Atlas MCP Server Tracking Plan

Generated on April 16, 2025

## MDB MCP Event

All events in the MCP server follow this base structure with common properties. Specific event types will have additional properties as detailed below.

**Base Properties**:

- **timestamp** (required): `string`
  - ISO 8601 timestamp when the event occurred
- **machine_id** (required): `string`
  - Unique anonymous identifier of the machine
- **mcp\_server\_version** (required): `string`  
  - The version of the MCP server.  
- **mcp\_server\_name** (required): `string`  
  - The name of the MCP server.  
- **mcp\_client\_version** (required): `string`  
  - The version of the MCP agent.  
- **mcp\_client\_name** (required): `string`  
  - The name of the agent calling the MCP server. (e.g. claude)  
- **platform** (required): `string`  
  - The platform on which the MCP server is running.  
- **arch** (required): `string`  
  - The architecture of the system's processor.  
- **os\_type** (optional): `string | undefined`  
  - The type of operating system.  
- **os\_version** (optional): `string | undefined`  
  - Detailed kernel or system version information.  
- **os\_linux\_dist** (optional): `string | undefined`  
  - The Linux distribution name, if applicable.
- **component** (required): `string`
  - The component generating the event (e.g., "server", "tool", "atlas", "mongodb")
- **action** (required): `string`
  - The specific action being performed

## Events per component

### Server Component

#### Server Lifecycle
**component**: `"server"`
**action**: `"lifecycle"`

**Additional Properties**:
- **state** (required): `"start" | "stop"`
  - The lifecycle state change
- **startup_time_ms** (optional): `number`
  - Time taken for the server to start. Present when state is "start".
- **connected_services** (optional): `string[] | undefined`
  - List of services connected at launch. Present when state is "start".
- **runtime_duration_ms** (optional): `number`
  - The total runtime duration. Present when state is "stop".
- **exit_code** (optional): `number`
  - The exit code. Present when state is "stop".
- **reason** (optional): `string | undefined`
  - The stop reason (e.g., "normal", "error", "timeout"). Present when state is "stop".

#### Tool Registration
**component**: `"tool"`
**action**: `"register" | "deregister"`

**Additional Properties**:
- **count** (required): `number`
  - The number of tools registered
- **tool_list** (required): `string[]`
  - List of tools registered


#### Tool Call
**component**: `"tool"`
**action**: `"call"`

**Additional Properties**:
- **name** (required): `string`
  - The name of the tool
- **target** (required): `"mongodb" | "atlas"`
  - The service being targeted by the tool
- **operation** (required): `string`
  - The type of operation being performed
  - For MongoDB: `"query" | "aggregation" | "insert" | "update" | "delete" | "index" | "metadata" | "connect"`
  - For Atlas: `"list_clusters" | "list_projects" | "create_cluster" | "manage_access_list" | "manage_database_user" | "connect"`
- **duration_ms** (required): `number`
  - Execution time in milliseconds
- **success** (required): `boolean`
  - Whether the call succeeded
- **error_code** (optional): `string | undefined`
  - Error code if operation failed
- **error_type** (optional): `string | undefined`
  - Type of error if operation failed
- **state** (optional): `"attempt" | "success" | "failure"`
  - Connection state (when operation is "connect")
- **doc_count** (optional): `number | undefined`
  - Number of affected documents (MongoDB only)
- **database** (optional): `string | undefined`
  - Target database name (MongoDB only)
- **collection** (optional): `string | undefined`
  - Target collection name (MongoDB only)
- **connection_id** (optional): `string | undefined`
  - Connection identifier (required when operation is "connect")
- **project_id** (optional): `string | undefined`
  - Atlas project ID (Atlas only)
- **org_id** (optional): `string | undefined`
  - Atlas organization ID (Atlas only)
- **cluster_name** (optional): `string | undefined`
  - Target cluster name (Atlas only)
- **is_atlas** (optional): `boolean | undefined`
  - Whether using Atlas connection string (when operation is "connect")

#### Error
**component**: `"error"`
**action**: `"occur"`

**Additional Properties**:
- **code** (required): `number`
  - The error code
- **context** (required): `string`
  - Where the error occurred (e.g., "auth", "tool", "connection")
- **type** (required): `string`
  - Error category or type

### Authentication Component

#### Authentication
**component**: `"auth"`
**action**: `"authenticate"`

**Additional Properties**:
- **target** (required): `"mongodb" | "atlas"`
  - The service being authenticated with
- **success** (required): `boolean`
  - Whether authentication succeeded
- **method** (required): `string`
  - Authentication method used
- **duration_ms** (required): `number`
  - Time taken to authenticate
- **error_code** (optional): `string | undefined`
  - Error code if failed