import { BaseEvent } from "./types.js";

/**
 * Singleton class for in-memory telemetry event caching
 * Provides a central storage for telemetry events that couldn't be sent
 */
export class EventCache {
    private static instance: EventCache;
    private events: BaseEvent[] = [];

    private constructor() {}

    /**
     * Gets the singleton instance of EventCache
     * @returns The EventCache instance
     */
    public static getInstance(): EventCache {
        if (!EventCache.instance) {
            EventCache.instance = new EventCache();
        }
        return EventCache.instance;
    }

    /**
     * Gets a copy of the currently cached events
     * @returns Array of cached BaseEvent objects
     */
    public getEvents(): BaseEvent[] {
        return [...this.events];
    }

    /**
     * Sets the cached events, replacing any existing events
     * @param events - The events to cache
     */
    public setEvents(events: BaseEvent[]): void {
        this.events = [...events];
    }

    /**
     * Clears all cached events
     */
    public clearEvents(): void {
        this.events = [];
    }
}
