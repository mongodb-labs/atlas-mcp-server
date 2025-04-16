import { NodeDriverServiceProvider } from "@mongosh/service-provider-node-driver";
import { ApiClient } from "./common/atlas/apiClient.js";
import config from "./config.js";
import logger from "./logger.js";
import { mongoLogId } from "mongodb-log-writer";

export class Session {
    sessionId?: string;
    serviceProvider?: NodeDriverServiceProvider;
    apiClient?: ApiClient;
    clientName?: string;
    clientVersion?: string;  

    ensureAuthenticated(): asserts this is { apiClient: ApiClient } {
        if (!this.apiClient) {
            if (!config.apiClientId || !config.apiClientSecret) {
                throw new Error(
                    "Not authenticated make sure to configure MCP server with MDB_MCP_API_CLIENT_ID and MDB_MCP_API_CLIENT_SECRET environment variables."
                );
            }

            this.apiClient = new ApiClient({
                baseUrl: config.apiBaseUrl,
                credentials: {
                    clientId: config.apiClientId,
                    clientSecret: config.apiClientSecret,
                },
            });
        }
    }

    async close(): Promise<void> {
        if (this.serviceProvider) {
            try {
                await this.serviceProvider.close(true);
            } catch (error) {
                console.error("Error closing service provider:", error);
            }
            this.serviceProvider = undefined;
        }
    }

    async emitTelemetry(todo: unknown): Promise<void> {
        logger.info(
            mongoLogId(1_000_001),
            "telemetry",
            `Telemetry event: ${JSON.stringify(todo)}`
        );
    }
}
