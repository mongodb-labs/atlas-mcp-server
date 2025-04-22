import { ListClustersTool } from "./listClusters.js";
import { ListProjectsTool } from "./listProjects.js";
import { InspectClusterTool } from "./inspectCluster.js";
import { CreateFreeClusterTool } from "./createFreeCluster.js";
import { CreateAccessListTool } from "./createAccessList.js";
import { InspectAccessListTool } from "./inspectAccessList.js";
import { ListDBUsersTool } from "./listDBUsers.js";
import { CreateDBUserTool } from "./createDBUser.js";
import { CreateProjectTool } from "./createProject.js";

export const AtlasTools = [
    ListClustersTool,
    ListProjectsTool,
    InspectClusterTool,
    CreateFreeClusterTool,
    CreateAccessListTool,
    InspectAccessListTool,
    ListDBUsersTool,
    CreateDBUserTool,
    CreateProjectTool,
];
