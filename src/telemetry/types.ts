/**
 * Base interface for all events
 */
export interface Event {
    timestamp: string;
    source: 'mdbmcp';
    properties: Record<string, unknown>;
}

export interface BaseEvent extends Event {
    properties: {
        device_id: string;
        mcp_server_version: string;
        mcp_server_name: string;
        mcp_client_version?: string;
        mcp_client_name?: string;
        platform: string;
        arch: string;
        os_type: string;
        os_version?: string;
        session_id?: string;
    } & Event['properties'];
}

/**
 * Interface for tool events
 */
export interface ToolEvent extends BaseEvent {
    properties: {
        command: string;
        category: string;
        duration_ms: number;
        result: 'success' | 'failure';
        error_code?: string;
        error_type?: string;
        project_id?: string;
        org_id?: string;
        cluster_name?: string;
        is_atlas?: boolean;
    } & BaseEvent['properties'];
}
