import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DbOperationArgs, DbOperationType, MongoDBToolBase } from "../mongodbTool.js";
import { ToolArgs } from "../../tool.js";

export class CreateCollectionTool extends MongoDBToolBase {
    protected name = "create-collection";
    protected description =
        "Creates a new collection in a database. If the database doesn't exist, it will be created automatically.";
    protected argsShape = DbOperationArgs;

    protected operationType: DbOperationType = "create";

    protected async execute({ collection, database }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        const provider = await this.ensureConnected();
        await provider.createCollection(database, collection);

        return {
            content: [
                {
                    type: "text",
                    text: `Collection "${collection}" created in database "${database}".`,
                },
            ],
        };
    }
}
