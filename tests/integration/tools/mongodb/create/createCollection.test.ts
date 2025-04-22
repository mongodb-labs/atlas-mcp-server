import {
    getResponseContent,
    validateParameters,
    dbOperationParameters,
    setupIntegrationTest,
} from "../../../helpers.js";
import { toIncludeSameMembers } from "jest-extended";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { ObjectId } from "bson";
import config from "../../../../../src/config.js";

describe("createCollection tool", () => {
    const integration = setupIntegrationTest();

    it("should have correct metadata", async () => {
        const { tools } = await integration.mcpClient().listTools();
        const listCollections = tools.find((tool) => tool.name === "create-collection")!;
        expect(listCollections).toBeDefined();
        expect(listCollections.description).toBe(
            "Creates a new collection in a database. If the database doesn't exist, it will be created automatically."
        );

        validateParameters(listCollections, dbOperationParameters);
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
                    await integration.mcpClient().callTool({ name: "create-collection", arguments: arg });
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
            const mongoClient = integration.mongoClient();
            let collections = await mongoClient.db(integration.randomDbName()).listCollections().toArray();
            expect(collections).toHaveLength(0);

            await integration.connectMcpClient();
            const response = await integration.mcpClient().callTool({
                name: "create-collection",
                arguments: { database: integration.randomDbName(), collection: "bar" },
            });
            const content = getResponseContent(response.content);
            expect(content).toEqual(`Collection "bar" created in database "${integration.randomDbName()}".`);

            collections = await mongoClient.db(integration.randomDbName()).listCollections().toArray();
            expect(collections).toHaveLength(1);
            expect(collections[0].name).toEqual("bar");
        });
    });

    describe("with existing database", () => {
        it("creates new collection", async () => {
            const mongoClient = integration.mongoClient();
            await mongoClient.db(integration.randomDbName()).createCollection("collection1");
            let collections = await mongoClient.db(integration.randomDbName()).listCollections().toArray();
            expect(collections).toHaveLength(1);

            await integration.connectMcpClient();
            const response = await integration.mcpClient().callTool({
                name: "create-collection",
                arguments: { database: integration.randomDbName(), collection: "collection2" },
            });
            const content = getResponseContent(response.content);
            expect(content).toEqual(`Collection "collection2" created in database "${integration.randomDbName()}".`);
            collections = await mongoClient.db(integration.randomDbName()).listCollections().toArray();
            expect(collections).toHaveLength(2);
            expect(collections.map((c) => c.name)).toIncludeSameMembers(["collection1", "collection2"]);
        });

        it("does nothing if collection already exists", async () => {
            const mongoClient = integration.mongoClient();
            await mongoClient.db(integration.randomDbName()).collection("collection1").insertOne({});
            let collections = await mongoClient.db(integration.randomDbName()).listCollections().toArray();
            expect(collections).toHaveLength(1);
            let documents = await mongoClient
                .db(integration.randomDbName())
                .collection("collection1")
                .find({})
                .toArray();
            expect(documents).toHaveLength(1);

            await integration.connectMcpClient();
            const response = await integration.mcpClient().callTool({
                name: "create-collection",
                arguments: { database: integration.randomDbName(), collection: "collection1" },
            });
            const content = getResponseContent(response.content);
            expect(content).toEqual(`Collection "collection1" created in database "${integration.randomDbName()}".`);
            collections = await mongoClient.db(integration.randomDbName()).listCollections().toArray();
            expect(collections).toHaveLength(1);
            expect(collections[0].name).toEqual("collection1");

            // Make sure we didn't drop the existing collection
            documents = await mongoClient.db(integration.randomDbName()).collection("collection1").find({}).toArray();
            expect(documents).toHaveLength(1);
        });
    });

    describe("when not connected", () => {
        it("connects automatically if connection string is configured", async () => {
            config.connectionString = integration.connectionString();

            const response = await integration.mcpClient().callTool({
                name: "create-collection",
                arguments: { database: integration.randomDbName(), collection: "new-collection" },
            });
            const content = getResponseContent(response.content);
            expect(content).toEqual(`Collection "new-collection" created in database "${integration.randomDbName()}".`);
        });

        it("throws an error if connection string is not configured", async () => {
            const response = await integration.mcpClient().callTool({
                name: "create-collection",
                arguments: { database: integration.randomDbName(), collection: "new-collection" },
            });
            const content = getResponseContent(response.content);
            expect(content).toContain("You need to connect to a MongoDB instance before you can access its data.");
        });
    });
});
