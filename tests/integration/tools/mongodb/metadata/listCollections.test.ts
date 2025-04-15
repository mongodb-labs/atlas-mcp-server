import {
    getResponseElements,
    connect,
    jestTestCluster,
    jestTestMCPClient,
    getResponseContent,
    getParameters,
    validateParameters,
} from "../../../helpers.js";
import { toIncludeSameMembers } from "jest-extended";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

describe("listCollections tool", () => {
    const client = jestTestMCPClient();
    const cluster = jestTestCluster();

    it("should have correct metadata", async () => {
        const { tools } = await client().listTools();
        const listCollections = tools.find((tool) => tool.name === "list-collections")!;
        expect(listCollections).toBeDefined();
        expect(listCollections.description).toBe("List all collections for a given database");

        validateParameters(listCollections, [{ name: "database", description: "Database name", type: "string" }]);
    });

    describe("with invalid arguments", () => {
        const args = [{}, { database: 123 }, { foo: "bar", database: "test" }, { database: [] }];
        for (const arg of args) {
            it(`throws a schema error for: ${JSON.stringify(arg)}`, async () => {
                await connect(client(), cluster());
                try {
                    await client().callTool({ name: "list-collections", arguments: arg });
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
            await connect(client(), cluster());
            const response = await client().callTool({
                name: "list-collections",
                arguments: { database: "non-existent" },
            });
            const content = getResponseContent(response.content);
            expect(content).toEqual(
                `No collections found for database "non-existent". To create a collection, use the "create-collection" tool.`
            );
        });
    });

    describe("with existing database", () => {
        it("returns collections", async () => {
            const mongoClient = cluster().getClient();
            await mongoClient.db("my-db").createCollection("collection-1");

            await connect(client(), cluster());
            const response = await client().callTool({
                name: "list-collections",
                arguments: { database: "my-db" },
            });
            const items = getResponseElements(response.content);
            expect(items).toHaveLength(1);
            expect(items[0].text).toContain('Name: "collection-1"');

            await mongoClient.db("my-db").createCollection("collection-2");

            const response2 = await client().callTool({
                name: "list-collections",
                arguments: { database: "my-db" },
            });
            const items2 = getResponseElements(response2.content);
            expect(items2).toHaveLength(2);
            expect(items2.map((item) => item.text)).toIncludeSameMembers([
                'Name: "collection-1"',
                'Name: "collection-2"',
            ]);
        });
    });
});
