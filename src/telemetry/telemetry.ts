import { Session } from "../session.js";
import { BaseEvent, CommonProperties } from "./types.js";
import { config } from "../config.js";
import logger, { LogId } from "../logger.js";
import { ApiClient } from "../common/atlas/apiClient.js";
import { MACHINE_METADATA } from "./constants.js";
import { EventCache } from "./eventCache.js";
import { createHmac } from "crypto";
import { machineId } from "node-machine-id";

type EventResult = {
    success: boolean;
    error?: Error;
};

export class Telemetry {
    private isBufferingEvents: boolean = true;
    private resolveDeviceId: (deviceId: string) => void = () => {};

    private constructor(
        private readonly session: Session,
        private readonly commonProperties: CommonProperties,
        private readonly eventCache: EventCache
    ) {}

    static create(
        session: Session,
        commonProperties: CommonProperties = MACHINE_METADATA,
        eventCache: EventCache = EventCache.getInstance()
    ): Telemetry {
        const instance = new Telemetry(session, commonProperties, eventCache);

        void instance.start();
        return instance;
    }

    private async start(): Promise<void> {
        this.commonProperties.device_id = await this.getDeviceId();

        this.isBufferingEvents = false;
        await this.emitEvents(this.eventCache.getEvents());
    }

    public async close(): Promise<void> {
        this.resolveDeviceId("unknown");
        this.isBufferingEvents = false;
        await this.emitEvents(this.eventCache.getEvents());
    }

    private async machineIdWithTimeout(): Promise<string> {
        try {
            return Promise.race<string>([
                machineId(true),
                new Promise<string>((resolve, reject) => {
                    this.resolveDeviceId = resolve;
                    setTimeout(() => {
                        reject(new Error("Timeout getting machine ID"));
                    }, 3000);
                }),
            ]);
        } catch (error) {
            logger.debug(LogId.telemetryMachineIdFailure, "telemetry", `Error getting machine ID: ${String(error)}`);
            return "unknown";
        }
    }

    /**
     * @returns A hashed, unique identifier for the running device or `undefined` if not known.
     */
    private async getDeviceId(): Promise<string> {
        if (this.commonProperties.device_id) {
            return this.commonProperties.device_id;
        }

        // Create a hashed format from the all uppercase version of the machine ID
        // to match it exactly with the denisbrodbeck/machineid library that Atlas CLI uses.

        const originalId = (await this.machineIdWithTimeout()).toUpperCase();

        const hmac = createHmac("sha256", originalId);

        /** This matches the message used to create the hashes in Atlas CLI */
        const DEVICE_ID_HASH_MESSAGE = "atlascli";

        hmac.update(DEVICE_ID_HASH_MESSAGE);
        return hmac.digest("hex");
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
        if (this.isBufferingEvents) {
            this.eventCache.appendEvents(events);
            return;
        }

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
