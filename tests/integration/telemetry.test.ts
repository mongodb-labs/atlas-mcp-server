import { createHmac } from "crypto";
import { machineId } from "node-machine-id";
import { Telemetry } from "../../src/telemetry/telemetry.js";
import { Session } from "../../src/session.js";

describe("Telemetry", () => {
    it("should resolve the actual machine ID", async () => {
        const actualId = await machineId(true);
        // Should be a UUID
        expect(actualId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        const actualHashedId = createHmac("sha256", actualId.toUpperCase()).update("atlascli").digest("hex");

        const telemetry = Telemetry.create(
            new Session({
                apiBaseUrl: "",
            })
        );

        expect(telemetry.getCommonProperties().device_id).toBe(undefined);
        expect(telemetry["isBufferingEvents"]).toBe(true);

        await telemetry.deviceIdPromise;

        expect(telemetry.getCommonProperties().device_id).toBe(actualHashedId);
        expect(telemetry["isBufferingEvents"]).toBe(false);
    });
});
