import { Session } from '../session.js';
import { BaseEvent, type ToolEvent } from './types.js';
import pkg from '../../package.json' with { type: 'json' };
import config from '../config.js';
import logger from '../logger.js';
import { mongoLogId } from 'mongodb-log-writer';
import { ApiClient } from '../common/atlas/apiClient.js';
import { ApiClientError } from '../common/atlas/apiClientError.js';

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

    private readonly isTelemetryEnabled = config.telemetry === 'enabled';

    async emitToolEvent(command: string, category: string, startTime: number, result: 'success' | 'failure', error?: Error): Promise<void> {
        if (!this.isTelemetryEnabled) {
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

        await this.emit(event);
    }

    private async emit(event: BaseEvent): Promise<void> {
        try {
            if (this.session.apiClient) {
                await this.session.apiClient.sendEvents([event]);
            }
        } catch (error) {
            logger.warning(mongoLogId(1_000_000), "telemetry", `Error sending event to authenticated client: ${error}`);
        }

        // if it is unauthenticated, send to temp client
        try {
            const tempApiClient = new ApiClient({
                baseUrl: config.apiBaseUrl,
            });
            await tempApiClient.sendEvents([event]);
        } catch (error) {
            logger.warning(mongoLogId(1_000_000), "telemetry", `Error sending event to unauthenticated client: ${error}`);
        }
    }
}
