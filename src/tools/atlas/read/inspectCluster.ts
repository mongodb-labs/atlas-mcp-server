import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { AtlasToolBase } from "../atlasTool.js";
import { ToolArgs, OperationType } from "../../tool.js";
import { ClusterDescription20240805 } from "../../../common/atlas/openapi.js";

export class InspectClusterTool extends AtlasToolBase {
    protected name = "atlas-inspect-cluster";
    protected description = "Inspect MongoDB Atlas cluster";
    protected operationType: OperationType = "read";
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

        return this.formatOutput(cluster);
    }

    private formatOutput(cluster?: ClusterDescription20240805): CallToolResult {
        if (!cluster) {
            throw new Error("Cluster not found");
        }

        const regionConfigs = (cluster.replicationSpecs || [])
            .map(
                (replicationSpec) =>
                    (replicationSpec.regionConfigs || []) as {
                        providerName: string;
                        electableSpecs?: {
                            instanceSize: string;
                        };
                        readOnlySpecs?: {
                            instanceSize: string;
                        };
                    }[]
            )
            .flat()
            .map((regionConfig) => {
                return {
                    providerName: regionConfig.providerName,
                    instanceSize: regionConfig.electableSpecs?.instanceSize || regionConfig.readOnlySpecs?.instanceSize,
                };
            });

        const instanceSize = (regionConfigs.length <= 0 ? undefined : regionConfigs[0].instanceSize) || "UNKNOWN";

        const clusterInstanceType = instanceSize == "M0" ? "FREE" : "DEDICATED";

        return {
            content: [
                {
                    type: "text",
                    text: `Cluster Name | Cluster Type | Tier | State | MongoDB Version | Connection String
----------------|----------------|----------------|----------------|----------------|----------------
${cluster.name} | ${clusterInstanceType} | ${clusterInstanceType == "DEDICATED" ? instanceSize : "N/A"} | ${cluster.stateName} | ${cluster.mongoDBVersion || "N/A"} | ${cluster.connectionStrings?.standardSrv || cluster.connectionStrings?.standard || "N/A"}`,
                },
            ],
        };
    }
}
