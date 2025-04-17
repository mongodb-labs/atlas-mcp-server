import {
    getResponseContent,
    validateParameters,
    dbOperationParameters,
    setupIntegrationTest,
} from "../../../helpers.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import config from "../../../../../src/config.js";

describe("deleteMany tool", () => {
    const integration = setupIntegrationTest();

    it("should have correct metadata", async () => {
        const { tools } = await integration.mcpClient().listTools();
        const deleteMany = tools.find((tool) => tool.name === "delete-many")!;
        expect(deleteMany).toBeDefined();
        expect(deleteMany.description).toBe("Removes all documents that match the filter from a MongoDB collection");

        validateParameters(deleteMany, [
            ...dbOperationParameters,
            {
                name: "filter",
                type: "object",
                description:
                    "The query filter, specifying the deletion criteria. Matches the syntax of the filter argument of db.collection.deleteMany()",
                required: false,
            },
        ]);
    });

    describe("with invalid arguments", () => {
        const args = [
            {},
            { collection: "bar", database: 123, filter: {} },
            { collection: [], database: "test", filter: {} },
            { collection: "bar", database: "test", filter: "my-document" },
            { collection: "bar", database: "test", filter: [{ name: "Peter" }] },
        ];
        for (const arg of args) {
            it(`throws a schema error for: ${JSON.stringify(arg)}`, async () => {
                await integration.connectMcpClient();
                try {
                    await integration.mcpClient().callTool({ name: "delete-many", arguments: arg });
                    expect.fail("Expected an error to be thrown");
                } catch (error) {
                    expect(error).toBeInstanceOf(McpError);
                    const mcpError = error as McpError;
                    expect(mcpError.code).toEqual(-32602);
                    expect(mcpError.message).toContain("Invalid arguments for tool delete-many");
                }
            });
        }
    });

    it("doesn't create the collection if it doesn't exist", async () => {
        await integration.connectMcpClient();
        const response = await integration.mcpClient().callTool({
            name: "delete-many",
            arguments: {
                database: integration.randomDbName(),
                collection: "coll1",
                filter: {},
            },
        });

        const content = getResponseContent(response.content);
        expect(content).toContain('Deleted `0` document(s) from collection "coll1"');

        const collections = await integration.mongoClient().db(integration.randomDbName()).listCollections().toArray();
        expect(collections).toHaveLength(0);
    });

    const insertDocuments = async () => {
        await integration
            .mongoClient()
            .db(integration.randomDbName())
            .collection("coll1")
            .insertMany([
                { age: 10, name: "Peter" },
                { age: 20, name: "John" },
                { age: 30, name: "Mary" },
                { age: 40, name: "Lucy" },
            ]);
    };

    const validateDocuments = async (expected: object[]) => {
        const documents = await integration
            .mongoClient()
            .db(integration.randomDbName())
            .collection("coll1")
            .find()
            .toArray();

        expect(documents).toHaveLength(expected.length);
        for (const expectedDocument of expected) {
            expect(documents).toContainEqual(expect.objectContaining(expectedDocument));
        }
    };

    it("deletes documents matching the filter", async () => {
        await insertDocuments();

        await integration.connectMcpClient();
        const response = await integration.mcpClient().callTool({
            name: "delete-many",
            arguments: {
                database: integration.randomDbName(),
                collection: "coll1",
                filter: { age: { $gt: 20 } },
            },
        });
        const content = getResponseContent(response.content);
        expect(content).toContain('Deleted `2` document(s) from collection "coll1"');

        await validateDocuments([
            { age: 10, name: "Peter" },
            { age: 20, name: "John" },
        ]);
    });

    it("when filter doesn't match, deletes nothing", async () => {
        await insertDocuments();
        await integration.connectMcpClient();
        const response = await integration.mcpClient().callTool({
            name: "delete-many",
            arguments: {
                database: integration.randomDbName(),
                collection: "coll1",
                filter: { age: { $gt: 100 } },
            },
        });

        const content = getResponseContent(response.content);
        expect(content).toContain('Deleted `0` document(s) from collection "coll1"');

        await validateDocuments([
            { age: 10, name: "Peter" },
            { age: 20, name: "John" },
            { age: 30, name: "Mary" },
            { age: 40, name: "Lucy" },
        ]);
    });

    it("with empty filter, deletes all documents", async () => {
        await insertDocuments();
        await integration.connectMcpClient();
        const response = await integration.mcpClient().callTool({
            name: "delete-many",
            arguments: {
                database: integration.randomDbName(),
                collection: "coll1",
                filter: {},
            },
        });

        const content = getResponseContent(response.content);
        expect(content).toContain('Deleted `4` document(s) from collection "coll1"');

        await validateDocuments([]);
    });

    describe("when not connected", () => {
        it("connects automatically if connection string is configured", async () => {
            config.connectionString = integration.connectionString();

            const response = await integration.mcpClient().callTool({
                name: "delete-many",
                arguments: {
                    database: integration.randomDbName(),
                    collection: "coll1",
                    filter: {},
                },
            });
            const content = getResponseContent(response.content);
            expect(content).toContain('Deleted `0` document(s) from collection "coll1"');
        });

        it("throws an error if connection string is not configured", async () => {
            const response = await integration.mcpClient().callTool({
                name: "delete-many",
                arguments: {
                    database: integration.randomDbName(),
                    collection: "coll1",
                    filter: {},
                },
            });
            const content = getResponseContent(response.content);
            expect(content).toContain("You need to connect to a MongoDB instance before you can access its data.");
        });
    });
});
