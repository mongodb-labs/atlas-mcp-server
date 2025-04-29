import { z } from "zod";
import { ToolArgs, ToolBase, ToolCategory, ToolMetadata } from "../tool.js";
import { NodeDriverServiceProvider } from "@mongosh/service-provider-node-driver";
import { CallToolResult, ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import { ErrorCodes, MongoDBError } from "../../errors.js";
import logger, { LogId } from "../../logger.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";

export const DbOperationArgs = {
    database: z.string().describe("Database name"),
    collection: z.string().describe("Collection name"),
};

export abstract class MongoDBToolBase extends ToolBase {
    protected category: ToolCategory = "mongodb";

    protected async ensureConnected(): Promise<NodeDriverServiceProvider> {
        if (!this.session.serviceProvider && this.config.connectionString) {
            try {
                await this.connectToMongoDB(this.config.connectionString);
            } catch (error) {
                logger.error(
                    LogId.mongodbConnectFailure,
                    "mongodbTool",
                    `Failed to connect to MongoDB instance using the connection string from the config: ${error as string}`
                );
                throw new MongoDBError(ErrorCodes.MisconfiguredConnectionString, "Not connected to MongoDB.");
            }
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
        if (error instanceof MongoDBError) {
            switch (error.code) {
                case ErrorCodes.NotConnectedToMongoDB:
                    return {
                        content: [
                            {
                                type: "text",
                                text: "You need to connect to a MongoDB instance before you can access its data.",
                            },
                            {
                                type: "text",
                                text: "Please use the 'connect' or 'switch-connection' tool to connect to a MongoDB instance.",
                            },
                        ],
                        isError: true,
                    };
                case ErrorCodes.MisconfiguredConnectionString:
                    return {
                        content: [
                            {
                                type: "text",
                                text: "The configured connection string is not valid. Please check the connection string and confirm it points to a valid MongoDB instance. Alternatively, use the 'switch-connection' tool to connect to a different instance.",
                            },
                        ],
                        isError: true,
                    };
            }
        }

        return super.handleError(error, args);
    }

    protected connectToMongoDB(connectionString: string): Promise<void> {
        return this.session.connectToMongoDB(connectionString, this.config.connectOptions);
    }

    protected resolveToolMetadata(
        args: { [x: string]: any },
        extra: RequestHandlerExtra<ServerRequest, ServerNotification>
    ): ToolMetadata {
        const metadata = super.resolveToolMetadata(args, extra);

        // Add projectId to the metadata if running a MongoDB operation to an Atlas cluster
        if (this.session.connectedAtlasCluster?.projectId) {
            metadata.projectId = this.session.connectedAtlasCluster.projectId;
        }

        return metadata;
    }
}
