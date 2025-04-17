import {
    getResponseContent,
    validateParameters,
    dbOperationParameters,
    setupIntegrationTest,
} from "../../../helpers.js";
import { toIncludeSameMembers } from "jest-extended";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { ObjectId } from "mongodb";

describe("count tool", () => {
    const integration = setupIntegrationTest();

    let randomDbName: string;
    beforeEach(() => {
        randomDbName = new ObjectId().toString();
    });

    it("should have correct metadata", async () => {
        const { tools } = await integration.mcpClient().listTools();
        const listCollections = tools.find((tool) => tool.name === "count")!;
        expect(listCollections).toBeDefined();
        expect(listCollections.description).toBe("Gets the number of documents in a MongoDB collection");

        validateParameters(listCollections, [
            {
                name: "query",
                description:
                    "The query filter to count documents. Matches the syntax of the filter argument of db.collection.count()",
                type: "object",
                required: false,
            },
            ...dbOperationParameters,
        ]);
    });

    describe("with invalid arguments", () => {
        const args = [
            {},
            { database: 123, collection: "bar" },
            { foo: "bar", database: "test", collection: "bar" },
            { collection: [], database: "test" },
            { collection: "bar", database: "test", query: "{ $gt: { foo: 5 } }" },
        ];
        for (const arg of args) {
            it(`throws a schema error for: ${JSON.stringify(arg)}`, async () => {
                await integration.connectMcpClient();
                try {
                    await integration.mcpClient().callTool({ name: "count", arguments: arg });
                    expect.fail("Expected an error to be thrown");
                } catch (error) {
                    expect(error).toBeInstanceOf(McpError);
                    const mcpError = error as McpError;
                    expect(mcpError.code).toEqual(-32602);
                    expect(mcpError.message).toContain("Invalid arguments for tool count");
                }
            });
        }
    });

    it("returns 0 when database doesn't exist", async () => {
        await integration.connectMcpClient();
        const response = await integration.mcpClient().callTool({
            name: "count",
            arguments: { database: "non-existent", collection: "foos" },
        });
        const content = getResponseContent(response.content);
        expect(content).toEqual('Found 0 documents in the collection "foos"');
    });

    it("returns 0 when collection doesn't exist", async () => {
        await integration.connectMcpClient();
        const mongoClient = integration.mongoClient();
        await mongoClient.db(randomDbName).collection("bar").insertOne({});
        const response = await integration.mcpClient().callTool({
            name: "count",
            arguments: { database: randomDbName, collection: "non-existent" },
        });
        const content = getResponseContent(response.content);
        expect(content).toEqual('Found 0 documents in the collection "non-existent"');
    });

    describe("with existing database", () => {
        beforeEach(async () => {
            const mongoClient = integration.mongoClient();
            await mongoClient
                .db(randomDbName)
                .collection("foo")
                .insertMany([
                    { name: "Peter", age: 5 },
                    { name: "Parker", age: 10 },
                    { name: "George", age: 15 },
                ]);
        });

        const testCases = [
            { filter: undefined, expectedCount: 3 },
            { filter: {}, expectedCount: 3 },
            { filter: { age: { $lt: 15 } }, expectedCount: 2 },
            { filter: { age: { $gt: 5 }, name: { $regex: "^P" } }, expectedCount: 1 },
        ];
        for (const testCase of testCases) {
            it(`returns ${testCase.expectedCount} documents for filter ${JSON.stringify(testCase.filter)}`, async () => {
                await integration.connectMcpClient();
                const response = await integration.mcpClient().callTool({
                    name: "count",
                    arguments: { database: randomDbName, collection: "foo", query: testCase.filter },
                });

                const content = getResponseContent(response.content);
                expect(content).toEqual(`Found ${testCase.expectedCount} documents in the collection "foo"`);
            });
        }
    });
});
