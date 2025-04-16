#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import logger from "./logger.js";
import { mongoLogId } from "mongodb-log-writer";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import config from "./config.js";
import { Session } from "./session.js";
import { Server } from "./server.js";

const POLL_INTERVAL_MS = 2000; // 2 seconds
const MAX_RETRIES = 15; // 30 seconds total
const CLIENT_VERSION_TIMEOUT = new Error('Timeout waiting for client version');

async function pollClientVersion(mcpServer: McpServer): Promise<void> {
    let attempts = 0;
    
    return new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
            try {
                const client = await mcpServer.server.getClientVersion();
                if (client?.name && client?.version) {
                    clearInterval(interval);
                    logger.info(
                        mongoLogId(1_000_003),
                        "server",
                        `Connected to client: ${client.name} v${client.version}`
                    );
                    resolve();
                } else if (++attempts >= MAX_RETRIES) {
                    clearInterval(interval);
                    reject(CLIENT_VERSION_TIMEOUT);
                }
            } catch (error: unknown) {
                clearInterval(interval);
                reject(error);
            }
        }, POLL_INTERVAL_MS);
    });
}

async function main() {
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
    try {
        await pollClientVersion(mcpServer);
    } catch (error) {
        logger.warning(
            mongoLogId(1_000_006),
            "server",
            "Client version information unavailable after 30 seconds"
        );
        
    }
}

// Start the server
try {
    await main();
} catch (error: unknown) {
    logger.emergency(
        mongoLogId(1_000_004),
        "server",
        `Fatal error running server: ${error as string}`
    );
    process.exit(1);
}
