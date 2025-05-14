import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
    DbOperationArgs,
    MongoDBToolBase,
    VectorFieldType,
    VectorIndexArgs,
} from "../mongodbTool.js";
import { OperationType, ToolArgs } from "../../tool.js";

const VECTOR_INDEX_TYPE = "vectorSearch";
export class CreateVectorIndexTool extends MongoDBToolBase {
    protected name = "create-vector-index";
    protected description = "Create an Atlas Search vector for a collection";
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
        const indexes = await provider.createSearchIndexes(database, collection, [
            {
                name,
                type: VECTOR_INDEX_TYPE,
                definition: { fields: [typedVectorField, ...typedFilterFields] },
            },
        ]);

        return {
            content: [
                {
                    text: `Created the vector index ${indexes[0]} on collection "${collection}" in database "${database}"`,
                    type: "text",
                },
            ],
        };
    }
}
