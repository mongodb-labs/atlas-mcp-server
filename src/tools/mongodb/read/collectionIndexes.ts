import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DbOperationArgs, MongoDBToolBase } from "../mongodbTool.js";
import { ToolArgs, OperationType } from "../../tool.js";
import { Document } from "bson";
import { MongoServerError } from "mongodb";

export class CollectionIndexesTool extends MongoDBToolBase {
    protected name = "collection-indexes";
    protected description = "Describe the indexes for a collection";
    protected argsShape = DbOperationArgs;
    protected operationType: OperationType = "read";

    protected async execute({ database, collection }: ToolArgs<typeof DbOperationArgs>): Promise<CallToolResult> {
        const provider = await this.ensureConnected();
        const indexes = await provider.getIndexes(database, collection);

        let searchIndexes: Document[];
        try {
            searchIndexes = await provider.getSearchIndexes(database, collection);
        } catch (error) {
            if (error instanceof MongoServerError && error.codeName === "SearchNotEnabled") {
                // If search is not enabled (e.g. due to connecting to a non-Atlas cluster), we can ignore the error
                // and return an empty array for search indexes.
                searchIndexes = [];
            } else {
                throw error;
            }
        }

        return {
            content: [
                {
                    text: `Found ${indexes.length + searchIndexes.length} indexes in the collection "${collection}":`,
                    type: "text",
                },
                ...indexes.map((indexDefinition) => {
                    return {
                        text: `Name "${indexDefinition.name}", definition: ${JSON.stringify(indexDefinition.key)}`,
                        type: "text",
                    } as const;
                }),
                ...searchIndexes.map((indexDefinition) => {
                    return {
                        text: `Search index name: "${indexDefinition.name}", status: ${indexDefinition.status}, definition: ${JSON.stringify(indexDefinition.latestDefinition)}`,
                        type: "text",
                    } as const;
                }),
            ],
        };
    }

    protected handleError(
        error: unknown,
        args: ToolArgs<typeof this.argsShape>
    ): Promise<CallToolResult> | CallToolResult {
        if (error instanceof Error && "codeName" in error && error.codeName === "NamespaceNotFound") {
            return {
                content: [
                    {
                        text: `The indexes for "${args.database}.${args.collection}" cannot be determined because the collection does not exist.`,
                        type: "text",
                    },
                ],
            };
        }

        return super.handleError(error, args);
    }
}
