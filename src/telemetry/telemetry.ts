import { Session } from "../session.js";
import { BaseEvent } from "./types.js";
import config from "../config.js";
import logger from "../logger.js";
import { mongoLogId } from "mongodb-log-writer";
import { ApiClient } from "../common/atlas/apiClient.js";
import { MACHINE_METADATA } from "./constants.js";
import { EventCache } from "./eventCache.js";

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
     *
     * Follows the Console Do Not Track standard (https://consoledonottrack.com/)
     * by respecting the DO_NOT_TRACK environment variable
     */
    private static isTelemetryEnabled(): boolean {
        // Check if telemetry is explicitly disabled in config
        if (config.telemetry === "disabled") {
            return false;
        }

        const doNotTrack = process.env.DO_NOT_TRACK;
        if (doNotTrack) {
            const value = doNotTrack.toLowerCase();
            // Telemetry should be disabled if DO_NOT_TRACK is "1", "true", or "yes"
            if (value === "1" || value === "true" || value === "yes") {
                return false;
            }
        }

        return true;
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
     * Reads cached events from memory
     * Returns empty array if no cache exists
     */
    private async readCache(): Promise<BaseEvent[]> {
        try {
            return EventCache.getInstance().getEvents();
        } catch (error) {
            logger.warning(
                mongoLogId(1_000_000),
                "telemetry",
                `Error reading telemetry cache from memory: ${error instanceof Error ? error.message : String(error)}`
            );
            return [];
        }
    }

    /**
     * Caches events in memory for later sending
     */
    private async cacheEvents(events: BaseEvent[]): Promise<void> {
        try {
            EventCache.getInstance().setEvents(events);
            logger.debug(
                mongoLogId(1_000_000),
                "telemetry",
                `Cached ${events.length} events in memory for later sending`
            );
        } catch (error) {
            logger.warning(
                mongoLogId(1_000_000),
                "telemetry",
                `Failed to cache telemetry events in memory: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Clears the event cache after successful sending
     */
    private async clearCache(): Promise<void> {
        try {
            EventCache.getInstance().clearEvents();
            logger.debug(mongoLogId(1_000_000), "telemetry", "In-memory telemetry cache cleared");
        } catch (error) {
            logger.warning(
                mongoLogId(1_000_000),
                "telemetry",
                `Error clearing in-memory telemetry cache: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}
