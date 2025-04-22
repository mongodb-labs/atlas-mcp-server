import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { setupIntegrationTest } from "../../helpers.js";
import { parseTable, describeAtlas } from "./atlasHelpers.js";

describeAtlas("orgs", (integration) => {
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
