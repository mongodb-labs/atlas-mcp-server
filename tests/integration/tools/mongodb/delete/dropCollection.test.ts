import { describeMongoDB } from "../mongodbHelpers.js";

import {
    getResponseContent,
    dbOperationParameters,
    setupIntegrationTest,
    validateToolMetadata,
    validateAutoConnectBehavior,
    validateThrowsForInvalidArguments,
    dbOperationInvalidArgTests,
} from "../../../helpers.js";

describeMongoDB("dropCollection tool", (integration) => {
    validateToolMetadata(
        integration,
        "drop-collection",
        "Removes a collection or view from the database. The method also removes any indexes associated with the dropped collection.",
        dbOperationParameters
    );

    validateThrowsForInvalidArguments(integration, "drop-collection", dbOperationInvalidArgTests);

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

    validateAutoConnectBehavior(integration, "drop-collection", () => {
        return {
            args: {
                database: integration.randomDbName(),
                collection: "coll1",
            },
            expectedResponse: `Successfully dropped collection "coll1" from database "${integration.randomDbName()}"`,
        };
    });
});
