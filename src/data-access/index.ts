import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { State } from "../state.js";
import { registerConnect } from "./connect.js";
import { registerListDatabases } from "./list-databases.js";
import { registerListCollections } from "./list-collections.js";
import { registerIndexesTools } from "./indexes.js";
import { registerCollectionSchema } from "./collection-schema.js";
import { registerDocumentsTools } from "./documents.js";

export function registerDataAccessEndpoints(server: McpServer, globalState: State) {
    registerConnect(server, globalState);
    registerListDatabases(server, globalState);
    registerListCollections(server, globalState);
    registerIndexesTools(server, globalState);
    registerCollectionSchema(server, globalState);
    registerDocumentsTools(server, globalState);
}
