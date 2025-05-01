import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DbOperationArgs, MongoDBToolBase } from "../mongodbTool.js";
import { ToolArgs, OperationType } from "../../tool.js";
import { z } from "zod";
import { MongoServerError } from "mongodb";

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
        try {
            await provider.dropSearchIndex(database, collection, name);
        } catch (error) {
            if (error instanceof MongoServerError && error.codeName === "SearchNotEnabled") {
                // If search is not enabled (e.g. due to connecting to a non-Atlas cluster), we can ignore the error
                // and return an empty array for search indexes.
            } else {
                throw error;
            }
        }

        return {
            content: [
                {
                    text: `Successfully dropped index "${name}" in  "${database}.${collection}"`,
                    type: "text",
                },
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
                        text: `Cannot drop index "${args.name}" because the namespace "${args.database}.${args.collection}" does not exist.`,
                        type: "text",
                    },
                ],
            };
        }

        return super.handleError(error, args);
    }
}
