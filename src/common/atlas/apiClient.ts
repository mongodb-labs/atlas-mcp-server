import createClient, { Client, Middleware } from "openapi-fetch";
import type { FetchOptions } from "openapi-fetch";
import { AccessToken, ClientCredentials } from "simple-oauth2";
import { ApiClientError } from "./apiClientError.js";
import { paths, operations } from "./openapi.js";
import { BaseEvent } from "../../telemetry/types.js";
import { packageInfo } from "../../packageInfo.js";

const ATLAS_API_VERSION = "2025-03-12";

export interface ApiClientCredentials {
    clientId: string;
    clientSecret: string;
}

export interface ApiClientOptions {
    credentials?: ApiClientCredentials;
    baseUrl: string;
    userAgent?: string;
}

export class ApiClient {
    private options: {
        baseUrl: string;
        userAgent: string;
        credentials?: {
            clientId: string;
            clientSecret: string;
        };
    };
    private client: Client<paths>;
    private oauth2Client?: ClientCredentials;
    private accessToken?: AccessToken;

    private getAccessToken = async () => {
        if (this.oauth2Client && (!this.accessToken || this.accessToken.expired())) {
            this.accessToken = await this.oauth2Client.getToken({});
        }
        return this.accessToken?.token.access_token as string | undefined;
    };

    private authMiddleware: Middleware = {
        onRequest: async ({ request, schemaPath }) => {
            if (schemaPath.startsWith("/api/private/unauth") || schemaPath.startsWith("/api/oauth")) {
                return undefined;
            }

            try {
                const accessToken = await this.getAccessToken();
                request.headers.set("Authorization", `Bearer ${accessToken}`);
                return request;
            } catch {
                // ignore not availble tokens, API will return 401
            }
        },
    };

    private readonly errorMiddleware: Middleware = {
        async onResponse({ response }) {
            if (!response.ok) {
                throw await ApiClientError.fromResponse(response);
            }
        },
    };

    constructor(options: ApiClientOptions) {
        this.options = {
            ...options,
            userAgent:
                options.userAgent ||
                `AtlasMCP/${packageInfo.version} (${process.platform}; ${process.arch}; ${process.env.HOSTNAME || "unknown"})`,
        };

        this.client = createClient<paths>({
            baseUrl: this.options.baseUrl,
            headers: {
                "User-Agent": this.options.userAgent,
                Accept: `application/vnd.atlas.${ATLAS_API_VERSION}+json`,
            },
        });
        if (this.options.credentials?.clientId && this.options.credentials?.clientSecret) {
            this.oauth2Client = new ClientCredentials({
                client: {
                    id: this.options.credentials.clientId,
                    secret: this.options.credentials.clientSecret,
                },
                auth: {
                    tokenHost: this.options.baseUrl,
                    tokenPath: "/api/oauth/token",
                },
            });
            this.client.use(this.authMiddleware);
        }
        this.client.use(this.errorMiddleware);
    }

    public hasCredentials(): boolean {
        return !!(this.oauth2Client && this.accessToken);
    }

