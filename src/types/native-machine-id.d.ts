/**
 * Type definitions for native-machine-id
 * Provides functionality to retrieve the machine ID of the current device.
 */

declare module "native-machine-id" {
    /**
     * Gets the machine ID synchronously.
     * @returns A string containing the machine ID.
     */
    export function getMachineIdSync(): string;

    /**
     * Gets the machine ID asynchronously.
     * @returns A Promise that resolves to a string containing the machine ID.
     */
    export function getMachineId(): Promise<string>;

    /**
     * Gets a machine ID that is based on the original ID but is "hashed" for privacy.
     * @param {string} [original] - The original ID to hash. If not provided, gets the machine ID first.
     * @param {string} [type='md5'] - The hashing algorithm to use.
     * @returns A Promise that resolves to a string containing the hashed machine ID.
     */
    export function machineIdSync(original?: string, type?: string): string;

    /**
     * Gets a machine ID that is based on the original ID but is "hashed" for privacy.
     * @param {string} [original] - The original ID to hash. If not provided, gets the machine ID first.
     * @param {string} [type='md5'] - The hashing algorithm to use.
     * @returns A Promise that resolves to a string containing the hashed machine ID.
     */
    export function machineId(original?: string, type?: string): Promise<string>;
}
