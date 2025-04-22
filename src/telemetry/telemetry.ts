import { Session } from "../session.js";
import { BaseEvent, type ToolEvent } from "./types.js";
import config from "../config.js";
import logger from "../logger.js";
import { mongoLogId } from "mongodb-log-writer";
import { ApiClient } from "../common/atlas/apiClient.js";
import fs from "fs/promises";
import path from "path";
import { MACHINE_METADATA } from "./constants.js";

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
        // Create an immutable object with all telemetry properties
        this.commonProperties = Object.freeze({
            ...MACHINE_METADATA,
            mcp_client_version: this.session.agentRunner?.version,
            mcp_client_name: this.session.agentRunner?.name,
        });
    }

    /**
     * Checks if telemetry is currently enabled
     * This is a method rather than a constant to capture runtime config changes
     */
    private static isTelemetryEnabled(): boolean {
        return config.telemetry !== "disabled";
    }

    /**
     * Emits events through the telemetry pipeline
     * @param events - The events to emit
     */
    public async emitEvents(events: BaseEvent[]): Promise<void> {
        if (!Telemetry.isTelemetryEnabled()) {
            logger.debug(mongoLogId(1_000_000), "telemetry", "Telemetry is disabled, skipping events.");
            return;
        }

        await this.emit(events);
    }

    /**
     * Gets the common properties for events
     * @returns Object containing common properties for all events
     */
    public getCommonProperties(): CommonProperties {
        return {
            ...this.commonProperties,
            session_id: this.session.sessionId,
        };
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
            logger.debug(mongoLogId(1_000_000), "telemetry", `Sent ${allEvents.length} events successfully`);
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
