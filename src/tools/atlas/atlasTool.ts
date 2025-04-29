import { ToolBase, ToolCategory, TelemetryToolMetadata } from "../tool.js";
import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import logger, { LogId } from "../../logger.js";
import { z } from "zod";

export abstract class AtlasToolBase extends ToolBase {
    protected category: ToolCategory = "atlas";

    protected verifyAllowed(): boolean {
        if (!this.config.apiClientId || !this.config.apiClientSecret) {
            return false;
        }
        return super.verifyAllowed();
    }

    /**
     *
     * Resolves the tool metadata from the arguments passed to the tool
     *
     * @param args - The arguments passed to the tool
     * @returns The tool metadata
     */
    protected resolveTelemetryMetadata(
        ...args: Parameters<ToolCallback<typeof this.argsShape>>
    ): TelemetryToolMetadata {
        const toolMetadata: TelemetryToolMetadata = {};
        if (!args.length) {
            return toolMetadata;
        }

        // Create a typed parser for the exact shape we expect
        const argsShape = z.object(this.argsShape);
        const parsedResult = argsShape.safeParse(args[0]);

        if (!parsedResult.success) {
            logger.debug(
                LogId.telemetryMetadataError,
                "tool",
                `Error parsing tool arguments: ${parsedResult.error.message}`
            );
            return toolMetadata;
        }

        const data = parsedResult.data;

        // Extract projectId using type guard
        if ("projectId" in data && typeof data.projectId === "string" && data.projectId.trim() !== "") {
            toolMetadata.projectId = data.projectId;
        }

        // Extract orgId using type guard
        if ("orgId" in data && typeof data.orgId === "string" && data.orgId.trim() !== "") {
            toolMetadata.orgId = data.orgId;
        }
        return toolMetadata;
    }
}