    public async getIpInfo(): Promise<{
        currentIpv4Address: string;
    }> {
        const accessToken = await this.getAccessToken();

        const endpoint = "api/private/ipinfo";
        const url = new URL(endpoint, this.options.baseUrl);
        const response = await fetch(url, {
            method: "GET",
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${accessToken}`,
                "User-Agent": this.options.userAgent,
            },
        });

        if (!response.ok) {
            throw await ApiClientError.fromResponse(response);
        }

        return (await response.json()) as Promise<{
            currentIpv4Address: string;
        }>;
    }

    async sendEvents(events: BaseEvent[]): Promise<void> {
        let endpoint = "api/private/unauth/telemetry/events";
        const headers: Record<string, string> = {
            Accept: "application/json",
            "Content-Type": "application/json",
            "User-Agent": this.options.userAgent,
        };

        const accessToken = await this.getAccessToken();
        if (accessToken) {
            endpoint = "api/private/v1.0/telemetry/events";
            headers["Authorization"] = `Bearer ${accessToken}`;
        }

        const url = new URL(endpoint, this.options.baseUrl);
        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(events),
        });

        if (!response.ok) {
            throw await ApiClientError.fromResponse(response);
        }
    }

    // DO NOT EDIT. This is auto-generated code.
    async listClustersForAllProjects(options?: FetchOptions<operations["listClustersForAllProjects"]>) {
        const { data } = await this.client.GET("/api/atlas/v2/clusters", options);
        return data;
    }

    async listProjects(options?: FetchOptions<operations["listProjects"]>) {
        const { data } = await this.client.GET("/api/atlas/v2/groups", options);
        return data;
    }

    async createProject(options: FetchOptions<operations["createProject"]>) {
        const { data } = await this.client.POST("/api/atlas/v2/groups", options);
        return data;
    }

    async deleteProject(options: FetchOptions<operations["deleteProject"]>) {
        await this.client.DELETE("/api/atlas/v2/groups/{groupId}", options);
    }

    async getProject(options: FetchOptions<operations["getProject"]>) {
        const { data } = await this.client.GET("/api/atlas/v2/groups/{groupId}", options);
        return data;
    }

    async listProjectIpAccessLists(options: FetchOptions<operations["listProjectIpAccessLists"]>) {
        const { data } = await this.client.GET("/api/atlas/v2/groups/{groupId}/accessList", options);
        return data;
    }

    async createProjectIpAccessList(options: FetchOptions<operations["createProjectIpAccessList"]>) {
        const { data } = await this.client.POST("/api/atlas/v2/groups/{groupId}/accessList", options);
        return data;
    }

    async deleteProjectIpAccessList(options: FetchOptions<operations["deleteProjectIpAccessList"]>) {
        await this.client.DELETE("/api/atlas/v2/groups/{groupId}/accessList/{entryValue}", options);
    }

    async listClusters(options: FetchOptions<operations["listClusters"]>) {
        const { data } = await this.client.GET("/api/atlas/v2/groups/{groupId}/clusters", options);
        return data;
    }

    async createCluster(options: FetchOptions<operations["createCluster"]>) {
        const { data } = await this.client.POST("/api/atlas/v2/groups/{groupId}/clusters", options);
        return data;
    }

    async deleteCluster(options: FetchOptions<operations["deleteCluster"]>) {
        await this.client.DELETE("/api/atlas/v2/groups/{groupId}/clusters/{clusterName}", options);
    }

    async getCluster(options: FetchOptions<operations["getCluster"]>) {
        const { data } = await this.client.GET("/api/atlas/v2/groups/{groupId}/clusters/{clusterName}", options);
        return data;
    }

    async listDatabaseUsers(options: FetchOptions<operations["listDatabaseUsers"]>) {
        const { data } = await this.client.GET("/api/atlas/v2/groups/{groupId}/databaseUsers", options);
        return data;
    }

    async createDatabaseUser(options: FetchOptions<operations["createDatabaseUser"]>) {
        const { data } = await this.client.POST("/api/atlas/v2/groups/{groupId}/databaseUsers", options);
        return data;
    }

    async deleteDatabaseUser(options: FetchOptions<operations["deleteDatabaseUser"]>) {
        await this.client.DELETE("/api/atlas/v2/groups/{groupId}/databaseUsers/{databaseName}/{username}", options);
    }

    async listOrganizations(options?: FetchOptions<operations["listOrganizations"]>) {
        const { data } = await this.client.GET("/api/atlas/v2/orgs", options);
        return data;
    }

    async listOrganizationProjects(options: FetchOptions<operations["listOrganizationProjects"]>) {
        const { data } = await this.client.GET("/api/atlas/v2/orgs/{orgId}/groups", options);
        return data;
    }

    // DO NOT EDIT. This is auto-generated code.
}
