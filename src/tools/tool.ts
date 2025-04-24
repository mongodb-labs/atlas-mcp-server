import { z, type ZodRawShape, type ZodNever } from "zod";
import type { McpServer, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Session } from "../session.js";
import logger from "../logger.js";
import { mongoLogId } from "mongodb-log-writer";
import { Telemetry } from "../telemetry/telemetry.js";
import { type ToolEvent } from "../telemetry/types.js";
import { UserConfig } from "../config.js";

export type ToolArgs<Args extends ZodRawShape> = z.objectOutputType<Args, ZodNever>;

export type OperationType = "metadata" | "read" | "create" | "delete" | "update" | "cluster";
export type ToolCategory = "mongodb" | "atlas";

export abstract class ToolBase {
    protected abstract name: string;

    protected abstract category: ToolCategory;

    protected abstract operationType: OperationType;

    protected abstract description: string;

    protected abstract argsShape: ZodRawShape;

    protected abstract execute(...args: Parameters<ToolCallback<typeof this.argsShape>>): Promise<CallToolResult>;

    constructor(
        protected readonly session: Session,
        protected readonly config: UserConfig,
        protected readonly telemetry: Telemetry
    ) {}

    /**
     * Creates and emits a tool telemetry event
     * @param startTime - Start time in milliseconds
     * @param result - Whether the command succeeded or failed
     * @param error - Optional error if the command failed
     */
    private async emitToolEvent(startTime: number, result: CallToolResult): Promise<void> {
        const duration = Date.now() - startTime;
        const event: ToolEvent = {
            timestamp: new Date().toISOString(),
            source: "mdbmcp",
            properties: {
                ...this.telemetry.getCommonProperties(),
                command: this.name,
                category: this.category,
                component: "tool",
                duration_ms: duration,
                result: result.isError ? "failure" : "success",
            },
        };
        await this.telemetry.emitEvents([event]);
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
                await this.emitToolEvent(startTime, result);
                return result;
            } catch (error: unknown) {
                logger.error(mongoLogId(1_000_000), "tool", `Error executing ${this.name}: ${error as string}`);
                const toolResult = await this.handleError(error, args[0] as ToolArgs<typeof this.argsShape>);
                await this.emitToolEvent(startTime, toolResult).catch(() => {});
                return toolResult;
            }
        };

        server.tool(this.name, this.description, this.argsShape, callback);
    }

    // Checks if a tool is allowed to run based on the config
    protected verifyAllowed(): boolean {
        let errorClarification: string | undefined;
        if (this.config.disabledTools.includes(this.category)) {
            errorClarification = `its category, \`${this.category}\`,`;
        } else if (this.config.disabledTools.includes(this.operationType)) {
            errorClarification = `its operation type, \`${this.operationType}\`,`;
        } else if (this.config.disabledTools.includes(this.name)) {
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
    protected handleError(
        error: unknown,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        args: ToolArgs<typeof this.argsShape>
    ): Promise<CallToolResult> | CallToolResult {
        return {
            content: [
                {
                    type: "text",
                    text: `Error running ${this.name}: ${error instanceof Error ? error.message : String(error)}`,
                    isError: true,
                },
            ],
        };
    }
}
