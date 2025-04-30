import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { AtlasToolBase } from "../atlasTool.js";
import { ToolArgs, OperationType } from "../../tool.js";
import { randomBytes } from "crypto";
import { promisify } from "util";
import logger, { LogId } from "../../../logger.js";

const EXPIRY_MS = 1000 * 60 * 60 * 12; // 12 hours

const randomBytesAsync = promisify(randomBytes);

async function generateSecurePassword(): Promise<string> {
    const buf = await randomBytesAsync(16);
    const pass = buf.toString("base64url");
    return pass;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
        await this.session.disconnect();

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

        const baseConnectionString = cluster.connectionStrings?.standardSrv || cluster.connectionStrings?.standard;

        if (!baseConnectionString) {
            throw new Error("Connection string not available");
        }

        const username = `mcpUser${Math.floor(Math.random() * 100000)}`;
        const password = await generateSecurePassword();

        const expiryDate = new Date(Date.now() + EXPIRY_MS);

        const readOnly =
            this.config.readOnly ||
            (this.config.disabledTools?.includes("create") &&
                this.config.disabledTools?.includes("update") &&
                this.config.disabledTools?.includes("delete") &&
                !this.config.disabledTools?.includes("read") &&
                !this.config.disabledTools?.includes("metadata"));

        const roleName = readOnly ? "readAnyDatabase" : "readWriteAnyDatabase";

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
                        roleName,
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

        this.session.connectedAtlasCluster = {
            username,
            projectId,
            clusterName,
            expiryDate,
        };

        const cn = new URL(baseConnectionString);
        cn.username = username;
        cn.password = password;
        cn.searchParams.set("authSource", "admin");
        const connectionString = cn.toString();

        let lastError: Error | undefined = undefined;

        for (let i = 0; i < 20; i++) {
            try {
                await this.session.connectToMongoDB(connectionString, this.config.connectOptions);
                lastError = undefined;
                break;
            } catch (err: unknown) {
                const error = err instanceof Error ? err : new Error(String(err));

                lastError = error;

                logger.debug(
                    LogId.atlasConnectFailure,
                    "atlas-connect-cluster",
                    `error connecting to cluster: ${error.message}`
                );

                await sleep(500); // wait for 500ms before retrying
            }
        }

        if (lastError) {
            throw lastError;
        }

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
