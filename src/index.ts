#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import logger from "./logger.js";
import { mongoLogId } from "mongodb-log-writer";
import { Server } from "./server.js";
import { config } from "./config.js";

try {
    const server = new Server(config);

    const transport = new StdioServerTransport();

    await server.connect(transport);
} catch (error: unknown) {
    logger.emergency(mongoLogId(1_000_004), "server", `Fatal error running server: ${error as string}`);

    process.exit(1);
}
