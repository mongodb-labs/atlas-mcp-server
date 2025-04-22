import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { MongoDBToolBase } from "../mongodbTool.js";
import { ToolArgs, OperationType } from "../../tool.js";
import config from "../../../config.js";
import { MongoError as DriverError } from "mongodb";

export class ConnectTool extends MongoDBToolBase {
    protected name = "connect";
    protected description = "Connect to a MongoDB instance";
    protected argsShape = {
        connectionStringOrClusterName: z
            .string()
            .optional()
            .describe("MongoDB connection string (in the mongodb:// or mongodb+srv:// format) or cluster name"),
    };

    protected operationType: OperationType = "metadata";

    protected async execute({
        connectionStringOrClusterName,
    }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        connectionStringOrClusterName ??= config.connectionString;
        if (!connectionStringOrClusterName) {
            return {
                content: [
                    { type: "text", text: "No connection details provided." },
                    { type: "text", text: "Please provide either a connection string or a cluster name" },
                    {
                        type: "text",
                        text: "Alternatively, you can use the default deployment at mongodb://localhost:27017",
                    },
                ],
            };
        }

        let connectionString: string;

        if (
            connectionStringOrClusterName.startsWith("mongodb://") ||
            connectionStringOrClusterName.startsWith("mongodb+srv://")
        ) {
            connectionString = connectionStringOrClusterName;
        } else {
            // TODO: https://github.com/mongodb-js/mongodb-mcp-server/issues/19
            // We don't support connecting via cluster name since we'd need to obtain the user credentials
            // and fill in the connection string.
            return {
                content: [
                    {
                        type: "text",
                        text: `Connecting via cluster name not supported yet. Please provide a connection string.`,
                    },
                ],
            };
        }

        try {
            await this.connectToMongoDB(connectionString);
            return {
                content: [{ type: "text", text: `Successfully connected to ${connectionString}.` }],
            };
        } catch (error) {
            // Sometimes the model will supply an incorrect connection string. If the user has configured
            // a different one as environment variable or a cli argument, suggest using that one instead.
            if (
                config.connectionString &&
                error instanceof DriverError &&
                config.connectionString !== connectionString
            ) {
                return {
                    content: [
                        {
                            type: "text",
                            text:
                                `Failed to connect to MongoDB at '${connectionString}' due to error: '${error.message}.` +
                                `Your config lists a different connection string: '${config.connectionString}' - do you want to try connecting to it instead?`,
                        },
                    ],
                };
            }

            throw error;
        }
    }
}
