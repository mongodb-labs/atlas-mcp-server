import { setupIntegrationTest } from "./helpers";

describe("Server integration test", () => {
    const integration = setupIntegrationTest();

    describe("list capabilities", () => {
        it("should return positive number of tools", async () => {
            const tools = await integration.mcpClient().listTools();
            expect(tools).toBeDefined();
            expect(tools.tools.length).toBeGreaterThan(0);
        });

        it("should return no resources", async () => {
            await expect(() => integration.mcpClient().listResources()).rejects.toMatchObject({
                message: "MCP error -32601: Method not found",
            });
        });

        it("should return no prompts", async () => {
            await expect(() => integration.mcpClient().listPrompts()).rejects.toMatchObject({
                message: "MCP error -32601: Method not found",
            });
        });

        it("should return capabilities", async () => {
            const capabilities = integration.mcpClient().getServerCapabilities();
            expect(capabilities).toBeDefined();
            expect(capabilities?.completions).toBeUndefined();
            expect(capabilities?.experimental).toBeUndefined();
            expect(capabilities?.tools).toBeDefined();
            expect(capabilities?.logging).toBeDefined();
            expect(capabilities?.prompts).toBeUndefined();
        });
    });
});
