import { ToolBase, ToolCategory } from "../tool.js";
import { Session } from "../../session.js";
import config from "../../config.js";
import { Telemetry } from "../../telemetry/telemetry.js";

export abstract class AtlasToolBase extends ToolBase {
    constructor(
        protected readonly session: Session,
        telemetry: Telemetry
    ) {
        super(session, telemetry);
    }

    protected category: ToolCategory = "atlas";

    protected verifyAllowed(): boolean {
        if (!config.apiClientId || !config.apiClientSecret) {
            return false;
        }
        return super.verifyAllowed();
    }
}
