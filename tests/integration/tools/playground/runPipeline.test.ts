import { describeWithMongoDB } from "../mongodb/mongodbHelpers.js";
import { getResponseElements } from "../../helpers.js";

describeWithMongoDB("runPipeline tool", (integration) => {
    it("should return results", async () => {
        await integration.connectMcpClient();
        const response = await integration.mcpClient().callTool({
            name: "run-pipeline",
            arguments: {
                documents: [{ name: "First document" }, { name: "Second document" }],
                aggregationPipeline: [
                    {
                        $search: {
                            index: "default",
                            text: {
                                query: "first",
                                path: {
                                    wildcard: "*",
                                },
                            },
                        },
                    },
                    {
                        $project: {
                            _id: 0,
                            name: 1,
                        },
                    },
                ],
            },
        });
        const elements = getResponseElements(response.content);
        expect(elements).toEqual([
            {
                text: 'Found 1 documents":',
                type: "text",
            },
            {
                text: '{"name":"First document"}',
                type: "text",
            },
        ]);
    });
});
