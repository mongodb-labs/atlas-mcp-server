import { DeferredPromise } from "../../src/helpers/deferred-promise.js";
import { jest } from "@jest/globals";

describe("DeferredPromise", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    it("should resolve with the correct value", async () => {
        const deferred = new DeferredPromise<string>((resolve) => {
            resolve("resolved value");
        });

        await expect(deferred).resolves.toEqual("resolved value");
    });

    it("should reject with the correct error", async () => {
        const deferred = new DeferredPromise<string>((_, reject) => {
            reject(new Error("rejected error"));
        });

        await expect(deferred).rejects.toThrow("rejected error");
    });

    it("should timeout if not resolved or rejected within the specified time", async () => {
        const deferred = new DeferredPromise<string>(
            () => {
                // Do not resolve or reject
            },
            { timeout: 100, onTimeout: (resolve, reject) => reject(new Error("Promise timed out")) }
        );

        jest.advanceTimersByTime(100);

        await expect(deferred).rejects.toThrow("Promise timed out");
    });

    it("should clear the timeout when resolved", async () => {
        const deferred = new DeferredPromise<string>(
            (resolve) => {
                setTimeout(() => resolve("resolved value"), 100);
            },
            { timeout: 200 }
        );

        const promise = deferred.then((value) => {
            expect(value).toBe("resolved value");
        });

        jest.advanceTimersByTime(100);
        await promise;
    });

    it("should clear the timeout when rejected", async () => {
        const deferred = new DeferredPromise<string>(
            (_, reject) => {
                setTimeout(() => reject(new Error("rejected error")), 100);
            },
            { timeout: 200, onTimeout: (resolve, reject) => reject(new Error("Promise timed out")) }
        );

        const promise = deferred.catch((error) => {
            expect(error).toEqual(new Error("rejected error"));
        });

        jest.advanceTimersByTime(100);
        await promise;
    });
});
