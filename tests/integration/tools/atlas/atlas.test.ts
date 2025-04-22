import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { setupIntegrationTest, describeAtlas } from "../../helpers.js";
import { Session } from "../../../../src/session.js";
import { ObjectId } from "mongodb";

const randomId = new ObjectId().toString();

function parseTable(text: string): Record<string, string>[] {
    const data = text
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => line.split("|").map((cell) => cell.trim()));

    const headers = data[0];
    return data
        .filter((_, index) => index >= 2)
        .map((cells) => {
            const row = {};
            cells.forEach((cell, index) => {
                row[headers[index]] = cell;
            });
            return row;
        });
}

describeAtlas("tools", () => {
    const integration = setupIntegrationTest();
    let projectId = "";

    describe("orgs", () => {
        describe("atlas-list-orgs", () => {
            it("should have correct metadata", async () => {
                const { tools } = await integration.mcpClient().listTools();
                const listOrgs = tools.find((tool) => tool.name === "atlas-list-orgs");
                expect(listOrgs).toBeDefined();
            });

            it("returns org names", async () => {
                const response = (await integration
                    .mcpClient()
                    .callTool({ name: "atlas-list-orgs", arguments: {} })) as CallToolResult;
                expect(response.content).toBeArray();
                expect(response.content).toHaveLength(1);
                const data = parseTable(response.content[0].text as string);
                expect(data).toHaveLength(1);
                expect(data[0]["Organization Name"]).toEqual("MongoDB MCP Test");
            });
        });
    });

    describe("projects", () => {
        const projName = "testProj-" + randomId;
        afterAll(async () => {
            const session: Session = integration.mcpServer().session;
            session.ensureAuthenticated();

            const response = (await integration
                .mcpClient()
                .callTool({ name: "atlas-list-projects", arguments: {} })) as CallToolResult;
            expect(response.content).toBeArray();
            expect(response.content).toHaveLength(1);
            const data = parseTable(response.content[0].text as string);
            for (const project of data) {
                if (project["Project Name"] === projName) {
                    await session.apiClient.deleteProject({
                        params: {
                            path:{
                                groupId: project["Project ID"],
                            }
                        },
                    });
                    break;
                }
            }
        });
        describe("atlas-create-project", () => {
            it("should have correct metadata", async () => {
                const { tools } = await integration.mcpClient().listTools();
                const createProject = tools.find((tool) => tool.name === "atlas-create-project")!;
                expect(createProject).toBeDefined();
                expect(createProject.inputSchema.type).toBe("object");
                expect(createProject.inputSchema.properties).toBeDefined();
                expect(createProject.inputSchema.properties).toHaveProperty("projectName");
                expect(createProject.inputSchema.properties).toHaveProperty("organizationId");
            });
            it("should create a project", async () => {
                const response = (await integration
                    .mcpClient()
                    .callTool({
                        name: "atlas-create-project",
                        arguments: { projectName: projName },
                    })) as CallToolResult;
                expect(response.content).toBeArray();
                expect(response.content).toHaveLength(1);
                expect(response.content[0].text).toContain(projName);
            });
        });
        describe("atlas-list-projects", () => {
            it("should have correct metadata", async () => {
                const { tools } = await integration.mcpClient().listTools();
                const listProjects = tools.find((tool) => tool.name === "atlas-list-projects")!;
                expect(listProjects).toBeDefined();
                expect(listProjects.inputSchema.type).toBe("object");
                expect(listProjects.inputSchema.properties).toBeDefined();
                expect(listProjects.inputSchema.properties).toHaveProperty("orgId");
            });

            it("returns project names", async () => {
                const response = (await integration
                    .mcpClient()
                    .callTool({ name: "atlas-list-projects", arguments: {} })) as CallToolResult;
                expect(response.content).toBeArray();
                expect(response.content).toHaveLength(1);
                expect(response.content[0].text).toContain("MCP Test");
                const data = parseTable(response.content[0].text as string);
                expect(data).toBeArray();
                expect(data.length).toBeGreaterThan(1);
                for (const project of data) {
                    if (project["Project Name"] === "MCP Test") {
                        projectId = data[0]["Project ID"];
                        break;
                    }
                }
            });
        });
    });

    describe("db users", () => {
        const userName = "testuser-" + randomId;

        afterAll(async () => {
            const session: Session = integration.mcpServer().session;
            session.ensureAuthenticated();
            await session.apiClient.deleteDatabaseUser({
                params: {
                    path: {
                        groupId: projectId,
                        username: userName,
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
                        username: userName,
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
                expect(response.content[0].text).toContain(userName);
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
        const clusterName = "ClusterTest-" + randomId;

        afterAll(async () => {
            const session: Session = integration.mcpServer().session;
            session.ensureAuthenticated();
            await session.apiClient.deleteCluster({
                params: {
                    path: {
                        groupId: projectId,
                        clusterName: clusterName,
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
                const response = (await integration
                    .mcpClient()
                    .callTool({ name: "atlas-list-clusters", arguments: { projectId } })) as CallToolResult;
                expect(response.content).toBeArray();
                expect(response.content).toHaveLength(2);
                expect(response.content[1].text).toContain(`${clusterName} | `);
            });

            it("returns clusters for all projects", async () => {
                const response = (await integration
                    .mcpClient()
                    .callTool({ name: "atlas-list-clusters", arguments: {} })) as CallToolResult;
                expect(response.content).toBeArray();
                expect(response.content).toHaveLength(1);
                expect(response.content[0].text).toContain(` | ${clusterName}`);
            });
        });
    });
});
