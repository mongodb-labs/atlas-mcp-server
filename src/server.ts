import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Session } from "./session.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { AtlasTools } from "./tools/atlas/tools.js";
import { MongoDbTools } from "./tools/mongodb/tools.js";
import logger, { initializeLogger } from "./logger.js";
import { mongoLogId } from "mongodb-log-writer";
import { ObjectId } from "mongodb";
import { Telemetry } from "./telemetry/telemetry.js";
import { UserConfig } from "./config.js";
import { CallToolRequestSchema, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import assert from "assert";

export interface ServerOptions {
    session: Session;
    userConfig: UserConfig;
    mcpServer: McpServer;
}

export class Server {
    public readonly session: Session;
    private readonly mcpServer: McpServer;
    private readonly telemetry: Telemetry;
    private readonly userConfig: UserConfig;

    constructor({ session, mcpServer, userConfig }: ServerOptions) {
        this.session = session;
        this.telemetry = new Telemetry(session);
        this.mcpServer = mcpServer;
        this.userConfig = userConfig;
    }

    async connect(transport: Transport) {
        this.mcpServer.server.registerCapabilities({ logging: {} });
        this.registerTools();
        this.registerResources();

        // This is a workaround for an issue we've seen with some models, where they'll see that everything in the `arguments`
        // object is optional, and then not pass it at all. However, the MCP server expects the `arguments` object to be if
        // the tool accepts any arguments, even if they're all optional.
        //
        // see: https://github.com/modelcontextprotocol/typescript-sdk/blob/131776764536b5fdca642df51230a3746fb4ade0/src/server/mcp.ts#L705
        // Since paramsSchema here is not undefined, the server will create a non-optional z.object from it.
        const existingHandler = (
            this.mcpServer.server["_requestHandlers"] as Map<
                string,
                (request: unknown, extra: unknown) => Promise<CallToolResult>
            >
        ).get(CallToolRequestSchema.shape.method.value);

        assert(existingHandler, "No existing handler found for CallToolRequestSchema");

        this.mcpServer.server.setRequestHandler(CallToolRequestSchema, (request, extra): Promise<CallToolResult> => {
            if (!request.params.arguments) {
                request.params.arguments = {};
            }

            return existingHandler(request, extra);
        });

        await initializeLogger(this.mcpServer, this.userConfig.logPath);

        await this.mcpServer.connect(transport);

        this.mcpServer.server.oninitialized = () => {
            this.session.setAgentRunner(this.mcpServer.server.getClientVersion());
            this.session.sessionId = new ObjectId().toString();

            logger.info(
                mongoLogId(1_000_004),
                "server",
                `Server started with transport ${transport.constructor.name} and agent runner ${this.session.agentRunner?.name}`
            );
        };
    }

    async close(): Promise<void> {
        await this.session.close();
        await this.mcpServer.close();
    }

    private registerTools() {
        for (const tool of [...AtlasTools, ...MongoDbTools]) {
            new tool(this.session, this.userConfig, this.telemetry).register(this.mcpServer);
        }
    }

    private registerResources() {
        if (this.userConfig.connectionString) {
            this.mcpServer.resource(
                "connection-string",
                "config://connection-string",
                {
                    description: "Preconfigured connection string that will be used as a default in the `connect` tool",
                },
                (uri) => {
                    return {
                        contents: [
                            {
                                text: `Preconfigured connection string: ${this.userConfig.connectionString}`,
                                uri: uri.href,
                            },
                        ],
                    };
                }
            );
        }
    }
}
