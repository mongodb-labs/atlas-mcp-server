import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DbOperationArgs, MongoDBToolBase } from "../mongodbTool.js";
import { ToolArgs, OperationType } from "../../tool.js";

export class DropSearchIndexTool extends MongoDBToolBase {
    protected name = "drop-search-index";
    protected description = "Deletes a text or vector search index from the database.";
    protected argsShape = {
        ...DbOperationArgs,
        indexName: z.string().describe("The name of the search or vector index to delete"),
    };
    protected operationType: OperationType = "delete";

    protected async execute({
        database,
        collection,
        indexName,
    }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        const provider = await this.ensureConnected();
        await provider.dropSearchIndex(database, collection, indexName);

        return {
            content: [
                {
                    text: `"Successfully dropped index "${indexName}" from database "${database}"`,
                    type: "text",
                },
            ],
        };
    }
}
