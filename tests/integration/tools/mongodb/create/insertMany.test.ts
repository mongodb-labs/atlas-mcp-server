import {
    getResponseContent,
    validateParameters,
    dbOperationParameters,
    setupIntegrationTest,
} from "../../../helpers.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import config from "../../../../../src/config.js";

describe("insertMany tool", () => {
    const integration = setupIntegrationTest();

    it("should have correct metadata", async () => {
        const { tools } = await integration.mcpClient().listTools();
        const insertMany = tools.find((tool) => tool.name === "insert-many")!;
        expect(insertMany).toBeDefined();
        expect(insertMany.description).toBe("Insert an array of documents into a MongoDB collection");

        validateParameters(insertMany, [
            ...dbOperationParameters,
            {
                name: "documents",
                type: "array",
                description:
                    "The array of documents to insert, matching the syntax of the document argument of db.collection.insertMany()",
                required: true,
            },
        ]);
    });

    describe("with invalid arguments", () => {
        const args = [
            {},
            { collection: "bar", database: 123, documents: [] },
            { collection: [], database: "test", documents: [] },
            { collection: "bar", database: "test", documents: "my-document" },
            { collection: "bar", database: "test", documents: { name: "Peter" } },
        ];
        for (const arg of args) {
            it(`throws a schema error for: ${JSON.stringify(arg)}`, async () => {
                await integration.connectMcpClient();
                try {
                    await integration.mcpClient().callTool({ name: "insert-many", arguments: arg });
                    expect.fail("Expected an error to be thrown");
                } catch (error) {
                    expect(error).toBeInstanceOf(McpError);
                    const mcpError = error as McpError;
                    expect(mcpError.code).toEqual(-32602);
                    expect(mcpError.message).toContain("Invalid arguments for tool insert-many");
                }
            });
        }
    });

    const validateDocuments = async (collection: string, expectedDocuments: object[]) => {
        const collections = await integration.mongoClient().db(integration.randomDbName()).listCollections().toArray();
        expect(collections.find((c) => c.name === collection)).toBeDefined();

        const docs = await integration
            .mongoClient()
            .db(integration.randomDbName())
            .collection(collection)
            .find()
            .toArray();

        expect(docs).toHaveLength(expectedDocuments.length);
        for (const expectedDocument of expectedDocuments) {
            expect(docs).toContainEqual(expect.objectContaining(expectedDocument));
        }
    };

    it("creates the namespace if necessary", async () => {
        await integration.connectMcpClient();
        const response = await integration.mcpClient().callTool({
            name: "insert-many",
            arguments: {
                database: integration.randomDbName(),
                collection: "coll1",
                documents: [{ prop1: "value1" }],
            },
        });

        const content = getResponseContent(response.content);
        expect(content).toContain('Inserted `1` document(s) into collection "coll1"');

        await validateDocuments("coll1", [{ prop1: "value1" }]);
    });

    it("returns an error when inserting duplicates", async () => {
        const { insertedIds } = await integration
            .mongoClient()
            .db(integration.randomDbName())
            .collection("coll1")
            .insertMany([{ prop1: "value1" }]);

        await integration.connectMcpClient();
        const response = await integration.mcpClient().callTool({
            name: "insert-many",
            arguments: {
                database: integration.randomDbName(),
                collection: "coll1",
                documents: [{ prop1: "value1", _id: insertedIds[0] }],
            },
        });

        const content = getResponseContent(response.content);
        expect(content).toContain("Error running insert-many");
        expect(content).toContain("duplicate key error");
        expect(content).toContain(insertedIds[0].toString());
    });

    describe("when not connected", () => {
        it("connects automatically if connection string is configured", async () => {
            config.connectionString = integration.connectionString();

            const response = await integration.mcpClient().callTool({
                name: "insert-many",
                arguments: {
                    database: integration.randomDbName(),
                    collection: "coll1",
                    documents: [{ prop1: "value1" }],
                },
            });
            const content = getResponseContent(response.content);
            expect(content).toContain('Inserted `1` document(s) into collection "coll1"');
        });

        it("throws an error if connection string is not configured", async () => {
            const response = await integration.mcpClient().callTool({
                name: "insert-many",
                arguments: {
                    database: integration.randomDbName(),
                    collection: "coll1",
                    documents: [{ prop1: "value1" }],
                },
            });
            const content = getResponseContent(response.content);
            expect(content).toContain("You need to connect to a MongoDB instance before you can access its data.");
        });
    });
});
