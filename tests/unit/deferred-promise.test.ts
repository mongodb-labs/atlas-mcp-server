import { DeferredPromise } from "../../src/deferred-promise.js";

describe("DeferredPromise", () => {
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
        const deferred = new DeferredPromise<string>(() => {
            // Do not resolve or reject
        }, 10);

        await expect(deferred).rejects.toThrow("Promise timed out");
    });

    it("should clear the timeout when resolved", async () => {
        jest.useFakeTimers();

        const deferred = new DeferredPromise<string>((resolve) => {
            setTimeout(() => resolve("resolved value"), 100);
        }, 200);

        const promise = deferred.then((value) => {
            expect(value).toBe("resolved value");
        });

        jest.advanceTimersByTime(100);
        await promise;

        jest.useRealTimers();
    });

    it("should clear the timeout when rejected", async () => {
        jest.useFakeTimers();

        const deferred = new DeferredPromise<string>((_, reject) => {
            setTimeout(() => reject(new Error("rejected error")), 100);
        }, 200);

        const promise = deferred.catch((error) => {
            expect(error).toEqual(new Error("rejected error"));
        });

        jest.advanceTimersByTime(100);
        await promise;

        jest.useRealTimers();
    });
});
