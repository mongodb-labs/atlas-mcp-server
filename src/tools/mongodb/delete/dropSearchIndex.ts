import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { SearchIndexOperationArgs, MongoDBToolBase } from "../mongodbTool.js";
import { ToolArgs, OperationType } from "../../tool.js";

export class DropSearchIndexTool extends MongoDBToolBase {
    protected name = "drop-search-index";
    protected description = "Deletes a text or vector search index from the database.";
    protected argsShape = {
        ...SearchIndexOperationArgs,
    };
    protected operationType: OperationType = "delete";

    protected async execute({
        database,
        collection,
        searchIndexName,
    }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        const provider = await this.ensureConnected();
        await provider.dropSearchIndex(database, collection, searchIndexName);
        return {
            content: [
                {
                    text: `Successfully dropped index ${searchIndexName} from database ${database}`,
                    type: "text",
                },
            ],
        };
    }
}
