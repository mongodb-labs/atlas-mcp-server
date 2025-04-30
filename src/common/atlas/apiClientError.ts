import { ApiError } from "./openapi.js";

export class ApiClientError extends Error {
    constructor(
        message: string,
        public readonly response?: Response,
        public readonly body?: ApiError
    ) {
        super(message);
        this.name = "ApiClientError";
    }

    static async fromResponse(
        response: Response,
        message: string = `error calling Atlas API`
    ): Promise<ApiClientError> {
        const err = await this.extractError(response);

        const errorMessage = this.buildErrorMessage(err);

        const body = err && typeof err === "object" ? err : undefined;

        return new ApiClientError(
            `[${response.status} ${response.statusText}] ${message}: ${errorMessage}`,
            response,
            body
        );
    }

    private static async extractError(response: Response): Promise<ApiError | string | undefined> {
        try {
            return (await response.json()) as ApiError;
        } catch {
            try {
                return await response.text();
            } catch {
                return undefined;
            }
        }
    }

    private static buildErrorMessage(error?: string | ApiError): string {
        let errorMessage: string = "unknown error";

        //eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
        switch (typeof error) {
            case "object":
                errorMessage = error.reason || "unknown error";
                if (error.detail && error.detail.length > 0) {
                    errorMessage = `${errorMessage}; ${error.detail}`;
                }
                break;
            case "string":
                errorMessage = error;
                break;
        }

        return errorMessage.trim();
    }
}
