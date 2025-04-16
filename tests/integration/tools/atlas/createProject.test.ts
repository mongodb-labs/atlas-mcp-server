import { jestTestMCPClient, validateParameters, getResponseContent } from "../../helpers.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

describe("createProject tool", () => {
    const client = jestTestMCPClient();
    // atlas client mockk

    it("should have correct metadata", async () => {
        const { tools } = await client().listTools();
        const createProject = tools.find((tool) => tool.name === "atlas-create-project")!;
        expect(createProject).toBeDefined();
        expect(createProject.description).toBe("Create a MongoDB Atlas project");

        // Validate the parameters match the schema
        validateParameters(createProject, [
            {
                name: "projectName",
                type: "string",
                description: "Name for the new project",
                required: true,
            },
            {
                name: "organizationId",
                type: "string",
                description: "Organization ID for the new project",
                required: true,
            },
        ]);
    });

    describe("with invalid arguments", () => {
        const args = [
            {}, // Empty args
            { projectName: 123, organizationId: "org-1" }, // Invalid projectName type
            { projectName: "Test Project" }, // Missing organizationId
            { projectName: "Test Project", organizationId: 456 }, // Invalid organizationId type
            { projectName: "", organizationId: "org-1" }, // Empty projectName
        ];

        for (const arg of args) {
            it(`throws a schema error for: ${JSON.stringify(arg)}`, async () => {
                try {
                    await client().callTool({ name: "atlas-create-project", arguments: arg });
                    expect.fail("Expected an error to be thrown");
                } catch (error) {
                    expect(error).toBeInstanceOf(McpError);
                    const mcpError = error as McpError;
                    expect(mcpError.code).toEqual(-32602);
                    expect(mcpError.message).toContain("Invalid arguments for tool atlas-create-project");
                }
            });
        }
    });

    describe("with valid arguments", () => {
        it("creates a new project", async () => {
            const projectName = "Test Project";
            const organizationId = "test-org-id";

            const response = await client().callTool({
                name: "atlas-create-project",
                arguments: { projectName, organizationId },
            });

            expect(response).toBeDefined();
            const content = getResponseContent(response.content);
            expect(content).toEqual(`Project "${projectName}" created successfully.`);
        });
    });
});
