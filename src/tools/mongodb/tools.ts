// TODO: https://github.com/mongodb-js/mongodb-mcp-server/issues/141 - reenable when the connect tool is reenabled
// import { ConnectTool } from "./metadata/connect.js";
import { ListCollectionsTool } from "./metadata/listCollections.js";
import { CollectionIndexesTool } from "./read/collectionIndexes.js";
import { ListDatabasesTool } from "./metadata/listDatabases.js";
import { CreateIndexTool } from "./create/createIndex.js";
import { CollectionSchemaTool } from "./metadata/collectionSchema.js";
import { FindTool } from "./read/find.js";
import { InsertManyTool } from "./create/insertMany.js";
import { DeleteManyTool } from "./delete/deleteMany.js";
import { CollectionStorageSizeTool } from "./metadata/collectionStorageSize.js";
import { CountTool } from "./read/count.js";
import { DbStatsTool } from "./metadata/dbStats.js";
import { AggregateTool } from "./read/aggregate.js";
import { UpdateManyTool } from "./update/updateMany.js";
import { RenameCollectionTool } from "./update/renameCollection.js";
import { DropDatabaseTool } from "./delete/dropDatabase.js";
import { DropCollectionTool } from "./delete/dropCollection.js";
import { ExplainTool } from "./metadata/explain.js";
import { CreateCollectionTool } from "./create/createCollection.js";
import { LogsTool } from "./metadata/logs.js";

export const MongoDbTools = [
    // TODO: https://github.com/mongodb-js/mongodb-mcp-server/issues/141 - reenable when the connect tool is reenabled
    // ConnectTool,
    ListCollectionsTool,
    ListDatabasesTool,
    CollectionIndexesTool,
    CreateIndexTool,
    CollectionSchemaTool,
    FindTool,
    InsertManyTool,
    DeleteManyTool,
    CollectionStorageSizeTool,
    CountTool,
    DbStatsTool,
    AggregateTool,
    UpdateManyTool,
    RenameCollectionTool,
    DropDatabaseTool,
    DropCollectionTool,
    ExplainTool,
    CreateCollectionTool,
    LogsTool,
];
