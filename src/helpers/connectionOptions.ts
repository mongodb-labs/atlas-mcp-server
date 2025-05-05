import { MongoClientOptions } from "mongodb";
import ConnectionString from "mongodb-connection-string-url";
import { isAtlas } from "mongodb-build-info";

export function setAppNameParamIfMissing({
    connectionString,
    defaultAppName,
    telemetryAnonymousId,
}: {
    connectionString: string;
    defaultAppName?: string;
    telemetryAnonymousId?: string;
}): string {
    const connectionStringUrl = new ConnectionString(connectionString);

    const searchParams = connectionStringUrl.typedSearchParams<MongoClientOptions>();

    if (!searchParams.has("appName") && defaultAppName !== undefined) {
        const appName = isAtlas(connectionString)
            ? `${defaultAppName}${telemetryAnonymousId ? `-${telemetryAnonymousId}` : ""}`
            : defaultAppName;

        searchParams.set("appName", appName);
    }

    return connectionStringUrl.toString();
}
