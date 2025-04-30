import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DbOperationArgs, MongoDBToolBase } from "../mongodbTool.js";
import { ToolArgs, OperationType } from "../../tool.js";
import { IndexDirection } from "mongodb";

export class CreateSearchIndexTool extends MongoDBToolBase {
    protected name = "create-search-index";
    protected description = "Create an Atlas Search index for a collection";
    protected argsShape = {
        ...DbOperationArgs,
        name: z.string().optional().describe("The name of the index"),
        type: z.enum(["search", "vectorSearch"]).optional().default("search").describe("The type of the index"),
        analyzer: z
            .string()
            .optional()
            .default("lucene.standard")
            .describe(
                "The analyzer to use for the index. Can be one of the built-in lucene analyzers (`lucene.standard`, `lucene.simple`, `lucene.whitespace`, `lucene.keyword`), a language-specific analyzer, such as `lucene.cjk` or `lucene.czech`, or a custom analyzer defined in the Atlas UI."
            ),
        mappings: z.object({
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
                                    "knnVector",
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
        }),
    };

    protected operationType: OperationType = "create";

    protected async execute({
        database,
        collection,
        name,
        type,
        analyzer,
        mappings,
    }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        const provider = await this.ensureConnected();
        const indexes = await provider.createSearchIndexes(database, collection, [
            {
                name,
                type,
                definition: {
                    analyzer,
                    mappings,
                },
            },
        ]);

        return {
            content: [
                {
                    text: `Created the index "${indexes[0]}" on collection "${collection}" in database "${database}"`,
                    type: "text",
                },
            ],
        };
    }
}
