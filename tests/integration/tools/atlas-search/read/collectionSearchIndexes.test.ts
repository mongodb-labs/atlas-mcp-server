import { describeWithMongoDB } from "../../mongodb/mongodbHelpers.js";
import {
    databaseCollectionInvalidArgs,
    validateThrowsForInvalidArguments,
    validateToolMetadata,
    collectionWithSearchIndexParameters,
} from "../../../helpers.js";

describeWithMongoDB("collectionSearchIndexes tool", (integration) => {
    validateToolMetadata(
        integration,
        "collection-search-indexes",
        "Describe the search indexes for a collection",
        collectionWithSearchIndexParameters
    );
    validateThrowsForInvalidArguments(integration, "collection-search-indexes", databaseCollectionInvalidArgs);

    // Real tests to be added once search indexes are supported in test env.
});
