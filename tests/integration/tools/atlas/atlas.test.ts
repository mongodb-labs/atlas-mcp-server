import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { setupIntegrationTest, describeAtlas } from "../../helpers.js";
import { Session } from "../../../../src/session.js";

describeAtlas("tools", () => {
    const integration = setupIntegrationTest();
    let projectId = "";

    describe("atlas-list-projects", () => {
        it("should have correct metadata", async () => {
            const { tools } = await integration.mcpClient().listTools();
            const listProjects = tools.find((tool) => tool.name === "atlas-list-projects")!;
            expect(listProjects).toBeDefined();
            expect(listProjects.inputSchema.type).toBe("object");
            expect(listProjects.inputSchema.properties).toBeDefined();

            const propertyNames = Object.keys(listProjects.inputSchema.properties!);
            expect(propertyNames).toHaveLength(0);
        });

        it("returns project names", async () => {
            const response = (await integration.mcpClient().callTool({ name: "atlas-list-projects", arguments: {} })) as CallToolResult;
            expect(response.content).toBeArray();
            expect(response.content).toHaveLength(1);
            expect(response.content[0].text).toContain("MCP Test");
            const data = (response.content[0].text as string).split("\n").map((line) => line.split(" | "));
            expect(data).toHaveLength(3);
            expect(data[2]).toHaveLength(3);
            projectId = data[2][1];
        });
    });

    describe("with cluster", () => {
        afterAll(async () => {
            const session: Session = integration.mcpServer().session;
            session.ensureAuthenticated();
            await session.apiClient.deleteCluster({
                params: {
                    path: {
                        groupId: projectId,
                        clusterName: "ClusterTest",
                    }
                },
            })
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
                const response = (await integration.mcpClient().callTool({
                    name: "atlas-create-free-cluster", arguments: {
                        projectId,
                        name: "ClusterTest",
                        region: "US_EAST_1",
                    }
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
                const response = (await integration.mcpClient().callTool({ name: "atlas-inspect-cluster", arguments: { projectId, clusterName: "ClusterTest" } })) as CallToolResult;
                expect(response.content).toBeArray();
                expect(response.content).toHaveLength(1);
                expect(response.content[0].text).toContain("ClusterTest | ");
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
                const response = (await integration.mcpClient().callTool({ name: "atlas-list-clusters", arguments: { projectId } })) as CallToolResult;
                expect(response.content).toBeArray();
                expect(response.content).toHaveLength(2);
                expect(response.content[1].text).toContain("ClusterTest | ");
            });

            it("returns clusters for all projects", async () => {
                const response = (await integration.mcpClient().callTool({ name: "atlas-list-clusters", arguments: { } })) as CallToolResult;
                expect(response.content).toBeArray();
                expect(response.content).toHaveLength(1);
                expect(response.content[0].text).toContain("| ClusterTest");
            });
        });
    });
});
