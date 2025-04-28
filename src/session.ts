import { NodeDriverServiceProvider } from "@mongosh/service-provider-node-driver";
import { ApiClient, ApiClientCredentials } from "./common/atlas/apiClient.js";
import { Implementation } from "@modelcontextprotocol/sdk/types.js";
import logger from "./logger.js";
import { mongoLogId } from "mongodb-log-writer";
import { ErrorCodes } from "./errors.js";

export interface SessionOptions {
    apiBaseUrl?: string;
    apiClientId?: string;
    apiClientSecret?: string;
}

export class Session {
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

    constructor({ apiBaseUrl, apiClientId, apiClientSecret }: SessionOptions = {}) {
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

    async disconnect() {
        if (this.serviceProvider) {
            try {
                await this.serviceProvider.close(true);
            } catch (err: unknown) {
                const error = err instanceof Error ? err : new Error(String(err));
                logger.error(
                    mongoLogId(ErrorCodes.CloseServiceProvider),
                    "Error closing service provider:",
                    error.message
                );
            }
            this.serviceProvider = undefined;
        }
        if (!this.connectedAtlasCluster) {
            return;
        }
        try {
            await this.apiClient.deleteDatabaseUser({
                params: {
                    path: {
                        groupId: this.connectedAtlasCluster.projectId,
                        username: this.connectedAtlasCluster.username,
                        databaseName: "admin",
                    },
                },
            });
        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));

            logger.error(
                mongoLogId(ErrorCodes.DeleteDatabaseUser),
                "atlas-connect-cluster",
                `Error deleting previous database user: ${error.message}`
            );
        }
        this.connectedAtlasCluster = undefined;
    }

    async close(): Promise<void> {
        await this.disconnect();
    }
}
