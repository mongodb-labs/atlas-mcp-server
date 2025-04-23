import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "./inMemoryTransport.js";
import { Server } from "../../src/server.js";
import runner, { MongoCluster } from "mongodb-runner";
import path from "path";
import fs from "fs/promises";
import { MongoClient, ObjectId } from "mongodb";
import { toIncludeAllMembers } from "jest-extended";
import { config, UserConfig } from "../../src/config.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Session } from "../../src/session.js";

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
    mongoClient: () => MongoClient;
    connectionString: () => string;
    connectMcpClient: () => Promise<void>;
    randomDbName: () => string;
}

export function setupIntegrationTest(userConfig: UserConfig = config): IntegrationTest {
    let mongoCluster: runner.MongoCluster | undefined;
    let mongoClient: MongoClient | undefined;

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
        randomDbName = new ObjectId().toString();
    });

    afterAll(async () => {
        await mcpClient?.close();
        mcpClient = undefined;

        await mcpServer?.close();
        mcpServer = undefined;
    });

    afterEach(async () => {
        await mcpServer?.session.close();
        config.connectionString = undefined;

        await mongoClient?.close();
        mongoClient = undefined;
    });

    beforeAll(async function () {
        // Downloading Windows executables in CI takes a long time because
        // they include debug symbols...
        const tmpDir = path.join(__dirname, "..", "tmp");
        await fs.mkdir(tmpDir, { recursive: true });

        // On Windows, we may have a situation where mongod.exe is not fully released by the OS
        // before we attempt to run it again, so we add a retry.
        let dbsDir = path.join(tmpDir, "mongodb-runner", "dbs");
        for (let i = 0; i < 10; i++) {
            try {
                mongoCluster = await MongoCluster.start({
                    tmpDir: dbsDir,
                    logDir: path.join(tmpDir, "mongodb-runner", "logs"),
                    topology: "standalone",
                });

                return;
            } catch (err) {
                if (i < 5) {
                    // Just wait a little bit and retry
                    console.error(`Failed to start cluster in ${dbsDir}, attempt ${i}: ${err}`);
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                } else {
                    // If we still fail after 5 seconds, try another db dir
                    console.error(
                        `Failed to start cluster in ${dbsDir}, attempt ${i}: ${err}. Retrying with a new db dir.`
                    );
                    dbsDir = path.join(tmpDir, "mongodb-runner", `dbs${i - 5}`);
                }
            }
        }

        throw new Error("Failed to start cluster after 10 attempts");
    }, 120_000);

    afterAll(async function () {
        await mongoCluster?.close();
        mongoCluster = undefined;
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

    const getConnectionString = () => {
        if (!mongoCluster) {
            throw new Error("beforeAll() hook not ran yet");
        }

        return mongoCluster.connectionString;
    };

    return {
        mcpClient: getMcpClient,
        mcpServer: getMcpServer,
        mongoClient: () => {
            if (!mongoClient) {
                mongoClient = new MongoClient(getConnectionString());
            }
            return mongoClient;
        },
        connectionString: getConnectionString,
        connectMcpClient: async () => {
            await getMcpClient().callTool({
                name: "connect",
                arguments: { options: [{ connectionString: getConnectionString() }] },
            });
        },
        randomDbName: () => randomDbName,
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

export const dbOperationParameters: ParameterInfo[] = [
    { name: "database", type: "string", description: "Database name", required: true },
    { name: "collection", type: "string", description: "Collection name", required: true },
];

export const dbOperationInvalidArgTests = [{}, { database: 123 }, { foo: "bar", database: "test" }, { database: [] }];

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

export function validateAutoConnectBehavior(
    integration: IntegrationTest,
    name: string,
    validation: () => {
        args: { [x: string]: unknown };
        expectedResponse?: string;
        validate?: (content: unknown) => void;
    },
    beforeEachImpl?: () => Promise<void>
): void {
    describe("when not connected", () => {
        if (beforeEachImpl) {
            beforeEach(() => beforeEachImpl());
        }

        it("connects automatically if connection string is configured", async () => {
            config.connectionString = integration.connectionString();

            const validationInfo = validation();

            const response = await integration.mcpClient().callTool({
                name,
                arguments: validationInfo.args,
            });

            if (validationInfo.expectedResponse) {
                const content = getResponseContent(response.content);
                expect(content).toContain(validationInfo.expectedResponse);
            }

            if (validationInfo.validate) {
                validationInfo.validate(response.content);
            }
        });

        it("throws an error if connection string is not configured", async () => {
            const response = await integration.mcpClient().callTool({
                name,
                arguments: validation().args,
            });
            const content = getResponseContent(response.content);
            expect(content).toContain("You need to connect to a MongoDB instance before you can access its data.");
        });
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
                await integration.connectMcpClient();
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
