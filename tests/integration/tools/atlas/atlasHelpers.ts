import { ObjectId } from "mongodb";
import { Group } from "../../../../src/common/atlas/openapi.js";
import { ApiClient } from "../../../../src/common/atlas/apiClient.js";
import { setupIntegrationTest, IntegrationTest, defaultTestConfig, sleep } from "../../helpers.js";
import { Session } from "../../../../src/session.js";

export type IntegrationTestFunction = (integration: IntegrationTest) => void;

export function describeWithAtlas(name: string, fn: IntegrationTestFunction): void {
    const testDefinition = () => {
        const integration = setupIntegrationTest(() => ({
            ...defaultTestConfig,
            apiClientId: process.env.MDB_MCP_API_CLIENT_ID,
            apiClientSecret: process.env.MDB_MCP_API_CLIENT_SECRET,
        }));

        describe(name, () => {
            fn(integration);
        });
    };

    if (!process.env.MDB_MCP_API_CLIENT_ID?.length || !process.env.MDB_MCP_API_CLIENT_SECRET?.length) {
        return describe.skip("atlas", testDefinition);
    }

    describe("atlas", testDefinition);
}

interface ProjectTestArgs {
    getProjectId: () => string;
}

type ProjectTestFunction = (args: ProjectTestArgs) => void;

export function withProject(integration: IntegrationTest, fn: ProjectTestFunction): void {
    describe("with project", () => {
        let projectId: string = "";
        const projectName = `testProj-${new ObjectId()}`;

        beforeAll(async () => {
            const apiClient = integration.mcpServer().session.apiClient;

            const group = await createProject(apiClient, projectName);
            projectId = group.id || "";
        });

        afterAll(async () => {
            const apiClient = integration.mcpServer().session.apiClient;

            const clusters = await apiClient.listClusters({
                params: {
                    path: {
                        groupId: projectId,
                    },
                },
            });

            const deletePromises =
                clusters?.results?.map((cluster) => {
                    if (cluster.name) {
                        return deleteAndWaitCluster(integration.mcpServer().session, projectId, cluster.name);
                    }

                    return Promise.resolve();
                }) ?? [];

            await Promise.all(deletePromises);

            await apiClient.deleteProject({
                params: {
                    path: {
                        groupId: projectId,
                    },
                },
            });
        });

        fn({
            getProjectId: () => projectId,
        });
    });
}

export function parseTable(text: string): Record<string, string>[] {
    const data = text
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => line.split("|").map((cell) => cell.trim()));

    const headers = data[0];
    return data
        .filter((_, index) => index >= 2)
        .map((cells) => {
            const row: Record<string, string> = {};
            cells.forEach((cell, index) => {
                row[headers[index]] = cell;
            });
            return row;
        });
}

async function createProject(apiClient: ApiClient, projectName: string): Promise<Group> {
    const orgs = await apiClient.listOrganizations();
    if (!orgs?.results?.length || !orgs.results[0].id) {
        throw new Error("No orgs found");
    }

    const group = await apiClient.createProject({
        body: {
            name: projectName,
            orgId: orgs.results[0].id,
        } as Group,
    });

    if (!group?.id) {
        throw new Error("Failed to create project");
    }

    return group;
}

export async function waitClusterState(session: Session, projectId: string, clusterName: string, state: string) {
    while (true) {
        const cluster = await session.apiClient.getCluster({
            params: {
                path: {
                    groupId: projectId,
                    clusterName,
                },
            },
        });
        if (cluster?.stateName === state) {
            return;
        }
        await sleep(1000);
    }
}

async function deleteAndWaitCluster(session: Session, projectId: string, clusterName: string) {
    await session.apiClient.deleteCluster({
        params: {
            path: {
                groupId: projectId,
                clusterName,
            },
        },
    });
    while (true) {
        try {
            await session.apiClient.getCluster({
                params: {
                    path: {
                        groupId: projectId,
                        clusterName,
                    },
                },
            });
            await sleep(1000);
        } catch {
            break;
        }
    }
}
