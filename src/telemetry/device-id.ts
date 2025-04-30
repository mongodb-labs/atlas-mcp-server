import { createHmac } from "crypto";
import nodeMachineId from "node-machine-id";
import logger, { LogId } from "../logger.js";

export function getDeviceId(): string {
    try {
        const originalId = nodeMachineId.machineIdSync(true);
        // Create a hashed format from the all uppercase version of the machine ID
        // to match it exactly with the denisbrodbeck/machineid library that Atlas CLI uses.
        const hmac = createHmac("sha256", originalId.toUpperCase());

        /** This matches the message used to create the hashes in Atlas CLI */
        const DEVICE_ID_HASH_MESSAGE = "atlascli";

        hmac.update(DEVICE_ID_HASH_MESSAGE);
        return hmac.digest("hex");
    } catch (error) {
        logger.debug(LogId.telemetryDeviceIdFailure, "telemetry", String(error));
        return "unknown";
    }
}
