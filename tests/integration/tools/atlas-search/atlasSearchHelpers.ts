import { ObjectId } from "bson";
import { defaultTestConfig, IntegrationTest, setupIntegrationTest } from "../../helpers.js";
import { waitClusterState, withProject } from "../atlas/atlasHelpers.js";

export function describeWithAtlasSearch(
    name: string,
    fn: (integration: IntegrationTest & { connectMcpClient: () => Promise<void> }) => void
): void {
    const describeFn =
        process.env.MDB_MCP_API_CLIENT_ID?.length && process.env.MDB_MCP_API_CLIENT_SECRET?.length
            ? describe
            : describe.skip;

    describeFn("atlas-search", () => {
        const integration = setupIntegrationTest(() => ({
            ...defaultTestConfig,
            apiClientId: process.env.MDB_MCP_API_CLIENT_ID,
            apiClientSecret: process.env.MDB_MCP_API_CLIENT_SECRET,
        }));

        describe(name, () => {
            withProject(integration, ({ getProjectId }) => {
                const clusterName = `ClusterTest-${new ObjectId()}`;
                beforeAll(async () => {
                    const projectId = getProjectId();

                    await integration.mcpClient().callTool({
                        name: "atlas-create-free-cluster",
                        arguments: {
                            projectId,
                            name: clusterName,
                            region: "US_EAST_1",
                        },
                    });

                    await waitClusterState(integration.mcpServer().session, projectId, clusterName, "IDLE");
                    await integration.mcpServer().session.apiClient.createProjectIpAccessList({
                        params: {
                            path: {
                                groupId: projectId,
                            },
                        },
                        body: [
                            {
                                comment: "MCP test",
                                cidrBlock: "0.0.0.0/0",
                            },
                        ],
                    });
                });

                fn({
                    ...integration,
                    connectMcpClient: async () => {
                        await integration.mcpClient().callTool({
                            name: "atlas-connect-cluster",
                            arguments: { projectId: getProjectId(), clusterName },
                        });

                        expect(integration.mcpServer().session.connectedAtlasCluster).toBeDefined();
                        expect(integration.mcpServer().session.serviceProvider).toBeDefined();
                    },
                });
            });
        });
    });
}
