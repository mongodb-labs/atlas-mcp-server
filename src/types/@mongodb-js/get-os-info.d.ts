declare module '@mongodb-js/get-os-info' {
    export function getOsInfo(): Promise<{
        platform: string;
        arch: string;
        version: string;
        release: string;
    }>;
}
