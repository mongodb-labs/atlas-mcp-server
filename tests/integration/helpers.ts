import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "./inMemoryTransport.js";
import { Server } from "../../src/server.js";
import runner, { MongoCluster } from "mongodb-runner";
import path from "path";
import fs from "fs/promises";
import { Session } from "../../src/session.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MongoClient } from "mongodb";
import { toIncludeAllMembers } from "jest-extended";

interface ParameterInfo {
    name: string;
    type: string;
    description: string;
    required: boolean;
}

type ToolInfo = Awaited<ReturnType<Client["listTools"]>>["tools"][number];

export function setupIntegrationTest(): {
    mcpClient: () => Client;
    mongoClient: () => MongoClient;
    connectionString: () => string;
    connectMcpClient: () => Promise<void>;
} {
    let mongoCluster: runner.MongoCluster | undefined;
    let mongoClient: MongoClient | undefined;

    let mcpClient: Client | undefined;
    let mcpServer: Server | undefined;

    beforeEach(async () => {
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

        mcpServer = new Server({
            mcpServer: new McpServer({
                name: "test-server",
                version: "1.2.3",
            }),
            session: new Session(),
        });
        await mcpServer.connect(serverTransport);
        await mcpClient.connect(clientTransport);
    });

    afterEach(async () => {
        await mcpClient?.close();
        mcpClient = undefined;

        await mcpServer?.close();
        mcpServer = undefined;

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

    const getConnectionString = () => {
        if (!mongoCluster) {
            throw new Error("beforeAll() hook not ran yet");
        }

        return mongoCluster.connectionString;
    };

    return {
        mcpClient: getMcpClient,
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
                arguments: { connectionStringOrClusterName: getConnectionString() },
            });
        },
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

export function validateParameters(tool: ToolInfo, parameters: ParameterInfo[]): void {
    const toolParameters = getParameters(tool);
    expect(toolParameters).toHaveLength(parameters.length);
    expect(toolParameters).toIncludeAllMembers(parameters);
}
