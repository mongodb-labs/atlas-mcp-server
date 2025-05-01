import { ObjectId } from "bson";
import { expectDefined, getResponseElements } from "../../../helpers.js";
import { describeWithAtlasSearch } from "../atlasSearchHelpers.js";

describeWithAtlasSearch("collectionIndexes tool", (integration) => {
    it("can inspect search indexes", async () => {
        await integration.connectMcpClient();

        const provider = integration.mcpServer().session.serviceProvider;
        expectDefined(provider);

        const database = new ObjectId().toString();

        await provider.mongoClient
            .db(database)
            .collection("coll1")
            .insertMany([
                { name: "Alice", age: 30 },
                { name: "Bob", age: 25 },
                { name: "Charlie", age: 35 },
            ]);

        const name = await provider.mongoClient
            .db(database)
            .collection("coll1")
            .createSearchIndex({
                name: "searchIndex1",
                definition: {
                    mappings: {
                        dynamic: true,
                    },
                    analyzer: "lucene.danish",
                },
            });

        const response = await integration.mcpClient().callTool({
            name: "collection-indexes",
            arguments: { database, collection: "coll1" },
        });

        const elements = getResponseElements(response.content);
        expect(elements).toHaveLength(3);
        expect(elements[0].text).toEqual(`Found 2 indexes in the collection "coll1":`);
        expect(elements[1].text).toEqual('Name "_id_", definition: {"_id":1}');
        expect(elements[2].text).toContain(`Search index name: "${name}"`);
        expect(elements[2].text).toContain('"analyzer":"lucene.danish"');
    });
});
