import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DbOperationArgs, MongoDBToolBase, SearchIndexArgs } from "../mongodbTool.js";
import { OperationType, ToolArgs } from "../../tool.js";

export class UpdateSearchIndexTool extends MongoDBToolBase {
    protected name = "update-search-index";
    protected description = "Updates a search index for a collection";
    protected argsShape = {
        ...DbOperationArgs,
        name: SearchIndexArgs.name,
        analyzer: SearchIndexArgs.analyzer,
        mappings: SearchIndexArgs.mappings,
    };

    protected operationType: OperationType = "update";

    protected async execute({
        database,
        collection,
        name,
        analyzer,
        mappings,
    }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        const provider = await this.ensureConnected();
        // @ts-expect-error: Interface expects a SearchIndexDefinition. However,
        // passing analyzer/mappings at the root for the definition is necessary for the call to succeed.
        await provider.updateSearchIndex(database, collection, name, {
            analyzer,
            mappings,
        });

        return {
            content: [
                {
                    text: `Successfully updated index "${name}" on collection "${collection}" in database "${database}"`,
                    type: "text",
                },
            ],
        };
    }
}
