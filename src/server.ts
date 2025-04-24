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
import { type ServerEvent } from "./telemetry/types.js";
import { type ServerCommand } from "./telemetry/types.js";

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

            this.emitServerEvent("start", Date.now() - this.startTime);
        };
    }

    async close(): Promise<void> {
        const closeTime = Date.now();
        await this.session.close();
        await this.mcpServer.close();

        this.emitServerEvent("stop", Date.now() - closeTime);
    }


    /**
     * Emits a server event
     * @param command - The server command (e.g., "start", "stop", "register", "deregister")
     * @param additionalProperties - Additional properties specific to the event
     */
    async emitServerEvent(command: ServerCommand, commandDuration: number): Promise<void> {
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
        }
        if (command === "stop") {
            event.properties.runtime_duration_ms = Date.now() - this.startTime;
        }

        await this.telemetry.emitEvents([event]);
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
