import { Session } from "../session.js";
import { BaseEvent, type ToolEvent } from "./types.js";
import pkg from "../../package.json" with { type: "json" };
import config from "../config.js";
import logger from "../logger.js";
import { mongoLogId } from "mongodb-log-writer";
import { ApiClient } from "../common/atlas/apiClient.js";
import fs from "fs/promises";
import path from "path";

const TELEMETRY_ENABLED = config.telemetry !== "disabled";
const CACHE_FILE = path.join(process.cwd(), ".telemetry-cache.json");

interface TelemetryError extends Error {
    code?: string;
}

type EventResult = {
    success: boolean;
    error?: Error;
};

type CommonProperties = {
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
};

export class Telemetry {
    private readonly commonProperties: CommonProperties;

    constructor(private readonly session: Session) {
        // Ensure all required properties are present
        this.commonProperties = Object.freeze({
            device_id: config.device_id,
            mcp_server_version: pkg.version,
            mcp_server_name: config.mcpServerName,
            mcp_client_version: this.session.agentClientVersion,
            mcp_client_name: this.session.agentClientName,
            platform: config.platform,
            arch: config.arch,
            os_type: config.os_type,
            os_version: config.os_version,
        });
    }

    /**
     * Emits a tool event with timing and error information
     * @param command - The command being executed
     * @param category - Category of the command
     * @param startTime - Start time in milliseconds
     * @param result - Whether the command succeeded or failed
     * @param error - Optional error if the command failed
     */
    public async emitToolEvent(
        command: string,
        category: string,
        startTime: number,
        result: "success" | "failure",
        error?: Error
    ): Promise<void> {
        if (!TELEMETRY_ENABLED) {
            logger.debug(mongoLogId(1_000_000), "telemetry", "Telemetry is disabled, skipping event.");
            return;
        }

        const duration = Date.now() - startTime;
        const event: ToolEvent = {
            timestamp: new Date().toISOString(),
            source: "mdbmcp",
            properties: {
                ...this.commonProperties,
                command,
                category,
                duration_ms: duration,
                session_id: this.session.sessionId,
                result,
                ...(error && {
                    error_type: error.name,
                    error_code: error.message,
                }),
            },
        };

        await this.emit([event]);
    }

    /**
     * Attempts to emit events through authenticated and unauthenticated clients
     * Falls back to caching if both attempts fail
     */
    private async emit(events: BaseEvent[]): Promise<void> {
        const cachedEvents = await this.readCache();
        const allEvents = [...cachedEvents, ...events];

        logger.debug(
            mongoLogId(1_000_000),
            "telemetry",
            `Attempting to send ${allEvents.length} events (${cachedEvents.length} cached)`
        );

        const result = await this.sendEvents(this.session.apiClient, allEvents);
        if (result.success) {
            await this.clearCache();
            return;
        }

        logger.warning(mongoLogId(1_000_000), "telemetry", `Error sending event to client: ${result.error}`);
        await this.cacheEvents(allEvents);
    }

    /**
     * Attempts to send events through the provided API client
     */
    private async sendEvents(client: ApiClient, events: BaseEvent[]): Promise<EventResult> {
        try {
            await client.sendEvents(events);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
            };
        }
    }

    /**
     * Reads cached events from disk
     * Returns empty array if no cache exists or on read error
     */
    private async readCache(): Promise<BaseEvent[]> {
        try {
            const data = await fs.readFile(CACHE_FILE, "utf-8");
            return JSON.parse(data) as BaseEvent[];
        } catch (error) {
            const typedError = error as TelemetryError;
            if (typedError.code !== "ENOENT") {
                logger.warning(
                    mongoLogId(1_000_000),
                    "telemetry",
                    `Error reading telemetry cache: ${typedError.message}`
                );
            }
            return [];
        }
    }

    /**
     * Caches events to disk for later sending
     */
    private async cacheEvents(events: BaseEvent[]): Promise<void> {
        try {
            await fs.writeFile(CACHE_FILE, JSON.stringify(events, null, 2));
            logger.debug(mongoLogId(1_000_000), "telemetry", `Cached ${events.length} events for later sending`);
        } catch (error) {
            logger.warning(
                mongoLogId(1_000_000),
                "telemetry",
                `Failed to cache telemetry events: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Clears the event cache after successful sending
     */
    private async clearCache(): Promise<void> {
        try {
            await fs.unlink(CACHE_FILE);
        } catch (error) {
            const typedError = error as TelemetryError;
            if (typedError.code !== "ENOENT") {
                logger.warning(
                    mongoLogId(1_000_000),
                    "telemetry",
                    `Error clearing telemetry cache: ${typedError.message}`
                );
            }
        }
    }
}
