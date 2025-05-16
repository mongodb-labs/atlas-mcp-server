import { DbOperationArgs, MongoDBToolBase } from "../mongodbTool.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ToolArgs, OperationType } from "../../tool.js";
import { z } from "zod";
import { ListSearchIndexOutput } from "../../../common/search/listSearchIndexesOutput.js";

export const ListSearchIndexesArgs = {
    indexName: z
        .string()
        .default("")
        .optional()
        .describe(
            "The name of the index to return information about. Returns all indexes on collection if not provided."
        ),
};

export class CollectionSearchIndexesTool extends MongoDBToolBase {
    protected name = "collection-search-indexes";
    protected description = "Describe the search indexes for a collection";
    protected argsShape = {
        ...DbOperationArgs,
        ...ListSearchIndexesArgs,
    };

    protected operationType: OperationType = "read";

    protected async execute({
        database,
        collection,
        indexName,
    }: ToolArgs<typeof this.argsShape>): Promise<CallToolResult> {
        const provider = await this.ensureConnected();
        const indexes: ListSearchIndexOutput[] = (
            (await provider.getSearchIndexes(database, collection, indexName)) as ListSearchIndexOutput[]
        ).map((doc) => ({
            id: doc.id,
            name: doc.name,
            status: doc.status,
            queryable: doc.queryable,
            latestDefinitionVersion: doc.latestDefinitionVersion,
            latestDefinition: doc.latestDefinition,
            statusDetail: doc.statusDetail,
            synonymMappingStatus: doc.synonymMappingStatus,
            synonymMappingStatusDetail: doc.synonymMappingStatusDetail,
        }));

        return {
            content: [
                {
                    text: indexName
                        ? `Found ${indexes.length} search indexes in the collection "${collection}" with name "${indexName}":`
                        : `Found ${indexes.length} search indexes in the collection "${collection}"`,
                    type: "text",
                },
                ...(indexes.map((indexDefinition) => {
                    return {
                        text: [
                            `Name: "${indexDefinition.name}"`,
                            `Definition: ${JSON.stringify(indexDefinition.latestDefinition, null, 2)}`,
                            `Queryable: ${indexDefinition.queryable}`,
                            `Status: "${indexDefinition.status}"`,
                            `Status Detail: ${JSON.stringify(indexDefinition.statusDetail, null, 2)}`,
                            `Definition Version: ${JSON.stringify(indexDefinition.latestDefinitionVersion, null, 2)}`,
                            `Synonym Mapping Status: ${indexDefinition.synonymMappingStatus}`,
                            `Synonym Mapping Status Detail: ${JSON.stringify(indexDefinition.synonymMappingStatusDetail, null, 2)}`,
                            `ID: ${indexDefinition.id}`,
                        ].join("\n"),
                        type: "text",
                    };
                }) as { text: string; type: "text" }[]),
            ],
        };
    }
}
