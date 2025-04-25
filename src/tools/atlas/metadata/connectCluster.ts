import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { AtlasToolBase } from "../atlasTool.js";
import { ToolArgs, OperationType } from "../../tool.js";
import { sleep } from "../../../common/utils.js";

function generateSecurePassword(): string {
    // TODO: use a better password generator
    return `pwdMcp${Math.floor(Math.random() * 100000)}`;
}

export class ConnectClusterTool extends AtlasToolBase {
    protected name = "atlas-connect-cluster";
    protected description = "Connect to MongoDB Atlas cluster";
    protected operationType: OperationType = "metadata";
    protected argsShape = {
        projectId: z.string().describe("Atlas project ID"),
        clusterName: z.string().describe("Atlas cluster name"),
    };

    protected async execute({ projectId, clusterName }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        const cluster = await this.session.apiClient.getCluster({
            params: {
                path: {
                    groupId: projectId,
                    clusterName,
                },
            },
        });

        if (!cluster) {
            throw new Error("Cluster not found");
        }

        if (!cluster.connectionStrings?.standardSrv || !cluster.connectionStrings?.standard) {
            throw new Error("Connection string not available");
        }

        const username = `usrMcp${Math.floor(Math.random() * 100000)}`;
        const password = generateSecurePassword();

        const expiryMs = 1000 * 60 * 60 * 12; // 12 hours
        const expiryDate = new Date(Date.now() + expiryMs);

        await this.session.apiClient.createDatabaseUser({
            params: {
                path: {
                    groupId: projectId,
                },
            },
            body: {
                databaseName: "admin",
                groupId: projectId,
                roles: [
                    {
                        roleName: "readWriteAnyDatabase",
                        databaseName: "admin",
                    },
                ],
                scopes: [{ type: "CLUSTER", name: clusterName }],
                username,
                password,
                awsIAMType: "NONE",
                ldapAuthType: "NONE",
                oidcAuthType: "NONE",
                x509Type: "NONE",
                deleteAfterDate: expiryDate.toISOString(),
            },
        });

        void sleep(expiryMs).then(async () => {
            // disconnect after 12 hours
            if (this.session.serviceProvider) {
                await this.session.serviceProvider.close(true);
                this.session.serviceProvider = undefined;
            }
        });

        const connectionString =
            (cluster.connectionStrings.standardSrv || cluster.connectionStrings.standard || "").replace(
                "://",
                `://${username}:${password}@`
            ) + `?authSource=admin`;

        await this.connectToMongoDB(connectionString);

        return {
            content: [
                {
                    type: "text",
                    text: `Connected to cluster "${clusterName}"`,
                },
            ],
        };
    }
}
