import { ToolBase, ToolCategory } from "../tool.js";
import { Session } from "../../session.js";
import config from "../../config.js";

export abstract class AtlasToolBase extends ToolBase {
    constructor(protected readonly session: Session) {
        super(session);
    }

    protected category: ToolCategory = "atlas";

    protected verifyAllowed(): boolean {
        if (!config.apiClientId || !config.apiClientSecret) {
            return false;
        }
        return super.verifyAllowed();
    }
}
