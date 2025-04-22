import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Session } from "../../../../src/session.js";
import { describeAtlas, withProject } from "./atlasHelpers.js";

describeAtlas("ip access lists", (integration) => {
    withProject(integration, ({ getProjectId }) => {
        let ipInfo: {
            currentIpv4Address: string;
        };

        beforeAll(async () => {
            const session: Session = integration.mcpServer().session;
            session.ensureAuthenticated();
            ipInfo = await session.apiClient.getIpInfo();
        });

        afterAll(async () => {
            const session: Session = integration.mcpServer().session;
            session.ensureAuthenticated();

            const projectId = getProjectId();

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
                const projectId = getProjectId();

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
                const projectId = getProjectId();

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
});
