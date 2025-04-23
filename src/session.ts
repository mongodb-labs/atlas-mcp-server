import { NodeDriverServiceProvider } from "@mongosh/service-provider-node-driver";
import { ApiClient, ApiClientCredentials } from "./common/atlas/apiClient.js";
import config from "./config.js";

export class Session {
    serviceProvider?: NodeDriverServiceProvider;
    apiClient: ApiClient;

    constructor() {
        const credentials: ApiClientCredentials | undefined =
            config.apiClientId && config.apiClientSecret
                ? {
                      clientId: config.apiClientId,
                      clientSecret: config.apiClientSecret,
                  }
                : undefined;

        this.apiClient = new ApiClient({
            baseUrl: config.apiBaseUrl,
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
