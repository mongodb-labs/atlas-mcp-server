import { NodeDriverServiceProvider } from "@mongosh/service-provider-node-driver";
import { ApiClient, ApiClientCredentials } from "./common/atlas/apiClient.js";
import { Implementation } from "@modelcontextprotocol/sdk/types.js";
import config from "./config.js";

export class Session {
    sessionId?: string;
    serviceProvider?: NodeDriverServiceProvider;
    apiClient: ApiClient;
    agentRunner?: {
        name: string;
        version: string;
    };

    constructor() {
        const credentials: ApiClientCredentials | undefined =
            config.apiClientId && config.apiClientSecret
                ? {
                      clientId: config.apiClientId,
                      clientSecret: config.apiClientSecret,
                  }
                : undefined;

        this.apiClient = new ApiClient({
            baseUrl: config.apiBaseUrl,
            credentials,
        });
    }

    setAgentRunner(agentRunner: Implementation | undefined) {
        if (agentRunner?.name && agentRunner?.version) {
            this.agentRunner = {
                name: agentRunner.name,
                version: agentRunner.version,
            };
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
