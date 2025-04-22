#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import logger from "./logger.js";
import { mongoLogId } from "mongodb-log-writer";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import config from "./config.js";
import { Session } from "./session.js";
import { Server } from "./server.js";

try {
    const session = new Session();
    const mcpServer = new McpServer({
        name: "MongoDB Atlas",
        version: config.version,
    });

    const server = new Server({
        mcpServer,
        session,
    });

    const transport = new StdioServerTransport();

    await server.connect(transport);
} catch (error: unknown) {
    logger.emergency(mongoLogId(1_000_004), "server", `Fatal error running server: ${error as string}`);
    process.exit(1);
}
