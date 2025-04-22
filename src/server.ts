import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Session } from "./session.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { AtlasTools } from "./tools/atlas/tools.js";
import { MongoDbTools } from "./tools/mongodb/tools.js";
import logger, { initializeLogger } from "./logger.js";
import { mongoLogId } from "mongodb-log-writer";
import config from "./config.js";

export class Server {
    public readonly session: Session;
    private readonly mcpServer: McpServer;

    constructor({ mcpServer, session }: { mcpServer: McpServer; session: Session }) {
        this.mcpServer = mcpServer;
        this.session = session;
    }

    async connect(transport: Transport) {
        this.mcpServer.server.registerCapabilities({ logging: {} });

        this.registerTools();
        this.registerResources();

        await initializeLogger(this.mcpServer);

        await this.mcpServer.connect(transport);

        logger.info(mongoLogId(1_000_004), "server", `Server started with transport ${transport.constructor.name}`);
    }

    async close(): Promise<void> {
        await this.session.close();
        await this.mcpServer.close();
    }

    private registerTools() {
        for (const tool of [...AtlasTools, ...MongoDbTools]) {
            new tool(this.session).register(this.mcpServer);
        }
    }

    private registerResources() {
        if (config.connectionString) {
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
                                text: `Preconfigured connection string: ${config.connectionString}`,
                                uri: uri.href,
                            },
                        ],
                    };
                }
            );
        }
    }
}
