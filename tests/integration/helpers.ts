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
}

type ToolInfo = Awaited<ReturnType<Client["listTools"]>>["tools"][number];

export function jestTestMCPClient(): () => Client {
    let client: Client | undefined;
    let server: Server | undefined;

    beforeEach(async () => {
        const clientTransport = new InMemoryTransport();
        const serverTransport = new InMemoryTransport();

        await serverTransport.start();
        await clientTransport.start();

        clientTransport.output.pipeTo(serverTransport.input);
        serverTransport.output.pipeTo(clientTransport.input);

        client = new Client(
            {
                name: "test-client",
                version: "1.2.3",
            },
            {
                capabilities: {},
            }
        );

        server = new Server({
            mcpServer: new McpServer({
                name: "test-server",
                version: "1.2.3",
            }),
            session: new Session(),
        });
        await server.connect(serverTransport);
        await client.connect(clientTransport);
    });

    afterEach(async () => {
        await client?.close();
        client = undefined;

        await server?.close();
        server = undefined;
    });

    return () => {
        if (!client) {
            throw new Error("beforeEach() hook not ran yet");
        }

        return client;
    };
}

export function jestTestCluster(): () => { connectionString: string; getClient: () => MongoClient } {
    let cluster: runner.MongoCluster | undefined;
    let client: MongoClient | undefined;

    afterEach(async () => {
        await client?.close();
        client = undefined;
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
                cluster = await MongoCluster.start({
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
        await cluster?.close();
        cluster = undefined;
    });

    return () => {
        if (!cluster) {
            throw new Error("beforeAll() hook not ran yet");
        }

        return {
            connectionString: cluster.connectionString,
            getClient: () => {
                if (!client) {
                    client = new MongoClient(cluster!.connectionString);
                }

                return client;
            },
        };
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

export async function connect(client: Client, cluster: runner.MongoCluster): Promise<void> {
    await client.callTool({
        name: "connect",
        arguments: { connectionStringOrClusterName: cluster.connectionString },
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
            };
        });
}

export function validateParameters(tool: ToolInfo, parameters: ParameterInfo[]): void {
    const toolParameters = getParameters(tool);
    expect(toolParameters).toHaveLength(parameters.length);
    expect(toolParameters).toIncludeAllMembers(parameters);
}
