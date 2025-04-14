import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "./inMemoryTransport.js";
import { Server } from "../../src/server.js";
import runner, { MongoCluster } from "mongodb-runner";
import path from "path";
import fs from "fs/promises";
import { Session } from "../../src/session.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

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

export function jestTestCluster(): () => runner.MongoCluster {
    let cluster: runner.MongoCluster | undefined;

    function runMongodb() {}

    beforeAll(async function () {
        // Downloading Windows executables in CI takes a long time because
        // they include debug symbols...
        const tmpDir = path.join(__dirname, "..", "tmp");
        await fs.mkdir(tmpDir, { recursive: true });

        // On Windows, we may have a situation where mongod.exe is not fully released by the OS
        // before we attempt to run it again, so we add a retry.
        const dbsDir = path.join(tmpDir, "mongodb-runner", `dbs`);
        for (let i = 0; i < 10; i++) {
            try {
                cluster = await MongoCluster.start({
                    tmpDir: dbsDir,
                    logDir: path.join(tmpDir, "mongodb-runner", "logs"),
                    topology: "standalone",
                });

                return;
            } catch (err) {
                console.error(`Failed to start cluster in ${dbsDir}, attempt ${i}: ${err}`);
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }
    }, 120_000);

    afterAll(async function () {
        await cluster?.close();
        cluster = undefined;
    });

    return () => {
        if (!cluster) {
            throw new Error("beforeAll() hook not ran yet");
        }

        return cluster;
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
