import { ConnectTool } from "./metadata/connect.js";
import { ListCollectionsTool } from "./metadata/listCollections.js";
import { CollectionIndexesTool } from "./read/collectionIndexes.js";
import { ListDatabasesTool } from "./metadata/listDatabases.js";
import { CreateIndexTool } from "./create/createIndex.js";
import { CollectionSchemaTool } from "./metadata/collectionSchema.js";
import { InsertOneTool } from "./create/insertOne.js";
import { FindTool } from "./read/find.js";
import { InsertManyTool } from "./create/insertMany.js";
import { DeleteManyTool } from "./delete/deleteMany.js";
import { DeleteOneTool } from "./delete/deleteOne.js";
import { CollectionStorageSizeTool } from "./metadata/collectionStorageSize.js";
import { CountTool } from "./read/count.js";
import { DbStatsTool } from "./metadata/dbStats.js";
import { AggregateTool } from "./read/aggregate.js";
import { UpdateOneTool } from "./update/updateOne.js";
import { UpdateManyTool } from "./update/updateMany.js";
import { RenameCollectionTool } from "./update/renameCollection.js";
import { DropDatabaseTool } from "./delete/dropDatabase.js";
import { DropCollectionTool } from "./delete/dropCollection.js";
import { ExplainTool } from "./metadata/explain.js";
import { CreateCollectionTool } from "./create/createCollection.js";

export const MongoDbTools = [
    ConnectTool,
    ListCollectionsTool,
    ListDatabasesTool,
    CollectionIndexesTool,
    CreateIndexTool,
    CollectionSchemaTool,
    InsertOneTool,
    FindTool,
    InsertManyTool,
    DeleteManyTool,
    DeleteOneTool,
    CollectionStorageSizeTool,
    CountTool,
    DbStatsTool,
    AggregateTool,
    UpdateOneTool,
    UpdateManyTool,
    RenameCollectionTool,
    DropDatabaseTool,
    DropCollectionTool,
    ExplainTool,
    CreateCollectionTool,
];
