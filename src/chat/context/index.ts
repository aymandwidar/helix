/**
 * Context manager: bundles project detection, HELIX.md loading, and history.
 */

import { ProjectInfo, detectProject, summarizeProject } from "./project";
import { HelixMd, loadHelixMd } from "./helix_md";
import { ConversationHistory } from "./history";
import { OpenRouterMessage } from "../../openrouter";

export interface ChatContextOptions {
    cwd?: string;
    extraDirs?: string[];
}

export interface ChatContextSummary {
    project: ProjectInfo;
    helixMd: HelixMd | null;
    extraDirs: string[];
    historySize: number;
}

export class ChatContext {
    public readonly cwd: string;
    public readonly project: ProjectInfo;
    public readonly helixMd: HelixMd | null;
    public readonly extraDirs: string[];
    public readonly history: ConversationHistory;

    constructor(options: ChatContextOptions = {}) {
        this.cwd = options.cwd || process.cwd();
        this.project = detectProject(this.cwd);
        this.helixMd = loadHelixMd(this.cwd);
        this.extraDirs = options.extraDirs || [];
        this.history = new ConversationHistory();
        this.history.setSystem(this.buildSystemPrompt());
    }

    summary(): ChatContextSummary {
        return {
            project: this.project,
            helixMd: this.helixMd,
            extraDirs: this.extraDirs,
            historySize: this.history.size(),
        };
    }

    /** Refresh the system prompt — useful after project state changes. */
    refresh(): void {
        this.history.setSystem(this.buildSystemPrompt());
    }

    private buildSystemPrompt(): string {
        const parts: string[] = [
            "You are Helix, an interactive AI development agent embedded in the user's terminal.",
            "You help users design, generate, evolve, and deploy full-stack applications using the Helix platform.",
            "You have access to a set of tools (file_read, file_write, file_edit, shell_exec, web_fetch, list_dir, search_files, spawn_app, evolve_app, deploy_app).",
            "Guidelines:",
            "- Prefer reading and exploring before suggesting changes.",
            "- For destructive actions (file_write, file_edit, shell_exec, deploy_app), the user will see a confirmation prompt — explain what you are about to do.",
            "- When responding without using tools, reply in concise Markdown suitable for terminal rendering.",
            "- If you don't know something, say so and ask before guessing.",
            "",
            "## Project context",
            summarizeProject(this.project),
        ];

        if (this.helixMd) {
            parts.push("", `## ${this.helixMd.path}`, this.helixMd.content.trim());
        }
        if (this.extraDirs.length > 0) {
            parts.push("", "## Additional include directories", this.extraDirs.join(", "));
        }
        return parts.join("\n");
    }

    pushUser(content: string): void {
        this.history.push({ role: "user", content });
    }

    messages(): OpenRouterMessage[] {
        return this.history.getAll();
    }
}
