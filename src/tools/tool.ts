import { z, type ZodRawShape, type ZodNever } from "zod";
import type { McpServer, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Session } from "../session.js";
import logger from "../logger.js";
import { mongoLogId } from "mongodb-log-writer";
import config from "../config.js";
import { Telemetry } from "../telemetry/telemetry.js";

export type ToolArgs<Args extends ZodRawShape> = z.objectOutputType<Args, ZodNever>;

export type OperationType = "metadata" | "read" | "create" | "delete" | "update" | "cluster";
export type ToolCategory = "mongodb" | "atlas";

export abstract class ToolBase {
    protected abstract name: string;

    protected abstract category: ToolCategory;

    protected abstract operationType: OperationType;

    protected abstract description: string;

    protected abstract argsShape: ZodRawShape;

    private readonly telemetry: Telemetry;

    protected abstract execute(...args: Parameters<ToolCallback<typeof this.argsShape>>): Promise<CallToolResult>;

    protected constructor(protected session: Session) {
        this.telemetry = new Telemetry(session);
    }

    public register(server: McpServer): void {
        if (!this.verifyAllowed()) {
            return;
        }

        const callback: ToolCallback<typeof this.argsShape> = async (...args) => {
            const startTime = Date.now();
            try {
                logger.debug(
                    mongoLogId(1_000_006),
                    "tool",
                    `Executing ${this.name} with args: ${JSON.stringify(args)}`
                );

                const result = await this.execute(...args);
                await this.telemetry.emitToolEvent(this.name, this.category, startTime, "success");
                return result;
            } catch (error: unknown) {
                logger.error(mongoLogId(1_000_000), "tool", `Error executing ${this.name}: ${error as string}`);

                await this.telemetry.emitToolEvent(
                    this.name,
                    this.category,
                    startTime,
                    "failure",
                    error instanceof Error ? error : new Error(String(error))
                );

                return await this.handleError(error);
            }
        };

        server.tool(this.name, this.description, this.argsShape, callback);
    }

    // Checks if a tool is allowed to run based on the config
    private verifyAllowed(): boolean {
        let errorClarification: string | undefined;
        if (config.disabledTools.includes(this.category)) {
            errorClarification = `its category, \`${this.category}\`,`;
        } else if (config.disabledTools.includes(this.operationType)) {
            errorClarification = `its operation type, \`${this.operationType}\`,`;
        } else if (config.disabledTools.includes(this.name)) {
            errorClarification = `it`;
        }

        if (errorClarification) {
            logger.debug(
                mongoLogId(1_000_010),
                "tool",
                `Prevented registration of ${this.name} because ${errorClarification} is disabled in the config`
            );

            return false;
        }

        return true;
    }

    // This method is intended to be overridden by subclasses to handle errors
    protected handleError(error: unknown): Promise<CallToolResult> | CallToolResult {
        return {
            content: [
                {
                    type: "text",
                    text: `Error running ${this.name}: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
            isError: true,
        };
    }
}
