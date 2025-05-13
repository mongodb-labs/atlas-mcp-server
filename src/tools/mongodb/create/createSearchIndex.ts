import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DbOperationArgs, MongoDBToolBase, SearchIndexArgs } from "../mongodbTool.js";
import { OperationType, ToolArgs } from "../../tool.js";

export class CreateSearchIndexTool extends MongoDBToolBase {
    protected name = "create-search-index";
    protected description = "Create an Atlas Search index for a collection";
    protected argsShape = {
        ...DbOperationArgs,
        name: SearchIndexArgs.name,
        type: SearchIndexArgs.type,
        analyzer: SearchIndexArgs.analyzer,
        mappings: SearchIndexArgs.mappings,
    };

    protected operationType: OperationType = "create";

    protected async execute({
        database,
        collection,
        name,
        type,
        analyzer,
        mappings,
    }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
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
