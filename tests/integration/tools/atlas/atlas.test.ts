import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { setupIntegrationTest, describeAtlas } from "../../helpers.js";
import { Session } from "../../../../src/session.js";
import { ObjectId } from "mongodb";

const randomId = new ObjectId().toString();

describeAtlas("tools", () => {
    const integration = setupIntegrationTest();
    let projectId = "";

    describe("projects", () => {
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
                const response = (await integration
                    .mcpClient()
                    .callTool({ name: "atlas-list-projects", arguments: {} })) as CallToolResult;
                expect(response.content).toBeArray();
                expect(response.content).toHaveLength(1);
                expect(response.content[0].text).toContain("MCP Test");
                const data = (response.content[0].text as string).split("\n").map((line) => line.split(" | "));
                expect(data).toHaveLength(3);
                expect(data[2]).toHaveLength(3);
                projectId = data[2][1];
            });
        });
    });

    describe("db users", () => {
        afterAll(async () => {
            const session: Session = integration.mcpServer().session;
            session.ensureAuthenticated();
            await session.apiClient.deleteDatabaseUser({
                params: {
                    path: {
                        groupId: projectId,
                        username: "testuser-" + randomId,
                        databaseName: "admin",
                    },
                },
            });
        });

        describe("atlas-create-db-user", () => {
            it("should have correct metadata", async () => {
                const { tools } = await integration.mcpClient().listTools();
                const createDbUser = tools.find((tool) => tool.name === "atlas-create-db-user")!;
                expect(createDbUser).toBeDefined();
                expect(createDbUser.inputSchema.type).toBe("object");
                expect(createDbUser.inputSchema.properties).toBeDefined();
                expect(createDbUser.inputSchema.properties).toHaveProperty("projectId");
                expect(createDbUser.inputSchema.properties).toHaveProperty("username");
                expect(createDbUser.inputSchema.properties).toHaveProperty("password");
                expect(createDbUser.inputSchema.properties).toHaveProperty("roles");
                expect(createDbUser.inputSchema.properties).toHaveProperty("clusters");
            });
            it("should create a database user", async () => {
                const response = (await integration.mcpClient().callTool({
                    name: "atlas-create-db-user",
                    arguments: {
                        projectId,
                        username: "testuser-" + randomId,
                        password: "testpassword",
                        roles: [
                            {
                                roleName: "readWrite",
                                databaseName: "admin",
                            },
                        ],
                    },
                })) as CallToolResult;
                expect(response.content).toBeArray();
                expect(response.content).toHaveLength(1);
                expect(response.content[0].text).toContain("created sucessfully");
            });
        });
        describe("atlas-list-db-users", () => {
            it("should have correct metadata", async () => {
                const { tools } = await integration.mcpClient().listTools();
                const listDbUsers = tools.find((tool) => tool.name === "atlas-list-db-users")!;
                expect(listDbUsers).toBeDefined();
                expect(listDbUsers.inputSchema.type).toBe("object");
                expect(listDbUsers.inputSchema.properties).toBeDefined();
                expect(listDbUsers.inputSchema.properties).toHaveProperty("projectId");
            });
            it("returns database users by project", async () => {
                const response = (await integration
                    .mcpClient()
                    .callTool({ name: "atlas-list-db-users", arguments: { projectId } })) as CallToolResult;
                expect(response.content).toBeArray();
                expect(response.content).toHaveLength(1);
                expect(response.content[0].text).toContain("testuser-" + randomId);
            });
        });
    });

    describe("ip access lists", () => {
        afterAll(async () => {
            const session: Session = integration.mcpServer().session;
            session.ensureAuthenticated();

            const ipInfo = await session.apiClient.getIpInfo();

            await session.apiClient.deleteProjectIpAccessList({
                params: {
                    path: {
                        groupId: projectId,
                        entryValue: ipInfo.currentIpv4Address,
                    },
                },
            });

            await session.apiClient.deleteProjectIpAccessList({
                params: {
                    path: {
                        groupId: projectId,
                        entryValue: "8.8.8.8",
                    },
                },
            });

            await session.apiClient.deleteProjectIpAccessList({
                params: {
                    path: {
                        groupId: projectId,
                        entryValue: "9.9.9.9/24",
                    },
                },
            });
        });

        describe("atlas-create-access-list", () => {
            it("should have correct metadata", async () => {
                const { tools } = await integration.mcpClient().listTools();
                const createAccessList = tools.find((tool) => tool.name === "atlas-create-access-list")!;
                expect(createAccessList).toBeDefined();
                expect(createAccessList.inputSchema.type).toBe("object");
                expect(createAccessList.inputSchema.properties).toBeDefined();
                expect(createAccessList.inputSchema.properties).toHaveProperty("projectId");
                expect(createAccessList.inputSchema.properties).toHaveProperty("ipAddresses");
                expect(createAccessList.inputSchema.properties).toHaveProperty("cidrBlocks");
                expect(createAccessList.inputSchema.properties).toHaveProperty("currentIpAddress");
                expect(createAccessList.inputSchema.properties).toHaveProperty("comment");
            });

            it("should create an access list", async () => {
                const response = (await integration.mcpClient().callTool({
                    name: "atlas-create-access-list",
                    arguments: {
                        projectId,
                        ipAddresses: ["8.8.8.8"],
                        cidrBlocks: ["9.9.9.9/24"],
                        currentIpAddress: true,
                    },
                })) as CallToolResult;
                expect(response.content).toBeArray();
                expect(response.content).toHaveLength(1);
                expect(response.content[0].text).toContain("IP/CIDR ranges added to access list");
            });
        });

        describe("atlas-inspect-access-list", () => {
            it("should have correct metadata", async () => {
                const { tools } = await integration.mcpClient().listTools();
                const inspectAccessList = tools.find((tool) => tool.name === "atlas-inspect-access-list")!;
                expect(inspectAccessList).toBeDefined();
                expect(inspectAccessList.inputSchema.type).toBe("object");
                expect(inspectAccessList.inputSchema.properties).toBeDefined();
                expect(inspectAccessList.inputSchema.properties).toHaveProperty("projectId");
            });

            it("returns access list data", async () => {
                const session: Session = integration.mcpServer().session;
                session.ensureAuthenticated();
                const ipInfo = await session.apiClient.getIpInfo();

                const response = (await integration
                    .mcpClient()
                    .callTool({ name: "atlas-inspect-access-list", arguments: { projectId } })) as CallToolResult;
                expect(response.content).toBeArray();
                expect(response.content).toHaveLength(1);
                expect(response.content[0].text).toContain("8.8.8.8");
                expect(response.content[0].text).toContain("9.9.9.9/24");
                expect(response.content[0].text).toContain(ipInfo.currentIpv4Address);
            });
        });
    });

    describe("clusters", () => {
        afterAll(async () => {
            const session: Session = integration.mcpServer().session;
            session.ensureAuthenticated();
            await session.apiClient.deleteCluster({
                params: {
                    path: {
                        groupId: projectId,
                        clusterName: "ClusterTest-" + randomId,
                    },
                },
            });
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
                    name: "atlas-create-free-cluster",
                    arguments: {
                        projectId,
                        name: "ClusterTest-" + randomId,
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
                const response = (await integration
                    .mcpClient()
                    .callTool({
                        name: "atlas-inspect-cluster",
                        arguments: { projectId, clusterName: "ClusterTest-" + randomId },
                    })) as CallToolResult;
                expect(response.content).toBeArray();
                expect(response.content).toHaveLength(1);
                expect(response.content[0].text).toContain(`ClusterTest-${randomId} | `);
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
                const response = (await integration
                    .mcpClient()
                    .callTool({ name: "atlas-list-clusters", arguments: { projectId } })) as CallToolResult;
                expect(response.content).toBeArray();
                expect(response.content).toHaveLength(2);
                expect(response.content[1].text).toContain(`ClusterTest-${randomId} | `);
            });

            it("returns clusters for all projects", async () => {
                const response = (await integration
                    .mcpClient()
                    .callTool({ name: "atlas-list-clusters", arguments: {} })) as CallToolResult;
                expect(response.content).toBeArray();
                expect(response.content).toHaveLength(1);
                expect(response.content[0].text).toContain(` | ClusterTest-${randomId}`);
            });
        });
    });
});
