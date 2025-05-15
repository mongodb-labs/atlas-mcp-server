import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DbOperationArgs, MongoDBToolBase } from "../mongodbTool.js";
import { ToolArgs, OperationType } from "../../tool.js";
import { z } from "zod";

export const CountArgs = {
    filter: z
        .record(z.string(), z.unknown())
        .optional()
        .describe(
            "The query filter to count documents. Matches the syntax of the filter argument of db.collection.countDocuments()"
        ),
    query: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Alternative old name for filter. Will be used in db.collection.countDocuments()"),
};

export class CountTool extends MongoDBToolBase {
    protected name = "count";
    protected description = "Gets the number of documents in a MongoDB collection";
    protected argsShape = {
        ...DbOperationArgs,
        ...CountArgs,
    };

    protected operationType: OperationType = "read";

    protected async execute({
        database,
        collection,
        query,
        filter,
    }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        const provider = await this.ensureConnected();
        // use either filter or query, since we're using countDocuments, prefer filter
        const queryFilter = filter || query;
        const count = await provider.countDocuments(database, collection, queryFilter);

        return {
            content: [
                {
                    text: `Found ${count} documents in the collection "${collection}"`,
                    type: "text",
                },
            ],
        };
    }
}
