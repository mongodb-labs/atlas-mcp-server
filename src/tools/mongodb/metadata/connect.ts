import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { MongoDBToolBase } from "../mongodbTool.js";
import { ToolArgs, OperationType } from "../../tool.js";
import { MongoError as DriverError } from "mongodb";

export class ConnectTool extends MongoDBToolBase {
    protected name = "connect";
    protected description = "Connect to a MongoDB instance";
    protected argsShape = {
        options: z
            .array(
                z
                    .union([
                        z.object({
                            connectionString: z
                                .string()
                                .describe("MongoDB connection string (in the mongodb:// or mongodb+srv:// format)"),
                        }),
                        z.object({
                            clusterName: z.string().describe("MongoDB cluster name"),
                        }),
                    ])
                    .optional()
            )
            .optional()
            .describe(
                "Options for connecting to MongoDB. If not provided, the connection string from the config://connection-string resource will be used. If the user hasn't specified Atlas cluster name or a connection string explicitly and the `config://connection-string` resource is present, always invoke this with no arguments."
            ),
    };

    protected operationType: OperationType = "metadata";

    protected async execute({ options: optionsArr }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        const options = optionsArr?.[0];
        let connectionString: string;
        if (!options && !this.config.connectionString) {
            return {
                content: [
                    { type: "text", text: "No connection details provided." },
                    { type: "text", text: "Please provide either a connection string or a cluster name" },
                ],
            };
        }

        if (!options) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            connectionString = this.config.connectionString!;
        } else if ("connectionString" in options) {
            connectionString = options.connectionString;
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
                this.config.connectionString &&
                error instanceof DriverError &&
                this.config.connectionString !== connectionString
            ) {
                return {
                    content: [
                        {
                            type: "text",
                            text:
                                `Failed to connect to MongoDB at '${connectionString}' due to error: '${error.message}.` +
                                `Your config lists a different connection string: '${this.config.connectionString}' - do you want to try connecting to it instead?`,
                        },
                    ],
                };
            }

            throw error;
        }
    }
}
