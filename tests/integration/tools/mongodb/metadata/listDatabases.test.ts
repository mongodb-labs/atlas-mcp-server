import { getResponseElements, getParameters, setupIntegrationTest } from "../../../helpers.js";
import { toIncludeSameMembers } from "jest-extended";

describe("listDatabases tool", () => {
    const integration = setupIntegrationTest();

    it("should have correct metadata", async () => {
        const { tools } = await integration.mcpClient().listTools();
        const listDatabases = tools.find((tool) => tool.name === "list-databases")!;
        expect(listDatabases).toBeDefined();
        expect(listDatabases.description).toBe("List all databases for a MongoDB connection");

        const parameters = getParameters(listDatabases);
        expect(parameters).toHaveLength(0);
    });

    describe("with no preexisting databases", () => {
        it("returns only the system databases", async () => {
            await integration.connectMcpClient();
            const response = await integration.mcpClient().callTool({ name: "list-databases", arguments: {} });
            const dbNames = getDbNames(response.content);

            expect(dbNames).toIncludeSameMembers(["admin", "config", "local"]);
        });
    });

    describe("with preexisting databases", () => {
        it("returns their names and sizes", async () => {
            const mongoClient = integration.mongoClient();
            await mongoClient.db("foo").collection("bar").insertOne({ test: "test" });
            await mongoClient.db("baz").collection("qux").insertOne({ test: "test" });

            await integration.connectMcpClient();

            const response = await integration.mcpClient().callTool({ name: "list-databases", arguments: {} });
            const dbNames = getDbNames(response.content);
            expect(dbNames).toIncludeSameMembers(["admin", "config", "local", "foo", "baz"]);
        });
    });
});

function getDbNames(content: unknown): (string | null)[] {
    const responseItems = getResponseElements(content);

    return responseItems.map((item) => {
        const match = item.text.match(/Name: (.*), Size: \d+ bytes/);
        return match ? match[1] : null;
    });
}
