import { NodeDriverServiceProvider } from "@mongosh/service-provider-node-driver";
import { ApiClient, ApiClientCredentials } from "./common/atlas/apiClient.js";
import { Implementation } from "@modelcontextprotocol/sdk/types.js";
import EventEmitter from "events";
import { ConnectOptions } from "./config.js";

export interface SessionOptions {
    apiBaseUrl: string;
    apiClientId?: string;
    apiClientSecret?: string;
}

export class Session extends EventEmitter<{
    close: [];
}> {
    sessionId?: string;
    serviceProvider?: NodeDriverServiceProvider;
    apiClient: ApiClient;
    agentRunner?: {
        name: string;
        version: string;
    };

    constructor({ apiBaseUrl, apiClientId, apiClientSecret }: SessionOptions) {
        super();

        const credentials: ApiClientCredentials | undefined =
            apiClientId && apiClientSecret
                ? {
                      clientId: apiClientId,
                      clientSecret: apiClientSecret,
                  }
                : undefined;

        this.apiClient = new ApiClient({
            baseUrl: apiBaseUrl,
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

            this.emit("close");
        }
    }

    async connectToMongoDB(connectionString: string, connectOptions: ConnectOptions): Promise<void> {
        const provider = await NodeDriverServiceProvider.connect(connectionString, {
            productDocsLink: "https://docs.mongodb.com/todo-mcp",
            productName: "MongoDB MCP",
            readConcern: {
                level: connectOptions.readConcern,
            },
            readPreference: connectOptions.readPreference,
            writeConcern: {
                w: connectOptions.writeConcern,
            },
            timeoutMS: connectOptions.timeoutMS,
        });

        this.serviceProvider = provider;
    }
}
