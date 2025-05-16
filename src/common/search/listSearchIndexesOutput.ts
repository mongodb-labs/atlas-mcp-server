export interface IndexDefinitionVersion {
    version: number;
    createdAt: string; // ISO 8601 date string
}

export interface IndexDefinition {
    [key: string]: unknown;
}

export interface SynonymMappingStatusDetails {
    status: string;
    queryable: boolean;
    message?: string;
}

export interface IndexStatusInfo {
    status: string;
    queryable: boolean;
    synonymMappingStatus?: string;
    synonymMappingStatusDetails?: SynonymMappingStatusDetails;
    definitionVersion: IndexDefinitionVersion;
    definition: IndexDefinition;
}

export interface SearchIndexStatusDetail {
    hostname: string;
    status: string;
    queryable: boolean;
    mainIndex: IndexStatusInfo;
    stagedIndex?: IndexStatusInfo;
}

export interface SynonymMappingStatusDetail {
    status: string;
    queryable: boolean;
    message?: string;
}

export interface ListSearchIndexOutput {
    id: string;
    name: string;
    status: string;
    queryable: boolean;
    latestDefinitionVersion: IndexDefinitionVersion;
    latestDefinition: IndexDefinition;
    statusDetail: SearchIndexStatusDetail[];
    synonymMappingStatus?: "BUILDING" | "FAILED" | "READY";
    synonymMappingStatusDetail?: SynonymMappingStatusDetail[];
}
