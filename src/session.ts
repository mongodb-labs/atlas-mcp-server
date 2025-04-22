import { NodeDriverServiceProvider } from "@mongosh/service-provider-node-driver";
import { ApiClient } from "./common/atlas/apiClient.js";
import config from "./config.js";
import { Implementation } from "@modelcontextprotocol/sdk/types.js";

export class Session {
    sessionId?: string;
    serviceProvider?: NodeDriverServiceProvider;
    apiClient: ApiClient;
    agentClientName?: string;
    agentClientVersion?: string;
    private credentials?: { clientId: string; clientSecret: string };
    private baseUrl: string;

    constructor() {
        this.baseUrl = config.apiBaseUrl ?? "https://cloud.mongodb.com/";
        
        // Store credentials if available
        if (config.apiClientId && config.apiClientSecret) {
            this.credentials = {
                clientId: config.apiClientId,
                clientSecret: config.apiClientSecret,
            };
            
            // Initialize API client with credentials
            this.apiClient = new ApiClient({
                baseUrl: this.baseUrl,
                credentials: this.credentials,
            });
            return;
        }

        // Initialize API client without credentials
        this.apiClient = new ApiClient({ baseUrl: this.baseUrl });
    }

    setAgentClientData(agentClient: Implementation | undefined) {
        this.agentClientName = agentClient?.name;
        this.agentClientVersion = agentClient?.version;
    }

    ensureAuthenticated(): asserts this is { apiClient: ApiClient } {
        if (!this.apiClient.hasCredentials()) {
            if (!this.credentials) {
                throw new Error(
                    "Not authenticated make sure to configure MCP server with MDB_MCP_API_CLIENT_ID and MDB_MCP_API_CLIENT_SECRET environment variables."
                );
            }

            // Reinitialize API client with the stored credentials
            // This can happen if the server was configured without credentials but the env variables are later set
            this.apiClient = new ApiClient({
                baseUrl: this.baseUrl,
                credentials: this.credentials,
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
