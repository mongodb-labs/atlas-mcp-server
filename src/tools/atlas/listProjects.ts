import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { AtlasToolBase } from "./atlasTool.js";
import { OperationType } from "../tool.js";
import { z } from "zod";
import { ToolArgs } from "../tool.js";

export class ListProjectsTool extends AtlasToolBase {
    protected name = "atlas-list-projects";
    protected description = "List MongoDB Atlas projects";
    protected operationType: OperationType = "read";
    protected argsShape = {
        orgId: z.string().describe("Atlas organization ID to filter projects").optional(),
    };

    protected async execute({ orgId }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        this.session.ensureAuthenticated();

        const data = orgId
            ? await this.session.apiClient.listOrganizationProjects({
                  params: {
                      path: {
                          orgId,
                      },
                  },
              })
            : await this.session.apiClient.listProjects();

        if (!data?.results?.length) {
            throw new Error("No projects found in your MongoDB Atlas account.");
        }

        // Format projects as a table
        const rows = data.results
            .map((project) => {
                const createdAt = project.created ? new Date(project.created).toLocaleString() : "N/A";
                return `${project.name} | ${project.id} | ${createdAt}`;
            })
            .join("\n");
        const formattedProjects = `Project Name | Project ID | Created At
----------------| ----------------| ----------------
${rows}`;
        return {
            content: [{ type: "text", text: formattedProjects }],
        };
    }
}
