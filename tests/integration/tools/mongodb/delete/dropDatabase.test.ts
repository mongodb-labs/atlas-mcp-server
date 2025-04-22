import {
    getResponseContent,
    dbOperationParameters,
    setupIntegrationTest,
    validateToolMetadata,
    validateAutoConnectBehavior,
} from "../../../helpers.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import config from "../../../../../src/config.js";

describe("dropDatabase tool", () => {
    const integration = setupIntegrationTest();

    it("should have correct metadata", async () => {
        await validateToolMetadata(
            integration.mcpClient(),
            "drop-database",
            "Removes the specified database, deleting the associated data files",
            [dbOperationParameters.find((d) => d.name === "database")!]
        );
    });

    describe("with invalid arguments", () => {
        const args = [{}, { database: 123 }, { foo: "bar", database: "test" }];
        for (const arg of args) {
            it(`throws a schema error for: ${JSON.stringify(arg)}`, async () => {
                await integration.connectMcpClient();
                try {
                    await integration.mcpClient().callTool({ name: "drop-database", arguments: arg });
                    expect.fail("Expected an error to be thrown");
                } catch (error) {
                    expect(error).toBeInstanceOf(McpError);
                    const mcpError = error as McpError;
                    expect(mcpError.code).toEqual(-32602);
                    expect(mcpError.message).toContain("Invalid arguments for tool drop-database");
                }
            });
        }
    });

    it("can drop non-existing database", async () => {
        let { databases } = await integration.mongoClient().db("").admin().listDatabases();

        const preDropLength = databases.length;

        await integration.connectMcpClient();
        const response = await integration.mcpClient().callTool({
            name: "drop-database",
            arguments: {
                database: integration.randomDbName(),
            },
        });

        const content = getResponseContent(response.content);
        expect(content).toContain(`Successfully dropped database "${integration.randomDbName()}"`);

        ({ databases } = await integration.mongoClient().db("").admin().listDatabases());

        expect(databases).toHaveLength(preDropLength);
        expect(databases.find((db) => db.name === integration.randomDbName())).toBeUndefined();
    });

    it("removes the database along with its collections", async () => {
        await integration.connectMcpClient();
        await integration.mongoClient().db(integration.randomDbName()).createCollection("coll1");
        await integration.mongoClient().db(integration.randomDbName()).createCollection("coll2");

        let { databases } = await integration.mongoClient().db("").admin().listDatabases();
        expect(databases.find((db) => db.name === integration.randomDbName())).toBeDefined();

        const response = await integration.mcpClient().callTool({
            name: "drop-database",
            arguments: {
                database: integration.randomDbName(),
            },
        });
        const content = getResponseContent(response.content);
        expect(content).toContain(`Successfully dropped database "${integration.randomDbName()}"`);

        ({ databases } = await integration.mongoClient().db("").admin().listDatabases());
        expect(databases.find((db) => db.name === integration.randomDbName())).toBeUndefined();

        const collections = await integration.mongoClient().db(integration.randomDbName()).listCollections().toArray();
        expect(collections).toHaveLength(0);
    });

    describe("when not connected", () => {
        beforeEach(async () => {
            await integration.mongoClient().db(integration.randomDbName()).createCollection("coll1");
        });

        validateAutoConnectBehavior(integration, "drop-database", () => {
            return {
                args: { database: integration.randomDbName() },
                expectedResponse: `Successfully dropped database "${integration.randomDbName()}"`,
            };
        });
    });
});
