import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { setupIntegrationTest, describeAtlas } from "../../helpers.js";

describeAtlas("listProjects tool", () => {
    const integration = setupIntegrationTest();

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
    });
});
