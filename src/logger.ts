import fs from "fs/promises";
import { MongoLogId, MongoLogManager, MongoLogWriter } from "mongodb-log-writer";
import redact from "mongodb-redact";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LoggingMessageNotification } from "@modelcontextprotocol/sdk/types.js";

export type LogLevel = LoggingMessageNotification["params"]["level"];

abstract class LoggerBase {
    abstract log(level: LogLevel, id: MongoLogId, context: string, message: string): void;
    info(id: MongoLogId, context: string, message: string): void {
        this.log("info", id, context, message);
    }

    error(id: MongoLogId, context: string, message: string): void {
        this.log("error", id, context, message);
    }
    debug(id: MongoLogId, context: string, message: string): void {
        this.log("debug", id, context, message);
    }

    notice(id: MongoLogId, context: string, message: string): void {
        this.log("notice", id, context, message);
    }

    warning(id: MongoLogId, context: string, message: string): void {
        this.log("warning", id, context, message);
    }

    critical(id: MongoLogId, context: string, message: string): void {
        this.log("critical", id, context, message);
    }

    alert(id: MongoLogId, context: string, message: string): void {
        this.log("alert", id, context, message);
    }

    emergency(id: MongoLogId, context: string, message: string): void {
        this.log("emergency", id, context, message);
    }
}

class ConsoleLogger extends LoggerBase {
    log(level: LogLevel, id: MongoLogId, context: string, message: string): void {
        message = redact(message);
        console.error(`[${level.toUpperCase()}] ${id.__value} - ${context}: ${message}`);
    }
}

class Logger extends LoggerBase {
    constructor(
        private logWriter: MongoLogWriter,
        private server: McpServer
    ) {
        super();
    }

    log(level: LogLevel, id: MongoLogId, context: string, message: string): void {
        message = redact(message);
        const mongoDBLevel = this.mapToMongoDBLogLevel(level);
        this.logWriter[mongoDBLevel]("MONGODB-MCP", id, context, message);
        void this.server.server.sendLoggingMessage({
            level,
            data: `[${context}]: ${message}`,
        });
    }

    private mapToMongoDBLogLevel(level: LogLevel): "info" | "warn" | "error" | "debug" | "fatal" {
        switch (level) {
            case "info":
                return "info";
            case "warning":
                return "warn";
            case "error":
                return "error";
            case "notice":
            case "debug":
                return "debug";
            case "critical":
            case "alert":
            case "emergency":
                return "fatal";
            default:
                return "info";
        }
    }
}

class ProxyingLogger extends LoggerBase {
    private internalLogger: LoggerBase = new ConsoleLogger();

    log(level: LogLevel, id: MongoLogId, context: string, message: string): void {
        this.internalLogger.log(level, id, context, message);
    }
}

const logger = new ProxyingLogger();
export default logger;

export async function initializeLogger(server: McpServer, logPath: string): Promise<void> {
    await fs.mkdir(logPath, { recursive: true });

    const manager = new MongoLogManager({
        directory: logPath,
        retentionDays: 30,
        onwarn: console.warn,
        onerror: console.error,
        gzip: false,
        retentionGB: 1,
    });

    await manager.cleanupOldLogFiles();

    const logWriter = await manager.createLogWriter();
    logger["internalLogger"] = new Logger(logWriter, server);
}
