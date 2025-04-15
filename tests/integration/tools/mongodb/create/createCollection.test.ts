import {
    connect,
    jestTestCluster,
    jestTestMCPClient,
    getResponseContent,
    validateParameters,
} from "../../../helpers.js";
import { toIncludeSameMembers } from "jest-extended";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { ObjectId } from "bson";

describe("createCollection tool", () => {
    const client = jestTestMCPClient();
    const cluster = jestTestCluster();

    it("should have correct metadata", async () => {
        const { tools } = await client().listTools();
        const listCollections = tools.find((tool) => tool.name === "create-collection")!;
        expect(listCollections).toBeDefined();
        expect(listCollections.description).toBe(
            "Creates a new collection in a database. If the database doesn't exist, it will be created automatically."
        );

        validateParameters(listCollections, [
            {
                name: "database",
                description: "Database name",
                type: "string",
            },
            {
                name: "collection",
                description: "Collection name",
                type: "string",
            },
        ]);
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
                await connect(client(), cluster());
                try {
                    await client().callTool({ name: "create-collection", arguments: arg });
                    expect.fail("Expected an error to be thrown");
                } catch (error) {
                    expect(error).toBeInstanceOf(McpError);
                    const mcpError = error as McpError;
                    expect(mcpError.code).toEqual(-32602);
                    expect(mcpError.message).toContain("Invalid arguments for tool create-collection");
                }
            });
        }
    });

    describe("with non-existent database", () => {
        it("creates a new collection", async () => {
            const mongoClient = cluster().getClient();
            let collections = await mongoClient.db("foo").listCollections().toArray();
            expect(collections).toHaveLength(0);

            await connect(client(), cluster());
            const response = await client().callTool({
                name: "create-collection",
                arguments: { database: "foo", collection: "bar" },
            });
            const content = getResponseContent(response.content);
            expect(content).toEqual('Collection "bar" created in database "foo".');

            collections = await mongoClient.db("foo").listCollections().toArray();
            expect(collections).toHaveLength(1);
            expect(collections[0].name).toEqual("bar");
        });
    });

    describe("with existing database", () => {
        let dbName: string;
        beforeEach(() => {
            dbName = new ObjectId().toString();
        });

        it("creates new collection", async () => {
            const mongoClient = cluster().getClient();
            await mongoClient.db(dbName).createCollection("collection1");
            let collections = await mongoClient.db(dbName).listCollections().toArray();
            expect(collections).toHaveLength(1);

            await connect(client(), cluster());
            const response = await client().callTool({
                name: "create-collection",
                arguments: { database: dbName, collection: "collection2" },
            });
            const content = getResponseContent(response.content);
            expect(content).toEqual(`Collection "collection2" created in database "${dbName}".`);
            collections = await mongoClient.db(dbName).listCollections().toArray();
            expect(collections).toHaveLength(2);
            expect(collections.map((c) => c.name)).toIncludeSameMembers(["collection1", "collection2"]);
        });

        it("does nothing if collection already exists", async () => {
            const mongoClient = cluster().getClient();
            await mongoClient.db(dbName).collection("collection1").insertOne({});
            let collections = await mongoClient.db(dbName).listCollections().toArray();
            expect(collections).toHaveLength(1);
            let documents = await mongoClient.db(dbName).collection("collection1").find({}).toArray();
            expect(documents).toHaveLength(1);

            await connect(client(), cluster());
            const response = await client().callTool({
                name: "create-collection",
                arguments: { database: dbName, collection: "collection1" },
            });
            const content = getResponseContent(response.content);
            expect(content).toEqual(`Collection "collection1" created in database "${dbName}".`);
            collections = await mongoClient.db(dbName).listCollections().toArray();
            expect(collections).toHaveLength(1);
            expect(collections[0].name).toEqual("collection1");

            // Make sure we didn't drop the existing collection
            documents = await mongoClient.db(dbName).collection("collection1").find({}).toArray();
            expect(documents).toHaveLength(1);
        });
    });
});
