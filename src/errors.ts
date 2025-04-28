export enum ErrorCodes {
    NotConnectedToMongoDB = 1_000_000,
    InvalidParams = 1_000_001,
    CloseServiceProvider = 1_000_007,
    DeleteDatabaseUser = 1_000_008,
}

export class MongoDBError extends Error {
    constructor(
        public code: ErrorCodes,
        message: string
    ) {
        super(message);
    }
}
