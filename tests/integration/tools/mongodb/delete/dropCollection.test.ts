import {
    getResponseContent,
    validateParameters,
    dbOperationParameters,
    setupIntegrationTest,
} from "../../../helpers.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import config from "../../../../../src/config.js";

describe("dropCollection tool", () => {
    const integration = setupIntegrationTest();

    it("should have correct metadata", async () => {
        const { tools } = await integration.mcpClient().listTools();
        const dropCollection = tools.find((tool) => tool.name === "drop-collection")!;
        expect(dropCollection).toBeDefined();
        expect(dropCollection.description).toBe(
            "Removes a collection or view from the database. The method also removes any indexes associated with the dropped collection."
        );

        validateParameters(dropCollection, [...dbOperationParameters]);
    });

    describe("with invalid arguments", () => {
        const args = [
            {},
            { database: 123, collection: "bar" },
            { foo: "bar", database: "test", collection: "bar" },
            { collection: [], database: "test" },
        ];
        for (const arg of args) {
            it(`throws a schema error for: ${JSON.stringify(arg)}`, async () => {
                await integration.connectMcpClient();
                try {
                    await integration.mcpClient().callTool({ name: "drop-collection", arguments: arg });
                    expect.fail("Expected an error to be thrown");
                } catch (error) {
                    expect(error).toBeInstanceOf(McpError);
                    const mcpError = error as McpError;
                    expect(mcpError.code).toEqual(-32602);
                    expect(mcpError.message).toContain("Invalid arguments for tool drop-collection");
                }
            });
        }
    });

    it("can drop non-existing collection", async () => {
        await integration.connectMcpClient();
        const response = await integration.mcpClient().callTool({
            name: "drop-collection",
            arguments: {
                database: integration.randomDbName(),
                collection: "coll1",
            },
        });

        const content = getResponseContent(response.content);
        expect(content).toContain(
            `Successfully dropped collection "coll1" from database "${integration.randomDbName()}"`
        );

        const collections = await integration.mongoClient().db(integration.randomDbName()).listCollections().toArray();
        expect(collections).toHaveLength(0);
    });

    it("removes the collection if it exists", async () => {
        await integration.connectMcpClient();
        await integration.mongoClient().db(integration.randomDbName()).createCollection("coll1");
        await integration.mongoClient().db(integration.randomDbName()).createCollection("coll2");
        const response = await integration.mcpClient().callTool({
            name: "drop-collection",
            arguments: {
                database: integration.randomDbName(),
                collection: "coll1",
            },
        });
        const content = getResponseContent(response.content);
        expect(content).toContain(
            `Successfully dropped collection "coll1" from database "${integration.randomDbName()}"`
        );
        const collections = await integration.mongoClient().db(integration.randomDbName()).listCollections().toArray();
        expect(collections).toHaveLength(1);
        expect(collections[0].name).toBe("coll2");
    });

    describe("when not connected", () => {
        it("connects automatically if connection string is configured", async () => {
            await integration.connectMcpClient();
            await integration.mongoClient().db(integration.randomDbName()).createCollection("coll1");

            config.connectionString = integration.connectionString();

            const response = await integration.mcpClient().callTool({
                name: "drop-collection",
                arguments: {
                    database: integration.randomDbName(),
                    collection: "coll1",
                },
            });
            const content = getResponseContent(response.content);
            expect(content).toContain(
                `Successfully dropped collection "coll1" from database "${integration.randomDbName()}"`
            );
        });

        it("throws an error if connection string is not configured", async () => {
            const response = await integration.mcpClient().callTool({
                name: "drop-collection",
                arguments: {
                    database: integration.randomDbName(),
                    collection: "coll1",
                },
            });
            const content = getResponseContent(response.content);
            expect(content).toContain("You need to connect to a MongoDB instance before you can access its data.");
        });
    });
});
