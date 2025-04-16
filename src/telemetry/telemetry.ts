import { Session } from '../session.js';
import { BaseEvent, type ToolEvent } from './types.js';
import pkg from '../../package.json' with { type: 'json' };
import config from '../config.js';
import logger from '../logger.js';
import { mongoLogId } from 'mongodb-log-writer';
import { ApiClient } from '../common/atlas/apiClient.js';
import { ApiClientError } from '../common/atlas/apiClientError.js';
import fs from 'fs/promises';
import path from 'path';

const isTelemetryEnabled = config.telemetry === 'enabled';
const CACHE_FILE = path.join(process.cwd(), '.telemetry-cache.json');

export class Telemetry {
    constructor(private readonly session: Session) {}

    private readonly commonProperties = {
            mcp_server_version: pkg.version,
            mcp_server_name: config.mcpServerName,
            mcp_client_version: this.session.agentClientVersion,
            mcp_client_name: this.session.agentClientName,
            session_id: this.session.sessionId,
            device_id: config.device_id,
            platform: config.platform,
            arch: config.arch,
            os_type: config.os_type,
            os_version: config.os_version,
        };

    async emitToolEvent(command: string, category: string, startTime: number, result: 'success' | 'failure', error?: Error): Promise<void> {
        if (!isTelemetryEnabled) {
            logger.debug(mongoLogId(1_000_000), "telemetry", `Telemetry is disabled, skipping event.`);
            return;
        }

        const duration = Date.now() - startTime;

        const event: ToolEvent = {
            timestamp: new Date().toISOString(),
            source: 'mdbmcp',
            properties: {
                ...this.commonProperties,
                command: command,
                category: category,
                duration_ms: duration,
                result: result
            }
        };

        if (result === 'failure') {
            event.properties.error_type = error?.name;
            event.properties.error_code = error?.message;
        }

        await this.emit([event]);
    }

    private async emit(events: BaseEvent[]): Promise<void> {
        // First try to read any cached events
        const cachedEvents = await this.readCache();
        const allEvents = [...cachedEvents, ...events];

        logger.debug(mongoLogId(1_000_000), "telemetry", `Attempting to send ${allEvents.length} events (${cachedEvents.length} cached)`);

        try {
            if (this.session.apiClient) {
                await this.session.apiClient.sendEvents(allEvents);
                // If successful, clear the cache
                await this.clearCache();
                return;
            }
        } catch (error) {
            logger.warning(mongoLogId(1_000_000), "telemetry", `Error sending event to authenticated client: ${error}`);
            // Cache the events that failed to send
            await this.cacheEvents(allEvents);
        }

        // Try unauthenticated client as fallback
        try {
            const tempApiClient = new ApiClient({
                baseUrl: config.apiBaseUrl,
            });
            await tempApiClient.sendEvents(allEvents);
            // If successful, clear the cache
            await this.clearCache();
        } catch (error) {
            logger.warning(mongoLogId(1_000_000), "telemetry", `Error sending event to unauthenticated client: ${error}`);
            // Cache the events that failed to send
            await this.cacheEvents(allEvents);
        }
    }

    private async readCache(): Promise<BaseEvent[]> {
        try {
            const data = await fs.readFile(CACHE_FILE, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                logger.warning(mongoLogId(1_000_000), "telemetry", `Error reading telemetry cache: ${error}`);
            }
            return [];
        }
    }

    private async cacheEvents(events: BaseEvent[]): Promise<void> {
        try {
            await fs.writeFile(CACHE_FILE, JSON.stringify(events, null, 2));
            logger.debug(mongoLogId(1_000_000), "telemetry", `Cached ${events.length} events for later sending`);
        } catch (error) {
            logger.warning(mongoLogId(1_000_000), "telemetry", `Failed to cache telemetry events: ${error}`);
        }
    }

    private async clearCache(): Promise<void> {
        try {
            await fs.unlink(CACHE_FILE);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                logger.warning(mongoLogId(1_000_000), "telemetry", `Error clearing telemetry cache: ${error}`);
            }
        }
    }
}
