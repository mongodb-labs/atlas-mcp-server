import { Session } from "../session.js";
import { BaseEvent, CommonProperties } from "./types.js";
import { config } from "../config.js";
import logger, { LogId } from "../logger.js";
import { ApiClient } from "../common/atlas/apiClient.js";
import { MACHINE_METADATA } from "./constants.js";
import { EventCache } from "./eventCache.js";

type EventResult = {
    success: boolean;
    error?: Error;
};

export class Telemetry {
    private readonly commonProperties: CommonProperties;

    constructor(
        private readonly session: Session,
        private readonly eventCache: EventCache = EventCache.getInstance()
    ) {
        this.commonProperties = {
            ...MACHINE_METADATA,
        };
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
        try {
            if (!Telemetry.isTelemetryEnabled()) {
                return;
            }

            await this.emit(events);
        } catch {
            logger.debug(LogId.telemetryEmitFailure, "telemetry", `Error emitting telemetry events.`);
        }
    }

    /**
     * Gets the common properties for events
     * @returns Object containing common properties for all events
     */
    public getCommonProperties(): CommonProperties {
        return {
            ...this.commonProperties,
            mcp_client_version: this.session.agentRunner?.version,
            mcp_client_name: this.session.agentRunner?.name,
            session_id: this.session.sessionId,
            config_atlas_auth: this.session.apiClient.hasCredentials() ? "true" : "false",
            config_connection_string: config.connectionString ? "true" : "false",
        };
    }

    /**
     * Attempts to emit events through authenticated and unauthenticated clients
     * Falls back to caching if both attempts fail
     */
    private async emit(events: BaseEvent[]): Promise<void> {
        const cachedEvents = this.eventCache.getEvents();
        const allEvents = [...cachedEvents, ...events];

        logger.debug(
            LogId.telemetryEmitStart,
            "telemetry",
            `Attempting to send ${allEvents.length} events (${cachedEvents.length} cached)`
        );

        const result = await this.sendEvents(this.session.apiClient, allEvents);
        if (result.success) {
            this.eventCache.clearEvents();
            logger.debug(LogId.telemetryEmitSuccess, "telemetry", `Sent ${allEvents.length} events successfully`);
            return;
        }

        logger.debug(
            LogId.telemetryEmitFailure,
            "telemetry",
            `Error sending event to client: ${result.error instanceof Error ? result.error.message : String(result.error)}`
        );
        this.eventCache.appendEvents(events);
    }

    /**
     * Attempts to send events through the provided API client
     */
    private async sendEvents(client: ApiClient, events: BaseEvent[]): Promise<EventResult> {
        try {
            await client.sendEvents(
                events.map((event) => ({
                    ...event,
                    properties: { ...this.getCommonProperties(), ...event.properties },
                }))
            );
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
            };
        }
    }
}
