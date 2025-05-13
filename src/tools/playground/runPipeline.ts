import { OperationType, TelemetryToolMetadata, ToolArgs, ToolBase, ToolCategory } from "../tool.js";
import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { EJSON } from "bson";

const PLAYGROUND_SEARCH_URL = "https://search-playground.mongodb.com/api/tools/code-playground/search";

const DEFAULT_DOCUMENTS = [
    {
        name: "First document",
    },
    {
        name: "Second document",
    },
];

const DEFAULT_SEARCH_INDEX_DEFINITION = {
    mappings: {
        dynamic: true,
    },
};

const DEFAULT_PIPELINE = [
    {
        $search: {
            index: "default",
            text: {
                query: "first",
                path: {
                    wildcard: "*",
                },
            },
        },
    },
];

const DEFAULT_SYNONYMS: Array<Record<string, unknown>> = [];

export const RunPipelineOperationArgs = {
    documents: z
        .array(z.record(z.string(), z.unknown()))
        .describe("Documents to run the pipeline against. 500 is maximum.")
        .default(DEFAULT_DOCUMENTS),
    aggregationPipeline: z
        .array(z.record(z.string(), z.unknown()))
        .describe("Aggregation pipeline to run on the provided documents.")
        .default(DEFAULT_PIPELINE),
    searchIndexDefinition: z
        .record(z.string(), z.unknown())
        .describe("Search index to create before running the pipeline.")
        .optional()
        .default(DEFAULT_SEARCH_INDEX_DEFINITION),
    synonyms: z
        .array(z.record(z.any()))
        .describe("Synonyms mapping to create before running the pipeline.")
        .optional()
        .default(DEFAULT_SYNONYMS),
};

interface RunRequest {
    documents: string;
    aggregationPipeline: string;
    indexDefinition: string;
    synonyms: string;
}

interface RunResponse {
    documents: Array<Record<string, unknown>>;
}

interface RunErrorResponse {
    code: string;
    message: string;
}

export class RunPipeline extends ToolBase {
    protected name = "run-pipeline";
    protected description =
        "Run aggregation pipeline for provided documents without needing an Atlas account, cluster, or collection.";
    protected category: ToolCategory = "playground";
    protected operationType: OperationType = "metadata";
    protected argsShape = RunPipelineOperationArgs;

    protected async execute(toolArgs: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        const runRequest = this.convertToRunRequest(toolArgs);
        const runResponse = await this.runPipeline(runRequest);
        const toolResult = this.convertToToolResult(runResponse);
        return toolResult;
    }

    protected resolveTelemetryMetadata(): TelemetryToolMetadata {
        return {};
    }

    private async runPipeline(runRequest: RunRequest): Promise<RunResponse> {
        const options: RequestInit = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(runRequest),
        };

        let response: Response;
        try {
            response = await fetch(PLAYGROUND_SEARCH_URL, options);
        } catch {
            throw new Error("Cannot run pipeline: network error.");
        }

        if (!response.ok) {
            const errorMessage = await this.getPlaygroundResponseError(response);
            throw new Error(`Pipeline run failed: ${errorMessage}`);
        }

        try {
            return (await response.json()) as RunResponse;
        } catch {
            throw new Error("Pipeline run failed: response is not valid JSON.");
        }
    }

    private async getPlaygroundResponseError(response: Response): Promise<string> {
        let errorMessage = `HTTP ${response.status} ${response.statusText}.`;
        try {
            const errorResponse = (await response.json()) as RunErrorResponse;
            errorMessage += ` Error code: ${errorResponse.code}. Error message: ${errorResponse.message}`;
        } catch {
            // Ignore JSON parse errors
        }

        return errorMessage;
    }

    private convertToRunRequest(toolArgs: ToolArgs<typeof this.argsShape>): RunRequest {
        try {
            return {
                documents: JSON.stringify(toolArgs.documents),
                aggregationPipeline: JSON.stringify(toolArgs.aggregationPipeline),
                indexDefinition: JSON.stringify(toolArgs.searchIndexDefinition || DEFAULT_SEARCH_INDEX_DEFINITION),
                synonyms: JSON.stringify(toolArgs.synonyms || DEFAULT_SYNONYMS),
            };
        } catch {
            throw new Error("Invalid arguments type.");
        }
    }

    private convertToToolResult(runResponse: RunResponse): CallToolResult {
        const content: Array<{ text: string; type: "text" }> = [
            {
                text: `Found ${runResponse.documents.length} documents":`,
                type: "text",
            },
            ...runResponse.documents.map((doc) => {
                return {
                    text: EJSON.stringify(doc),
                    type: "text",
                } as { text: string; type: "text" };
            }),
        ];

        return {
            content,
        };
    }
}
