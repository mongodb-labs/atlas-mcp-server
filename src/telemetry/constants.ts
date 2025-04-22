import pkg from "../../package.json" with { type: "json" };
import config from "../config.js";

/**
 * Machine-specific metadata formatted for telemetry
 */
export const MACHINE_METADATA = Object.freeze({
    device_id: "id", // TODO: use @mongodb-js/machine-id
    mcp_server_version: pkg.version,
    mcp_server_name: config.mcpServerName,
    platform: process.platform,
    arch: process.arch,
    os_type: process.platform,
    os_version: process.version,
});
