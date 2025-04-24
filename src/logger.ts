import fs from "fs/promises";
import { MongoLogId, MongoLogManager, MongoLogWriter } from "mongodb-log-writer";
import redact from "mongodb-redact";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LoggingMessageNotification } from "@modelcontextprotocol/sdk/types.js";

export type LogLevel = LoggingMessageNotification["params"]["level"];

abstract class LoggerBase {
    async initialize(): Promise<void> {
        return Promise.resolve();
    }

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

class DiskLogger extends LoggerBase {
    private logWriter?: MongoLogWriter;

    constructor(private logPath: string) {
        super();
    }

    async initialize(): Promise<void> {
        await fs.mkdir(this.logPath, { recursive: true });

        const manager = new MongoLogManager({
            directory: this.logPath,
            retentionDays: 30,
            onwarn: console.warn,
            onerror: console.error,
            gzip: false,
            retentionGB: 1,
        });

        await manager.cleanupOldLogFiles();

        this.logWriter = await manager.createLogWriter();
    }

    log(level: LogLevel, id: MongoLogId, context: string, message: string): void {
        message = redact(message);
        const mongoDBLevel = this.mapToMongoDBLogLevel(level);

        if (!this.logWriter) {
            throw new Error("DiskLogger is not initialized");
        }

        this.logWriter[mongoDBLevel]("MONGODB-MCP", id, context, message);
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

class McpLogger extends LoggerBase {
    constructor(private server: McpServer) {
        super();
    }

    log(level: LogLevel, _: MongoLogId, context: string, message: string): void {
        void this.server.server.sendLoggingMessage({
            level,
            data: `[${context}]: ${message}`,
        });
    }
}

class CompositeLogger extends LoggerBase {
    private loggers: LoggerBase[];

    constructor(...loggers: LoggerBase[]) {
        super();

        if (loggers.length === 0) {
            // default to ConsoleLogger
            this.loggers = [new ConsoleLogger()];
            return;
        }

        this.loggers = [...loggers];
    }

    async initialize(): Promise<void> {
        for (const logger of this.loggers) {
            await logger.initialize();
        }
    }

    setLoggers(...loggers: LoggerBase[]): void {
        this.loggers = [...loggers];
    }

    log(level: LogLevel, id: MongoLogId, context: string, message: string): void {
        for (const logger of this.loggers) {
            logger.log(level, id, context, message);
        }
    }
}

const logger = new CompositeLogger();
export default logger;

export async function initializeLogger(server: McpServer, logPath: string): Promise<void> {
    logger.setLoggers(new McpLogger(server), new DiskLogger(logPath));
    await logger.initialize();
}
