/**
 * Result type constants for telemetry events
 */
export type TelemetryResult = "success" | "failure";
export type ServerCommand = "start" | "stop";

/**
 * Base interface for all events
 */
export interface Event {
    timestamp: string;
    source: "mdbmcp";
    properties: Record<string, unknown>;
}

export interface BaseEvent extends Event {
    properties: {
        device_id?: string;
        mcp_server_version: string;
        mcp_server_name: string;
        mcp_client_version?: string;
        mcp_client_name?: string;
        platform: string;
        arch: string;
        os_type: string;
        component: string;
        duration_ms: number;
        result: TelemetryResult;
        category: string;
        os_version?: string;
        session_id?: string;
    } & Event["properties"];
}

/**
 * Interface for tool events
 */
export interface ToolEvent extends BaseEvent {
    properties: {
        command: string;
        error_code?: string;
        error_type?: string;
        project_id?: string;
        org_id?: string;
        cluster_name?: string;
        is_atlas?: boolean;
    } & BaseEvent["properties"];
}

/**
 * Interface for server events
 */
export interface ServerEvent extends BaseEvent {
    properties: {
        command: ServerCommand;
        reason?: string;
        startup_time_ms?: number;
        runtime_duration_ms?: number;
    } & BaseEvent["properties"];
}
