import {
    getResponseElements,
    getResponseContent,
    setupIntegrationTest,
    validateToolMetadata,
    validateAutoConnectBehavior,
} from "../../../helpers.js";
import { toIncludeSameMembers } from "jest-extended";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import config from "../../../../../src/config.js";

describe("listCollections tool", () => {
    const integration = setupIntegrationTest();

    it("should have correct metadata", async () => {
        await validateToolMetadata(
            integration.mcpClient(),
            "list-collections",
            "List all collections for a given database",
            [{ name: "database", description: "Database name", type: "string", required: true }]
        );
    });

    describe("with invalid arguments", () => {
        const args = [{}, { database: 123 }, { foo: "bar", database: "test" }, { database: [] }];
        for (const arg of args) {
            it(`throws a schema error for: ${JSON.stringify(arg)}`, async () => {
                await integration.connectMcpClient();
                try {
                    await integration.mcpClient().callTool({ name: "list-collections", arguments: arg });
                    expect.fail("Expected an error to be thrown");
                } catch (error) {
                    expect(error).toBeInstanceOf(McpError);
                    const mcpError = error as McpError;
                    expect(mcpError.code).toEqual(-32602);
                    expect(mcpError.message).toContain("Invalid arguments for tool list-collections");
                    expect(mcpError.message).toContain('"expected": "string"');
                }
            });
        }
    });

    describe("with non-existent database", () => {
        it("returns no collections", async () => {
            await integration.connectMcpClient();
            const response = await integration.mcpClient().callTool({
                name: "list-collections",
                arguments: { database: "non-existent" },
            });
            const content = getResponseContent(response.content);
            expect(content).toEqual(
                'No collections found for database "non-existent". To create a collection, use the "create-collection" tool.'
            );
        });
    });

    describe("with existing database", () => {
        it("returns collections", async () => {
            const mongoClient = integration.mongoClient();
            await mongoClient.db(integration.randomDbName()).createCollection("collection-1");

            await integration.connectMcpClient();
            const response = await integration.mcpClient().callTool({
                name: "list-collections",
                arguments: { database: integration.randomDbName() },
            });
            const items = getResponseElements(response.content);
            expect(items).toHaveLength(1);
            expect(items[0].text).toContain('Name: "collection-1"');

            await mongoClient.db(integration.randomDbName()).createCollection("collection-2");

            const response2 = await integration.mcpClient().callTool({
                name: "list-collections",
                arguments: { database: integration.randomDbName() },
            });
            const items2 = getResponseElements(response2.content);
            expect(items2).toHaveLength(2);
            expect(items2.map((item) => item.text)).toIncludeSameMembers([
                'Name: "collection-1"',
                'Name: "collection-2"',
            ]);
        });
    });

    describe("when not connected", () => {
        validateAutoConnectBehavior(
            integration,
            "list-collections",

            () => {
                return {
                    args: { database: integration.randomDbName() },
                    expectedResponse: `No collections found for database "${integration.randomDbName()}". To create a collection, use the "create-collection" tool.`,
                };
            }
        );
    });
});
