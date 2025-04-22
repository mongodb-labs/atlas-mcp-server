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
        projectName: z.string().optional().describe("Name for the new project"),
        organizationId: z.string().optional().describe("Organization ID for the new project"),
    };

    protected async execute({ projectName, organizationId }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        this.session.ensureAuthenticated();
        let assumedOrg = false;

        if (!projectName) {
            projectName = "Atlas Project";
        }

        if (!organizationId) {
            try {
                const organizations = await this.session.apiClient.listOrganizations();
                if (!organizations?.results?.length) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: "No organizations were found in your MongoDB Atlas account. Please create an organization first.",
                            },
                        ],
                        isError: true,
                    };
                }
                organizationId = organizations.results[0].id;
                assumedOrg = true;
            } catch {
                return {
                    content: [
                        {
                            type: "text",
                            text: "Could not search for organizations in your MongoDB Atlas account, please provide an organization ID or create one first.",
                        },
                    ],
                    isError: true,
                };
            }
        }

        const input = {
            name: projectName,
            orgId: organizationId,
        } as Group;

        await this.session.apiClient.createProject({
            body: input,
        });

        return {
            content: [
                {
                    type: "text",
                    text: `Project "${projectName}" created successfully${assumedOrg ? ` (using organizationId ${organizationId}).` : ""}.`,
                },
            ],
        };
    }
}
