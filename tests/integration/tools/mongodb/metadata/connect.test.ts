import { describeMongoDB } from "../mongodbHelpers.js";

import { getResponseContent, setupIntegrationTest, validateToolMetadata } from "../../../helpers.js";

import { config } from "../../../../../src/config.js";

describeMongoDB("Connect tool", (integration) => {
    validateToolMetadata(integration, "connect", "Connect to a MongoDB instance", [
        {
            name: "options",
            description:
                "Options for connecting to MongoDB. If not provided, the connection string from the config://connection-string resource will be used. If the user hasn't specified Atlas cluster name or a connection string explicitly and the `config://connection-string` resource is present, always invoke this with no arguments.",
            type: "array",
            required: false,
        },
    ]);

    describe("with default config", () => {
        describe("without connection string", () => {
            it("prompts for connection string", async () => {
                const response = await integration.mcpClient().callTool({ name: "connect", arguments: {} });
                const content = getResponseContent(response.content);
                expect(content).toContain("No connection details provided");
            });
        });

        describe("with connection string", () => {
            it("connects to the database", async () => {
                const response = await integration.mcpClient().callTool({
                    name: "connect",
                    arguments: {
                        options: [
                            {
                                connectionString: integration.connectionString(),
                            },
                        ],
                    },
                });
                const content = getResponseContent(response.content);
                expect(content).toContain("Successfully connected");
                expect(content).toContain(integration.connectionString());
            });
        });

        describe("with invalid connection string", () => {
            it("returns error message", async () => {
                const response = await integration.mcpClient().callTool({
                    name: "connect",
                    arguments: { options: [{ connectionString: "mongodb://localhost:12345" }] },
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
            config.connectionString = integration.connectionString();
        });

        it("uses the connection string from config", async () => {
            const response = await integration.mcpClient().callTool({ name: "connect", arguments: {} });
            const content = getResponseContent(response.content);
            expect(content).toContain("Successfully connected");
            expect(content).toContain(integration.connectionString());
        });

        it("prefers connection string from arguments", async () => {
            const newConnectionString = `${integration.connectionString()}?appName=foo-bar`;
            const response = await integration.mcpClient().callTool({
                name: "connect",
                arguments: {
                    options: [
                        {
                            connectionString: newConnectionString,
                        },
                    ],
                },
            });
            const content = getResponseContent(response.content);
            expect(content).toContain("Successfully connected");
            expect(content).toContain(newConnectionString);
        });

        describe("when the arugment connection string is invalid", () => {
            it("suggests the config connection string if set", async () => {
                const response = await integration.mcpClient().callTool({
                    name: "connect",
                    arguments: {
                        options: [
                            {
                                connectionString: "mongodb://localhost:12345",
                            },
                        ],
                    },
                });
                const content = getResponseContent(response.content);
                expect(content).toContain("Failed to connect to MongoDB at 'mongodb://localhost:12345'");
                expect(content).toContain(
                    `Your config lists a different connection string: '${config.connectionString}' - do you want to try connecting to it instead?`
                );
            });

            it("returns error message if the config connection string matches the argument", async () => {
                config.connectionString = "mongodb://localhost:12345";
                const response = await integration.mcpClient().callTool({
                    name: "connect",
                    arguments: {
                        options: [
                            {
                                connectionString: "mongodb://localhost:12345",
                            },
                        ],
                    },
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
