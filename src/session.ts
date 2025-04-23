import { NodeDriverServiceProvider } from "@mongosh/service-provider-node-driver";
import { ApiClient } from "./common/atlas/apiClient.js";
import config from "./config.js";

export class Session {
    serviceProvider?: NodeDriverServiceProvider;
    apiClient: ApiClient;

    constructor() {
        let credentials: {
            clientId: string;
            clientSecret: string;
        } | undefined = undefined;
        if (config.apiClientId && config.apiClientSecret) {
            credentials = {
                clientId: config.apiClientId,
                clientSecret: config.apiClientSecret,
            };
        }

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
