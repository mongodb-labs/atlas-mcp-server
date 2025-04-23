import { NodeDriverServiceProvider } from "@mongosh/service-provider-node-driver";
import { ApiClient, ApiClientCredentials } from "./common/atlas/apiClient.js";

export interface SessionOptions {
    apiBaseUrl?: string;
    apiClientId?: string;
    apiClientSecret?: string;
}

export class Session {
    serviceProvider?: NodeDriverServiceProvider;
    apiClient: ApiClient;

    constructor({ apiBaseUrl, apiClientId, apiClientSecret }: SessionOptions = {}) {
        const credentials: ApiClientCredentials | undefined =
            apiClientId && apiClientSecret
                ? {
                      clientId: apiClientId,
                      clientSecret: apiClientSecret,
                  }
                : undefined;

        this.apiClient = new ApiClient({
            baseUrl: apiBaseUrl,
            credentials,
        });
    }

    async close(): Promise<void> {
        if (this.serviceProvider) {
            try {
                await this.serviceProvider.close(true);
            } catch (error) {
                console.error("Error closing service provider:", error);
            }
            this.serviceProvider = undefined;
        }
    }
}
