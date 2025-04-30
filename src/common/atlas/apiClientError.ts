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
        let text: string = "";
        let body: ApiError | undefined = undefined;
        try {
            body = (await response.json()) as ApiError;
            text = body.reason || "unknown error";
            if (body.detail && body.detail.length > 0) {
                text = `${text}; ${body.detail}`;
            }
        } catch {
            try {
                text = await response.text();
            } catch {
                text = "";
            }
        }

        if (text.length > 0) {
            text = `${message}: [${response.status} ${response.statusText}] ${text.trim()}`;
        } else {
            text = `${message}: ${response.status} ${response.statusText}`;
        }

        return new ApiClientError(text, response, body);
    }
}
