import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DbOperationArgs, MongoDBToolBase } from "../mongodbTool.js";
import { ToolArgs, OperationType } from "../../tool.js";
import { z } from "zod";

export class DropIndexTool extends MongoDBToolBase {
    protected name = "drop-index";
    protected description = "Removes an index from a collection.";
    protected argsShape = {
        ...DbOperationArgs,
        name: z.string().describe("The name of the index to drop"),
    };
    protected operationType: OperationType = "delete";

    protected async execute({ database, collection, name }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        const provider = await this.ensureConnected();
        await provider.mongoClient.db(database).collection(collection).dropIndex(name);
        await provider.dropSearchIndex(database, collection, name);

        return {
            content: [
                {
                    text: `Successfully dropped index "${name}" in  "${database}.${collection}"`,
                    type: "text",
                },
            ],
        };
    }
}
