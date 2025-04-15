import { getResponseContent, jestTestMCPClient, jestTestCluster, validateParameters } from "../../../helpers.js";

import config from "../../../../../src/config.js";

describe("Connect tool", () => {
    const client = jestTestMCPClient();
    const cluster = jestTestCluster();

    it("should have correct metadata", async () => {
        const { tools } = await client().listTools();
        const connectTool = tools.find((tool) => tool.name === "connect")!;
        expect(connectTool).toBeDefined();
        expect(connectTool.description).toBe("Connect to a MongoDB instance");

        validateParameters(connectTool, [
            {
                name: "connectionStringOrClusterName",
                description: "MongoDB connection string (in the mongodb:// or mongodb+srv:// format) or cluster name",
                type: "string",
            },
        ]);
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

                // Should not suggest using the config connection string (because we don't have one)
                expect(content).not.toContain("Your config lists a different connection string");
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

        describe("when the arugment connection string is invalid", () => {
            it("suggests the config connection string if set", async () => {
                const response = await client().callTool({
                    name: "connect",
                    arguments: { connectionStringOrClusterName: "mongodb://localhost:12345" },
                });
                const content = getResponseContent(response.content);
                expect(content).toContain("Failed to connect to MongoDB at 'mongodb://localhost:12345'");
                expect(content).toContain(
                    `Your config lists a different connection string: '${config.connectionString}' - do you want to try connecting to it instead?`
                );
            });

            it("returns error message if the config connection string matches the argument", async () => {
                config.connectionString = "mongodb://localhost:12345";
                const response = await client().callTool({
                    name: "connect",
                    arguments: { connectionStringOrClusterName: "mongodb://localhost:12345" },
                });

                const content = getResponseContent(response.content);

                // Should be handled by default error handler and not suggest the config connection string
                // because it matches the argument connection string
                expect(content).toContain("Error running connect");
                expect(content).not.toContain("Your config lists a different connection string");
            });
        });
    });
});
