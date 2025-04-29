import { createHmac } from "crypto";
import nodeMachineId from "node-machine-id";
import { Telemetry } from "../../src/telemetry/telemetry.js";
import { Session } from "../../src/session.js";
import { config } from "../../src/config.js";

describe("Telemetry", () => {
    it("should resolve the actual machine ID", async () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const actualId: string = await nodeMachineId.machineId(true);
        const actualHashedId = createHmac("sha256", actualId.toUpperCase()).update("atlascli").digest("hex");

        const telemetry = Telemetry.create(
            new Session({
                apiBaseUrl: "",
            }),
            config
        );

        expect(telemetry.getCommonProperties().device_id).toBe(undefined);
        expect(telemetry["isBufferingEvents"]).toBe(true);

        await telemetry.deviceIdPromise;

        expect(telemetry.getCommonProperties().device_id).toBe(actualHashedId);
        expect(telemetry["isBufferingEvents"]).toBe(false);
    });
});
