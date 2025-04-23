import { ToolBase, ToolCategory } from "../tool.js";

export abstract class AtlasToolBase extends ToolBase {
    protected category: ToolCategory = "atlas";

    protected verifyAllowed(): boolean {
        if (!this.config.apiClientId || !this.config.apiClientSecret) {
            return false;
        }
        return super.verifyAllowed();
    }
}
