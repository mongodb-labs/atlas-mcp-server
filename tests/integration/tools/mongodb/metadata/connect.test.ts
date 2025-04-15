import { getResponseContent, jestTestMCPClient, jestTestCluster } from "../../../helpers.js";

import config from "../../../../../src/config.js";

describe("Connect tool", () => {
    const client = jestTestMCPClient();
    const cluster = jestTestCluster();

    it("should have correct metadata", async () => {
        const { tools } = await client().listTools();
        const connectTool = tools.find((tool) => tool.name === "connect")!;
        expect(connectTool).toBeDefined();
        expect(connectTool.description).toBe("Connect to a MongoDB instance");
        expect(connectTool.inputSchema.type).toBe("object");
        expect(connectTool.inputSchema.properties).toBeDefined();

        const propertyNames = Object.keys(connectTool.inputSchema.properties!);
        expect(propertyNames).toHaveLength(1);
        expect(propertyNames[0]).toBe("connectionStringOrClusterName");

        const connectionStringOrClusterNameProp = connectTool.inputSchema.properties![propertyNames[0]] as {
            type: string;
            description: string;
        };
        expect(connectionStringOrClusterNameProp.type).toBe("string");
        expect(connectionStringOrClusterNameProp.description).toContain("MongoDB connection string");
        expect(connectionStringOrClusterNameProp.description).toContain("cluster name");
    });

    describe("with default config", () => {
        describe("without connection string", () => {
            it("prompts for connection string", async () => {
                const response = await client().callTool({ name: "connect", arguments: {} });
                const content = getResponseContent(response.content);
                expect(content).toContain("No connection details provided");
                expect(content).toContain("mongodb://localhost:27017");
            });
        });

        describe("with connection string", () => {
            it("connects to the database", async () => {
                const response = await client().callTool({
                    name: "connect",
                    arguments: { connectionStringOrClusterName: cluster().connectionString },
                });
                const content = getResponseContent(response.content);
                expect(content).toContain("Successfully connected");
                expect(content).toContain(cluster().connectionString);
            });
        });

        describe("with invalid connection string", () => {
            it("returns error message", async () => {
                const response = await client().callTool({
                    name: "connect",
                    arguments: { connectionStringOrClusterName: "mongodb://localhost:12345" },
                });
                const content = getResponseContent(response.content);
                expect(content).toContain("Error running connect");
            });
        });
    });

    describe("with connection string in config", () => {
        beforeEach(async () => {
            config.connectionString = cluster().connectionString;
        });

        it("uses the connection string from config", async () => {
            const response = await client().callTool({ name: "connect", arguments: {} });
            const content = getResponseContent(response.content);
            expect(content).toContain("Successfully connected");
            expect(content).toContain(cluster().connectionString);
        });

        it("prefers connection string from arguments", async () => {
            const newConnectionString = `${cluster().connectionString}?appName=foo-bar`;
            const response = await client().callTool({
                name: "connect",
                arguments: { connectionStringOrClusterName: newConnectionString },
            });
            const content = getResponseContent(response.content);
            expect(content).toContain("Successfully connected");
            expect(content).toContain(newConnectionString);
        });
    });
});
