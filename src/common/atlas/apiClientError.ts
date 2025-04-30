import { ApiError } from "./openapi.js";

export class ApiClientError extends Error {
    private constructor(
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
        const { errorMessage, body } = await this.extractErrorMessage(response);

        return new ApiClientError(`${message}: ${errorMessage}`, response, body);
    }

    private static async extractErrorMessage(
        response: Response
    ): Promise<{ errorMessage: string; body: ApiError | undefined }> {
        let errorMessage: string = "";
        let body: ApiError | undefined = undefined;
        try {
            body = (await response.json()) as ApiError;
            errorMessage = body.reason || "unknown error";
            if (body.detail && body.detail.length > 0) {
                errorMessage = `${errorMessage}; ${body.detail}`;
            }
        } catch {
            try {
                errorMessage = await response.text();
            } catch {
                errorMessage = "unknown error";
            }
        }

        errorMessage = `[${response.status} ${response.statusText}] ${errorMessage.trim()}`;

        return {
            errorMessage,
            body,
        };
    }
}
