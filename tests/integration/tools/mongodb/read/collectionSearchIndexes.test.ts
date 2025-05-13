import { describeWithMongoDB } from "../mongodbHelpers.js";

import {
    databaseCollectionParameters,
    databaseCollectionInvalidArgs,
    validateThrowsForInvalidArguments,
    validateToolMetadata,
} from "../../../helpers.js";

describeWithMongoDB("collectionSearchIndexes tool", (integration) => {
    validateToolMetadata(
        integration,
        "collection-search-indexes",
        "Describe the search indexes for a collection",
        databaseCollectionParameters
    );
    validateThrowsForInvalidArguments(integration, "collection-search-indexes", databaseCollectionInvalidArgs);

    // Real tests to be added once search indexes are supported in test env.
});
