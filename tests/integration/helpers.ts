import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "./inMemoryTransport.js";
import { Server } from "../../src/server.js";
import { ObjectId } from "mongodb";
import { config, UserConfig } from "../../src/config.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Session } from "../../src/session.js";
import { toIncludeAllMembers } from "jest-extended";

interface ParameterInfo {
    name: string;
    type: string;
    description: string;
    required: boolean;
}

type ToolInfo = Awaited<ReturnType<Client["listTools"]>>["tools"][number];

export interface IntegrationTest {
    mcpClient: () => Client;
    mcpServer: () => Server;
}

export function setupIntegrationTest(userConfig: UserConfig = config): IntegrationTest {
    let mcpClient: Client | undefined;
    let mcpServer: Server | undefined;

    let randomDbName: string;

    beforeAll(async () => {
        const clientTransport = new InMemoryTransport();
        const serverTransport = new InMemoryTransport();

        await serverTransport.start();
        await clientTransport.start();

        clientTransport.output.pipeTo(serverTransport.input);
        serverTransport.output.pipeTo(clientTransport.input);

        mcpClient = new Client(
            {
                name: "test-client",
                version: "1.2.3",
            },
            {
                capabilities: {},
            }
        );

        const session = new Session({
            apiBaseUrl: userConfig.apiBaseUrl,
            apiClientId: userConfig.apiClientId,
            apiClientSecret: userConfig.apiClientSecret,
        });

        mcpServer = new Server({
            session,
            userConfig,
            mcpServer: new McpServer({
                name: "test-server",
                version: "1.2.3",
            }),
        });
        await mcpServer.connect(serverTransport);
        await mcpClient.connect(clientTransport);
    });

    beforeEach(async () => {
        config.telemetry = "disabled";
        randomDbName = new ObjectId().toString();
    });

    afterAll(async () => {
        await mcpClient?.close();
        mcpClient = undefined;

        await mcpServer?.close();
        mcpServer = undefined;
    });

    const getMcpClient = () => {
        if (!mcpClient) {
            throw new Error("beforeEach() hook not ran yet");
        }

        return mcpClient;
    };

    const getMcpServer = () => {
        if (!mcpServer) {
            throw new Error("beforeEach() hook not ran yet");
        }

        return mcpServer;
    };

    return {
        mcpClient: getMcpClient,
        mcpServer: getMcpServer,
    };
}

export function getResponseContent(content: unknown): string {
    return getResponseElements(content)
        .map((item) => item.text)
        .join("\n");
}

export function getResponseElements(content: unknown): { type: string; text: string }[] {
    expect(Array.isArray(content)).toBe(true);

    const response = content as { type: string; text: string }[];
    for (const item of response) {
        expect(item).toHaveProperty("type");
        expect(item).toHaveProperty("text");
        expect(item.type).toBe("text");
    }

    return response;
}

export async function connect(client: Client, connectionString: string): Promise<void> {
    await client.callTool({
        name: "connect",
        arguments: { connectionStringOrClusterName: connectionString },
    });
}

export function getParameters(tool: ToolInfo): ParameterInfo[] {
    expect(tool.inputSchema.type).toBe("object");
    expect(tool.inputSchema.properties).toBeDefined();

    return Object.entries(tool.inputSchema.properties!)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, value]) => {
            expect(value).toHaveProperty("type");
            expect(value).toHaveProperty("description");

            const typedValue = value as { type: string; description: string };
            expect(typeof typedValue.type).toBe("string");
            expect(typeof typedValue.description).toBe("string");
            return {
                name: key,
                type: typedValue.type,
                description: typedValue.description,
                required: (tool.inputSchema.required as string[])?.includes(key) ?? false,
            };
        });
}

export const databaseParameters: ParameterInfo[] = [
    { name: "database", type: "string", description: "Database name", required: true },
];

export const databaseCollectionParameters: ParameterInfo[] = [
    ...databaseParameters,
    { name: "collection", type: "string", description: "Collection name", required: true },
];

export const databaseCollectionInvalidArgs = [
    {},
    { database: "test" },
    { collection: "foo" },
    { database: 123, collection: "foo" },
    { database: "test", collection: "foo", extra: "bar" },
    { database: "test", collection: 123 },
    { database: [], collection: "foo" },
    { database: "test", collection: [] },
];

export const databaseInvalidArgs = [{}, { database: 123 }, { database: [] }, { database: "test", extra: "bar" }];

export function validateToolMetadata(
    integration: IntegrationTest,
    name: string,
    description: string,
    parameters: ParameterInfo[]
): void {
    it("should have correct metadata", async () => {
        const { tools } = await integration.mcpClient().listTools();
        const tool = tools.find((tool) => tool.name === name)!;
        expect(tool).toBeDefined();
        expect(tool.description).toBe(description);

        const toolParameters = getParameters(tool);
        expect(toolParameters).toHaveLength(parameters.length);
        expect(toolParameters).toIncludeAllMembers(parameters);
    });
}

export function validateThrowsForInvalidArguments(
    integration: IntegrationTest,
    name: string,
    args: { [x: string]: unknown }[]
): void {
    describe("with invalid arguments", () => {
        for (const arg of args) {
            it(`throws a schema error for: ${JSON.stringify(arg)}`, async () => {
                try {
                    await integration.mcpClient().callTool({ name, arguments: arg });
                    expect.fail("Expected an error to be thrown");
                } catch (error) {
                    expect(error).toBeInstanceOf(McpError);
                    const mcpError = error as McpError;
                    expect(mcpError.code).toEqual(-32602);
                    expect(mcpError.message).toContain(`Invalid arguments for tool ${name}`);
                }
            });
        }
    });
}
