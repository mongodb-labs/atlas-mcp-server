import { NodeDriverServiceProvider } from "@mongosh/service-provider-node-driver";
import { ApiClient, ApiClientCredentials } from "./common/atlas/apiClient.js";
import { Implementation } from "@modelcontextprotocol/sdk/types.js";
import logger, { LogId } from "./logger.js";
import EventEmitter from "events";
import { ConnectOptions } from "./config.js";

export interface SessionOptions {
    apiBaseUrl: string;
    apiClientId?: string;
    apiClientSecret?: string;
}

export class Session extends EventEmitter<{
    close: [];
    disconnect: [];
}> {
    sessionId?: string;
    serviceProvider?: NodeDriverServiceProvider;
    apiClient: ApiClient;
    agentRunner?: {
        name: string;
        version: string;
    };
    connectedAtlasCluster?: {
        username: string;
        projectId: string;
        clusterName: string;
        expiryDate: Date;
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

    async disconnect(): Promise<void> {
        if (this.serviceProvider) {
            try {
                await this.serviceProvider.close(true);
            } catch (err: unknown) {
                const error = err instanceof Error ? err : new Error(String(err));
                logger.error(LogId.mongodbDisconnectFailure, "Error closing service provider:", error.message);
            }
            this.serviceProvider = undefined;
        }
        if (!this.connectedAtlasCluster) {
            this.emit("disconnect");
            return;
        }
        void this.apiClient
            .deleteDatabaseUser({
                params: {
                    path: {
                        groupId: this.connectedAtlasCluster.projectId,
                        username: this.connectedAtlasCluster.username,
                        databaseName: "admin",
                    },
                },
            })
            .catch((err: unknown) => {
                const error = err instanceof Error ? err : new Error(String(err));
                logger.error(
                    LogId.atlasDeleteDatabaseUserFailure,
                    "atlas-connect-cluster",
                    `Error deleting previous database user: ${error.message}`
                );
            });
        this.connectedAtlasCluster = undefined;

        this.emit("disconnect");
    }

    async close(): Promise<void> {
        await this.disconnect();
        this.emit("close");
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
