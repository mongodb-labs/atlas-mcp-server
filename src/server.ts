import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Session } from "./session.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { AtlasTools } from "./tools/atlas/tools.js";
import { MongoDbTools } from "./tools/mongodb/tools.js";
import logger, { initializeLogger } from "./logger.js";
import { mongoLogId } from "mongodb-log-writer";
import { UserConfig } from "./config.js";
import version from "./version.js";

export class Server {
    public readonly session: Session;
    private readonly mcpServer: McpServer = new McpServer({
        name: "MongoDB Atlas",
        version,
    });

    constructor(private readonly config: UserConfig) {
        this.session = new Session({
            apiBaseUrl: config.apiBaseUrl,
            apiClientId: config.apiClientId,
            apiClientSecret: config.apiClientSecret,
        });
    }

    async connect(transport: Transport) {
        this.mcpServer.server.registerCapabilities({ logging: {} });

        this.registerTools();
        this.registerResources();

        await initializeLogger(this.mcpServer, this.config.logPath);

        await this.mcpServer.connect(transport);

        logger.info(mongoLogId(1_000_004), "server", `Server started with transport ${transport.constructor.name}`);
    }

    async close(): Promise<void> {
        await this.session.close();
        await this.mcpServer.close();
    }

    private registerTools() {
        for (const tool of [...AtlasTools, ...MongoDbTools]) {
            new tool(this.session, this.config).register(this.mcpServer);
        }
    }

    private registerResources() {
        if (this.config.connectionString) {
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
                                text: `Preconfigured connection string: ${this.config.connectionString}`,
                                uri: uri.href,
                            },
                        ],
                    };
                }
            );
        }
    }
}
