import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Session } from "./session.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { AtlasTools } from "./tools/atlas/tools.js";
import { MongoDbTools } from "./tools/mongodb/tools.js";
import logger, { initializeLogger, LogId } from "./logger.js";
import { ObjectId } from "mongodb";
import { Telemetry } from "./telemetry/telemetry.js";
import { UserConfig } from "./config.js";
import { type ServerEvent } from "./telemetry/types.js";
import { type ServerCommand } from "./telemetry/types.js";
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
    public readonly userConfig: UserConfig;
    private readonly startTime: number;

    constructor({ session, mcpServer, userConfig }: ServerOptions) {
        this.startTime = Date.now();
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
                LogId.serverInitialized,
                "server",
                `Server started with transport ${transport.constructor.name} and agent runner ${this.session.agentRunner?.name}`
            );

            this.emitServerEvent("start", Date.now() - this.startTime);
        };

        this.mcpServer.server.onclose = () => {
            const closeTime = Date.now();
            this.emitServerEvent("stop", Date.now() - closeTime);
        };

        this.mcpServer.server.onerror = (error: Error) => {
            const closeTime = Date.now();
            this.emitServerEvent("stop", Date.now() - closeTime, error);
        };
    }

    async close(): Promise<void> {
        await this.session.close();
        await this.mcpServer.close();
    }

    /**
     * Emits a server event
     * @param command - The server command (e.g., "start", "stop", "register", "deregister")
     * @param additionalProperties - Additional properties specific to the event
     */
    emitServerEvent(command: ServerCommand, commandDuration: number, error?: Error) {
        const event: ServerEvent = {
            timestamp: new Date().toISOString(),
            source: "mdbmcp",
            properties: {
                ...this.telemetry.getCommonProperties(),
                result: "success",
                duration_ms: commandDuration,
                component: "server",
                category: "other",
                command: command,
            },
        };

        if (command === "start") {
            event.properties.startup_time_ms = commandDuration;
            event.properties.read_only_mode = this.userConfig.readOnly || false;
            event.properties.disallowed_tools = this.userConfig.disabledTools || [];
        }
        if (command === "stop") {
            event.properties.runtime_duration_ms = Date.now() - this.startTime;
            if (error) {
                event.properties.result = "failure";
                event.properties.reason = error.message;
            }
        }

        this.telemetry.emitEvents([event]).catch(() => {});
    }

    private registerTools() {
        for (const tool of [...AtlasTools, ...MongoDbTools]) {
            new tool(this.session, this.userConfig, this.telemetry).register(this.mcpServer);
        }
    }

    private registerResources() {
        this.mcpServer.resource(
            "config",
            "config://config",
            {
                description:
                    "Server configuration, supplied by the user either as environment variables or as startup arguments",
            },
            (uri) => {
                const result = {
                    telemetry: this.userConfig.telemetry,
                    logPath: this.userConfig.logPath,
                    connectionString: this.userConfig.connectionString
                        ? "set; no explicit connect needed, use switch-connection tool to connect to a different connection if necessary"
                        : "not set; before using any mongodb tool, you need to call the connect tool with a connection string",
                    connectOptions: this.userConfig.connectOptions,
                };
                return {
                    contents: [
                        {
                            text: JSON.stringify(result),
                            uri: uri.href,
                        },
                    ],
                };
            }
        );
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
