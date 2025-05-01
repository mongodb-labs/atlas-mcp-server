import { describeWithMongoDB, validateAutoConnectBehavior } from "../mongodbHelpers.js";

import {
    getResponseContent,
    databaseCollectionParameters,
    validateToolMetadata,
    validateThrowsForInvalidArguments,
} from "../../../helpers.js";

describeWithMongoDB("dropIndex tool", (integration) => {
    validateToolMetadata(integration, "drop-index", "Removes an index from a collection.", [
        ...databaseCollectionParameters,
        {
            name: "name",
            type: "string",
            description: "The name of the index to drop",
            required: true,
        },
    ]);

    validateThrowsForInvalidArguments(integration, "drop-index", [
        {},
        { collection: "bar", name: "_id_" },
        { database: "test", name: "_id_" },
        { collection: "bar", database: "test" },
        { collection: "bar", database: 123, name: "_id_" },
        { collection: [], database: "test", name: "_id_" },
        { collection: "bar", database: "test", name: {} },
    ]);

    it("returns an error when dropping from non-existing collection", async () => {
        await integration.connectMcpClient();
        const response = await integration.mcpClient().callTool({
            name: "drop-index",
            arguments: {
                database: integration.randomDbName(),
                collection: "coll1",
                name: "_id_",
            },
        });

        const content = getResponseContent(response.content);
        expect(content).toContain(
            `Cannot drop index "_id_" because the namespace "${integration.randomDbName()}.coll1" does not exist.`
        );
    });

    it("returns an error when dropping a non-existent index", async () => {
        await integration.mongoClient().db(integration.randomDbName()).createCollection("coll1");

        await integration.connectMcpClient();
        const response = await integration.mcpClient().callTool({
            name: "drop-index",
            arguments: {
                database: integration.randomDbName(),
                collection: "coll1",
                name: "non-existent-index",
            },
        });

        const content = getResponseContent(response.content);
        expect(content).toContain("index not found with name [non-existent-index]");
    });

    it("removes an existing index", async () => {
        await integration.mongoClient().db(integration.randomDbName()).createCollection("coll1");
        await integration
            .mongoClient()
            .db(integration.randomDbName())
            .collection("coll1")
            .createIndex({ a: 1 }, { name: "index-a" });

        let indexes = await integration
            .mongoClient()
            .db(integration.randomDbName())
            .collection("coll1")
            .listIndexes()
            .toArray();
        expect(indexes).toHaveLength(2);
        expect(indexes[0]).toHaveProperty("name", "_id_");
        expect(indexes[1]).toHaveProperty("name", "index-a");

        await integration.connectMcpClient();
        const response = await integration.mcpClient().callTool({
            name: "drop-index",
            arguments: {
                database: integration.randomDbName(),
                collection: "coll1",
                name: "index-a",
            },
        });
        const content = getResponseContent(response.content);
        expect(content).toContain(`Successfully dropped index "index-a" in  "${integration.randomDbName()}.coll1"`);
        indexes = await integration
            .mongoClient()
            .db(integration.randomDbName())
            .collection("coll1")
            .listIndexes()
            .toArray();
        expect(indexes).toHaveLength(1);
        expect(indexes[0]).toHaveProperty("name", "_id_");
    });

    validateAutoConnectBehavior(integration, "drop-index", () => {
        return {
            args: {
                database: integration.randomDbName(),
                collection: "coll1",
                name: "index-a",
            },
            expectedResponse: `Cannot drop index "_id_" because the namespace "${integration.randomDbName()}.coll1" does not exist.`,
        };
    });
});
