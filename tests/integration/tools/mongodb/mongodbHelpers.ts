import runner, { MongoCluster } from "mongodb-runner";
import path from "path";
import fs from "fs/promises";
import { MongoClient, ObjectId } from "mongodb";
import { getResponseContent, IntegrationTest, setupIntegrationTest } from "../../helpers.js";
import { UserConfig, config } from "../../../../src/config.js";

interface MongoDBIntegrationTest {
    mongoClient: () => MongoClient;
    connectionString: () => string;
    connectMcpClient: () => Promise<void>;
    randomDbName: () => string;
}

export function describeWithMongoDB(
    name: number | string | Function | jest.FunctionLike,
    fn: (integration: IntegrationTest & MongoDBIntegrationTest) => void
): void {
    describe("mongodb", () => {
        const integration = setupIntegrationTest();
        const mdbIntegration = setupMongoDBIntegrationTest(integration);
        describe(name, () => {
            fn({ ...integration, ...mdbIntegration });
        });
    });
}

export function setupMongoDBIntegrationTest(
    integration: IntegrationTest,
    userConfig: UserConfig = config
): MongoDBIntegrationTest {
    let mongoCluster: runner.MongoCluster | undefined;
    let mongoClient: MongoClient | undefined;
    let randomDbName: string;

    beforeEach(async () => {
        randomDbName = new ObjectId().toString();
    });

    afterEach(async () => {
        await integration.mcpServer().session.close();
        config.connectionString = undefined;

        await mongoClient?.close();
        mongoClient = undefined;
    });

    beforeAll(async function () {
        // Downloading Windows executables in CI takes a long time because
        // they include debug symbols...
        const tmpDir = path.join(__dirname, "..", "..", "..", "tmp");
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

    const getConnectionString = () => {
        if (!mongoCluster) {
            throw new Error("beforeAll() hook not ran yet");
        }

        return mongoCluster.connectionString;
    };

    return {
        mongoClient: () => {
            if (!mongoClient) {
                mongoClient = new MongoClient(getConnectionString());
            }
            return mongoClient;
        },
        connectionString: getConnectionString,
        connectMcpClient: async () => {
            await integration.mcpClient().callTool({
                name: "connect",
                arguments: { options: [{ connectionString: getConnectionString() }] },
            });
        },
        randomDbName: () => randomDbName,
    };
}

export function validateAutoConnectBehavior(
    integration: IntegrationTest & MongoDBIntegrationTest,
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
