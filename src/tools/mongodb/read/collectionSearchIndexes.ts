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
export interface SearchIndex {
    name: string;
    latestDefinition: Record<string, unknown>;
}

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

        const indexes: SearchIndex[] = (await provider.getSearchIndexes(database, collection, indexName)).map(
            (doc) => ({
                name: doc.name,
                latestDefinition: doc.latestDefinition,
            })
        );

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
                        text: `\nName: "${indexDefinition.name}"\nDefinition: ${JSON.stringify(indexDefinition.latestDefinition, null, 2)}\n`,
                        type: "text",
                    };
                }) as { text: string; type: "text" }[]),
            ],
        };
    }
}
