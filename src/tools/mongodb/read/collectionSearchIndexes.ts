import { DbOperationArgs, MongoDBToolBase } from "../mongodbTool.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ToolArgs, OperationType } from "../../tool.js";
import { z } from "zod";

export const ListSearchIndexesArgs = {
    indexName: z
        .string()
        .default("")
        .optional()
        .describe(
            "The name of the index to return information about. Returns all indexes on collection if not provided."
        ),
};

export class CollectionSearchIndexesTool extends MongoDBToolBase {
    protected name = "collection-search-indexes";
    protected description = "Describe the search indexes for a collection";
    protected argsShape = {
        ...DbOperationArgs,
        ...ListSearchIndexesArgs,
    };

    protected operationType: OperationType = "read";

    protected async execute({
        database,
        collection,
        indexName,
    }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        const provider = await this.ensureConnected();
        const indexes = await provider.getSearchIndexes(database, collection, indexName);

        return {
            content: [
                {
                    text: indexName
                        ? `Found ${indexes.length} search indexes in the collection "${collection}" with name "${indexName}":`
                        : `Found ${indexes.length} search indexes in the collection "${collection}"`,
                    type: "text",
                },
                ...(indexes.map((indexDefinition) => {
                    return {
                        text: `Name "${indexDefinition.name}", definition: ${JSON.stringify(indexDefinition.latestDefinition)}`,
                        type: "text",
                    };
                }) as { text: string; type: "text" }[]),
            ],
        };
    }
}
