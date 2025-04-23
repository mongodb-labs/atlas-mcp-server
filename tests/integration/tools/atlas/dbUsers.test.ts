import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Session } from "../../../../src/session.js";
import { describeAtlas, withProject, randomId } from "./atlasHelpers.js";

describeAtlas("db users", (integration) => {
    const userName = "testuser-" + randomId;
    withProject(integration, ({ getProjectId }) => {
        afterAll(async () => {
            const projectId = getProjectId();

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
                const projectId = getProjectId();

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
                const projectId = getProjectId();

                const response = (await integration
                    .mcpClient()
                    .callTool({ name: "atlas-list-db-users", arguments: { projectId } })) as CallToolResult;
                expect(response.content).toBeArray();
                expect(response.content).toHaveLength(1);
                expect(response.content[0].text).toContain(userName);
            });
        });
    });
});
