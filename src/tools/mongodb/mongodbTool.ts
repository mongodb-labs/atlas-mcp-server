import { z } from "zod";
import { ToolArgs, ToolBase, ToolCategory } from "../tool.js";
import { NodeDriverServiceProvider } from "@mongosh/service-provider-node-driver";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ErrorCodes, MongoDBError } from "../../errors.js";

export const DbOperationArgs = {
    database: z.string().describe("Database name"),
    collection: z.string().describe("Collection name"),
};

export abstract class MongoDBToolBase extends ToolBase {
    protected category: ToolCategory = "mongodb";

    protected async ensureConnected(): Promise<NodeDriverServiceProvider> {
        if (!this.session.serviceProvider && this.config.connectionString) {
            await this.connectToMongoDB(this.config.connectionString);
        }

        if (!this.session.serviceProvider) {
            throw new MongoDBError(ErrorCodes.NotConnectedToMongoDB, "Not connected to MongoDB");
        }

        return this.session.serviceProvider;
    }

    protected handleError(
        error: unknown,
        args: ToolArgs<typeof this.argsShape>
    ): Promise<CallToolResult> | CallToolResult {
        if (error instanceof MongoDBError && error.code === ErrorCodes.NotConnectedToMongoDB) {
            return {
                content: [
                    {
                        type: "text",
                        text: "You need to connect to a MongoDB instance before you can access its data.",
                    },
                    {
                        type: "text",
                        text: "Please use the 'connect' tool to connect to a MongoDB instance.",
                    },
                ],
                isError: true,
            };
        }

        return super.handleError(error, args);
    }

    protected async connectToMongoDB(connectionString: string): Promise<void> {
        const provider = await NodeDriverServiceProvider.connect(connectionString, {
            productDocsLink: "https://docs.mongodb.com/todo-mcp",
            productName: "MongoDB MCP",
            readConcern: {
                level: this.config.connectOptions.readConcern,
            },
            readPreference: this.config.connectOptions.readPreference,
            writeConcern: {
                w: this.config.connectOptions.writeConcern,
            },
            timeoutMS: this.config.connectOptions.timeoutMS,
        });

        this.session.serviceProvider = provider;
    }
}
