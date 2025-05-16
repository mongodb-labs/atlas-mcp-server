import { describeWithMongoDB, validateAutoConnectBehavior } from "../mongodbHelpers.js";

import {
    getResponseContent,
    databaseCollectionParameters,
    validateToolMetadata,
    validateThrowsForInvalidArguments,
} from "../../../helpers.js";

describeWithMongoDB("count tool", (integration) => {
    validateToolMetadata(integration, "count", "Gets the number of documents in a MongoDB collection", [
        {
            name: "query",
            description:
                "The query filter to count documents. Matches the syntax of the filter argument of db.collection.count()",
            type: "object",
            required: false,
        },
        {
            name: "filter",
            description: "Alternative name for query parameter. The query filter to count documents.",
            type: "object",
            required: false,
        },
        ...databaseCollectionParameters,
    ]);

    validateThrowsForInvalidArguments(integration, "count", [
        {},
        { database: 123, collection: "bar" },
        { collection: [], database: "test" },
        { collection: "bar", database: "test", query: "{ $gt: { foo: 5 } }" },
    ]);

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
        await mongoClient.db(integration.randomDbName()).collection("bar").insertOne({});
        const response = await integration.mcpClient().callTool({
            name: "count",
            arguments: { database: integration.randomDbName(), collection: "non-existent" },
        });
        const content = getResponseContent(response.content);
        expect(content).toEqual('Found 0 documents in the collection "non-existent"');
    });

    describe("with existing database", () => {
        beforeEach(async () => {
            const mongoClient = integration.mongoClient();
            await mongoClient
                .db(integration.randomDbName())
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
                    arguments: { database: integration.randomDbName(), collection: "foo", query: testCase.filter },
                });

                const content = getResponseContent(response.content);
                expect(content).toEqual(`Found ${testCase.expectedCount} documents in the collection "foo"`);
            });
        }

        it("correctly filters documents when using 'filter' parameter", async () => {
            await integration.connectMcpClient();

            // Using 'filter' parameter - should work correctly after the fix
            const response = await integration.mcpClient().callTool({
                name: "count",
                arguments: {
                    database: integration.randomDbName(),
                    collection: "foo",
                    filter: { age: { $lt: 15 } },
                },
            });

            const content = getResponseContent(response.content);
            expect(content).toEqual('Found 2 documents in the collection "foo"');
        });

        it("prioritizes filter over query when both are provided", async () => {
            await integration.connectMcpClient();

            // Using both 'filter' and 'query' parameters
            const response = await integration.mcpClient().callTool({
                name: "count",
                arguments: {
                    database: integration.randomDbName(),
                    collection: "foo",
                    filter: { age: { $lt: 15 } },
                    query: { age: { $gt: 10 } },
                },
            });

            const content = getResponseContent(response.content);
            // Filter takes precedence over query
            // Filter is { age: { $lt: 15 } } which matches 2 documents
            expect(content).toEqual('Found 2 documents in the collection "foo"');
        });
    });

    validateAutoConnectBehavior(integration, "count", () => {
        return {
            args: { database: integration.randomDbName(), collection: "coll1" },
            expectedResponse: 'Found 0 documents in the collection "coll1"',
        };
    });
});
