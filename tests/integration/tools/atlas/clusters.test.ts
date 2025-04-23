import { Session } from "../../../../src/session.js";
import { describeAtlas, withProject, sleep, randomId } from "./atlasHelpers.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

async function deleteAndWaitCluster(session: Session, projectId: string, clusterName: string) {
    await session.apiClient.deleteCluster({
        params: {
            path: {
                groupId: projectId,
                clusterName: clusterName,
            },
        },
    });
    while (true) {
        try {
            await session.apiClient.getCluster({
                params: {
                    path: {
                        groupId: projectId,
                        clusterName: clusterName,
                    },
                },
            });
            await sleep(1000);
        } catch {
            break;
        }
    }
}

describeAtlas("clusters", (integration) => {
    withProject(integration, ({ getProjectId }) => {
        const clusterName = "ClusterTest-" + randomId;

        afterAll(async () => {
            const projectId = getProjectId();

            const session: Session = integration.mcpServer().session;

            await deleteAndWaitCluster(session, projectId, clusterName);
        });

        describe("atlas-create-free-cluster", () => {
            it("should have correct metadata", async () => {
                const { tools } = await integration.mcpClient().listTools();
                const createFreeCluster = tools.find((tool) => tool.name === "atlas-create-free-cluster")!;

                expect(createFreeCluster).toBeDefined();
                expect(createFreeCluster.inputSchema.type).toBe("object");
                expect(createFreeCluster.inputSchema.properties).toBeDefined();
                expect(createFreeCluster.inputSchema.properties).toHaveProperty("projectId");
                expect(createFreeCluster.inputSchema.properties).toHaveProperty("name");
                expect(createFreeCluster.inputSchema.properties).toHaveProperty("region");
            });

            it("should create a free cluster", async () => {
                const projectId = getProjectId();

                const response = (await integration.mcpClient().callTool({
                    name: "atlas-create-free-cluster",
                    arguments: {
                        projectId,
                        name: clusterName,
                        region: "US_EAST_1",
                    },
                })) as CallToolResult;
                expect(response.content).toBeArray();
                expect(response.content).toHaveLength(1);
                expect(response.content[0].text).toContain("has been created");
            });
        });

        describe("atlas-inspect-cluster", () => {
            it("should have correct metadata", async () => {
                const { tools } = await integration.mcpClient().listTools();
                const inspectCluster = tools.find((tool) => tool.name === "atlas-inspect-cluster")!;

                expect(inspectCluster).toBeDefined();
                expect(inspectCluster.inputSchema.type).toBe("object");
                expect(inspectCluster.inputSchema.properties).toBeDefined();
                expect(inspectCluster.inputSchema.properties).toHaveProperty("projectId");
                expect(inspectCluster.inputSchema.properties).toHaveProperty("clusterName");
            });

            it("returns cluster data", async () => {
                const projectId = getProjectId();

                const response = (await integration.mcpClient().callTool({
                    name: "atlas-inspect-cluster",
                    arguments: { projectId, clusterName: clusterName },
                })) as CallToolResult;
                expect(response.content).toBeArray();
                expect(response.content).toHaveLength(1);
                expect(response.content[0].text).toContain(`${clusterName} | `);
            });
        });

        describe("atlas-list-clusters", () => {
            it("should have correct metadata", async () => {
                const { tools } = await integration.mcpClient().listTools();
                const listClusters = tools.find((tool) => tool.name === "atlas-list-clusters")!;
                expect(listClusters).toBeDefined();
                expect(listClusters.inputSchema.type).toBe("object");
                expect(listClusters.inputSchema.properties).toBeDefined();
                expect(listClusters.inputSchema.properties).toHaveProperty("projectId");
            });

            it("returns clusters by project", async () => {
                const projectId = getProjectId();

                const response = (await integration
                    .mcpClient()
                    .callTool({ name: "atlas-list-clusters", arguments: { projectId } })) as CallToolResult;
                expect(response.content).toBeArray();
                expect(response.content).toHaveLength(2);
                expect(response.content[1].text).toContain(`${clusterName} | `);
            });
        });
    });
});
