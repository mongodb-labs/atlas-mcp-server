import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient } from "./common/atlas/apiClient.js";
import defaultState, { State } from "./state.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { registerAtlasTools } from "./tools/atlas/tools.js";
import { registerMongoDBTools } from "./tools/mongodb/index.js";
import config from "./config.js";
import logger, { initializeLogger } from "./logger.js";
import { mongoLogId } from "mongodb-log-writer";

export class Server {
    state: State = defaultState;
    apiClient?: ApiClient;
    private server?: McpServer;

    async connect(transport: Transport) {
        this.server = new McpServer({
            name: "MongoDB Atlas",
            version: config.version,
        });

        this.server.server.registerCapabilities({ logging: {} });

        registerAtlasTools(this.server, this.state, this.apiClient);
        registerMongoDBTools(this.server, this.state);

        await this.server.connect(transport);
        await initializeLogger(this.server);
        
        logger.info(mongoLogId(1_000_004), "server", `Server started with transport ${transport.constructor.name}`);
    }

    async close(): Promise<void> {
        try {
            await this.state.serviceProvider?.close(true);
        } catch {
            // Ignore errors during service provider close
        }
        await this.server?.close();
    }
}
