import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { shellExecTool } from "../../../src/chat/tools/shell_exec";

describe("shell_exec tool", () => {
    let tmp: string;
    beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "helix-sh-")); });
    afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    it("requires approval and is marked as mutating", () => {
        expect(shellExecTool.requiresApproval).toBe(true);
        expect(shellExecTool.mutatesFiles).toBe(true);
    });

    it("executes a benign command and returns its output", async () => {
        const result = await shellExecTool.execute({ command: "echo hello-helix" }, { cwd: tmp });
        expect(result.success).toBe(true);
        expect(result.output).toContain("hello-helix");
    });

    it("rejects empty command", async () => {
        const result = await shellExecTool.execute({ command: "   " }, { cwd: tmp });
        expect(result.success).toBe(false);
    });

    it("blocks dangerous patterns like rm -rf /", async () => {
        const result = await shellExecTool.execute({ command: "rm -rf /" }, { cwd: tmp });
        expect(result.success).toBe(false);
        expect(result.error).toContain("Refused");
    });

    it("captures non-zero exit code as failure", async () => {
        const result = await shellExecTool.execute({ command: "exit 2" }, { cwd: tmp });
        expect(result.success).toBe(false);
        expect(result.output).toContain("exit=2");
    });
});
