import { DbOperationArgs, MongoDBToolBase, SearchIndexArgs } from "../mongodbTool.js";

export class CreateSearchIndexTool extends MongoDBToolBase {
    constructor() {
        super(...arguments);
        this.name = "create-search-index";
        this.description = "Create an Atlas Search index for a collection";
        this.argsShape = {
            ...DbOperationArgs,
            name: SearchIndexArgs.name,
            type: SearchIndexArgs.type,
            analyzer: SearchIndexArgs.analyzer,
            mappings: SearchIndexArgs.mappings,
        };
        this.operationType = "create";
    }
    async execute({ database, collection, name, type, analyzer, mappings, }) {
        const provider = await this.ensureConnected();
        const indexes = await provider.createSearchIndexes(database, collection, [
            {
                name,
                type,
                definition: {
                    analyzer,
                    mappings,
                },
            },
        ]);
        return {
            content: [
                {
                    text: `Created the index "${indexes[0]}" on collection "${collection}" in database "${database}"`,
                    type: "text",
                },
            ],
        };
    }
}