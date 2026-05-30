/**
 * Deploy adapters — Sprint 12.
 *
 * Single dispatch entry point used by both legacy `deploy()` and the new
 * `helix deploy --vercel|--netlify|--railway` flags. Each adapter is a thin
 * wrapper over the platform CLI; missing-CLI is reported as a clean failure
 * rather than a thrown exception.
 */

import { DeployContext, DeployResult, DeployTarget } from "./types";
import { deployToVercel } from "./vercel";
import { deployToNetlify } from "./netlify";
import { deployToRailway } from "./railway";

export async function runDeploy(target: DeployTarget, ctx: DeployContext): Promise<DeployResult> {
    switch (target) {
        case "vercel":  return deployToVercel(ctx);
        case "netlify": return deployToNetlify(ctx);
        case "railway": return deployToRailway(ctx);
    }
}

export type { DeployContext, DeployResult, DeployTarget } from "./types";
export { deployToVercel } from "./vercel";
export { deployToNetlify } from "./netlify";
export { deployToRailway } from "./railway";
