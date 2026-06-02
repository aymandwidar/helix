#!/usr/bin/env node

/**
 * Background worker entry point. Forked by `helix bg <prompt>` via
 * src/bg/daemon.ts. This script never runs commander; it just executes one
 * agent turn against the spec stored in HELIX_BG_* env vars and writes its
 * own state to ~/.helix/bg/<id>/.
 *
 * Kept as a separate file so it doesn't share any of the commander / CLI
 * boot path with `helix.ts`.
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();
if (!process.env.OPENROUTER_API_KEY) {
    const installDirEnv = path.resolve(__dirname, "..", "..", ".env");
    if (fs.existsSync(installDirEnv)) {
        dotenv.config({ path: installDirEnv });
    }
}

(async () => {
    try {
        const { runWorker } = await import("../bg/daemon");
        await runWorker();
        process.exit(0);
    } catch (err: any) {
        // Last-ditch: dump to a file so the user can see what went wrong.
        const id = process.env.HELIX_BG_ID || "unknown";
        try {
            const { appendOutput, updateMeta, writeResult } = await import("../bg/store");
            appendOutput(id, `worker crashed: ${err?.message || err}`);
            writeResult(id, { finalText: "", iterations: 0, toolCalls: 0, error: err?.message || String(err) });
            updateMeta(id, { state: "failed", finishedAt: new Date().toISOString() });
        } catch { /* already lost */ }
        process.exit(1);
    }
})();
