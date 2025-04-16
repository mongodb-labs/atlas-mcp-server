import {
    getResponseContent,
    validateParameters,
    dbOperationParameters,
    setupIntegrationTest,
} from "../../../helpers.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { ObjectId } from "bson";
import { IndexDirection } from "mongodb";

describe("createIndex tool", () => {
    const integration = setupIntegrationTest();

    let dbName: string;
    beforeEach(() => {
        dbName = new ObjectId().toString();
    });

    it("should have correct metadata", async () => {
        const { tools } = await integration.mcpClient().listTools();
        const listCollections = tools.find((tool) => tool.name === "create-index")!;
        expect(listCollections).toBeDefined();
        expect(listCollections.description).toBe("Create an index for a collection");

        validateParameters(listCollections, [
            ...dbOperationParameters,
            {
                name: "keys",
                type: "object",
                description: "The index definition",
                required: true,
            },
            {
                name: "name",
                type: "string",
                description: "The name of the index",
                required: false,
            },
        ]);
    });

    describe("with invalid arguments", () => {
        const args = [
            {},
            { collection: "bar", database: 123, keys: { foo: 1 } },
            { collection: "bar", database: "test", keys: { foo: 5 } },
            { collection: [], database: "test", keys: { foo: 1 } },
            { collection: "bar", database: "test", keys: { foo: 1 }, name: 123 },
            { collection: "bar", database: "test", keys: "foo", name: "my-index" },
        ];
        for (const arg of args) {
            it(`throws a schema error for: ${JSON.stringify(arg)}`, async () => {
                await integration.connectMcpClient();
                try {
                    await integration.mcpClient().callTool({ name: "create-index", arguments: arg });
                    expect.fail("Expected an error to be thrown");
                } catch (error) {
                    expect(error).toBeInstanceOf(McpError);
                    const mcpError = error as McpError;
                    expect(mcpError.code).toEqual(-32602);
                    expect(mcpError.message).toContain("Invalid arguments for tool create-index");
                }
            });
        }
    });

    const validateIndex = async (collection: string, expected: { name: string; key: object }[]) => {
        const mongoClient = integration.mongoClient();
        const collections = await mongoClient.db(dbName).listCollections().toArray();
        expect(collections).toHaveLength(1);
        expect(collections[0].name).toEqual("coll1");
        const indexes = await mongoClient.db(dbName).collection(collection).indexes();
        expect(indexes).toHaveLength(expected.length + 1);
        expect(indexes[0].name).toEqual("_id_");
        for (const index of expected) {
            const foundIndex = indexes.find((i) => i.name === index.name);
            expect(foundIndex).toBeDefined();
            expect(foundIndex!.key).toEqual(index.key);
        }
    };

    it("creates the namespace if necessary", async () => {
        await integration.connectMcpClient();
        const response = await integration.mcpClient().callTool({
            name: "create-index",
            arguments: { database: dbName, collection: "coll1", keys: { prop1: 1 }, name: "my-index" },
        });

        const content = getResponseContent(response.content);
        expect(content).toEqual(`Created the index "my-index" on collection "coll1" in database "${dbName}"`);

        await validateIndex("coll1", [{ name: "my-index", key: { prop1: 1 } }]);
    });

    it("generates a name if not provided", async () => {
        await integration.connectMcpClient();
        const response = await integration.mcpClient().callTool({
            name: "create-index",
            arguments: { database: dbName, collection: "coll1", keys: { prop1: 1 } },
        });

        const content = getResponseContent(response.content);
        expect(content).toEqual(`Created the index "prop1_1" on collection "coll1" in database "${dbName}"`);
        await validateIndex("coll1", [{ name: "prop1_1", key: { prop1: 1 } }]);
    });

    it("can create multiple indexes in the same collection", async () => {
        await integration.connectMcpClient();
        let response = await integration.mcpClient().callTool({
            name: "create-index",
            arguments: { database: dbName, collection: "coll1", keys: { prop1: 1 } },
        });

        expect(getResponseContent(response.content)).toEqual(
            `Created the index "prop1_1" on collection "coll1" in database "${dbName}"`
        );

        response = await integration.mcpClient().callTool({
            name: "create-index",
            arguments: { database: dbName, collection: "coll1", keys: { prop2: -1 } },
        });

        expect(getResponseContent(response.content)).toEqual(
            `Created the index "prop2_-1" on collection "coll1" in database "${dbName}"`
        );

        await validateIndex("coll1", [
            { name: "prop1_1", key: { prop1: 1 } },
            { name: "prop2_-1", key: { prop2: -1 } },
        ]);
    });

    it("can create multiple indexes on the same property", async () => {
        await integration.connectMcpClient();
        let response = await integration.mcpClient().callTool({
            name: "create-index",
            arguments: { database: dbName, collection: "coll1", keys: { prop1: 1 } },
        });

        expect(getResponseContent(response.content)).toEqual(
            `Created the index "prop1_1" on collection "coll1" in database "${dbName}"`
        );

        response = await integration.mcpClient().callTool({
            name: "create-index",
            arguments: { database: dbName, collection: "coll1", keys: { prop1: -1 } },
        });

        expect(getResponseContent(response.content)).toEqual(
            `Created the index "prop1_-1" on collection "coll1" in database "${dbName}"`
        );

        await validateIndex("coll1", [
            { name: "prop1_1", key: { prop1: 1 } },
            { name: "prop1_-1", key: { prop1: -1 } },
        ]);
    });

    it("doesn't duplicate indexes", async () => {
        await integration.connectMcpClient();
        let response = await integration.mcpClient().callTool({
            name: "create-index",
            arguments: { database: dbName, collection: "coll1", keys: { prop1: 1 } },
        });

        expect(getResponseContent(response.content)).toEqual(
            `Created the index "prop1_1" on collection "coll1" in database "${dbName}"`
        );

        response = await integration.mcpClient().callTool({
            name: "create-index",
            arguments: { database: dbName, collection: "coll1", keys: { prop1: 1 } },
        });

        expect(getResponseContent(response.content)).toEqual(
            `Created the index "prop1_1" on collection "coll1" in database "${dbName}"`
        );

        await validateIndex("coll1", [{ name: "prop1_1", key: { prop1: 1 } }]);
    });

    const testCases: { name: string; direction: IndexDirection }[] = [
        { name: "descending", direction: -1 },
        { name: "ascending", direction: 1 },
        { name: "hashed", direction: "hashed" },
        { name: "text", direction: "text" },
        { name: "geoHaystack", direction: "2dsphere" },
        { name: "geo2d", direction: "2d" },
    ];

    for (const { name, direction } of testCases) {
        it(`creates ${name} index`, async () => {
            await integration.connectMcpClient();
            const response = await integration.mcpClient().callTool({
                name: "create-index",
                arguments: { database: dbName, collection: "coll1", keys: { prop1: direction } },
            });

            expect(getResponseContent(response.content)).toEqual(
                `Created the index "prop1_${direction}" on collection "coll1" in database "${dbName}"`
            );

            let expectedKey: object = { prop1: direction };
            if (direction === "text") {
                expectedKey = {
                    _fts: "text",
                    _ftsx: 1,
                };
            }
            await validateIndex("coll1", [{ name: `prop1_${direction}`, key: expectedKey }]);
        });
    }
});
