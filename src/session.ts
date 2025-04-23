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

    constructor(options?: SessionOptions) {
        const credentials: ApiClientCredentials | undefined =
            options?.apiClientId && options?.apiClientSecret
                ? {
                      clientId: options?.apiClientId,
                      clientSecret: options?.apiClientSecret,
                  }
                : undefined;

        this.apiClient = new ApiClient({
            baseUrl: options?.apiBaseUrl,
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
