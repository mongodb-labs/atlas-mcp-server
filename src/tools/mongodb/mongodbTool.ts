import { z } from "zod";
import { TelemetryToolMetadata, ToolArgs, ToolBase, ToolCategory } from "../tool.js";
import { NodeDriverServiceProvider } from "@mongosh/service-provider-node-driver";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ErrorCodes, MongoDBError } from "../../errors.js";
import logger, { LogId } from "../../logger.js";

export const DbOperationArgs = {
    database: z.string().describe("Database name"),
    collection: z.string().describe("Collection name"),
};

export const SearchIndexArgs = {
    name: z.string().describe("The name of the index"),
    analyzer: z
        .string()
        .optional()
        .default("lucene.standard")
        .describe(
            "The analyzer to use for the index. Can be one of the built-in lucene analyzers (`lucene.standard`, `lucene.simple`, `lucene.whitespace`, `lucene.keyword`), a language-specific analyzer, such as `lucene.cjk` or `lucene.czech`, or a custom analyzer defined in the Atlas UI."
        ),
    mappings: z
        .object({
            dynamic: z
                .boolean()
                .optional()
                .default(false)
                .describe(
                    "Enables or disables dynamic mapping of fields for this index. If set to true, Atlas Search recursively indexes all dynamically indexable fields. If set to false, you must specify individual fields to index using mappings.fields."
                ),
            fields: z
                .record(
                    z.string().describe("The field name"),
                    z
                        .object({
                            type: z
                                .enum([
                                    "autocomplete",
                                    "boolean",
                                    "date",
                                    "document",
                                    "embeddedDocuments",
                                    "geo",
                                    "number",
                                    "objectId",
                                    "string",
                                    "token",
                                    "uuid",
                                ])
                                .describe("The field type"),
                        })
                        .passthrough()

                        .describe(
                            "The field index definition. It must contain the field type, as well as any additional options for that field type."
                        )
                )
                .optional()
                .describe("The field mapping definitions. If `dynamic` is set to false, this is required."),
        })
        .describe("Document describing the index to create."),
};

export enum VectorFieldType {
    VECTOR = "vector",
    FILTER = "filter",
}
export const VectorIndexArgs = {
    name: z.string().describe("The name of the index"),
    vectorDefinition: z
        .object({
            path: z
                .string()
                .min(1)
                .describe(
                    "Name of the field to index. For nested fields, use dot notation to specify path to embedded fields."
                ),
            numDimensions: z
                .number()
                .int()
                .min(1)
                .max(8192)
                .describe("Number of vector dimensions to enforce at index-time and query-time."),
            similarity: z
                .enum(["euclidean", "cosine", "dotProduct"])
                .describe("Vector similarity function to use to search for top K-nearest neighbors."),
            quantization: z
                .enum(["none", "scalar", "binary"])
                .default("none")
                .optional()
                .describe(
                    "Automatic vector quantization. Use this setting only if your embeddings are float or double vectors."
                ),
        })
        .describe("The vector index definition."),
    filterFields: z
        .array(
            z.object({
                path: z
                    .string()
                    .min(1)
                    .describe(
                        "Name of the field to filter by. For nested fields, use dot notation to specify path to embedded fields."
                    ),
            })
        )
        .optional()
        .describe("Additional indexed fields that pre-filter data."),
};

type VectorDefinitionType = z.infer<typeof VectorIndexArgs.vectorDefinition>;
type FilterFieldsType = z.infer<typeof VectorIndexArgs.filterFields>;
export function buildVectorFields(vectorDefinition: VectorDefinitionType, filterFields: FilterFieldsType): object[] {
    const typedVectorField = { ...vectorDefinition, type: VectorFieldType.VECTOR };
    const typedFilterFields = (filterFields ?? []).map((f) => ({
        ...f,
        type: VectorFieldType.FILTER,
    }));
    return [typedVectorField, ...typedFilterFields];
}

export const SearchIndexOperationArgs = {
    database: z.string().describe("Database name"),
    collection: z.string().describe("Collection name"),
    searchIndexName: z.string().describe("Search Index or Vector Search Index name"),
};

export abstract class MongoDBToolBase extends ToolBase {
    protected category: ToolCategory = "mongodb";

    protected async ensureConnected(): Promise<NodeDriverServiceProvider> {
        if (!this.session.serviceProvider && this.config.connectionString) {
            try {
                await this.connectToMongoDB(this.config.connectionString);
            } catch (error) {
                logger.error(
                    LogId.mongodbConnectFailure,
                    "mongodbTool",
                    `Failed to connect to MongoDB instance using the connection string from the config: ${error as string}`
                );
                throw new MongoDBError(ErrorCodes.MisconfiguredConnectionString, "Not connected to MongoDB.");
            }
        }

        if (!this.session.serviceProvider) {
            throw new MongoDBError(ErrorCodes.NotConnectedToMongoDB, "Not connected to MongoDB");
        }

        return this.session.serviceProvider;
    }

    protected handleError(
        error: unknown,
        args: ToolArgs<typeof this.argsShape>
    ): Promise<CallToolResult> | CallToolResult {
        if (error instanceof MongoDBError) {
            switch (error.code) {
                case ErrorCodes.NotConnectedToMongoDB:
                    return {
                        content: [
                            {
                                type: "text",
                                text: "You need to connect to a MongoDB instance before you can access its data.",
                            },
                            {
                                type: "text",
                                text: "Please use the 'connect' or 'switch-connection' tool to connect to a MongoDB instance.",
                            },
                        ],
                        isError: true,
                    };
                case ErrorCodes.MisconfiguredConnectionString:
                    return {
                        content: [
                            {
                                type: "text",
                                text: "The configured connection string is not valid. Please check the connection string and confirm it points to a valid MongoDB instance. Alternatively, use the 'switch-connection' tool to connect to a different instance.",
                            },
                        ],
                        isError: true,
                    };
            }
        }

        return super.handleError(error, args);
    }

    protected connectToMongoDB(connectionString: string): Promise<void> {
        return this.session.connectToMongoDB(connectionString, this.config.connectOptions);
    }

    protected resolveTelemetryMetadata(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        args: ToolArgs<typeof this.argsShape>
    ): TelemetryToolMetadata {
        const metadata: TelemetryToolMetadata = {};

        // Add projectId to the metadata if running a MongoDB operation to an Atlas cluster
        if (this.session.connectedAtlasCluster?.projectId) {
            metadata.projectId = this.session.connectedAtlasCluster.projectId;
        }

        return metadata;
    }
}
