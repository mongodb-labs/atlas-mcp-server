import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { AtlasToolBase } from "./atlasTool.js";
import { ToolArgs, OperationType } from "../tool.js";
import { Group } from "../../common/atlas/openapi.js";

export class CreateProjectTool extends AtlasToolBase {
    protected name = "atlas-create-project";
    protected description = "Create a MongoDB Atlas project";
    protected operationType: OperationType = "create";
    protected argsShape = {
        projectName: z.string().describe("Name for the new project"),
        organizationId: z.string().describe("Organization ID for the new project"),
    };

    protected async execute({
      projectName,
      organizationId,
    }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        this.session.ensureAuthenticated();

        const input = {
            name: projectName,
            orgId: organizationId,
        } as Group;

        await this.session.apiClient.createProject({
            body: input,
        });

        return {
            content: [{ type: "text", text: `Project "${projectName}" created successfully.` }],
        };
    }
}
