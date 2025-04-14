import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "./inMemoryTransport.js";
import { Server } from "../../src/server.js";
import runner, { MongoCluster } from "mongodb-runner";
import path from "path";
import fs from "fs/promises";
import { Session } from "../../src/session.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export async function setupIntegrationTest(): Promise<{
    client: Client;
    server: Server;
    teardown: () => Promise<void>;
}> {
    const clientTransport = new InMemoryTransport();
    const serverTransport = new InMemoryTransport();

    await serverTransport.start();
    await clientTransport.start();

    clientTransport.output.pipeTo(serverTransport.input);
    serverTransport.output.pipeTo(clientTransport.input);

    const client = new Client(
        {
            name: "test-client",
            version: "1.2.3",
        },
        {
            capabilities: {},
        }
    );

    const server = new Server({
        mcpServer: new McpServer({
            name: "test-server",
            version: "1.2.3",
        }),
        session: new Session(),
    });
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    return {
        client,
        server,
        teardown: async () => {
            await client.close();
            await server.close();
        },
    };
}

export async function runMongoDB(): Promise<runner.MongoCluster> {
    const tmpDir = path.join(__dirname, "..", "tmp");
    await fs.mkdir(tmpDir, { recursive: true });

    try {
        const cluster = await MongoCluster.start({
            tmpDir: path.join(tmpDir, "mongodb-runner", "dbs"),
            logDir: path.join(tmpDir, "mongodb-runner", "logs"),
            topology: "standalone",
        });

        return cluster;
    } catch (err) {
        throw err;
    }
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
