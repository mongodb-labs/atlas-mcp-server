import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
    DbOperationArgs,
    MongoDBToolBase,
    VectorFieldType,
    VectorIndexArgs,
} from "../mongodbTool.js";
import { OperationType, ToolArgs } from "../../tool.js";

export class UpdateVectorIndexTool extends MongoDBToolBase {
    protected name = "update-vector-index";
    protected description = "Updates an Atlas Search vector for a collection";
    protected argsShape = {
        ...DbOperationArgs,
        name: VectorIndexArgs.name,
        vectorDefinition: VectorIndexArgs.vectorDefinition,
        filterFields: VectorIndexArgs.filterFields,
    };

    protected operationType: OperationType = "create";

    protected async execute({
        database,
        collection,
        name,
        vectorDefinition,
        filterFields,
    }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        const provider = await this.ensureConnected();

        const typedVectorField = { ...vectorDefinition, type: VectorFieldType.VECTOR };
        const typedFilterFields =
            filterFields?.map((v) => ({
                ...v,
                type: VectorFieldType.FILTER,
            })) || [];
        // @ts-expect-error: Interface expects a SearchIndexDefinition {definition: {fields}}. However,
        // passing fields at the root level is necessary for the call to succeed.
        await provider.updateSearchIndex(database, collection, name, {
            fields: [typedVectorField, ...typedFilterFields],
        });

        return {
            content: [
                {
                    text: `Successfully updated vector index "${name}" on collection "${collection}" in database "${database}"`,
                    type: "text",
                },
            ],
        };
    }
}