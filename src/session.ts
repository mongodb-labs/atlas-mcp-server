import { NodeDriverServiceProvider } from "@mongosh/service-provider-node-driver";
import { ApiClient } from "./common/atlas/apiClient.js";
import config from "./config.js";
import logger from "./logger.js";
import { mongoLogId } from "mongodb-log-writer";
import { Implementation } from "@modelcontextprotocol/sdk/types.js";

export class Session {
    sessionId?: string;
    serviceProvider?: NodeDriverServiceProvider;
    apiClient?: ApiClient;
    agentClientName?: string;
    agentClientVersion?: string; 

    constructor() {
        // configure api client if credentials are set
        if (config.apiClientId && config.apiClientSecret) {
            this.apiClient = new ApiClient({
                baseUrl: config.apiBaseUrl,
                credentials: {
                    clientId: config.apiClientId,
                    clientSecret: config.apiClientSecret,
                },
            });
        }
    }
    
    setAgentClientData(agentClient: Implementation | undefined) {
        this.agentClientName = agentClient?.name;
        this.agentClientVersion = agentClient?.version;
    }

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
}
