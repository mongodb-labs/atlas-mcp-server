import pkg from "../../package.json" with { type: "json" };
import config from "../config.js";
import { getMachineIdSync } from "native-machine-id";

/**
 * Machine-specific metadata formatted for telemetry
 */
export const MACHINE_METADATA = {
    device_id: getMachineIdSync(),
    mcp_server_version: pkg.version,
    mcp_server_name: config.mcpServerName,
    platform: process.platform,
    arch: process.arch,
    os_type: process.platform,
    os_version: process.version,
} as const;
