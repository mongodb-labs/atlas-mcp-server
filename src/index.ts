#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import logger from "./logger.js";
import { mongoLogId } from "mongodb-log-writer";
import { Server } from "./server.js";
import { config } from "./config.js";
import { Session } from "./session.js";
import { packageInfo } from "./package.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

try {
    const session = new Session({
        apiBaseUrl: config.apiBaseUrl,
        apiClientId: config.apiClientId,
        apiClientSecret: config.apiClientSecret,
    });
    const mcpServer = new McpServer({
        name: packageInfo.mcpServerName,
        version: packageInfo.version,
    });
    const server = new Server({
        session,
        userConfig: config,
        mcpServer,
    });

    const transport = new StdioServerTransport();

    await server.connect(transport);
} catch (error: unknown) {
    logger.emergency(mongoLogId(1_000_004), "server", `Fatal error running server: ${error as string}`);

    process.exit(1);
}
